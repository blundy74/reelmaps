/**
 * SST color-range chips for the right rail.
 * GOM 78–86 is the default so a 2° wall reads; Fit stretches to water in view;
 * Wide returns to the GIBS-scale 50–90°F rainbow.
 */

import { useState, type ReactNode } from 'react'
import { useMapStore } from '../../store/mapStore'
import { cn } from '../../lib/utils'
import {
  DEFAULT_SST_RANGE,
  SST_WIDE_MAX_F,
  SST_WIDE_MIN_F,
  sampleSstRangeFromView,
  type SstRangePreset,
} from '../../lib/sstPalette'

const SST_LAYER_IDS = ['sst-mur', 'sst-goes'] as const

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
        'px-2 py-1 rounded-full text-[10px] font-medium border transition-colors',
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

  const sstOn = SST_LAYER_IDS.some((id) => layers.find((l) => l.id === id)?.visible)
  if (!sstOn) return null

  const setPreset = (preset: SstRangePreset, minF: number, maxF: number) => {
    setFitError(null)
    setSstRange({ preset, minF, maxF })
  }

  const handleFit = async () => {
    if (!mapBounds || fitting) return
    const layerId = layers.find((l) => l.id === 'sst-goes' && l.visible)?.id
      ?? layers.find((l) => l.id === 'sst-mur' && l.visible)?.id
    if (!layerId) return

    setFitting(true)
    setFitError(null)
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

  const fitLabel =
    sstRange.preset === 'fit'
      ? `Fit ${sstRange.minF}–${sstRange.maxF}`
      : fitting
        ? 'Fitting…'
        : 'Fit to view'

  return (
    <section>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
        SST color range
      </p>
      <div className="flex flex-wrap gap-1">
        <Chip
          active={sstRange.preset === 'gom'}
          onClick={() => setPreset('gom', DEFAULT_SST_RANGE.minF, DEFAULT_SST_RANGE.maxF)}
        >
          GOM 78–86°F
        </Chip>
        <Chip active={sstRange.preset === 'fit'} disabled={fitting || !mapBounds} onClick={handleFit}>
          {fitLabel}
        </Chip>
        <Chip
          active={sstRange.preset === 'wide'}
          onClick={() => setPreset('wide', SST_WIDE_MIN_F, SST_WIDE_MAX_F)}
        >
          Wide 50–90°F
        </Chip>
      </div>
      <p className="text-[9px] text-slate-600 mt-1 px-0.5 leading-snug">
        Stretches the satellite rainbow so Gulf rips read. Same VIIRS / MUR tiles — not a new product.
        If the water is all one color, hit Fit.
      </p>
      {fitError && (
        <p className="text-[9px] text-amber-400/90 mt-1 px-0.5">{fitError}</p>
      )}
    </section>
  )
}
