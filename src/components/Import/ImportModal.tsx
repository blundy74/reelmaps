/**
 * ImportModal — drag-and-drop file upload for fishing spots.
 * Supports CSV, GPX, and Garmin FIT files.
 * Parses client-side, shows preview, then sends to API.
 */

import { useState, useRef, useCallback } from 'react'
import { parseFile, type ParsedSpot, type FileType } from '../../lib/fileParser'
import { useUserSpotsStore } from '../../store/userSpotsStore'
import { cn } from '../../lib/utils'
import { SPOT_ICONS, DEFAULT_SPOT_ICON, type SpotIconDef } from '../../lib/spotIcons'

interface Props {
  open: boolean
  onClose: () => void
}

type Step = 'upload' | 'preview' | 'importing' | 'done'

export default function ImportModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [spots, setSpots] = useState<ParsedSpot[]>([])
  const [filename, setFilename] = useState('')
  const [fileType, setFileType] = useState<FileType>('csv')
  const [importResult, setImportResult] = useState<{ batchId: string; importedCount: number } | null>(null)
  const [selectedIcon, setSelectedIcon] = useState(DEFAULT_SPOT_ICON)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { importFile, loading } = useUserSpotsStore()

  const reset = useCallback(() => {
    setStep('upload')
    setError(null)
    setSpots([])
    setFilename('')
    setImportResult(null)
    setSelectedIcon(DEFAULT_SPOT_ICON)
  }, [])

  const handleClose = () => {
    reset()
    onClose()
  }

  const processFile = async (file: File) => {
    setError(null)
    try {
      const result = await parseFile(file)
      setSpots(result.spots)
      setFilename(file.name)
      setFileType(result.fileType)
      setStep('preview')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = '' // reset so same file can be re-selected
  }

  const handleImport = async () => {
    setStep('importing')
    const result = await importFile(filename, fileType, spots, selectedIcon)
    if (result) {
      setImportResult(result)
      setStep('done')
    } else {
      setStep('preview')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full max-w-lg mx-4 max-h-[80vh] bg-ocean-900 border border-ocean-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ocean-700 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-200">Import Fishing Spots</h2>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Upload step */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                  dragOver
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-ocean-600 hover:border-ocean-500 hover:bg-ocean-800/50',
                )}
              >
                <svg className="w-10 h-10 mx-auto mb-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-slate-300 font-medium">Drop a file here or click to browse</p>
                <p className="text-xs text-slate-500 mt-2">Supports CSV, Garmin GPX, and Garmin FIT files</p>
              </div>

              <input ref={fileInputRef} type="file" accept=".csv,.txt,.gpx,.fit" onChange={handleFileSelect} className="hidden" />

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supported Formats</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { ext: 'CSV', desc: 'Spreadsheet with lat/lng columns' },
                    { ext: 'GPX', desc: 'Garmin GPS waypoints & tracks' },
                    { ext: 'FIT', desc: 'Garmin device activity files' },
                  ].map(f => (
                    <div key={f.ext} className="bg-ocean-800/60 rounded-lg p-2.5 border border-ocean-700/50">
                      <span className="text-xs font-bold text-cyan-400">.{f.ext}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">{filename}</p>
                  <p className="text-xs text-slate-500">{spots.length.toLocaleString()} spots found</p>
                </div>
                <span className="text-xs font-bold text-cyan-400 px-2 py-1 bg-cyan-500/10 rounded">{fileType.toUpperCase()}</span>
              </div>

              {/* Icon picker */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Map Icon</p>
                <div className="flex flex-wrap gap-1.5">
                  {SPOT_ICONS.map((icon) => (
                    <button
                      key={icon.key}
                      onClick={() => setSelectedIcon(icon.key)}
                      title={icon.label}
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center transition-all border',
                        selectedIcon === icon.key
                          ? 'border-cyan-400 bg-cyan-500/15 ring-1 ring-cyan-400/40'
                          : 'border-ocean-700/50 bg-ocean-800/60 hover:bg-ocean-700/60 hover:border-ocean-600',
                      )}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill={icon.color}>
                        <path d={icon.path} />
                      </svg>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-600 mt-1">
                  {SPOT_ICONS.find(i => i.key === selectedIcon)?.label} — applies to all spots in this import (editable later)
                </p>
              </div>

              {/* Preview table */}
              <div className="bg-ocean-800/60 rounded-lg border border-ocean-700/50 overflow-hidden">
                <div className="overflow-x-auto max-h-60">
                  <table className="w-full text-xs">
                    <thead className="bg-ocean-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-500 font-medium">#</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-medium">Name</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-medium">Lat</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-medium">Lng</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-medium">Depth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spots.slice(0, 50).map((s, i) => (
                        <tr key={i} className="border-t border-ocean-700/30">
                          <td className="px-3 py-1.5 text-slate-600 font-mono">{i + 1}</td>
                          <td className="px-3 py-1.5 text-slate-300 truncate max-w-32">{s.name || '—'}</td>
                          <td className="px-3 py-1.5 text-slate-400 font-mono">{s.lat.toFixed(5)}</td>
                          <td className="px-3 py-1.5 text-slate-400 font-mono">{s.lng.toFixed(5)}</td>
                          <td className="px-3 py-1.5 text-slate-400 font-mono">{s.depthFt ? `${s.depthFt}ft` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {spots.length > 50 && (
                  <div className="px-3 py-2 bg-ocean-800/80 text-[10px] text-slate-500 text-center border-t border-ocean-700/30">
                    Showing 50 of {spots.length.toLocaleString()} spots
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={reset} className="flex-1 py-2 rounded-lg text-xs font-semibold bg-ocean-700 text-slate-300 hover:bg-ocean-600 transition-all border border-ocean-600">
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-cyan-500 text-white hover:bg-cyan-400 transition-all"
                >
                  Import {spots.length.toLocaleString()} Spots
                </button>
              </div>
            </div>
          )}

          {/* Importing step */}
          {step === 'importing' && (
            <div className="flex flex-col items-center py-12 space-y-3">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Importing {spots.length.toLocaleString()} spots...</p>
            </div>
          )}

          {/* Done step */}
          {step === 'done' && importResult && (
            <div className="flex flex-col items-center py-8 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-200">Import complete!</p>
                <p className="text-xs text-slate-500 mt-1">{importResult.importedCount.toLocaleString()} spots added from {filename}</p>
              </div>
              <button
                onClick={handleClose}
                className="px-6 py-2 rounded-lg text-xs font-semibold bg-cyan-500 text-white hover:bg-cyan-400 transition-all"
              >
                View on Map
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
