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
  /** Which hotspot variant to display: 'hotspot', 'hotspot-inshore', or 'hotspot-offshore' */
  variant?: 'hotspot' | 'hotspot-inshore' | 'hotspot-offshore'
}

function toDateKey(isoDate: string): string {
  return isoDate.replace(/-/g, '')
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
  for (const id of ['clusters', 'cluster-count', 'fishing-spots', 'fishing-spots-rigs', 'fishing-spots-fads', 'fishing-spots-labels']) {
    if (map.getLayer(id)) map.moveLayer(id)
  }
}

export default function HotspotOverlay({ mapRef, variant = 'hotspot' }: Props) {
  const sourceId = `${variant}-source`
  const layerId = `${variant}-layer`

  const visible = useMapStore(
    (s) => s.layers.find((l) => l.id === variant)?.visible ?? false,
  )
  const opacity = useMapStore(
    (s) => s.layers.find((l) => l.id === variant)?.opacity ?? 0.55,
  )
  const selectedDate = useMapStore((s) => s.selectedDate)
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

    return () => {
      map.off('style.load', onStyleLoad)
    }
  }, [mapRef, visible, opacity, selectedDate, sourceId, layerId, variant])

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
