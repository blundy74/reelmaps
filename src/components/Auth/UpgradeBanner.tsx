import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { createCheckoutSession } from '../../lib/apiClient'

export default function UpgradeBanner() {
  const user = useAuthStore((s) => s.user)
  const [dismissed, setDismissed] = useState(false)

  // Only show for logged-in non-premium users
  if (!user || user.isPremium || dismissed) return null

  return (
    <div className="relative flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-500/10 via-ocean-900 to-amber-500/10 border-b border-amber-500/20">
      <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <p className="flex-1 text-xs text-slate-300">
        <span className="font-semibold text-amber-400">Upgrade to Premium</span>
        <span className="hidden sm:inline"> — unlock satellite layers, AI-powered hotspots, spot imports, and more.</span>
      </p>
      <button
        onClick={async () => {
          try {
            const { url } = await createCheckoutSession()
            if (url) window.location.href = url
          } catch { /* ignore */ }
        }}
        className="px-3 py-1 rounded-lg text-[10px] font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-400 hover:to-amber-500 transition-all whitespace-nowrap"
      >
        Upgrade
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
        title="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
