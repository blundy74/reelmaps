/**
 * LightningOverlay — three-layer lightning visualization:
 *
 *   1. GIBS GLM density tiles (raster) — background heatmap of recent flash density
 *   2. GLM individual flashes (canvas) — animated white flash bursts from NOAA satellite
 *   3. HRRR forecast — handled by separate HrrrOverlay component
 *
 * Polls the GLM API every 20 seconds for fresh flash coordinates.
 * Each flash renders as a bright white burst that fades over 3 seconds.
 */

import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { useWeatherStore } from '../../store/weatherStore'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
}

interface Flash {
  lat: number
  lon: number
  energy?: number
  receivedAt: number // when we received it from the API
}

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best'
const GLM_SOURCE = 'glm-density-source'
const GLM_LAYER = 'glm-density-layer'
const GLM_API = 'https://xhac6pdww5.execute-api.us-east-2.amazonaws.com/glm/flashes'
const FLASH_MAX_AGE = 10000 // 10 seconds visible per flash
const POLL_INTERVAL = 20000 // 20 seconds

function getGlmTime(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - 20)
  now.setMinutes(Math.floor(now.getMinutes() / 10) * 10, 0, 0)
  return now.toISOString().slice(0, 19) + 'Z'
}

export default function LightningOverlay({ mapRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const flashesRef = useRef<Flash[]>([])
  const animRef = useRef<number>(0)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastGibsTime = useRef('')

  const lightningToggle = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'lightning')?.visible ?? false,
  )
  const radarVisible = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'radar')?.visible ?? false,
  )
  const lightningVisible = lightningToggle || radarVisible

  const opacity = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'lightning')?.opacity ?? 0.8,
  )

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

  // Fetch flash data from GLM API
  const fetchFlashes = useCallback(async () => {
    try {
      const res = await fetch(GLM_API, { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return
      const data = await res.json()
      const now = Date.now()

      if (data.flashes?.length > 0) {
        // Stagger the receivedAt times so flashes appear to animate in
        const stagger = POLL_INTERVAL / Math.max(data.flashes.length, 1)
        const newFlashes: Flash[] = data.flashes.map((f: { lat: number; lon: number; energy?: number }, i: number) => ({
          lat: f.lat,
          lon: f.lon,
          energy: f.energy,
          receivedAt: now + i * stagger * 0.5, // spread over half the poll interval
        }))
        flashesRef.current = [...flashesRef.current.filter(f => now - f.receivedAt < FLASH_MAX_AGE), ...newFlashes]
      }
    } catch { /* ignore fetch errors */ }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return

    if (!lightningVisible) {
      // Hide everything
      if (map.getLayer(GLM_LAYER)) map.setLayoutProperty(GLM_LAYER, 'visibility', 'none')
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      flashesRef.current = []
      if (pollTimer.current) clearInterval(pollTimer.current)
      cancelAnimationFrame(animRef.current)
      return
    }

    syncSize()

    // ── GIBS GLM density tiles (background) ──────────────────────────
    const setupGibs = () => {
      if (!map.isStyleLoaded()) return
      const time = getGlmTime()
      const tileUrl = `${GIBS_BASE}/GOES-East_GLM_Flash_Extent_Density/default/${time}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`

      if (!map.getSource(GLM_SOURCE)) {
        map.addSource(GLM_SOURCE, { type: 'raster', tiles: [tileUrl], tileSize: 256, maxzoom: 8 })
      }
      if (!map.getLayer(GLM_LAYER)) {
        map.addLayer({
          id: GLM_LAYER, type: 'raster', source: GLM_SOURCE,
          paint: { 'raster-opacity': opacity * 0.6, 'raster-opacity-transition': { duration: 300, delay: 0 } },
        })
        for (const id of ['clusters', 'cluster-count', 'fishing-spots', 'fishing-spots-rigs', 'fishing-spots-labels']) {
          if (map.getLayer(id)) map.moveLayer(id)
        }
      }
      map.setLayoutProperty(GLM_LAYER, 'visibility', 'visible')
      map.setPaintProperty(GLM_LAYER, 'raster-opacity', opacity * 0.6)

      if (time !== lastGibsTime.current) {
        const src = map.getSource(GLM_SOURCE) as maplibregl.RasterTileSource
        if (src?.setTiles) src.setTiles([tileUrl])
        lastGibsTime.current = time
      }
    }

    if (map.isStyleLoaded()) setupGibs()
    else map.once('style.load', setupGibs)

    const onStyleLoad = () => { lastGibsTime.current = ''; setTimeout(setupGibs, 50) }
    map.on('style.load', onStyleLoad)

    // ── GLM flash polling ────────────────────────────────────────────
    fetchFlashes()
    pollTimer.current = setInterval(fetchFlashes, POLL_INTERVAL)

    // ── Canvas animation loop (flash bursts) ─────────────────────────
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true
    const container = map.getContainer()

    const frame = () => {
      if (!running) return
      const now = Date.now()
      const cw = container.clientWidth
      const ch = container.clientHeight

      ctx.clearRect(0, 0, cw, ch)

      // Remove expired flashes
      flashesRef.current = flashesRef.current.filter(f => now - f.receivedAt < FLASH_MAX_AGE)

      for (const flash of flashesRef.current) {
        const age = now - flash.receivedAt
        if (age < 0) continue // staggered — not yet "visible"

        const pt = map.project([flash.lon, flash.lat])
        if (pt.x < -50 || pt.x > cw + 50 || pt.y < -50 || pt.y > ch + 50) continue

        const progress = age / FLASH_MAX_AGE // 0→1

        // ── BRIGHT WHITE FLASH (first 15%) ─────────────────────────
        if (progress < 0.15) {
          const t = progress / 0.15
          const intensity = 1.0 - t

          // Large white burst
          const r = 20 + intensity * 15
          const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r)
          grad.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.9})`)
          grad.addColorStop(0.3, `rgba(220, 230, 255, ${intensity * 0.5})`)
          grad.addColorStop(1, 'rgba(200, 210, 255, 0)')
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()

          // Bright core
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`
          ctx.fill()
        }

        // ── EXPANDING RING (first 40%) ─────────────────────────────
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

        // ── FADING DOT (always visible while alive) ────────────────
        const dotAlpha = Math.max(0.05, 0.6 * (1 - progress))
        const dotSize = Math.max(1, 2.5 * (1 - progress * 0.5))
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, dotSize, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${dotAlpha})`
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)

    const onResize = () => syncSize()
    map.on('resize', onResize)

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
      map.off('resize', onResize)
      map.off('style.load', onStyleLoad)
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [mapRef, lightningVisible, opacity, syncSize, fetchFlashes])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const map = mapRef.current
      if (!map) return
      try {
        if (map.getLayer(GLM_LAYER)) map.removeLayer(GLM_LAYER)
        if (map.getSource(GLM_SOURCE)) map.removeSource(GLM_SOURCE)
      } catch { /* disposed */ }
      if (pollTimer.current) clearInterval(pollTimer.current)
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
