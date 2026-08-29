/**
 * Auto-fit SST palette to p5–p95 of water in view.
 * Runs when Fit is the preset and SST first shows, the date changes, or
 * imagery switches. Uses boundsReady (not the bounds object) so pans do not
 * re-sample. Manual Fit-after-pan is the chip's job.
 *
 * Waits for persist hydration so a leftover v12 GOM default can migrate to
 * Fit before the first sample — otherwise rehydrate aborts the in-flight fit.
 */

import { useEffect, useRef, useState } from 'react'
import { useMapStore } from '../store/mapStore'
import { activeSstLayerId, sampleSstRangeFromView } from '../lib/sstPalette'

function usePersistHydrated(): boolean {
  const persistApi = useMapStore.persist
  const [hydrated, setHydrated] = useState(() => persistApi?.hasHydrated?.() ?? true)

  useEffect(() => {
    if (!persistApi?.onFinishHydration) {
      setHydrated(true)
      return
    }
    if (persistApi.hasHydrated()) {
      setHydrated(true)
      return
    }
    return persistApi.onFinishHydration(() => setHydrated(true))
  }, [persistApi])

  return hydrated
}

export function useSstAutoFit() {
  const preset = useMapStore((s) => s.sstRange.preset)
  const selectedDate = useMapStore((s) => s.selectedDate)
  const layers = useMapStore((s) => s.layers)
  const mapBounds = useMapStore((s) => s.mapBounds)
  const setSstRange = useMapStore((s) => s.setSstRange)
  const hydrated = usePersistHydrated()

  const layerId = activeSstLayerId(layers)
  const boundsReady = mapBounds != null
  const boundsRef = useRef(mapBounds)
  boundsRef.current = mapBounds

  useEffect(() => {
    if (!hydrated) return
    if (preset !== 'fit' || !layerId || !boundsReady) return
    const bounds = boundsRef.current
    if (!bounds) return

    const controller = new AbortController()
    void (async () => {
      try {
        const span = await sampleSstRangeFromView(
          layerId,
          selectedDate,
          bounds,
          controller.signal,
        )
        if (controller.signal.aborted || !span) return
        const cur = useMapStore.getState().sstRange
        if (cur.preset !== 'fit') return
        if (cur.minF === span.minF && cur.maxF === span.maxF) return
        setSstRange({ preset: 'fit', minF: span.minF, maxF: span.maxF })
      } catch {
        // Chip UI reports manual-fit errors; auto-fit fails quiet.
      }
    })()
    return () => controller.abort()
  }, [hydrated, preset, selectedDate, layerId, boundsReady, setSstRange])
}
