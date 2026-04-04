import { useState, useMemo } from 'react'
import { useMapStore } from '../../store/mapStore'
import { FISHING_SPOTS, SPOT_TYPE_COLORS, SPOT_TYPE_LABELS, MONTH_NAMES } from '../../lib/fishingSpots'
import type { FishingSpot, SpotType } from '../../types'
import { cn } from '../../lib/utils'

const MAX_DISTANCE_MI = 150

/** Haversine distance in miles between two lat/lng points */
function distanceMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const SPOT_TYPES: { value: SpotType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'canyon', label: 'Canyon' },
  { value: 'hump', label: 'Hump' },
  { value: 'reef', label: 'Reef' },
  { value: 'wreck', label: 'Wreck' },
  { value: 'ledge', label: 'Ledge' },
  { value: 'rip', label: 'Rip' },
  { value: 'artificial', label: 'Artificial' },
  { value: 'rig', label: 'Oil/Gas Rig' },
]

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-2.5 h-2.5 ${i < rating ? 'text-amber-400' : 'text-slate-700'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function SpotCard({ spot, isSelected, distance }: { spot: FishingSpot; isSelected: boolean; distance?: number }) {
  const typeColor = SPOT_TYPE_COLORS[spot.type] ?? '#f59e0b'
  const typeLabel = SPOT_TYPE_LABELS[spot.type] ?? spot.type
  const currentMonth = new Date().getMonth() + 1
  const isInSeason = spot.bestMonths.includes(currentMonth)

  return (
    <div
      className={cn(
        'rounded-xl p-3 border transition-all cursor-pointer hover:border-ocean-500',
        isSelected
          ? 'border-cyan-500/60 bg-cyan-500/10'
          : 'border-ocean-700 bg-ocean-800/50 hover:bg-ocean-750/80',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: typeColor }}
            />
            <span className="text-xs font-medium" style={{ color: typeColor }}>
              {typeLabel}
            </span>
            {isInSeason && (
              <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-full px-1.5 py-0 leading-4">
                In season
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-slate-100 leading-tight truncate">{spot.name}</h4>
          <p className="text-xs text-slate-500 truncate">{spot.region}</p>
        </div>
        <StarRating rating={spot.rating} />
      </div>

      {/* Depth + distance */}
      <div className="flex items-center gap-3 mb-2 text-xs font-mono text-slate-500">
        <span>{spot.depth.toLocaleString()} ft</span>
        {distance != null && (
          <>
            <span>·</span>
            <span className="text-cyan-500">{Math.round(distance)} mi away</span>
          </>
        )}
      </div>

      {/* Species pills */}
      <div className="flex flex-wrap gap-1">
        {spot.species.slice(0, 3).map((s) => (
          <span
            key={s}
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              background: `${typeColor}18`,
              color: typeColor,
              border: `1px solid ${typeColor}30`,
            }}
          >
            {s}
          </span>
        ))}
        {spot.species.length > 3 && (
          <span className="text-xs text-slate-600 px-1.5 py-0.5">
            +{spot.species.length - 3} more
          </span>
        )}
      </div>
    </div>
  )
}

export default function SpotsList() {
  const { selectedSpot, setSelectedSpot, viewState } = useMapStore()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<SpotType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'depth' | 'rating' | 'distance'>('distance')

  const centerLat = viewState.latitude
  const centerLng = viewState.longitude

  const filtered = useMemo(() => {
    // Filter to spots within 150 miles of map center
    let spots = FISHING_SPOTS.filter(
      (s) => distanceMi(centerLat, centerLng, s.lat, s.lng) <= MAX_DISTANCE_MI,
    )

    if (search.trim()) {
      const q = search.toLowerCase()
      spots = spots.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.region.toLowerCase().includes(q) ||
          s.species.some((sp) => sp.toLowerCase().includes(q)),
      )
    }

    if (typeFilter !== 'all') {
      spots = spots.filter((s) => s.type === typeFilter)
    }

    return [...spots].sort((a, b) => {
      if (sortBy === 'distance') {
        return distanceMi(centerLat, centerLng, a.lat, a.lng) - distanceMi(centerLat, centerLng, b.lat, b.lng)
      }
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'depth') return b.depth - a.depth
      return a.name.localeCompare(b.name)
    })
  }, [search, typeFilter, sortBy, centerLat, centerLng])

  const currentMonth = new Date().getMonth() + 1
  const inSeasonCount = FISHING_SPOTS.filter((s) => s.bestMonths.includes(currentMonth)).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search */}
      <div className="px-3 pt-3 space-y-2">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search spots, species, regions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-ocean-800 border border-ocean-600 rounded-xl pl-8 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Type filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SPOT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              className={cn(
                'flex-shrink-0 text-xs px-2.5 py-1 rounded-full border transition-all whitespace-nowrap',
                typeFilter === t.value
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-ocean-800 border-ocean-600 text-slate-500 hover:border-ocean-500 hover:text-slate-400',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            <span className="text-slate-300 font-medium">{filtered.length}</span> spots within {MAX_DISTANCE_MI} mi
          </span>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs bg-ocean-800 border border-ocean-600 rounded-lg px-2 py-1 text-slate-400 focus:outline-none focus:border-cyan-500/60"
          >
            <option value="distance">Nearest</option>
            <option value="rating">Top Rated</option>
            <option value="depth">Deepest</option>
            <option value="name">A–Z</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">No spots found</p>
          </div>
        ) : (
          filtered.map((spot) => (
            <div
              key={spot.id}
              onClick={() => {
                const selecting = selectedSpot?.id !== spot.id
                setSelectedSpot(selecting ? spot : null)
                if (selecting) {
                  useMapStore.getState().setFlyToTarget({ lat: spot.lat, lng: spot.lng, zoom: 10 })
                }
              }}
            >
              <SpotCard
                spot={spot}
                isSelected={selectedSpot?.id === spot.id}
                distance={distanceMi(centerLat, centerLng, spot.lat, spot.lng)}
              />
            </div>
          ))
        )}
      </div>

      {/* Current month callout */}
      <div className="px-3 py-2 border-t border-ocean-700">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span>
            Best in <span className="text-slate-400 font-medium">{MONTH_NAMES[currentMonth - 1]}</span>:{' '}
            {inSeasonCount} spots
          </span>
        </div>
      </div>
    </div>
  )
}
