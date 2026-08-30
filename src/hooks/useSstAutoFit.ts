/**
 * Auto-fit SST palette to water in view.
 *
 * Re-Fit ONLY on:
 *   1. first SST show (hydrate + SST appears)
 *   2. MUR ↔ Daily imagery switch
 *   3. explicit Fit tap (chip — not this hook)
 *
 * Date scrub does NOT re-sample the Fit window. A separate probe
 * marks "No SST for this date" without turning the layer off.
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
  const layers = useMapStore((s) => s.layers)
  const mapBounds = useMapStore((s) => s.mapBounds)
  const setSstRange = useMapStore((s) => s.setSstRange)
  const setSstEmpty = useMapStore((s) => s.setSstEmpty)
  const selectedDate = useMapStore((s) => s.selectedDate)
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
    const date = useMapStore.getState().selectedDate
    void (async () => {
      try {
        const span = await sampleSstRangeFromView(
          layerId,
          date,
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
    // selectedDate is intentionally omitted — date scrub keeps the last window.
  }, [hydrated, preset, layerId, boundsReady, setSstRange])

  useEffect(() => {
    if (!hydrated) {
      return
    }
    if (!layerId || !boundsReady) {
      setSstEmpty(false)
      return
    }
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
        if (controller.signal.aborted) return
        setSstEmpty(!span)
      } catch {
        if (!controller.signal.aborted) setSstEmpty(true)
      }
    })()
    return () => controller.abort()
  }, [hydrated, layerId, boundsReady, selectedDate, setSstEmpty])
}
