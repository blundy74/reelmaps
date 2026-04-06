/**
 * Settings modal — 3 tabs: Account, Marine, Preferences.
 * All preferences are saved to the user_preferences table when logged in,
 * or to local Zustand persist when not logged in.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWeatherStore } from '../../store/weatherStore'
import { useAuthStore } from '../../store/authStore'
import { useMapStore } from '../../store/mapStore'
import { savePreferences, getPreferences, requestPasswordReset, resendVerificationCode, deactivateAccount, createCheckoutSession } from '../../lib/apiClient'
import { cn } from '../../lib/utils'
import type { BasemapId } from '../../types'
import MarineConditions from './MarineConditions'
import TideChart from './TideChart'
import type { UnitSystem } from '../../lib/units'

const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'imperial', label: 'Imperial' },
  { value: 'metric', label: 'Metric' },
  { value: 'nautical', label: 'Nautical' },
]

const BASEMAP_OPTIONS = [
  { id: 'dark' as BasemapId, label: 'Dark Ocean', color: '#040c18' },
  { id: 'satellite' as BasemapId, label: 'Satellite', color: '#2d6a2d' },
  { id: 'nautical' as BasemapId, label: 'Nautical', color: '#0a3060' },
  { id: 'light' as BasemapId, label: 'Light', color: '#d0e8f8' },
]

const TABS = [
  { id: 'marine' as const, label: 'Marine' },
  { id: 'overlays' as const, label: 'Preferences' },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: Props) {
  const {
    tab, setTab, marine, loading,
    playbackSpeed, setPlaybackSpeed,
    location, unitSystem, setUnitSystem,
    homePort, setHomePort,
    defaultOverlayOpacity, setDefaultOverlayOpacity,
  } = useWeatherStore()
  const { basemap, setBasemap } = useMapStore()
  const { user, logout, setShowAuthModal, setAuthMode } = useAuthStore()

  // Auto-select first tab when modal opens
  useEffect(() => {
    if (open && !TABS.some(t => t.id === tab)) {
      setTab(TABS[0].id)
    }
  }, [open, tab, setTab])

  // Save preferences to API whenever they change (debounced)
  const persistPreferences = useCallback(async () => {
    if (!user) return
    try {
      await savePreferences({
        units: unitSystem,
        defaultBasemap: basemap,
        theme: 'dark',
      })
    } catch { /* silent — local state is the source of truth */ }
  }, [user, unitSystem, basemap])

  // Load preferences from API on open (if logged in)
  useEffect(() => {
    if (!open || !user) return
    getPreferences().then((prefs) => {
      if (prefs.units) setUnitSystem(prefs.units as UnitSystem)
      if (prefs.defaultBasemap) setBasemap(prefs.defaultBasemap as BasemapId)
    }).catch(() => {})
  }, [open, user])

  if (!open) return null

  // Wrapper that saves to API after changing a preference
  const handleUnitChange = (u: UnitSystem) => { setUnitSystem(u); setTimeout(persistPreferences, 100) }
  const handleBasemapChange = (id: BasemapId) => { setBasemap(id); setTimeout(persistPreferences, 100) }
  const handlePlaybackChange = (v: number) => { setPlaybackSpeed(v) }
  const handleOpacityChange = (v: number) => { setDefaultOverlayOpacity(v) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 max-h-[80vh] bg-ocean-900 border border-ocean-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ocean-700 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-200">Settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-ocean-700 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors',
                tab === t.id
                  ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Marine tab ──────────────────────────────────────── */}
          {tab === 'marine' && (
            <MarineTab
              homePort={homePort}
              setHomePort={setHomePort}
              marine={marine}
              location={location}
              loading={loading}
            />
          )}

          {/* ── Preferences tab ─────────────────────────────────── */}
          {tab === 'overlays' && (
            <div className="space-y-5">
              {/* Default Basemap */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Default Basemap
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {BASEMAP_OPTIONS.map((bm) => (
                    <button
                      key={bm.id}
                      onClick={() => handleBasemapChange(bm.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all',
                        basemap === bm.id
                          ? 'border-cyan-500/60 bg-cyan-500/10'
                          : 'border-ocean-700 hover:border-ocean-500 hover:bg-ocean-800/50',
                      )}
                    >
                      <div
                        className="w-8 h-8 rounded-md border border-ocean-600"
                        style={{ background: bm.color }}
                      />
                      <span className={cn(
                        'text-[10px] font-medium',
                        basemap === bm.id ? 'text-cyan-400' : 'text-slate-500',
                      )}>
                        {bm.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Forecast Playback Speed */}
              <div className="border-t border-ocean-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Forecast Playback Speed
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-10">Slow</span>
                  <input
                    type="range" min="0.25" max="3" step="0.25"
                    value={playbackSpeed}
                    onChange={(e) => handlePlaybackChange(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-ocean-600 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-cyan-400"
                  />
                  <span className="text-xs text-slate-500 w-10 text-right">Fast</span>
                </div>
                <p className="text-xs text-slate-500 text-center mt-1">{playbackSpeed.toFixed(1)}s per hour</p>
              </div>

              {/* Weather Overlay Transparency */}
              <div className="border-t border-ocean-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Weather Overlay Transparency
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-16">Transparent</span>
                  <input
                    type="range" min="0.1" max="1" step="0.05"
                    value={defaultOverlayOpacity}
                    onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 bg-ocean-600 rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-cyan-400"
                  />
                  <span className="text-xs text-slate-500 w-12 text-right">Opaque</span>
                </div>
                <p className="text-xs text-slate-500 text-center mt-1">{Math.round(defaultOverlayOpacity * 100)}%</p>
              </div>

              {/* Unit System */}
              <div className="border-t border-ocean-700 pt-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Units
                </h3>
                <div className="flex rounded-lg bg-ocean-800 p-1">
                  {UNIT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleUnitChange(opt.value)}
                      className={cn(
                        'flex-1 text-xs font-semibold py-1.5 rounded-md transition-all',
                        unitSystem === opt.value
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                          : 'text-slate-500 hover:text-slate-300',
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save indicator for logged-in users */}
              {user && (
                <p className="text-[10px] text-slate-600 text-center pt-2">
                  Preferences are saved to your account automatically.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Account sub-component ──────────────────────────────────────────────────

function DeleteAccountSection({ onLogout }: { onLogout: () => void }) {
  const [step, setStep] = useState<'idle' | 'confirm' | 'processing' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  if (step === 'idle') {
    return (
      <div className="border-t border-ocean-700 pt-4">
        <button
          onClick={() => setStep('confirm')}
          className="w-full py-2 rounded-lg text-xs text-slate-600 hover:text-red-400 transition-colors"
        >
          Delete Account
        </button>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div className="border-t border-ocean-700 pt-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs font-semibold text-red-300">Are you sure?</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your account will be deactivated. You can reactivate it anytime by contacting us.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStep('idle')}
              className="flex-1 py-2 rounded-lg text-xs font-semibold bg-ocean-800 text-slate-400 hover:text-slate-200 hover:bg-ocean-700 border border-ocean-700 transition-all"
            >
              Keep Account
            </button>
            <button
              onClick={async () => {
                setStep('processing')
                try {
                  await deactivateAccount()
                  setStep('done')
                  setTimeout(() => onLogout(), 2000)
                } catch (err: any) {
                  setErrorMsg(err.message || 'Failed to deactivate')
                  setStep('error')
                }
              }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 transition-all"
            >
              Delete Account
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'processing') {
    return (
      <div className="border-t border-ocean-700 pt-4 text-center py-4">
        <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 mt-2">Deactivating account...</p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="border-t border-ocean-700 pt-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
          <p className="text-xs text-emerald-400 font-semibold">Account deactivated</p>
          <p className="text-xs text-slate-500 mt-1">Check your email for a goodbye message. Signing out...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-ocean-700 pt-4">
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
        <p className="text-xs text-red-400">{errorMsg}</p>
        <button onClick={() => setStep('idle')} className="text-xs text-slate-500 hover:text-slate-300 underline mt-1">
          Go back
        </button>
      </div>
    </div>
  )
}

function AccountTab({ user, onLogout, onLogin, onRegister }: {
  user: { email: string; displayName?: string; avatarUrl?: string; emailVerified?: boolean } | null
  onLogout: () => void
  onLogin: () => void
  onRegister: () => void
}) {
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resetMsg, setResetMsg] = useState('')
  const [verifySending, setVerifySending] = useState(false)
  const [verifySent, setVerifySent] = useState(false)

  if (!user) {
    return (
      <div className="flex flex-col items-center py-8 space-y-5">
        <div className="w-16 h-16 rounded-full bg-ocean-800 border border-ocean-600 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm text-slate-300 font-medium">Not signed in</p>
          <p className="text-xs text-slate-500 mt-1">
            Sign in to save your settings, home port, and fishing spots across devices.
          </p>
        </div>
        <div className="flex gap-3 w-full max-w-xs">
          <button onClick={onLogin} className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-cyan-500 text-white hover:bg-cyan-400 transition-all">
            Sign In
          </button>
          <button onClick={onRegister} className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-ocean-700 text-slate-300 hover:bg-ocean-600 transition-all border border-ocean-600">
            Register
          </button>
        </div>

        {/* Premium upsell for non-logged-in users */}
        <div className="w-full max-w-xs border-t border-ocean-700 pt-4 mt-2">
          <a
            href="https://buy.stripe.com/6oUaEW3033Ak4Mi32D8AE01"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-400 hover:to-amber-500 transition-all shadow-lg shadow-amber-500/20"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Get ReelMaps Premium
          </a>
        </div>
      </div>
    )
  }

  const initials = (user.displayName || user.email)
    .split(/[\s@]/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('')

  return (
    <div className="space-y-5">
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

      {/* Upgrade to Premium */}
      <div className="border-t border-ocean-700 pt-4">
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
                  } catch { /* ignore */ }
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
          {/* Decorative glow */}
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-amber-500/10 blur-2xl" />
        </div>
      </div>

      {/* Email verification */}
      {!user.emailVerified && (
        <div className="border-t border-ocean-700 pt-4">
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
                try {
                  await resendVerificationCode()
                  setVerifySent(true)
                } catch { /* ignore */ }
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
        </div>
      )}

      {/* Password reset */}
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
            <p className="text-xs text-slate-500 mt-2">Sending reset email...</p>
          </div>
        ) : (
          <div className={cn(
            'rounded-lg p-3 border space-y-1',
            resetState === 'sent' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20',
          )}>
            <p className={cn('text-xs', resetState === 'sent' ? 'text-emerald-400' : 'text-red-400')}>{resetMsg}</p>
            {resetState === 'sent' && (
              <p className="text-[10px] text-slate-500">Check your email for the reset code. Enter it when prompted.</p>
            )}
            <button onClick={() => setResetState('idle')} className="text-[10px] text-slate-500 hover:text-slate-300 underline mt-1">
              {resetState === 'sent' ? 'Done' : 'Try again'}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-ocean-700 pt-4">
        <button onClick={onLogout} className="w-full py-2 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 transition-all">
          Sign Out
        </button>
      </div>

      {/* Delete Account */}
      <DeleteAccountSection onLogout={onLogout} />
    </div>
  )
}

// ── Marine sub-component ───────────────────────────────────────────────────

function MarineTab({ homePort, setHomePort, marine, location, loading }: {
  homePort: { name: string; lat: number; lng: number } | null
  setHomePort: (port: { name: string; lat: number; lng: number } | null) => void
  marine: import('../../lib/weatherTypes').MarineData | null
  location: { lat: number; lng: number } | null
  loading: boolean
}) {
  const [editingPort, setEditingPort] = useState(false)
  const [portName, setPortName] = useState(homePort?.name ?? '')
  const [portLat, setPortLat] = useState(homePort?.lat?.toString() ?? '')
  const [portLng, setPortLng] = useState(homePort?.lng?.toString() ?? '')

  const savePort = () => {
    const lat = parseFloat(portLat)
    const lng = parseFloat(portLng)
    if (!portName.trim() || isNaN(lat) || isNaN(lng)) return
    setHomePort({ name: portName.trim(), lat, lng })
    setEditingPort(false)
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Home Port</h3>
        {homePort && !editingPort ? (
          <div className="bg-ocean-800/60 rounded-xl p-3 border border-ocean-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-200">{homePort.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {Math.abs(homePort.lat).toFixed(4)}&deg;{homePort.lat >= 0 ? 'N' : 'S'},{' '}
                  {Math.abs(homePort.lng).toFixed(4)}&deg;{homePort.lng >= 0 ? 'E' : 'W'}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => { setPortName(homePort.name); setPortLat(homePort.lat.toString()); setPortLng(homePort.lng.toString()); setEditingPort(true) }}
                  className="px-2.5 py-1 rounded-md text-[10px] font-medium text-slate-400 hover:text-slate-200 bg-ocean-700 hover:bg-ocean-600 transition-all">Edit</button>
                <button onClick={() => setHomePort(null)}
                  className="px-2.5 py-1 rounded-md text-[10px] font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/15 transition-all">Remove</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-ocean-800/60 rounded-xl p-4 border border-ocean-700/50 space-y-3">
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Port Name</label>
              <input type="text" value={portName} onChange={(e) => setPortName(e.target.value)} placeholder="e.g. Orange Beach Marina"
                className="w-full px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Latitude</label>
                <input type="number" step="any" value={portLat} onChange={(e) => setPortLat(e.target.value)} placeholder="30.2804"
                  className="w-full px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 font-mono" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Longitude</label>
                <input type="number" step="any" value={portLng} onChange={(e) => setPortLng(e.target.value)} placeholder="-87.5617"
                  className="w-full px-3 py-2 rounded-lg bg-ocean-900 border border-ocean-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 font-mono" />
              </div>
            </div>
            <p className="text-[10px] text-slate-600">Tip: Drop a pin on the map to get exact coordinates.</p>
            <div className="flex gap-2">
              <button onClick={savePort} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-cyan-500 text-white hover:bg-cyan-400 transition-all">Save Home Port</button>
              {homePort && <button onClick={() => setEditingPort(false)} className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 bg-ocean-700 hover:bg-ocean-600 transition-all">Cancel</button>}
            </div>
          </div>
        )}
      </div>

      {!homePort ? (
        <div className="flex flex-col items-center py-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-ocean-800 border border-ocean-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-400">Set your home port</p>
            <p className="text-xs text-slate-600 mt-1">Sea state, waves, currents, and marine forecast data will appear here.</p>
          </div>
        </div>
      ) : loading ? (
        <LoadingSpinner />
      ) : marine ? (
        <div className="space-y-5 border-t border-ocean-700 pt-4">
          <MarineConditions marine={marine} />
          {location && <div className="border-t border-ocean-700 pt-4"><TideChart lat={location.lat} lng={location.lng} /></div>}
        </div>
      ) : (
        <div className="border-t border-ocean-700 pt-4">
          <p className="text-sm text-slate-500 text-center py-6">No marine data available.</p>
        </div>
      )}
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      <span className="text-xs text-slate-500 ml-2">Loading...</span>
    </div>
  )
}
