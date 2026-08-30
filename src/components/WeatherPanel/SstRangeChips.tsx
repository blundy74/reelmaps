/**
 * SST color-range chips for the right rail.
 * Fit-to-view (inner percentiles of water on screen) is the default so late-summer
 * 88s are not clipped. Loop / sail locks the named 78–86 chip (paint extends to 90
 * so August 87–88 still read). Wide is the global 50–90 rainbow.
 * The Fit button label is always "Fit". The numeric window is subtitle text.
 */

import { useState, type ReactNode } from 'react'
import { useMapStore } from '../../store/mapStore'
import { cn } from '../../lib/utils'
import {
  SST_GOM_MAX_F,
  SST_GOM_MIN_F,
  SST_WIDE_MAX_F,
  SST_WIDE_MIN_F,
  activeSstLayerId,
  sampleSstRangeFromView,
} from '../../lib/sstPalette'

function Chip({
  active,
  disabled,
  children,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'px-2 py-1 rounded-full text-[10px] font-medium border transition-colors leading-tight',
        active
          ? 'bg-cyan-500/20 border-cyan-400/45 text-cyan-200'
          : 'bg-black/25 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300',
        disabled && 'opacity-50 cursor-wait',
      )}
    >
      {children}
    </button>
  )
}

export default function SstRangeChips() {
  const layers = useMapStore((s) => s.layers)
  const sstRange = useMapStore((s) => s.sstRange)
  const setSstRange = useMapStore((s) => s.setSstRange)
  const selectedDate = useMapStore((s) => s.selectedDate)
  const mapBounds = useMapStore((s) => s.mapBounds)
  const [fitting, setFitting] = useState(false)
  const [fitError, setFitError] = useState<string | null>(null)

  const layerId = activeSstLayerId(layers)
  if (!layerId) return null

  const handleFitChip = async () => {
    setFitError(null)
    if (!mapBounds) return
    setFitting(true)
    try {
      const span = await sampleSstRangeFromView(layerId, selectedDate, mapBounds)
      if (!span) {
        setFitError('No SST water in view — try a clearer date or zoom to ocean.')
        return
      }
      setSstRange({ preset: 'fit', minF: span.minF, maxF: span.maxF })
    } catch {
      setFitError('Could not sample the tiles in view.')
    } finally {
      setFitting(false)
    }
  }

  const fitIsPlaceholder =
    sstRange.minF === SST_WIDE_MIN_F && sstRange.maxF === SST_WIDE_MAX_F
  const fitSubtitle = fitting
    ? 'sampling…'
    : sstRange.preset === 'fit' && !fitIsPlaceholder
      ? `${sstRange.minF}–${sstRange.maxF}°F`
      : 'to view'

  return (
    <section>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
        SST color range
      </p>
      <div className="flex flex-wrap gap-1">
        <Chip
          active={sstRange.preset === 'fit'}
          disabled={fitting || !mapBounds}
          onClick={() => { void handleFitChip() }}
        >
          Fit
        </Chip>
        <Chip
          active={sstRange.preset === 'gom'}
          onClick={() => {
            setFitError(null)
            setSstRange({ preset: 'gom', minF: SST_GOM_MIN_F, maxF: SST_GOM_MAX_F })
          }}
        >
          Loop / sail 78–86°F
        </Chip>
        <Chip
          active={sstRange.preset === 'wide'}
          onClick={() => {
            setFitError(null)
            setSstRange({ preset: 'wide', minF: SST_WIDE_MIN_F, maxF: SST_WIDE_MAX_F })
          }}
        >
          Wide 50–90°F
        </Chip>
      </div>
      <p className="text-[9px] text-slate-500 mt-1 px-0.5 leading-snug">
        <span className="text-slate-400 font-medium">Fit</span>
        {': '}
        {fitSubtitle}
        {' — inner percentiles of water in view so 1°F rips paint. Pan/fly re-samples. '}
        Loop / sail locks the 78–86 chip (paint keeps 87–90 distinct). Wide is the global rainbow.
      </p>
      {fitError && (
        <p className="text-[9px] text-amber-400/90 mt-1 px-0.5">{fitError}</p>
      )}
    </section>
  )
}
