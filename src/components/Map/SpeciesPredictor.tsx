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
  // ── Tunas ─────────────────────────────────────────────────────────────
  { name: 'Yellowfin Tuna',  emoji: '\u{1F41F}', optimal: [72, 82], tolerance: [68, 86], depth: [100, 1000], habitat: 'pelagic', regions: ['atlantic', 'gulf', 'pacific'] },
  { name: 'Bluefin Tuna',    emoji: '\u{1F41F}', optimal: [61, 72], tolerance: [55, 78], depth: [100, 3000], habitat: 'pelagic', regions: ['atlantic', 'pacific'] },
  { name: 'Bigeye Tuna',     emoji: '\u{1F41F}', optimal: [63, 76], tolerance: [58, 80], depth: [300, 1500], habitat: 'pelagic', regions: ['atlantic', 'gulf'] },
  { name: 'Blackfin Tuna',   emoji: '\u{1F41F}', optimal: [72, 82], tolerance: [68, 84], depth: [50, 600],  habitat: 'pelagic', regions: ['atlantic', 'gulf'] },
  { name: 'Albacore',        emoji: '\u{1F41F}', optimal: [60, 66], tolerance: [57, 70], depth: [100, 1500], habitat: 'pelagic', regions: ['pacific', 'atlantic'] },
  { name: 'Skipjack Tuna',   emoji: '\u{1F41F}', optimal: [75, 83], tolerance: [70, 86], depth: [0, 850],   habitat: 'pelagic', regions: ['atlantic', 'gulf', 'pacific'] },

  // ── Billfish ──────────────────────────────────────────────────────────
  { name: 'Blue Marlin',     emoji: '\u{1F5E1}\uFE0F', optimal: [76, 84], tolerance: [72, 88], depth: [200, 3000], habitat: 'pelagic', regions: ['atlantic', 'gulf', 'pacific'] },
  { name: 'White Marlin',    emoji: '\u{1F5E1}\uFE0F', optimal: [72, 80], tolerance: [68, 84], depth: [200, 1500], habitat: 'pelagic', regions: ['atlantic', 'gulf'] },
  { name: 'Sailfish',        emoji: '\u26F5',           optimal: [76, 84], tolerance: [72, 86], depth: [60, 600],  habitat: 'pelagic', regions: ['atlantic', 'gulf'] },
  { name: 'Swordfish',       emoji: '\u2694\uFE0F',     optimal: [64, 74], tolerance: [58, 80], depth: [600, 3000], habitat: 'pelagic', regions: ['atlantic', 'gulf', 'pacific'] },
  { name: 'Striped Marlin',  emoji: '\u{1F3F9}',        optimal: [68, 76], tolerance: [63, 80], depth: [100, 800], habitat: 'pelagic', regions: ['pacific'] },

  // ── Pelagics ──────────────────────────────────────────────────────────
  { name: 'Mahi-Mahi',       emoji: '\u{1F42C}', optimal: [76, 84], tolerance: [72, 86], depth: [30, 500],  habitat: 'pelagic', regions: ['atlantic', 'gulf', 'pacific'] },
  { name: 'Wahoo',           emoji: '\u26A1',    optimal: [74, 82], tolerance: [70, 84], depth: [100, 600], habitat: 'pelagic', regions: ['atlantic', 'gulf', 'pacific'] },
  { name: 'King Mackerel',   emoji: '\u{1F420}', optimal: [72, 82], tolerance: [68, 84], depth: [30, 300],  habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Spanish Mackerel', emoji: '\u{1F420}', optimal: [70, 82], tolerance: [65, 84], depth: [10, 100], habitat: 'nearshore', regions: ['atlantic', 'gulf'] },
  { name: 'Cobia',           emoji: '\u{1F421}', optimal: [70, 82], tolerance: [65, 85], depth: [20, 300],  habitat: 'structure', regions: ['atlantic', 'gulf'] },
  { name: 'Tripletail',      emoji: '\u{1F421}', optimal: [72, 84], tolerance: [68, 86], depth: [5, 60],    habitat: 'nearshore', regions: ['atlantic', 'gulf'] },

  // ── Reef / Bottom ─────────────────────────────────────────────────────
  { name: 'Red Snapper',     emoji: '\u{1F534}', optimal: [68, 82], tolerance: [62, 85], depth: [60, 400],  habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Vermilion Snapper', emoji: '\u{1F534}', optimal: [68, 80], tolerance: [62, 84], depth: [60, 350], habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Grouper (Gag)',   emoji: '\u{1FAA8}', optimal: [68, 78], tolerance: [62, 82], depth: [30, 250],  habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Grouper (Red)',   emoji: '\u{1FAA8}', optimal: [72, 82], tolerance: [66, 85], depth: [60, 400],  habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Greater Amberjack', emoji: '\u{1F49B}', optimal: [70, 82], tolerance: [65, 85], depth: [60, 400], habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Triggerfish',     emoji: '\u{1FAA8}', optimal: [68, 82], tolerance: [62, 85], depth: [40, 250],  habitat: 'reef', regions: ['atlantic', 'gulf'] },
  { name: 'Tilefish',        emoji: '\u{1FAA8}', optimal: [52, 62], tolerance: [48, 68], depth: [500, 1500], habitat: 'reef', regions: ['atlantic', 'gulf'] },

  // ── Pacific ───────────────────────────────────────────────────────────
  { name: 'Yellowtail',      emoji: '\u{1F49B}', optimal: [62, 70], tolerance: [58, 74], depth: [30, 400],  habitat: 'pelagic', regions: ['pacific'] },
  { name: 'White Seabass',   emoji: '\u{1F41F}', optimal: [58, 66], tolerance: [54, 70], depth: [10, 200],  habitat: 'nearshore', regions: ['pacific'] },
  { name: 'Dorado (Pacific)', emoji: '\u{1F42C}', optimal: [76, 84], tolerance: [72, 86], depth: [30, 500], habitat: 'pelagic', regions: ['pacific'] },

  // ── Inshore / Nearshore ───────────────────────────────────────────────
  { name: 'Red Drum (Redfish)', emoji: '\u{1F534}', optimal: [70, 84], tolerance: [60, 88], depth: [1, 40], habitat: 'nearshore', regions: ['atlantic', 'gulf'] },
  { name: 'Speckled Trout',  emoji: '\u{1F420}', optimal: [65, 78], tolerance: [58, 82], depth: [1, 30],    habitat: 'nearshore', regions: ['atlantic', 'gulf'] },
  { name: 'Flounder',        emoji: '\u{1F41F}', optimal: [58, 72], tolerance: [52, 78], depth: [5, 100],   habitat: 'nearshore', regions: ['atlantic', 'gulf'] },
  { name: 'Sheepshead',      emoji: '\u{1FAA8}', optimal: [62, 76], tolerance: [55, 80], depth: [5, 50],    habitat: 'structure', regions: ['atlantic', 'gulf'] },
  { name: 'Tarpon',          emoji: '\u{1F3C6}', optimal: [76, 88], tolerance: [72, 90], depth: [3, 100],   habitat: 'nearshore', regions: ['atlantic', 'gulf'] },
  { name: 'Snook',           emoji: '\u{1F3C6}', optimal: [74, 86], tolerance: [70, 90], depth: [1, 40],    habitat: 'nearshore', regions: ['atlantic', 'gulf'] },
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

function regionFromCoords(lat: number, lng: number): string {
  // Pacific: west of Baja/California
  if (lng < -118) return 'pacific'
  if (lng < -105 && lat < 33) return 'pacific'

  // Gulf of Mexico: bounded by Florida Keys, Straits of Florida, and south Texas
  // Roughly: west of -80° (Florida west coast), north of 18° (Yucatan), east of -98° (Texas)
  if (lng >= -98 && lng <= -80 && lat >= 18 && lat <= 31) return 'gulf'
  // Florida panhandle and northern gulf
  if (lng >= -89 && lng <= -82 && lat >= 29 && lat <= 31) return 'gulf'
  // Western gulf (south Texas coast)
  if (lng >= -98 && lng <= -93 && lat >= 25 && lat <= 30) return 'gulf'

  // Default to Atlantic for US East Coast and Caribbean
  return 'atlantic'
}

function regionScore(lat: number, lng: number, species: SpeciesEntry): number {
  return species.regions.includes(regionFromCoords(lat, lng)) ? 1.0 : 0.0
}

interface ScoredSpecies {
  species: SpeciesEntry
  score: number
  sstVal: number
  depthVal: number
}

function scoreAll(sst: number, depthFt: number, lat: number, lng: number): ScoredSpecies[] {
  return SPECIES_DATA
    .map((sp) => {
      const s = sstScore(sst, sp) * depthScore(depthFt, sp) * regionScore(lat, lng, sp)
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
        setResults(scoreAll(sstVal, depthVal, lat, lng))
      } else if (sstVal != null) {
        // Score without depth info — treat depth as neutral (1.0)
        const partial = SPECIES_DATA
          .map((sp) => ({
            species: sp,
            score: sstScore(sstVal, sp) * regionScore(lat, lng, sp),
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

  const region = regionFromCoords(lat, lng)

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
