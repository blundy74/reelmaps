/**
 * Keyboard shortcuts help modal — shows all available shortcuts
 * in a clean two-column grid with key-cap styling.
 */

interface Props {
  open: boolean
  onClose: () => void
}

const SHORTCUTS: { key: string; description: string }[] = [
  { key: 'W', description: 'Toggle wind overlay' },
  { key: 'R', description: 'Toggle rain radar overlay' },
  { key: 'V', description: 'Toggle wave overlay' },
  { key: 'T', description: 'Toggle SST layer' },
  { key: 'C', description: 'Toggle currents layer' },
  { key: 'B', description: 'Toggle bathymetry' },
  { key: 'F', description: 'Toggle fishing spots' },
  { key: 'Space', description: 'Advance forecast hour' },
  { key: '\u2190', description: 'Previous forecast hour' },
  { key: '\u2192', description: 'Next forecast hour' },
  { key: 'M', description: 'Toggle measure mode' },
  { key: 'P', description: 'Toggle pin drop mode' },
  { key: 'Esc', description: 'Close modals / cancel modes' },
  { key: '?', description: 'Show this help' },
]

export default function ShortcutsModal({ open, onClose }: Props) {
  // Hide on mobile/touch devices — keyboard shortcuts aren't relevant
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  if (!open || isTouchDevice) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 bg-ocean-900 border border-ocean-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ocean-700">
          <h2 className="text-sm font-semibold text-slate-200">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="px-5 py-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between gap-4">
              <span className="text-xs text-slate-300">{s.description}</span>
              <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-md bg-ocean-800 border border-ocean-600 text-[11px] font-mono font-semibold text-cyan-400 shadow-sm whitespace-nowrap">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-ocean-700">
          <p className="text-[10px] text-slate-600 text-center">
            Shortcuts are disabled when typing in text fields
          </p>
        </div>
      </div>
    </div>
  )
}
