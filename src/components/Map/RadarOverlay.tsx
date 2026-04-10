/**
 * RadarOverlay — combined real-time radar + forecast precipitation.
 *
 * Two data sources, stitched by real time:
 *   Past/Current:  RainViewer — actual radar composites (~2h past + 30 min nowcast)
 *   Forecast:      NOAA NDFD QPF — model precipitation forecast (up to 7 days)
 *
 * The forecast bar's selectedForecastHour is converted to a real Unix
 * timestamp.  If that time falls within RainViewer's range we show radar;
 * otherwise we show the NDFD forecast layer.
 */

import { useEffect, useRef, useMemo, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { fetchRainViewerFrames, rainViewerTileUrl, type RainViewerData } from '../../lib/weatherApi'
import { fetchHrrrManifest, hrrrPrecipUrl } from '../../lib/layerUrls'
import { useWeatherStore } from '../../store/weatherStore'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
}

// RainViewer (past radar)
const RV_SOURCE = 'radar-rv-source'
const RV_LAYER = 'radar-rv-layer'

// Forecast precipitation (HRRR tiles if available, NDFD as fallback)
const FORECAST_SOURCE = 'radar-forecast-source'
const FORECAST_LAYER = 'radar-forecast-layer'
// NOAA NDFD QPF — fallback when HRRR is not configured
const NDFD_TILE_URL =
  '/proxy/nowcoast/arcgis/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_qpf6hrs_offsets/MapServer/WMSServer' +
  '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true' +
  '&LAYERS=1&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'

export default function RadarOverlay({ mapRef }: Props) {
  const radarVisible = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'radar')?.visible ?? false,
  )
  const radarOpacity = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'radar')?.opacity ?? 0.85,
  )
  const forecastHour = useWeatherStore((s) => s.selectedForecastHour)

  const framesRef = useRef<RainViewerData | null>(null)
  const lastRvIdx = useRef(-1)
  const lastForecastFh = useRef(-1)
  const activeSource = useRef<'rv' | 'forecast' | null>(null)
  const hrrrManifestRef = useRef<{ run_date: string; run_hour: string; forecast_hours: number[] } | null>(null)

  // ── Hourly data starts 5h before "now", so index 5 = now ──────────
  // forecastHour 0 = 5h ago, forecastHour 5 = now, forecastHour 53 = +48h
  const hourlyData = useWeatherStore((s) => s.hourly)
  const nowOffsetHours = useMemo(() => {
    if (!hourlyData.length) return 3
    const now = Date.now()
    for (let i = 0; i < hourlyData.length; i++) {
      if (new Date(hourlyData[i].time).getTime() >= now - 30 * 60 * 1000) return i
    }
    return 3
  }, [hourlyData])

  // Store latest values in refs so the sync function always reads current state
  // without requiring effect re-runs on every forecastHour tick
  const forecastHourRef = useRef(forecastHour)
  forecastHourRef.current = forecastHour
  const opacityRef = useRef(radarOpacity)
  opacityRef.current = radarOpacity
  const nowOffsetRef = useRef(nowOffsetHours)
  nowOffsetRef.current = nowOffsetHours

  const sync = useCallback(async (map: maplibregl.Map) => {
    if (!map.isStyleLoaded()) return

    const currentOpacity = opacityRef.current
    const hoursFromNow = forecastHourRef.current - nowOffsetRef.current

    // ── Try HRRR first (covers past ~4h through +18h from run time) ──
    if (!hrrrManifestRef.current) {
      hrrrManifestRef.current = await fetchHrrrManifest()
    }
    const hrrr = hrrrManifestRef.current

    let hrrrFh = -1
    if (hrrr) {
      const runTime = new Date(`${hrrr.run_date.slice(0,4)}-${hrrr.run_date.slice(4,6)}-${hrrr.run_date.slice(6,8)}T${hrrr.run_hour}:00:00Z`)
      const runAge = (Date.now() - runTime.getTime()) / 3600000
      hrrrFh = Math.round(runAge + hoursFromNow)
    }

    const hrrrAvailable = hrrr && hrrrFh >= 0 && hrrrFh <= 18 && hrrr.forecast_hours.includes(hrrrFh)

    if (hrrrAvailable) {
      const forecastTileUrl = hrrrPrecipUrl(hrrr!.run_date, hrrr!.run_hour, hrrrFh)

      if (map.getLayer(RV_LAYER)) map.setPaintProperty(RV_LAYER, 'raster-opacity', 0.001)

      if (!map.getSource(FORECAST_SOURCE)) {
        map.addSource(FORECAST_SOURCE, { type: 'raster', tiles: [forecastTileUrl], tileSize: 256 })
      }
      if (!map.getLayer(FORECAST_LAYER)) {
        map.addLayer({
          id: FORECAST_LAYER, type: 'raster', source: FORECAST_SOURCE,
          paint: {
            'raster-opacity': currentOpacity,
            'raster-opacity-transition': { duration: 0, delay: 0 },
            'raster-fade-duration': 0,
          },
        })
        moveSpotLayersToTop(map)
      }

      if (hrrrFh !== lastForecastFh.current) {
        map.setPaintProperty(FORECAST_LAYER, 'raster-opacity', 0)
        const src = map.getSource(FORECAST_SOURCE) as maplibregl.RasterTileSource
        if (src?.setTiles) src.setTiles([forecastTileUrl])
        setTimeout(() => {
          if (map.getLayer(FORECAST_LAYER)) {
            map.setPaintProperty(FORECAST_LAYER, 'raster-opacity', opacityRef.current)
          }
        }, 50)
        lastForecastFh.current = hrrrFh
      } else {
        map.setLayoutProperty(FORECAST_LAYER, 'visibility', 'visible')
        map.setPaintProperty(FORECAST_LAYER, 'raster-opacity', currentOpacity)
      }
      activeSource.current = 'forecast'

    } else if (hoursFromNow <= 0.5) {
      let rv: RainViewerData
      try {
        rv = await fetchRainViewerFrames()
        framesRef.current = rv
      } catch { return }

      const allFrames = [...rv.past, ...rv.nowcast]
      if (!allFrames.length) return

      const nowSec = Math.floor(Date.now() / 1000)
      const targetSec = nowSec + hoursFromNow * 3600

      let bestIdx = 0
      let bestDiff = Infinity
      for (let i = 0; i < allFrames.length; i++) {
        const diff = Math.abs(allFrames[i].time - targetSec)
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i }
      }

      const tileUrl = rainViewerTileUrl(rv.host, allFrames[bestIdx].path)

      if (!map.getSource(RV_SOURCE)) {
        map.addSource(RV_SOURCE, { type: 'raster', tiles: [tileUrl], tileSize: 256 })
      }
      if (!map.getLayer(RV_LAYER)) {
        map.addLayer({
          id: RV_LAYER, type: 'raster', source: RV_SOURCE,
          paint: { 'raster-opacity': 0.001, 'raster-opacity-transition': { duration: 300, delay: 0 } },
        })
        moveSpotLayersToTop(map)
      }

      map.setLayoutProperty(RV_LAYER, 'visibility', 'visible')
      map.setPaintProperty(RV_LAYER, 'raster-opacity', currentOpacity)
      if (map.getLayer(FORECAST_LAYER)) map.setPaintProperty(FORECAST_LAYER, 'raster-opacity', 0.001)

      if (bestIdx !== lastRvIdx.current) {
        const src = map.getSource(RV_SOURCE) as maplibregl.RasterTileSource
        if (src?.setTiles) src.setTiles([tileUrl])
        lastRvIdx.current = bestIdx
      }
      activeSource.current = 'rv'

    } else {
      const forecastTileUrl = NDFD_TILE_URL

      if (!map.getSource(FORECAST_SOURCE)) {
        map.addSource(FORECAST_SOURCE, { type: 'raster', tiles: [forecastTileUrl], tileSize: 256 })
      }
      if (!map.getLayer(FORECAST_LAYER)) {
        map.addLayer({
          id: FORECAST_LAYER, type: 'raster', source: FORECAST_SOURCE,
          paint: { 'raster-opacity': 0.001, 'raster-opacity-transition': { duration: 300, delay: 0 }, 'raster-resampling': 'linear' },
        })
        moveSpotLayersToTop(map)
      }

      map.setLayoutProperty(FORECAST_LAYER, 'visibility', 'visible')
      map.setPaintProperty(FORECAST_LAYER, 'raster-opacity', currentOpacity)
      if (map.getLayer(RV_LAYER)) map.setPaintProperty(RV_LAYER, 'raster-opacity', 0.001)

      const ndfdFh = Math.round(hoursFromNow)
      if (ndfdFh !== lastForecastFh.current) {
        const src = map.getSource(FORECAST_SOURCE) as maplibregl.RasterTileSource
        if (src?.setTiles) src.setTiles([forecastTileUrl])
        lastForecastFh.current = ndfdFh
      }

      activeSource.current = 'forecast'
    }
  }, [])

  // ── Setup: add layers when radar becomes visible ──────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!radarVisible) {
      if (map.getLayer(RV_LAYER)) map.setLayoutProperty(RV_LAYER, 'visibility', 'none')
      if (map.getLayer(FORECAST_LAYER)) map.setLayoutProperty(FORECAST_LAYER, 'visibility', 'none')
      lastRvIdx.current = -1
      lastForecastFh.current = -1
      activeSource.current = null
      return
    }

    const run = () => sync(map)

    if (map.isStyleLoaded()) {
      run()
    } else {
      map.once('style.load', run)
    }

    const onStyleLoad = () => {
      lastRvIdx.current = -1
      lastForecastFh.current = -1
      activeSource.current = null
      setTimeout(run, 50)
    }
    map.on('style.load', onStyleLoad)

    return () => { map.off('style.load', onStyleLoad) }
  }, [mapRef, radarVisible, sync])

  // ── Animate: update tiles when forecast hour changes (no effect teardown) ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !radarVisible) return
    if (map.isStyleLoaded()) sync(map)
  }, [mapRef, radarVisible, forecastHour, sync])

  // ── Update opacity without full re-sync ──────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !radarVisible) return
    if (map.getLayer(FORECAST_LAYER)) map.setPaintProperty(FORECAST_LAYER, 'raster-opacity', radarOpacity)
    if (map.getLayer(RV_LAYER)) map.setPaintProperty(RV_LAYER, 'raster-opacity', radarOpacity)
  }, [mapRef, radarVisible, radarOpacity])

  // Cleanup
  useEffect(() => {
    return () => {
      const map = mapRef.current
      if (!map) return
      try {
        for (const lyr of [RV_LAYER, FORECAST_LAYER]) { if (map.getLayer(lyr)) map.removeLayer(lyr) }
        for (const src of [RV_SOURCE, FORECAST_SOURCE]) { if (map.getSource(src)) map.removeSource(src) }
      } catch { /* map may be disposed */ }
    }
  }, [mapRef])

  return null
}

function moveSpotLayersToTop(map: maplibregl.Map) {
  for (const id of ['clusters', 'cluster-count', 'fishing-spots', 'fishing-spots-rigs', 'fishing-spots-labels']) {
    if (map.getLayer(id)) map.moveLayer(id)
  }
}
