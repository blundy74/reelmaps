import { useState, useCallback } from 'react'

export default function ShareButton() {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])

  return (
    <div className="relative">
      <button
        onClick={handleCopy}
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
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-cyan-600 text-white text-[10px] whitespace-nowrap animate-fade-in">
          Link copied to clipboard
        </div>
      )}
    </div>
  )
}
