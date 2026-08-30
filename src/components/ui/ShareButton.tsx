import { useState, useCallback } from 'react'
import { useMapStore } from '../../store/mapStore'
import { syncStateToUrl } from '../../lib/urlSync'

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export default function ShareButton() {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const { viewState, basemap, layers } = useMapStore.getState()
    const activeLayers = layers.filter((l) => l.visible).map((l) => l.id)
    syncStateToUrl(
      { latitude: viewState.latitude, longitude: viewState.longitude, zoom: viewState.zoom },
      basemap,
      activeLayers,
    )
    const ok = await copyText(window.location.href)
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2200)
  }, [])

  return (
    <div className="relative">
      <button
        onClick={() => { void handleCopy() }}
        title="Copy shareable link"
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all shadow-lg border glass border-ocean-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        {copied ? 'Copied!' : 'Share'}
      </button>

      {copied && (
        <div
          className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-cyan-600 text-white text-[11px] font-medium whitespace-nowrap shadow-lg z-50 animate-fade-in"
          role="status"
        >
          Link copied
        </div>
      )}
    </div>
  )
}
