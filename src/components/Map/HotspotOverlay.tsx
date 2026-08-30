/**
 * HotspotOverlay — displays the fishing hotspot heat map.
 * Tile URL format: /tiles/hotspot/{YYYYMMDD}/{z}/{x}/{y}.png
 */

import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMapStore } from '../../store/mapStore'

const TILE_BASE = import.meta.env.VITE_HRRR_TILE_URL || 'https://xhac6pdww5.execute-api.us-east-2.amazonaws.com'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
  /** Which variant to display */
  variant?: 'hotspot' | 'hotspot-inshore' | 'hotspot-offshore' | 'sargassum' | 'sargassum-daily'
  mapReady?: number
}

function toDateKey(isoDate: string): string {
  return isoDate.replace(/-/g, '')
}

function lngLatToTile(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n)
  return { x, y }
}

async function hotspotTileHasInk(url: string, signal?: AbortSignal): Promise<boolean | null> {
  try {
    const res = await fetch(url, { signal })
    if (res.status === 404 || res.status === 204) return false
    if (!res.ok) return null
    const blob = await res.blob()
    if (blob.size < 80) return false
    const img = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, img.width, img.height).data
    let ink = 0
    for (let i = 3; i < data.length; i += 32) {
      if (data[i] > 24) ink++
    }
    img.close()
    return ink > 6
  } catch {
    return null
  }
}

function addHotspotLayer(map: maplibregl.Map, srcId: string, lyrId: string, variantPath: string, dateKey: string, op: number) {
  const tileUrl = `${TILE_BASE}/tiles/${variantPath}/${dateKey}/{z}/{x}/{y}.png`

  if (!map.getSource(srcId)) {
    map.addSource(srcId, { type: 'raster', tiles: [tileUrl], tileSize: 256, maxzoom: 8 })
  }

  if (!map.getLayer(lyrId)) {
    map.addLayer({
      id: lyrId,
      type: 'raster',
      source: srcId,
      paint: {
        'raster-opacity': op,
        'raster-opacity-transition': { duration: 300, delay: 0 },
        'raster-resampling': 'linear',
      },
    })
  }
}

function removeHotspotLayer(map: maplibregl.Map, srcId: string, lyrId: string) {
  if (map.getLayer(lyrId)) map.removeLayer(lyrId)
  if (map.getSource(srcId)) map.removeSource(srcId)
}

function moveSpotLayersToTop(map: maplibregl.Map) {
  for (const id of [
    'clusters', 'cluster-count', 'fishing-spots', 'fishing-spots-rigs', 'fishing-spots-fads', 'fishing-spots-labels',
    'user-clusters', 'user-cluster-count', 'user-spots', 'user-spots-labels',
  ]) {
    if (map.getLayer(id)) map.moveLayer(id)
  }
}

export default function HotspotOverlay({ mapRef, variant = 'hotspot', mapReady }: Props) {
  const sourceId = `${variant}-source`
  const layerId = `${variant}-layer`

  const visible = useMapStore(
    (s) => s.layers.find((l) => l.id === variant)?.visible ?? false,
  )
  const opacity = useMapStore(
    (s) => s.layers.find((l) => l.id === variant)?.opacity ?? 0.55,
  )
  const selectedDate = useMapStore((s) => s.selectedDate)
  const setHotspotEmpty = useMapStore((s) => s.setHotspotEmpty)
  const activeDateKey = useRef('')

  // Main effect: manage layer lifecycle based on visibility and date
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => {
      if (!map.isStyleLoaded()) return

      const dateKey = toDateKey(selectedDate)

      if (!visible) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none')
        }
        if (variant === 'hotspot') setHotspotEmpty(false)
        return
      }

      // Date changed or layer missing — rebuild
      if (activeDateKey.current !== dateKey || !map.getSource(sourceId)) {
        removeHotspotLayer(map, sourceId, layerId)
        addHotspotLayer(map, sourceId, layerId, variant, dateKey, opacity)
        moveSpotLayersToTop(map)
        activeDateKey.current = dateKey
      } else if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'visible')
        map.setPaintProperty(layerId, 'raster-opacity', opacity)
      }
    }

    // Apply immediately if style is ready, otherwise wait
    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('style.load', apply)
    }

    // Re-apply after basemap switch (setStyle destroys all layers)
    const onStyleLoad = () => {
      activeDateKey.current = '' // force rebuild
      apply()
    }
    map.on('style.load', onStyleLoad)

    const onError = (e: { sourceId?: string }) => {
      if (variant === 'hotspot' && e.sourceId === sourceId) setHotspotEmpty(true)
    }
    map.on('error', onError)

    let probeAbort: AbortController | null = null
    const probeEmpty = () => {
      if (variant !== 'hotspot' || !visible) return
      probeAbort?.abort()
      const controller = new AbortController()
      probeAbort = controller
      const z = Math.min(8, Math.max(0, Math.floor(map.getZoom())))
      const c = map.getCenter()
      const dateKey = toDateKey(selectedDate)
      const tiles = [
        lngLatToTile(c.lng, c.lat, z),
        lngLatToTile(c.lng + 0.4, c.lat, z),
        lngLatToTile(c.lng - 0.4, c.lat, z),
      ]
      void (async () => {
        const results = await Promise.all(
          tiles.map(({ x, y }) =>
            hotspotTileHasInk(`${TILE_BASE}/tiles/${variant}/${dateKey}/${z}/${x}/${y}.png`, controller.signal),
          ),
        )
        if (controller.signal.aborted) return
        if (results.some((r) => r === true)) {
          setHotspotEmpty(false)
          return
        }
        if (results.every((r) => r === false)) setHotspotEmpty(true)
      })()
    }

    if (visible && variant === 'hotspot') {
      map.once('idle', probeEmpty)
      map.on('moveend', probeEmpty)
    }

    return () => {
      map.off('style.load', onStyleLoad)
      map.off('error', onError)
      map.off('moveend', probeEmpty)
      probeAbort?.abort()
    }
  }, [mapRef, visible, opacity, selectedDate, sourceId, layerId, variant, mapReady, setHotspotEmpty])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const map = mapRef.current
      if (!map) return
      try { removeHotspotLayer(map, sourceId, layerId) } catch { /* disposed */ }
    }
  }, [mapRef, sourceId, layerId])

  return null
}
