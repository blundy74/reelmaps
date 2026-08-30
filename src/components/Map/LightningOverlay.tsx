/**
 * LightningOverlay — live lightning for the OVERLAYS Lightning chip (`id === 'lightning'`).
 *
 *   1. RealEarth GOES-East GLM Flash Extent Density (5-min XYZ) — the visible product
 *   2. GLM individual flashes (canvas) — only when /glm/flashes returns points
 *   3. HRRR lightning tiles — fallback if RealEarth fails after a couple of tries
 *
 * Radar does not turn this on. HRRR lightning forecast (`hrrr-lightning`) is a
 * separate overlay. Do not wait on Lambda; raster FED is the live layer.
 */

import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { useWeatherStore, selectOverlayHour } from '../../store/weatherStore'
import {
  GLM_DENSITY_LAYER,
  GLM_PROBE_FAILS_BEFORE_HRRR,
  GLM_TILE_REFRESH_MS,
  glmFlashesFromApi,
  glmTileCacheBust,
  hasRealEarthWatermarkHeader,
  hrrrLightningFallbackUrl,
  isUsableRasterTile,
  lightningChipVisible,
  realEarthGlmFedUrl,
  realEarthGlmProbeUrl,
  restackGlmAboveImagery,
  type LightningProduct,
} from '../../lib/lightningOverlay'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
  mapReady?: number
}

interface Flash {
  lat: number
  lon: number
  energy?: number
  receivedAt: number
}

const GLM_SOURCE = 'glm-density-source'
const GLM_LAYER = GLM_DENSITY_LAYER
const GLM_API = 'https://xhac6pdww5.execute-api.us-east-2.amazonaws.com/glm/flashes'
const FLASH_MAX_AGE = 10000
const POLL_INTERVAL = 20000

async function probeRealEarthImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      referrer: 'no-referrer',
      credentials: 'omit',
    })
    if (hasRealEarthWatermarkHeader(res.headers)) return false
    if (!res.ok) return false
    const buf = await res.arrayBuffer()
    return isUsableRasterTile({
      ok: true,
      contentType: res.headers.get('content-type'),
      byteLength: buf.byteLength,
    })
  } catch {
    return false
  }
}

export default function LightningOverlay({ mapRef, mapReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flashesRef = useRef<Flash[]>([])
  const animRef = useRef<number>(0)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTileUrl = useRef('')
  const productRef = useRef<LightningProduct>('glm')
  const failCount = useRef(0)
  const probing = useRef(false)

  const lightningVisible = useWeatherStore((s) => lightningChipVisible(s.overlays))
  const opacity = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'lightning')?.opacity ?? 0.8,
  )
  const forecastHour = useWeatherStore(selectOverlayHour)
  const hourly = useWeatherStore((s) => s.hourly)
  const setLightningProduct = useWeatherStore((s) => s.setLightningProduct)

  const forecastHourRef = useRef(forecastHour)
  forecastHourRef.current = forecastHour
  const hourlyRef = useRef(hourly)
  hourlyRef.current = hourly
  const opacityRef = useRef(opacity)
  opacityRef.current = opacity

  const syncSize = useCallback(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    if (!canvas || !map) return
    const c = map.getContainer()
    const dpr = window.devicePixelRatio || 1
    canvas.width = c.clientWidth * dpr
    canvas.height = c.clientHeight * dpr
    canvas.style.width = `${c.clientWidth}px`
    canvas.style.height = `${c.clientHeight}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [mapRef])

  const applyTiles = useCallback((tileUrl: string, product: LightningProduct) => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    if (!map.getSource(GLM_SOURCE)) {
      map.addSource(GLM_SOURCE, { type: 'raster', tiles: [tileUrl], tileSize: 256 })
    }
    if (!map.getLayer(GLM_LAYER)) {
      map.addLayer({
        id: GLM_LAYER,
        type: 'raster',
        source: GLM_SOURCE,
        paint: {
          'raster-opacity': opacityRef.current,
          'raster-opacity-transition': { duration: 300, delay: 0 },
          'raster-fade-duration': 0,
        },
      })
    }
    map.setLayoutProperty(GLM_LAYER, 'visibility', 'visible')
    map.setPaintProperty(GLM_LAYER, 'raster-opacity', opacityRef.current)

    if (tileUrl !== lastTileUrl.current) {
      const src = map.getSource(GLM_SOURCE) as maplibregl.RasterTileSource
      if (src?.setTiles) src.setTiles([tileUrl])
      lastTileUrl.current = tileUrl
    }

    restackGlmAboveImagery(map)

    if (productRef.current !== product) {
      productRef.current = product
      setLightningProduct(product)
    }
  }, [mapRef, setLightningProduct])

  const showGlm = useCallback(() => {
    applyTiles(realEarthGlmFedUrl(glmTileCacheBust()), 'glm')
  }, [applyTiles])

  const showHrrr = useCallback(async () => {
    const url = await hrrrLightningFallbackUrl(forecastHourRef.current, hourlyRef.current)
    if (url) applyTiles(url, 'hrrr')
    else {
      productRef.current = 'hrrr'
      setLightningProduct('hrrr')
    }
  }, [applyTiles, setLightningProduct])

  const probeAndPaint = useCallback(async () => {
    if (probing.current) return
    probing.current = true
    try {
      // Paint GLM first — do not wait on the probe, and do not start on HRRR.
      showGlm()
      let ok = false
      for (let i = 0; i < GLM_PROBE_FAILS_BEFORE_HRRR; i++) {
        ok = await probeRealEarthImage(realEarthGlmProbeUrl(`${glmTileCacheBust()}-${i}`))
        if (ok) break
      }
      if (ok) {
        failCount.current = 0
        showGlm()
        return
      }
      failCount.current = GLM_PROBE_FAILS_BEFORE_HRRR
      await showHrrr()
    } finally {
      probing.current = false
    }
  }, [showGlm, showHrrr])

  const fetchFlashes = useCallback(async () => {
    try {
      const res = await fetch(GLM_API, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return
      const data = await res.json()
      const points = glmFlashesFromApi(data)
      if (points.length === 0) return
      const now = Date.now()
      const stagger = POLL_INTERVAL / Math.max(points.length, 1)
      const newFlashes: Flash[] = points.map((f, i) => ({
        lat: f.lat,
        lon: f.lon,
        energy: f.energy,
        receivedAt: now + i * stagger * 0.5,
      }))
      flashesRef.current = [
        ...flashesRef.current.filter((f) => now - f.receivedAt < FLASH_MAX_AGE),
        ...newFlashes,
      ]
    } catch { /* ignore fetch errors — raster FED is the visible product */ }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!lightningVisible) {
      // Hide tiles even if the canvas has already unmounted (return null below).
      try {
        if (map.getLayer(GLM_LAYER)) map.setLayoutProperty(GLM_LAYER, 'visibility', 'none')
      } catch { /* style not ready */ }
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      flashesRef.current = []
      if (pollTimer.current) clearInterval(pollTimer.current)
      if (refreshTimer.current) clearInterval(refreshTimer.current)
      cancelAnimationFrame(animRef.current)
      lastTileUrl.current = ''
      failCount.current = 0
      productRef.current = 'glm'
      setLightningProduct('glm')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    syncSize()

    const restack = () => {
      try { restackGlmAboveImagery(map) } catch { /* style not ready */ }
    }
    const run = () => { void probeAndPaint() }
    if (map.isStyleLoaded()) run()
    else map.once('style.load', run)

    const onStyleLoad = () => {
      lastTileUrl.current = ''
      failCount.current = 0
      setTimeout(run, 50)
    }
    map.on('style.load', onStyleLoad)
    // Later SST / colormap rebuilds addLayer after GLM — keep FED on top.
    map.on('idle', restack)
    const restackTimer = window.setTimeout(restack, 250)

    fetchFlashes()
    pollTimer.current = setInterval(fetchFlashes, POLL_INTERVAL)
    refreshTimer.current = setInterval(() => {
      lastTileUrl.current = ''
      void probeAndPaint()
    }, GLM_TILE_REFRESH_MS)

    const ctx = canvas.getContext('2d')
    let running = !!ctx
    const container = map.getContainer()

    const frame = () => {
      if (!running || !ctx) return
      const now = Date.now()
      const cw = container.clientWidth
      const ch = container.clientHeight

      ctx.clearRect(0, 0, cw, ch)
      flashesRef.current = flashesRef.current.filter((f) => now - f.receivedAt < FLASH_MAX_AGE)

      for (const flash of flashesRef.current) {
        const age = now - flash.receivedAt
        if (age < 0) continue

        const pt = map.project([flash.lon, flash.lat])
        if (pt.x < -50 || pt.x > cw + 50 || pt.y < -50 || pt.y > ch + 50) continue

        const progress = age / FLASH_MAX_AGE

        if (progress < 0.15) {
          const t = progress / 0.15
          const intensity = 1.0 - t
          const r = 20 + intensity * 15
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r)
          grad.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.9})`)
          grad.addColorStop(0.3, `rgba(220, 230, 255, ${intensity * 0.5})`)
          grad.addColorStop(1, 'rgba(200, 210, 255, 0)')
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`
          ctx.fill()
        }

        if (progress < 0.4) {
          const t = progress / 0.4
          const ringR = t * 20
          const ringA = (1 - t) * 0.5
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(200, 200, 255, ${ringA})`
          ctx.lineWidth = 1.5 * (1 - t) + 0.3
          ctx.stroke()
        }

        const dotAlpha = Math.max(0.05, 0.6 * (1 - progress))
        const dotSize = Math.max(1, 2.5 * (1 - progress * 0.5))
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, dotSize, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${dotAlpha})`
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(frame)
    }

    if (ctx) animRef.current = requestAnimationFrame(frame)

    const onResize = () => syncSize()
    map.on('resize', onResize)

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
      map.off('resize', onResize)
      map.off('style.load', onStyleLoad)
      map.off('idle', restack)
      window.clearTimeout(restackTimer)
      if (pollTimer.current) clearInterval(pollTimer.current)
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [mapRef, lightningVisible, syncSize, fetchFlashes, probeAndPaint, setLightningProduct, mapReady])

  useEffect(() => {
    if (!lightningVisible) return
    if (productRef.current === 'hrrr') {
      lastTileUrl.current = ''
      void showHrrr()
    } else {
      try {
        mapRef.current?.setPaintProperty(GLM_LAYER, 'raster-opacity', opacity)
      } catch { /* layer not mounted yet */ }
    }
  }, [lightningVisible, forecastHour, opacity, showHrrr, mapRef])

  useEffect(() => {
    return () => {
      const map = mapRef.current
      if (!map) return
      try {
        if (map.getLayer(GLM_LAYER)) map.removeLayer(GLM_LAYER)
        if (map.getSource(GLM_SOURCE)) map.removeSource(GLM_SOURCE)
      } catch { /* disposed */ }
      if (pollTimer.current) clearInterval(pollTimer.current)
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [mapRef])

  if (!lightningVisible) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 6,
      }}
    />
  )
}
