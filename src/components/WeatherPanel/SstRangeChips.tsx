/**
 * SST color-range chips for the right rail.
 * Fit-to-view (p5–p95 of water on screen) is the default so late-summer
 * 88s are not clipped. Loop / sail locks 78–86 when the Gulf is in that band.
 * Wide is the global 50–90 rainbow. Auto-fit on first show / date / imagery
 * switch — not on every pan.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
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

  const layerId = activeSstLayerId(layers)
  const boundsReady = mapBounds != null
  const boundsRef = useRef(mapBounds)
  boundsRef.current = mapBounds
  const sstRangeRef = useRef(sstRange)
  sstRangeRef.current = sstRange

  const runFit = async (signal?: AbortSignal, force = false) => {
    const bounds = boundsRef.current
    const id = activeSstLayerId(useMapStore.getState().layers)
    const date = useMapStore.getState().selectedDate
    if (!bounds || !id) return

    setFitting(true)
    setFitError(null)
    try {
      const span = await sampleSstRangeFromView(id, date, bounds, signal)
      if (signal?.aborted) return
      if (!span) {
        setFitError('No SST water in view — try a clearer date or zoom to ocean.')
        return
      }
      const cur = sstRangeRef.current
      if (
        !force
        && cur.preset === 'fit'
        && cur.minF === span.minF
        && cur.maxF === span.maxF
      ) {
        return
      }
      setSstRange({ preset: 'fit', minF: span.minF, maxF: span.maxF })
    } catch {
      if (signal?.aborted) return
      setFitError('Could not sample the tiles in view.')
    } finally {
      if (!signal?.aborted) setFitting(false)
    }
  }

  // Auto-fit when Fit is the active preset: first show, date change, imagery switch.
  // boundsReady (not the bounds object) so pans do not re-sample.
  useEffect(() => {
    if (sstRange.preset !== 'fit') return
    if (!layerId || !boundsReady) return
    const controller = new AbortController()
    void runFit(controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sstRange.preset, selectedDate, layerId, boundsReady])

  const handleFitChip = () => {
    if (sstRange.preset !== 'fit') {
      setFitError(null)
      setSstRange({ ...sstRange, preset: 'fit' })
      return
    }
    void runFit(undefined, true)
  }

  if (!layerId) return null

  const fitIsPlaceholder =
    sstRange.minF === SST_WIDE_MIN_F && sstRange.maxF === SST_WIDE_MAX_F
  const fitLabel =
    sstRange.preset === 'fit' && !fitIsPlaceholder
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
        <Chip active={sstRange.preset === 'fit'} disabled={fitting || !boundsReady} onClick={handleFitChip}>
          {fitLabel}
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
      <p className="text-[9px] text-slate-600 mt-1 px-0.5 leading-snug">
        Fit is the default — p5–p95 of water in view, so August 88s are not clipped.
        Loop / sail locks 78–86 when the Gulf is actually in that band. Wide is the global rainbow.
      </p>
      {fitError && (
        <p className="text-[9px] text-amber-400/90 mt-1 px-0.5">{fitError}</p>
      )}
    </section>
  )
}
