/**
 * Modal showing spots selected by the lasso tool, with export options.
 */

import type { SavedSpot } from '../../lib/apiClient'
import { exportCSV, exportGPX, exportKML } from '../../lib/exportSpots'

interface Props {
  spots: SavedSpot[]
  onClose: () => void
}

export default function LassoResultsModal({ spots, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-ocean-900 border border-ocean-700 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ocean-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <h2 className="text-sm font-semibold text-slate-200">
              Selected Spots ({spots.length})
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Spot list */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ocean-900">
              <tr className="text-left text-slate-500 border-b border-ocean-700">
                <th className="px-5 py-2 w-8">#</th>
                <th className="py-2">Name</th>
                <th className="py-2 text-right pr-3">Lat</th>
                <th className="py-2 text-right pr-3">Lng</th>
                <th className="py-2 text-right pr-5">Depth</th>
              </tr>
            </thead>
            <tbody>
              {spots.map((s, i) => (
                <tr key={s.id} className="border-b border-ocean-800/50 hover:bg-ocean-800/30">
                  <td className="px-5 py-2 text-slate-600">{i + 1}</td>
                  <td className="py-2 text-slate-200 font-medium truncate max-w-[150px]">{s.name}</td>
                  <td className="py-2 text-right pr-3 text-slate-400 font-mono">{s.lat.toFixed(5)}</td>
                  <td className="py-2 text-right pr-3 text-slate-400 font-mono">{s.lng.toFixed(5)}</td>
                  <td className="py-2 text-right pr-5 text-slate-500 font-mono">{s.depthFt != null ? `${s.depthFt}'` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-ocean-700 flex-shrink-0">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mr-auto">Export as:</span>
          <button
            onClick={() => exportCSV(spots)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all"
          >
            CSV
          </button>
          <button
            onClick={() => exportGPX(spots)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all"
          >
            GPX
          </button>
          <button
            onClick={() => exportKML(spots)}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all"
          >
            KML
          </button>
        </div>
      </div>
    </div>
  )
}
