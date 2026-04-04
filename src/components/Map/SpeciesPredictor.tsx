import { useState, useEffect, useCallback } from 'react'
import { cn } from '../../lib/utils'

// ---------------------------------------------------------------------------
// Species database
// ---------------------------------------------------------------------------

interface SpeciesEntry {
  name: string
  emoji: string
  optimal: [number, number]   // SST optimal range (°F)
  tolerance: [number, number] // SST tolerance range (°F)
  depth: [number, number]     // depth preference (ft)
  habitat: string
  regions: string[]
}

const SPECIES_DATA: SpeciesEntry[] = [
  { name: 'Yellowfin Tuna', emoji: '\u{1F41F}', optimal: [75, 82], tolerance: [64, 86], depth: [0, 650], habitat: 'pelagic', regions: ['atlantic', 'gulf', 'pacific'] },
  { name: 'Bluefin Tuna', emoji: '\u{1F41F}', optimal: [60, 72], tolerance: [55, 78], depth: [0, 3000], habitat: 'pelagic', regions: ['atlantic', 'pacific'] },
  { name: 'Bigeye Tuna', emoji: '\u{1F41F}', optimal: [62, 74], tolerance: [55, 78], depth: [150, 1500], habitat: 'pelagic', regions: ['atlantic'] },
  { name: 'Mahi-Mahi', emoji: '\u{1F42C}', optimal: [74, 80], tolerance: [70, 84], depth: [0, 250], habitat: 'pelagic', regions: ['atlantic', 'gulf', 'pacific'] },
  { name: 'Wahoo', emoji: '\u26A1', optimal: [73, 78], tolerance: [64, 82], depth: [0, 400], habitat: 'pelagic', regions: ['atlantic', 'gulf'] },
  { name: 'Blue Marlin', emoji: '\u{1F5E1}\uFE0F', optimal: [74, 82], tolerance: [72, 88], depth: [0, 600], habitat: 'pelagic', regions: ['atlantic', 'gulf'] },
  { name: 'White Marlin', emoji: '\u{1F5E1}\uFE0F', optimal: [70, 80], tolerance: [68, 84], depth: [0, 500], habitat: 'pelagic', regions: ['atlantic'] },
  { name: 'Sailfish', emoji: '\u26F5', optimal: [72, 82], tolerance: [70, 86], depth: [0, 200], habitat: 'pelagic', regions: ['atlantic', 'gulf'] },
  { name: 'Swordfish', emoji: '\u2694\uFE0F', optimal: [64, 72], tolerance: [58, 78], depth: [0, 2000], habitat: 'pelagic', regions: ['atlantic', 'gulf'] },
  { name: 'King Mackerel', emoji: '\u{1F420}', optimal: [70, 78], tolerance: [65, 82], depth: [30, 200], habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Cobia', emoji: '\u{1F421}', optimal: [68, 78], tolerance: [62, 84], depth: [20, 200], habitat: 'structure', regions: ['atlantic', 'gulf'] },
  { name: 'Red Snapper', emoji: '\u{1F534}', optimal: [55, 70], tolerance: [50, 75], depth: [60, 400], habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Grouper', emoji: '\u{1FAA8}', optimal: [65, 78], tolerance: [58, 82], depth: [30, 200], habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Yellowtail', emoji: '\u{1F49B}', optimal: [64, 72], tolerance: [60, 76], depth: [0, 400], habitat: 'pelagic', regions: ['pacific'] },
  { name: 'Albacore', emoji: '\u{1F3AF}', optimal: [62, 65], tolerance: [59, 68], depth: [0, 1000], habitat: 'pelagic', regions: ['pacific'] },
  { name: 'Striped Marlin', emoji: '\u{1F3F9}', optimal: [68, 76], tolerance: [61, 78], depth: [0, 500], habitat: 'pelagic', regions: ['pacific'] },
]

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** Gaussian falloff — matches the hotspot handler approach */
function gaussianScore(value: number, optLow: number, optHigh: number, tolLow: number, tolHigh: number): number {
  if (value >= optLow && value <= optHigh) return 1.0

  // How far outside optimal, scaled by the tolerance buffer
  let distance: number
  let sigma: number
  if (value < optLow) {
    distance = optLow - value
    sigma = (optLow - tolLow) / 2 // 2-sigma = tolerance edge
  } else {
    distance = value - optHigh
    sigma = (tolHigh - optHigh) / 2
  }
  if (sigma <= 0) return 0
  return Math.exp(-0.5 * (distance / sigma) ** 2)
}

function sstScore(sst: number, species: SpeciesEntry): number {
  return gaussianScore(sst, species.optimal[0], species.optimal[1], species.tolerance[0], species.tolerance[1])
}

function depthScore(depthFt: number, species: SpeciesEntry): number {
  const [dMin, dMax] = species.depth
  if (depthFt >= dMin && depthFt <= dMax) return 1.0

  // Within 50% of the range extent
  const rangeExtent = dMax - dMin
  const buffer = rangeExtent * 0.5
  if (depthFt < dMin && depthFt >= dMin - buffer) return 0.5
  if (depthFt > dMax && depthFt <= dMax + buffer) return 0.5

  return 0
}

function regionFromLng(lng: number): string {
  if (lng > -82) return 'atlantic'
  if (lng >= -98) return 'gulf'
  return 'pacific'
}

function regionScore(lng: number, species: SpeciesEntry): number {
  return species.regions.includes(regionFromLng(lng)) ? 1.0 : 0.0
}

interface ScoredSpecies {
  species: SpeciesEntry
  score: number
  sstVal: number
  depthVal: number
}

function scoreAll(sst: number, depthFt: number, lng: number): ScoredSpecies[] {
  return SPECIES_DATA
    .map((sp) => {
      const s = sstScore(sst, sp) * depthScore(depthFt, sp) * regionScore(lng, sp)
      return { species: sp, score: s, sstVal: sst, depthVal: depthFt }
    })
    .filter((r) => r.score > 0.01)
    .sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------------
// API fetchers
// ---------------------------------------------------------------------------

async function fetchSST(lat: number, lng: number, signal?: AbortSignal): Promise<number | null> {
  try {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&current=sea_surface_temperature&temperature_unit=fahrenheit`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = await res.json()
    return data?.current?.sea_surface_temperature ?? null
  } catch {
    return null
  }
}

async function fetchDepth(lat: number, lng: number, signal?: AbortSignal): Promise<number | null> {
  try {
    const url = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/etopo1_bedrock.json?altitude[(${lat.toFixed(2)})][(${lng.toFixed(2)})]`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = await res.json()
    const alt = data?.table?.rows?.[0]?.[2]
    if (alt == null) return null
    // negative altitude = ocean depth; convert m -> ft
    if (alt < 0) return Math.round(Math.abs(alt) * 3.28084)
    return null // on land
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SpeciesPredictorProps {
  /** Latitude of the clicked point */
  lat: number
  /** Longitude of the clicked point */
  lng: number
  /** Called when the user closes the panel */
  onClose: () => void
  /** Optional extra className */
  className?: string
}

export default function SpeciesPredictor({ lat, lng, onClose, className }: SpeciesPredictorProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sst, setSST] = useState<number | null>(null)
  const [depthFt, setDepthFt] = useState<number | null>(null)
  const [results, setResults] = useState<ScoredSpecies[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResults([])

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    try {
      const [sstVal, depthVal] = await Promise.all([
        fetchSST(lat, lng, controller.signal),
        fetchDepth(lat, lng, controller.signal),
      ])

      clearTimeout(timeout)

      if (sstVal == null && depthVal == null) {
        setError('Could not retrieve ocean data for this location.')
        setLoading(false)
        return
      }

      setSST(sstVal)
      setDepthFt(depthVal)

      if (sstVal != null && depthVal != null) {
        setResults(scoreAll(sstVal, depthVal, lng))
      } else if (sstVal != null) {
        // Score without depth info — treat depth as neutral (1.0)
        const partial = SPECIES_DATA
          .map((sp) => ({
            species: sp,
            score: sstScore(sstVal, sp) * regionScore(lng, sp),
            sstVal,
            depthVal: 0,
          }))
          .filter((r) => r.score > 0.01)
          .sort((a, b) => b.score - a.score)
        setResults(partial)
      }
    } catch {
      setError('Request timed out. Try again.')
    } finally {
      setLoading(false)
    }
  }, [lat, lng])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Determine bar color based on score percentage
  function barColor(score: number): string {
    const pct = score * 100
    if (pct >= 70) return 'bg-emerald-500'
    if (pct >= 40) return 'bg-amber-500'
    return 'bg-slate-500'
  }

  const region = regionFromLng(lng)

  return (
    <div
      className={cn(
        'w-80 max-h-[480px] flex flex-col rounded-xl border border-ocean-700 bg-ocean-900/95 backdrop-blur-md shadow-2xl text-slate-200 overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-ocean-700/60">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-sm font-semibold tracking-wide">Species Predictor</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-ocean-700 text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Conditions summary */}
      <div className="px-4 py-2.5 border-b border-ocean-700/40 bg-ocean-800/40">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400 font-medium">SST</span>
            {loading ? (
              <span className="text-slate-500">--</span>
            ) : sst != null ? (
              <span className="text-slate-100 font-semibold">{sst.toFixed(1)}°F</span>
            ) : (
              <span className="text-red-400">N/A</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400 font-medium">Depth</span>
            {loading ? (
              <span className="text-slate-500">--</span>
            ) : depthFt != null ? (
              <span className="text-slate-100 font-semibold">{depthFt.toLocaleString()} ft</span>
            ) : (
              <span className="text-red-400">N/A</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400 font-medium">Region</span>
            <span className="text-slate-100 font-semibold capitalize">{region}</span>
          </div>
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          {lat.toFixed(4)}° {lat >= 0 ? 'N' : 'S'}, {Math.abs(lng).toFixed(4)}° {lng >= 0 ? 'E' : 'W'}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-ocean-600">
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">Analyzing...</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 px-4">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm text-red-300 text-center">{error}</span>
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 px-4">
            <span className="text-2xl">🌊</span>
            <span className="text-sm text-slate-400 text-center">No species predicted for these conditions.</span>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <ul className="divide-y divide-ocean-700/40">
            {results.map(({ species, score }) => {
              const pct = Math.round(score * 100)
              return (
                <li key={species.name} className="px-4 py-2.5 hover:bg-ocean-800/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base flex-shrink-0">{species.emoji}</span>
                      <span className="text-sm font-medium truncate">{species.name}</span>
                    </div>
                    <span className={cn(
                      'text-xs font-bold tabular-nums flex-shrink-0 ml-2',
                      pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-slate-400',
                    )}>
                      {pct}%
                    </span>
                  </div>
                  {/* Probability bar */}
                  <div className="h-1.5 w-full rounded-full bg-ocean-700/60 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', barColor(score))}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      {!loading && results.length > 0 && (
        <div className="px-4 py-2 border-t border-ocean-700/40 text-[10px] text-slate-500 text-center">
          Based on current SST, depth &amp; region conditions
        </div>
      )}
    </div>
  )
}
