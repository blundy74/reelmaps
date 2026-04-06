import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { requestPasswordReset, resetPassword } from '../../lib/apiClient'
import { cn } from '../../lib/utils'

// ── End User License Agreement ──────────────────────────────────────────────

function EulaModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-ocean-900 border border-ocean-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ocean-700 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-200">End User License Agreement</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-xs text-slate-400 leading-relaxed space-y-4">
          <p className="text-slate-300 font-semibold text-sm">ReelMaps End User License Agreement</p>
          <p className="text-slate-500 text-[10px]">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

          <p>By creating an account and using ReelMaps (&quot;the Service&quot;), operated by ReelMaps (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you (&quot;User&quot;) agree to be bound by the following terms and conditions. If you do not agree, do not create an account or use the Service.</p>

          <p className="text-slate-300 font-semibold">1. No Marine Safety Guarantee</p>
          <p>THE SERVICE IS PROVIDED FOR INFORMATIONAL AND RECREATIONAL PURPOSES ONLY. REELMAPS IS NOT A NAVIGATION AID AND MUST NOT BE USED AS A SUBSTITUTE FOR OFFICIAL NOAA NAUTICAL CHARTS, MARINE FORECASTS, OR PROFESSIONAL NAVIGATION EQUIPMENT. You acknowledge that:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Data displayed on ReelMaps — including but not limited to sea surface temperature, ocean currents, wave height, wind speed, bathymetry, weather radar, fishing hotspots, and species predictions — is derived from publicly available government sources and third-party APIs, and may be delayed, incomplete, inaccurate, or unavailable at any time.</li>
            <li>ReelMaps makes NO WARRANTY regarding the accuracy, timeliness, or reliability of any data, overlay, prediction, or recommendation presented through the Service.</li>
            <li>You are solely responsible for your own marine safety, navigation decisions, and compliance with all applicable maritime laws and regulations.</li>
            <li>ReelMaps shall NOT be liable for any loss, injury, death, property damage, or other harm arising from the use of or reliance on any information provided by the Service, including but not limited to decisions related to vessel navigation, weather avoidance, or fishing activity.</li>
          </ul>

          <p className="text-slate-300 font-semibold">2. Data Sources and Availability</p>
          <p>ReelMaps aggregates data from publicly available sources including but not limited to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>National Oceanic and Atmospheric Administration (NOAA) — weather models (HRRR, GFS), satellite imagery (GOES, VIIRS), nautical charts, ocean current models (RTOFS, HYCOM), tide predictions, and marine forecasts</li>
            <li>National Aeronautics and Space Administration (NASA) — GIBS satellite imagery (MUR SST, chlorophyll-a, true color), sea surface height (JPL MEaSUREs)</li>
            <li>Open-Meteo — weather and marine forecast APIs</li>
            <li>GEBCO / Esri — bathymetric data</li>
            <li>RainViewer — radar imagery</li>
            <li>USF Optical Oceanography Lab / NOAA AOML — Sargassum detection (AFAI)</li>
          </ul>
          <p>We do not control these data sources. Data availability, accuracy, and update frequency are determined by the respective agencies and providers. The Service may be interrupted, degraded, or unavailable if upstream data sources experience outages, format changes, or discontinuation. We are not responsible for any such interruptions.</p>

          <p className="text-slate-300 font-semibold">3. AI-Generated Content</p>
          <p>ReelMaps uses artificial intelligence algorithms to generate fishing hotspot scores, species predictions, and fishing reports. These outputs are probabilistic estimates based on environmental data and should be treated as suggestions, not guarantees. AI predictions may be inaccurate and should not be the sole basis for any decision. Past performance of any prediction does not guarantee future results.</p>

          <p className="text-slate-300 font-semibold">4. Limitation of Liability</p>
          <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, REELMAPS AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING FROM:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Your use of or inability to use the Service</li>
            <li>Any inaccuracy, delay, or omission in any data or content</li>
            <li>Any decision made or action taken in reliance on the Service</li>
            <li>Unauthorized access to or alteration of your data</li>
            <li>Any marine incident, accident, or adverse event</li>
          </ul>

          <p className="text-slate-300 font-semibold">5. Assumption of Risk</p>
          <p>Offshore fishing and boating are inherently dangerous activities. By using ReelMaps, you acknowledge that you voluntarily assume all risks associated with marine activities, weather conditions, and ocean navigation, and that ReelMaps bears no responsibility for your safety on the water.</p>

          <p className="text-slate-300 font-semibold">6. User Accounts and Data</p>
          <p>You are responsible for maintaining the confidentiality of your account credentials. Your imported fishing spots and personal data are stored securely and are not shared with third parties. We reserve the right to suspend or terminate accounts that violate these terms. Account deactivation preserves your data; you may reactivate by re-registering with the same email.</p>

          <p className="text-slate-300 font-semibold">7. Intellectual Property</p>
          <p>The ReelMaps platform, including its design, algorithms, and proprietary hotspot scoring methodology, is the intellectual property of ReelMaps. You may not reverse-engineer, copy, or redistribute the platform or its outputs for commercial purposes without written permission.</p>

          <p className="text-slate-300 font-semibold">8. Indemnification</p>
          <p>You agree to indemnify and hold harmless ReelMaps and its affiliates from any claims, damages, losses, or expenses (including legal fees) arising from your use of the Service, your violation of these terms, or your marine activities.</p>

          <p className="text-slate-300 font-semibold">9. Modifications</p>
          <p>We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the revised terms. Material changes will be communicated via email or in-app notification.</p>

          <p className="text-slate-300 font-semibold">10. Governing Law</p>
          <p>This Agreement shall be governed by and construed in accordance with the laws of the United States. Any disputes shall be resolved through binding arbitration in the state in which ReelMaps operates.</p>

          <p className="text-slate-300 font-semibold">11. Contact</p>
          <p>For questions about this Agreement, contact us at support@reelmaps.ai.</p>
        </div>
        <div className="px-5 py-3 border-t border-ocean-700 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2 rounded-lg text-xs font-semibold bg-cyan-500 text-white hover:bg-cyan-400 transition-all">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, authMode, setAuthMode, login, register, loading, error, suggestions } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [eulaAccepted, setEulaAccepted] = useState(false)
  const [showEula, setShowEula] = useState(false)
  const [resetMode, setResetMode] = useState<'off' | 'email' | 'sent' | 'code'>('off')
  const [resetEmail, setResetEmail] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')

  if (!showAuthModal) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (authMode === 'register') {
      if (password !== confirmPassword) return
      await register(email, password, displayName || undefined)
    } else {
      await login(email, password)
    }
  }

  const passwordMismatch = authMode === 'register' && confirmPassword.length > 0 && password !== confirmPassword

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAuthModal(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-ocean-900 border border-ocean-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-ocean-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                  <ellipse cx="10" cy="12" rx="5" ry="3" />
                  <path d="M15 12 l4-3 l0 6 z" />
                  <circle cx="8" cy="11.5" r="0.8" fill="#040c18"/>
                </svg>
              </div>
              <span className="text-lg font-bold text-slate-100">ReelMaps</span>
            </div>
            <button
              onClick={() => setShowAuthModal(false)}
              className="p-1.5 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-lg bg-ocean-800 p-0.5">
            <button
              onClick={() => setAuthMode('login')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                authMode === 'login'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => setAuthMode('register')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                authMode === 'register'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-slate-500 hover:text-slate-300',
              )}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Reset password flow */}
        {resetMode !== 'off' && authMode === 'login' ? (
          <div className="px-6 py-5 space-y-4">
            {resetMode === 'email' && (
              <>
                <p className="text-sm text-slate-300">Enter your email and we'll send you a reset code.</p>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="captain@reelmaps.ai"
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-ocean-800 border border-ocean-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                {resetError && <p className="text-xs text-red-400">{resetError}</p>}
                <button
                  onClick={async () => {
                    setResetLoading(true); setResetError('')
                    try {
                      await requestPasswordReset(resetEmail)
                      setResetMode('sent')
                    } catch (err: any) { setResetError(err.message || 'Failed to send reset code') }
                    setResetLoading(false)
                  }}
                  disabled={resetLoading || !resetEmail}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold bg-cyan-500 text-white hover:bg-cyan-400 transition-all disabled:opacity-50"
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Code'}
                </button>
                <button onClick={() => setResetMode('off')} className="w-full text-xs text-slate-500 hover:text-slate-300 py-1">
                  Back to sign in
                </button>
              </>
            )}
            {resetMode === 'sent' && (
              <>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-emerald-400">Reset code sent to {resetEmail}. Check your email.</p>
                </div>
                <button onClick={() => setResetMode('code')} className="w-full py-2.5 rounded-lg text-sm font-semibold bg-cyan-500 text-white hover:bg-cyan-400 transition-all">
                  Enter Reset Code
                </button>
              </>
            )}
            {resetMode === 'code' && (
              <>
                <p className="text-sm text-slate-300">Enter the code from your email and your new password.</p>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Reset Code</label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full px-3 py-2.5 rounded-lg bg-ocean-800 border border-ocean-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 font-mono tracking-widest text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    minLength={8}
                    className="w-full px-3 py-2.5 rounded-lg bg-ocean-800 border border-ocean-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
                  />
                </div>
                {resetError && <p className="text-xs text-red-400">{resetError}</p>}
                {resetSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                    <p className="text-xs text-emerald-400">{resetSuccess}</p>
                  </div>
                )}
                <button
                  onClick={async () => {
                    setResetLoading(true); setResetError(''); setResetSuccess('')
                    try {
                      await resetPassword(resetEmail, resetCode, newPassword)
                      setResetSuccess('Password reset! You can now sign in.')
                      setTimeout(() => { setResetMode('off'); setResetSuccess('') }, 2000)
                    } catch (err: any) { setResetError(err.message || 'Reset failed') }
                    setResetLoading(false)
                  }}
                  disabled={resetLoading || !resetCode || newPassword.length < 8}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold bg-cyan-500 text-white hover:bg-cyan-400 transition-all disabled:opacity-50"
                >
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
                <button onClick={() => setResetMode('off')} className="w-full text-xs text-slate-500 hover:text-slate-300 py-1">
                  Back to sign in
                </button>
              </>
            )}
          </div>
        ) : (
        /* Normal login/register form */
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {authMode === 'register' && (
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Captain Hook"
                className="w-full px-3 py-2.5 rounded-lg bg-ocean-800 border border-ocean-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="captain@reelmaps.ai"
              required
              className="w-full px-3 py-2.5 rounded-lg bg-ocean-800 border border-ocean-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs text-slate-500 uppercase tracking-wider">Password</label>
              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setResetMode('email'); setResetEmail(email) }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              required
              minLength={8}
              className="w-full px-3 py-2.5 rounded-lg bg-ocean-800 border border-ocean-600 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          {authMode === 'register' && (
            <div>
              <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg bg-ocean-800 border text-sm text-slate-200 placeholder-slate-600 focus:outline-none',
                  passwordMismatch ? 'border-red-500/50' : 'border-ocean-600 focus:border-cyan-500/50',
                )}
              />
              {passwordMismatch && (
                <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
              {suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] text-slate-500 mb-1">Try one of these:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setDisplayName(s)}
                        className="px-2 py-1 rounded bg-ocean-700 text-xs text-cyan-400 hover:bg-ocean-600 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EULA checkbox (register only) */}
          {authMode === 'register' && (
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="eula-checkbox"
                checked={eulaAccepted}
                onChange={(e) => setEulaAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-ocean-600 bg-ocean-800 text-cyan-500 focus:ring-cyan-500/30 flex-shrink-0 cursor-pointer"
              />
              <label htmlFor="eula-checkbox" className="text-xs text-slate-500 leading-relaxed cursor-pointer">
                I agree to the{' '}
                <button
                  type="button"
                  onClick={() => setShowEula(true)}
                  className="text-cyan-400 hover:underline"
                >
                  End User License Agreement
                </button>
                , including that ReelMaps is not a navigation aid and data is provided as-is from public sources.
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (authMode === 'register' && (passwordMismatch || !eulaAccepted))}
            className={cn(
              'w-full py-2.5 rounded-lg text-sm font-semibold transition-all',
              loading
                ? 'bg-cyan-500/30 text-cyan-300 cursor-wait'
                : 'bg-cyan-500 text-white hover:bg-cyan-400',
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {authMode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              authMode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
        )}

        {/* Footer */}
        <div className="px-6 pb-5">
          <p className="text-xs text-slate-600 text-center">
            {authMode === 'login' ? (
              <>Don't have an account? <button onClick={() => setAuthMode('register')} className="text-cyan-400 hover:underline">Sign up</button></>
            ) : (
              <>Already have an account? <button onClick={() => setAuthMode('login')} className="text-cyan-400 hover:underline">Sign in</button></>
            )}
          </p>
        </div>
      </div>

      {/* EULA modal */}
      {showEula && <EulaModal onClose={() => setShowEula(false)} />}
    </div>
  )
}
