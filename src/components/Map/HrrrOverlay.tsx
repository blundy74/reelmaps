/**
 * HrrrOverlay — generic HRRR tile overlay for any variable.
 * Uses setTiles() with brief opacity hide to swap forecast hours
 * without tile accumulation.
 */

import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import { fetchHrrrManifest, hrrrTileUrl } from '../../lib/layerUrls'
import { useWeatherStore } from '../../store/weatherStore'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
  variable: string
  overlayId: string
}

export default function HrrrOverlay({ mapRef, variable, overlayId }: Props) {
  const visible = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === overlayId)?.visible ?? false,
  )
  const opacity = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === overlayId)?.opacity ?? 0.6,
  )
  const forecastHour = useWeatherStore((s) => s.selectedForecastHour)
  const hourlyData = useWeatherStore((s) => s.hourly)

  const sourceId = `hrrr-${variable}-source`
  const layerId = `hrrr-${variable}-layer`
  const manifestRef = useRef<{ run_date: string; run_hour: string; variables?: Record<string, number[]>; forecast_hours?: number[]; wave_run?: { run_date: string; run_hour: string } } | null>(null)
  const lastFh = useRef(-1)

  const nowOffsetHours = (() => {
    if (!hourlyData.length) return 4
    const now = Date.now()
    for (let i = 0; i < hourlyData.length; i++) {
      if (new Date(hourlyData[i].time).getTime() >= now - 30 * 60 * 1000) return i
    }
    return 4
  })()

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!visible) {
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none')
      lastFh.current = -1
      return
    }

    const sync = async () => {
      if (!map.isStyleLoaded()) return

      if (!manifestRef.current) {
        manifestRef.current = await fetchHrrrManifest()
      }
      const manifest = manifestRef.current
      if (!manifest) return

      const hoursFromNow = forecastHour - nowOffsetHours
      const runTime = new Date(
        `${manifest.run_date.slice(0, 4)}-${manifest.run_date.slice(4, 6)}-${manifest.run_date.slice(6, 8)}T${manifest.run_hour}:00:00Z`
      )
      const runAge = (Date.now() - runTime.getTime()) / 3600000
      const hrrrFh = Math.round(runAge + hoursFromNow)

      const availableHours = manifest.variables?.[variable] ?? manifest.forecast_hours ?? []
      if (hrrrFh < 0 || hrrrFh > 18 || !availableHours.includes(hrrrFh)) {
        if (map.getLayer(layerId)) map.setPaintProperty(layerId, 'raster-opacity', 0)
        lastFh.current = -1
        return
      }

      const tileUrl = hrrrTileUrl(variable, manifest.run_date, manifest.run_hour, hrrrFh)

      // Ensure source+layer exist
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'raster', tiles: [tileUrl], tileSize: 256 })
      }
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': opacity,
            'raster-opacity-transition': { duration: 0, delay: 0 },
            'raster-fade-duration': 0,
          },
        })
        for (const id of ['clusters', 'cluster-count', 'fishing-spots', 'fishing-spots-rigs', 'fishing-spots-labels']) {
          if (map.getLayer(id)) map.moveLayer(id)
        }
      }

      // Swap tiles when forecast hour changes
      if (hrrrFh !== lastFh.current) {
        // Hide briefly to clear old tiles during swap
        map.setPaintProperty(layerId, 'raster-opacity', 0)
        const src = map.getSource(sourceId) as maplibregl.RasterTileSource
        if (src?.setTiles) src.setTiles([tileUrl])
        setTimeout(() => {
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, 'raster-opacity', opacity)
          }
        }, 50)
        lastFh.current = hrrrFh
      } else {
        map.setLayoutProperty(layerId, 'visibility', 'visible')
        map.setPaintProperty(layerId, 'raster-opacity', opacity)
      }
    }

    if (map.isStyleLoaded()) {
      sync()
    } else {
      map.once('style.load', () => sync())
    }

    const onStyleLoad = () => {
      lastFh.current = -1
      setTimeout(() => sync(), 50)
    }
    map.on('style.load', onStyleLoad)

    return () => { map.off('style.load', onStyleLoad) }
  }, [mapRef, visible, opacity, forecastHour, variable, overlayId, sourceId, layerId, nowOffsetHours])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const map = mapRef.current
      if (!map) return
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      } catch { /* disposed */ }
    }
  }, [mapRef, layerId, sourceId])

  return null
}
