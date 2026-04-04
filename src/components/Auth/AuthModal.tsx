import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, authMode, setAuthMode, login, register, loading, error, suggestions } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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

        {/* Form */}
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
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
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

          <button
            type="submit"
            disabled={loading || (authMode === 'register' && passwordMismatch)}
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
    </div>
  )
}
