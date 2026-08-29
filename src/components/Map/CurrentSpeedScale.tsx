/**
 * Hilton-style velocity scale on the right — 0–4 kt, never a u/v diagnostic.
 */

import { OSCAR_SPEED_MAX_KT } from '../../lib/oscarCurrents'

const GRADIENT =
  'linear-gradient(to top, #7dd3fc, #eab308, #f97316, #ef4444)'

export default function CurrentSpeedScale({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      className="absolute right-3 z-20 pointer-events-none flex items-end gap-1.5"
      style={{ bottom: '5.5rem' }}
      aria-label="Current speed 0 to 4 knots"
    >
      <div className="flex flex-col justify-between h-28 py-0.5 text-[9px] font-mono text-slate-300 text-right leading-none">
        <span>{OSCAR_SPEED_MAX_KT} kt</span>
        <span>2</span>
        <span>0</span>
      </div>
      <div
        className="w-2 h-28 rounded-full border border-white/25 shadow-lg"
        style={{ background: GRADIENT }}
      />
    </div>
  )
}
