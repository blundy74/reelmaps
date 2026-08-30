/**
 * Hilton-style velocity scale on the right — 0–4 kt, never a u/v diagnostic.
 * Color lives here and at the cursor pip, not on every arrow shaft.
 */

import { useMapStore } from '../../store/mapStore'
import {
  latestOscarGrid,
  sampleOscar,
  speedToArrowColor,
  OSCAR_AGE_STAMP,
  OSCAR_SPEED_MAX_KT,
} from '../../lib/oscarCurrents'

const GRADIENT =
  'linear-gradient(to top, #7dd3fc, #eab308, #f97316, #ef4444)'

export default function CurrentSpeedScale({ visible }: { visible: boolean }) {
  const cursor = useMapStore((s) => s.cursorCoords)
  if (!visible) return null

  const sample = cursor && latestOscarGrid()
    ? sampleOscar(latestOscarGrid()!, cursor.lat, cursor.lng)
    : null
  const kt = sample?.speedKt ?? null
  const t = kt == null ? null : Math.max(0, Math.min(1, kt / OSCAR_SPEED_MAX_KT))

  return (
    <div
      className="absolute z-20 pointer-events-none flex flex-col items-end gap-1.5"
      style={{ right: '3.75rem', bottom: '6.5rem' }}
      aria-label={`Current speed 0 to 4 knots · ${OSCAR_AGE_STAMP}`}
    >
      <span
        className="text-[10px] font-semibold text-cyan-100 tracking-wide whitespace-nowrap px-1.5 py-0.5 rounded bg-black/55 border border-white/15"
        style={{ textShadow: '0 0 4px rgba(0,0,0,0.85)' }}
      >
        {OSCAR_AGE_STAMP}
      </span>
      <div className="flex items-end gap-1.5">
        <div className="flex flex-col items-end gap-1">
          {kt != null && (
            <span
              className="text-[10px] font-mono font-semibold tabular-nums px-1 py-0.5 rounded"
              style={{ color: speedToArrowColor(kt), textShadow: '0 0 4px rgba(0,0,0,0.85)' }}
            >
              {kt < 10 ? kt.toFixed(1) : Math.round(kt)} kt
            </span>
          )}
          <div className="flex flex-col justify-between h-28 py-0.5 text-[9px] font-mono text-slate-300 text-right leading-none">
            <span>{OSCAR_SPEED_MAX_KT}</span>
            <span>2</span>
            <span>0</span>
          </div>
        </div>
        <div className="relative w-2 h-28">
          <div
            className="w-2 h-28 rounded-full border border-white/25 shadow-lg"
            style={{ background: GRADIENT }}
          />
          {t != null && (
            <span
              className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
              style={{
                bottom: `calc(${t * 100}% - 6px)`,
                background: speedToArrowColor(kt!),
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
