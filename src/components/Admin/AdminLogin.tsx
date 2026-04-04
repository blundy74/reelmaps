import { useState } from 'react'
import { adminLogin } from '../../lib/adminApi'

interface Props {
  onLogin: () => void
  onBack: () => void
}

export default function AdminLogin({ onLogin, onBack }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await adminLogin(email, password)
      onLogin()
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ocean-950 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="bg-ocean-900 border border-ocean-700 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-200">Admin Access</h1>
              <p className="text-xs text-slate-500">Authorized personnel only</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-ocean-800 border border-ocean-600 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
              autoFocus
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-ocean-800 border border-ocean-600 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full mt-5 py-3 rounded-xl text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Login'}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full mt-3 py-2 text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Back to ReelMaps
          </button>
        </form>
      </div>
    </div>
  )
}
