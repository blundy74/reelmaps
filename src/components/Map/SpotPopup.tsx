import type { FishingSpot } from '../../types'
import { SPOT_TYPE_COLORS, SPOT_TYPE_LABELS, MONTH_NAMES } from '../../lib/fishingSpots'

interface Props {
  spot: FishingSpot
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? 'text-amber-400' : 'text-slate-600'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function SpotPopup({ spot }: Props) {
  const typeColor = SPOT_TYPE_COLORS[spot.type] ?? '#f59e0b'
  const typeLabel = SPOT_TYPE_LABELS[spot.type] ?? spot.type

  return (
    <div className="font-sans text-slate-200 w-80 select-none">
      {/* Header */}
      <div
        className="px-4 py-3 rounded-t-xl"
        style={{ background: `linear-gradient(135deg, rgba(11,24,41,0.98), rgba(14,30,51,0.98))` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: typeColor }}
              />
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: typeColor }}>
                {typeLabel}
              </span>
            </div>
            <h3 className="font-semibold text-base text-slate-100 leading-tight">{spot.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{spot.region}</p>
          </div>
          <StarRating rating={spot.rating} />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {/* Depth */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span className="text-slate-400">Depth:</span>
            <span className="text-slate-200 font-medium tabular-nums">{spot.depth.toLocaleString()} ft</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-slate-400 font-mono text-xs tabular-nums">
              {Math.abs(spot.lat).toFixed(5)}°{spot.lat >= 0 ? 'N' : 'S'}{' '}
              {Math.abs(spot.lng).toFixed(5)}°{spot.lng >= 0 ? 'E' : 'W'}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 leading-relaxed">{spot.description}</p>

        {/* Species */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Target Species</p>
          <div className="flex flex-wrap gap-1">
            {spot.species.map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  background: `${typeColor}22`,
                  color: typeColor,
                  border: `1px solid ${typeColor}44`,
                }}
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Best months */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Best Months</p>
          <div className="flex gap-0.5">
            {MONTH_NAMES.map((name, i) => {
              const active = spot.bestMonths.includes(i + 1)
              return (
                <div
                  key={name}
                  title={name}
                  className="flex-1 text-center py-1 rounded text-xs font-medium transition-colors"
                  style={{
                    background: active ? `${typeColor}33` : 'rgba(18,37,64,0.6)',
                    color: active ? typeColor : '#475569',
                    border: active ? `1px solid ${typeColor}55` : '1px solid transparent',
                  }}
                >
                  {name[0]}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
