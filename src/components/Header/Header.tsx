import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMapStore } from '../../store/mapStore'
import { useWeatherStore } from '../../store/weatherStore'
import { useAuthStore } from '../../store/authStore'
import { formatCoords, cn } from '../../lib/utils'
import { requestPasswordReset, resendVerificationCode, deactivateAccount, cancelSubscription, createCheckoutSession, createPortalSession } from '../../lib/apiClient'
import SearchBar from './SearchBar'
import ContactModal from '../ui/ContactModal'

interface HeaderProps {
  onSettingsClick?: () => void
}

// ── Account Modal ──────────────────────────────────────────────────────────

function AccountModal({ user, onLogout, onClose }: {
  user: { email: string; displayName?: string; avatarUrl?: string; emailVerified?: boolean; isPremium?: boolean; subscriptionRenewDate?: string | null; subscriptionExpiresAt?: string | null }
  onLogout: () => void
  onClose: () => void
}) {
  const [verifySending, setVerifySending] = useState(false)
  const [verifySent, setVerifySent] = useState(false)
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resetMsg, setResetMsg] = useState('')
  const [deactivateStep, setDeactivateStep] = useState<'idle' | 'confirm' | 'processing' | 'done'>('idle')
  const [cancelState, setCancelState] = useState<'idle' | 'confirm' | 'cancelling' | 'done'>('idle')
  const [contactOpen, setContactOpen] = useState(false)
  const checkAuth = useAuthStore((s) => s.checkAuth)

  const initials = (user.displayName || user.email)
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('')

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto py-8">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-ocean-900 border border-ocean-700 rounded-2xl shadow-2xl w-96 max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ocean-700 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-200">Account</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Profile */}
          <div className="flex items-center gap-4 bg-ocean-800/60 rounded-xl p-4 border border-ocean-700/50">
            <div className="w-14 h-14 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-cyan-400">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              {user.displayName && <p className="text-sm font-semibold text-slate-200 truncate">{user.displayName}</p>}
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Subscription section */}
          {user.isPremium ? (
            <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-ocean-800/80 to-cyan-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-200">Premium Member</p>

                  {/* Show expiration date if cancelled, otherwise show renewal date */}
                  {user.subscriptionExpiresAt ? (
                    <p className="text-xs text-amber-400 mt-1">
                      Subscription expires on{' '}
                      <span className="font-medium">
                        {new Date(user.subscriptionExpiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </p>
                  ) : user.subscriptionRenewDate ? (
                    <p className="text-xs text-slate-400 mt-1">
                      Subscription renews on{' '}
                      <span className="text-slate-300 font-medium">
                        {new Date(user.subscriptionRenewDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">Active subscription</p>
                  )}

                  {/* Manage billing via Stripe Portal */}
                  <button
                    onClick={async () => {
                      try {
                        const { url } = await createPortalSession()
                        if (url) window.location.href = url
                      } catch { /* no portal available */ }
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors mt-2 underline underline-offset-2"
                  >
                    Manage billing
                  </button>

                  {/* Downgrade — only show if not already cancelled */}
                  {!user.subscriptionExpiresAt && cancelState === 'idle' && (
                    <button
                      onClick={() => setCancelState('confirm')}
                      className="text-[10px] text-slate-600 hover:text-red-400 transition-colors mt-1 underline underline-offset-2"
                    >
                      Cancel auto-renew
                    </button>
                  )}
                  {cancelState === 'confirm' && (
                    <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
                      <p className="text-xs text-slate-400">Your premium access will remain active until the end of your current billing period. After that, your account will revert to the free plan. Are you sure?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setCancelState('idle')} className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-ocean-800 text-slate-400 hover:text-slate-200 hover:bg-ocean-700 border border-ocean-700 transition-all">
                          Keep Premium
                        </button>
                        <button
                          onClick={async () => {
                            setCancelState('cancelling')
                            try {
                              await cancelSubscription()
                              setCancelState('done')
                              checkAuth()
                            } catch { setCancelState('idle') }
                          }}
                          className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 transition-all"
                        >
                          Downgrade
                        </button>
                      </div>
                    </div>
                  )}
                  {cancelState === 'cancelling' && (
                    <div className="mt-3 text-center">
                      <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
                    </div>
                  )}
                  {cancelState === 'done' && (
                    <p className="text-xs text-amber-400 mt-2">Subscription cancelled. You'll keep premium access until the end of your billing period.</p>
                  )}
                </div>
              </div>
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-emerald-500/10 blur-2xl" />
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-ocean-800/80 to-cyan-500/10 p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-200">Upgrade to Premium</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Unlimited spot imports, advanced radar, trip logging, and priority satellite data.
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        const { url } = await createCheckoutSession()
                        if (url) window.location.href = url
                      } catch { /* fallback */ }
                    }}
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Upgrade Now
                  </button>
                </div>
              </div>
              <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-500/10 blur-2xl" />
            </div>
          )}

          {/* Email verification */}
          {!user.emailVerified && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span className="text-xs font-semibold text-amber-300">Email not verified</span>
              </div>
              <p className="text-xs text-slate-400 mb-3">Check your inbox for a verification link, or request a new one.</p>
              <button
                onClick={async () => {
                  setVerifySending(true)
                  try { await resendVerificationCode(); setVerifySent(true) } catch { /* */ }
                  setVerifySending(false)
                }}
                disabled={verifySending || verifySent}
                className={cn(
                  'w-full py-2 rounded-lg text-xs font-semibold transition-all',
                  verifySent
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-cyan-500 text-white hover:bg-cyan-400',
                )}
              >
                {verifySending ? 'Sending...' : verifySent ? 'Verification email sent!' : 'Resend Verification Email'}
              </button>
            </div>
          )}

          {/* Security */}
          <div className="border-t border-ocean-700 pt-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Security</h3>
            {resetState === 'idle' ? (
              <button
                onClick={async () => {
                  setResetState('sending')
                  try {
                    await requestPasswordReset(user.email)
                    setResetState('sent')
                    setResetMsg('Reset code sent to ' + user.email)
                  } catch (e: any) {
                    setResetState('error')
                    setResetMsg(e.message || 'Failed to send reset email')
                  }
                }}
                className="w-full py-2 rounded-lg text-xs font-semibold bg-ocean-800 text-slate-400 hover:text-slate-200 hover:bg-ocean-700 transition-all border border-ocean-700"
              >
                Reset Password
              </button>
            ) : resetState === 'sending' ? (
              <div className="text-center py-2">
                <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : (
              <div className={cn(
                'rounded-lg p-3 border',
                resetState === 'sent' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20',
              )}>
                <p className={cn('text-xs', resetState === 'sent' ? 'text-emerald-400' : 'text-red-400')}>{resetMsg}</p>
                <button onClick={() => setResetState('idle')} className="text-[10px] text-slate-500 hover:text-slate-300 underline mt-1">
                  {resetState === 'sent' ? 'Done' : 'Try again'}
                </button>
              </div>
            )}
          </div>

          {/* Sign out */}
          <div className="border-t border-ocean-700 pt-4">
            <button
              onClick={() => { onClose(); onLogout() }}
              className="w-full py-2 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 transition-all"
            >
              Sign Out
            </button>
          </div>

          {/* Contact */}
          <div className="border-t border-ocean-700 pt-4 pb-2">
            <button
              onClick={() => setContactOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-slate-400 hover:text-cyan-400 hover:bg-ocean-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Us
            </button>
            <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
          </div>

          {/* Delete account */}
          <div className="border-t border-ocean-700 pt-4">
            {deactivateStep === 'idle' && (
              <button
                onClick={() => setDeactivateStep('confirm')}
                className="w-full py-2 rounded-lg text-xs text-slate-600 hover:text-red-400 transition-colors"
              >
                Delete Account
              </button>
            )}
            {deactivateStep === 'confirm' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span className="text-xs font-semibold text-red-300">Are you sure?</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your account will be deactivated. You can reactivate it anytime by signing up again with the same email.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setDeactivateStep('idle')} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-ocean-800 text-slate-400 hover:text-slate-200 hover:bg-ocean-700 border border-ocean-700 transition-all">
                    Keep Account
                  </button>
                  <button
                    onClick={async () => {
                      setDeactivateStep('processing')
                      try {
                        await deactivateAccount()
                        setDeactivateStep('done')
                        setTimeout(() => { onClose(); onLogout() }, 2000)
                      } catch { setDeactivateStep('idle') }
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 transition-all"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            )}
            {deactivateStep === 'processing' && (
              <div className="text-center py-4">
                <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 mt-2">Deactivating account...</p>
              </div>
            )}
            {deactivateStep === 'done' && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                <p className="text-xs text-emerald-400 font-semibold">Account deactivated</p>
                <p className="text-xs text-slate-500 mt-1">Check your email for a goodbye message. Signing out...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function UserButton({ user, onLogout }: {
  user: { email: string; displayName?: string; avatarUrl?: string; emailVerified?: boolean; isPremium?: boolean }
  onLogout: () => void
}) {
  const [showAccount, setShowAccount] = useState(false)
  const initials = (user.displayName || user.email)
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('')

  return (
    <>
      <button
        onClick={() => setShowAccount(true)}
        className="flex items-center gap-1.5 glass rounded-xl px-2.5 py-1.5 hover:bg-ocean-700/80 transition-colors"
      >
        <div className="relative w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
          <span className="text-[10px] font-bold text-cyan-400">{initials}</span>
          {user.isPremium && (
            <svg className="absolute -top-1 -right-1 w-2.5 h-2.5 text-amber-400 drop-shadow sm:hidden" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          )}
        </div>
        <span className="relative text-xs text-slate-300 max-w-24 truncate hidden sm:block">
          {user.displayName || user.email}
          {user.isPremium && (
            <svg className="absolute -top-1.5 -right-3 w-3 h-3 text-amber-400 drop-shadow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          )}
        </span>
      </button>
      {showAccount && createPortal(
        <AccountModal user={user} onLogout={onLogout} onClose={() => setShowAccount(false)} />,
        document.body,
      )}
    </>
  )
}

export default function Header({ onSettingsClick }: HeaderProps) {
  const { cursorCoords, sidebarOpen, setSidebarOpen } = useMapStore()
  const { panelOpen: weatherOpen, setPanelOpen: setWeatherOpen } = useWeatherStore()
  const { user, setShowAuthModal, logout } = useAuthStore()
  const setFlyToTarget = useMapStore((s) => s.setFlyToTarget)

  const handleSearchSelect = useCallback((lat: number, lng: number, _label: string) => {
    setFlyToTarget({ lat, lng, zoom: 10 })
  }, [setFlyToTarget])

  return (
    <header className="relative z-30 flex items-center justify-between gap-2 md:gap-3 px-2 md:px-4 h-14 border-b border-ocean-700 bg-ocean-900/95 backdrop-blur-md flex-shrink-0">
      {/* Left: logo */}
      <div className="flex items-center gap-3">
        {/* Logo */}
        <button onClick={() => window.location.reload()} className="flex items-center gap-2.5 cursor-pointer bg-transparent border-none p-0">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.3"/>
              {/* Fish shape */}
              <ellipse cx="10" cy="12" rx="5" ry="3" />
              <path d="M15 12 l4-3 l0 6 z" />
              <circle cx="8" cy="11.5" r="0.8" fill="#040c18"/>
            </svg>
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-slate-100 leading-tight tracking-tight">ReelMaps</div>
            <div className="text-xs text-slate-500 leading-tight hidden sm:block">AI-Powered Fishing Intelligence</div>
          </div>
        </button>
      </div>

      {/* Center: Search */}
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-center">
        <SearchBar onSelect={handleSearchSelect} />
      </div>

      {/* Right: coordinates + status */}
      <div className="flex items-center gap-3">
        {/* Cursor coordinates */}
        <div className="hidden md:flex items-center gap-1.5 glass rounded-xl px-3 py-1.5 min-w-52">
          <svg className="w-3 h-3 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {cursorCoords
              ? formatCoords(cursorCoords.lat, cursorCoords.lng)
              : '—'}
          </span>
        </div>

        {/* Live data indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>NOAA Live</span>
        </div>

        {/* Settings gear */}
        <button
          onClick={onSettingsClick}
          className="p-2.5 md:p-1.5 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors"
          title="Settings"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* User / Login button */}
        {user ? (
          <UserButton user={user} onLogout={logout} />
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs font-medium text-cyan-400 hover:bg-cyan-500/25 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Login
          </button>
        )}
      </div>
    </header>
  )
}
