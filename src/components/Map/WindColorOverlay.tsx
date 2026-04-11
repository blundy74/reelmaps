/**
 * WindColorOverlay — smooth color-coded wind speed heatmap.
 * Renders at 1/3 resolution with gaussian blur for ultra-smooth gradients.
 */

import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { fetchWindGrid, interpolateWindAtHour, windSpeed, type WindGrid } from '../../lib/windField'
import { useWeatherStore } from '../../store/weatherStore'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
  mapReady?: number
}

const SCALE = 3 // render at 1/3 resolution for smoother interpolation

// Smooth multi-stop gradient matching Windy.com's wind palette
// Uses many small steps for gradual transitions
const COLOR_STOPS: [number, number, number, number][] = [
  // [speed_ms, R, G, B]
  [0,   20,  30, 120],   // very dark blue (calm)
  [1,   30,  50, 160],   // dark blue
  [2,   40,  80, 200],   // medium blue
  [3,   20, 120, 210],   // blue-teal
  [4,   0,  155, 190],   // teal
  [5,   0,  170, 160],   // teal-green
  [6,   30, 180, 130],   // sea green
  [7,   60, 190, 100],   // green
  [8,   100, 200, 80],   // bright green
  [9,   140, 210, 60],   // yellow-green
  [10,  180, 215, 40],   // lime
  [11,  220, 220, 30],   // yellow
  [12,  245, 200, 20],   // golden
  [13,  250, 170, 10],   // orange-yellow
  [14,  252, 140, 0],    // orange
  [15,  248, 110, 0],    // dark orange
  [16,  240, 80, 10],    // red-orange
  [17,  230, 55, 20],    // red
  [18,  215, 40, 35],    // dark red
  [19,  200, 30, 50],    // crimson
  [20,  185, 25, 70],    // magenta-red
  [22,  170, 20, 100],   // magenta
  [25,  150, 15, 130],   // deep magenta
  [30,  120, 10, 150],   // purple
]

function windSpeedColor(speed: number): [number, number, number] {
  const s = Math.max(0, speed)

  // Find surrounding stops
  let lo = 0
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    if (COLOR_STOPS[i][0] > s) break
    lo = i
  }
  const hi = Math.min(lo + 1, COLOR_STOPS.length - 1)

  if (lo === hi) return [COLOR_STOPS[lo][1], COLOR_STOPS[lo][2], COLOR_STOPS[lo][3]]

  const range = COLOR_STOPS[hi][0] - COLOR_STOPS[lo][0]
  const t = range === 0 ? 0 : (s - COLOR_STOPS[lo][0]) / range
  // Smoothstep for even smoother transitions
  const st = t * t * (3 - 2 * t)

  return [
    Math.round(COLOR_STOPS[lo][1] + (COLOR_STOPS[hi][1] - COLOR_STOPS[lo][1]) * st),
    Math.round(COLOR_STOPS[lo][2] + (COLOR_STOPS[hi][2] - COLOR_STOPS[lo][2]) * st),
    Math.round(COLOR_STOPS[lo][3] + (COLOR_STOPS[hi][3] - COLOR_STOPS[lo][3]) * st),
  ]
}

export default function WindColorOverlay({ mapRef, mapReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const windVisible = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'wind')?.visible ?? false,
  )
  const windOpacity = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'wind')?.opacity ?? 0.2,
  )
  const forecastHour = useWeatherStore((s) => s.selectedForecastHour)

  const syncSize = useCallback(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    if (!canvas || !map) return
    const c = map.getContainer()
    canvas.width = c.clientWidth
    canvas.height = c.clientHeight
    canvas.style.width = `${c.clientWidth}px`
    canvas.style.height = `${c.clientHeight}px`
  }, [mapRef])

  const renderOverlay = useCallback(async () => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cw = canvas.width
    const ch = canvas.height
    const bounds = map.getBounds()

    let grid: WindGrid
    try {
      grid = await fetchWindGrid(bounds.getSouth(), bounds.getNorth(), bounds.getWest(), bounds.getEast())
    } catch { return }

    const sw = Math.ceil(cw / SCALE)
    const sh = Math.ceil(ch / SCALE)

    const offscreen = document.createElement('canvas')
    offscreen.width = sw
    offscreen.height = sh
    const offCtx = offscreen.getContext('2d')
    if (!offCtx) return

    const imageData = offCtx.createImageData(sw, sh)
    const data = imageData.data

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const px = x * SCALE + SCALE / 2
        const py = y * SCALE + SCALE / 2
        const lngLat = map.unproject([px, py])
        const wind = interpolateWindAtHour(lngLat.lat, lngLat.lng, grid, forecastHour)
        const speed = windSpeed(wind)
        const [r, g, b] = windSpeedColor(speed)

        const idx = (y * sw + x) * 4
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
      }
    }

    offCtx.putImageData(imageData, 0, 0)

    ctx.clearRect(0, 0, cw, ch)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Double blur pass for extra smoothness
    if (typeof ctx.filter !== 'undefined') {
      ctx.filter = 'blur(6px)'
    }

    ctx.globalAlpha = windOpacity
    ctx.drawImage(offscreen, 0, 0, sw, sh, 0, 0, cw, ch)
    ctx.globalAlpha = 1
    ctx.filter = 'none'
  }, [mapRef, windOpacity, forecastHour])

  useEffect(() => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return

    if (!windVisible) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    syncSize()
    renderOverlay()

    const onMoveStart = () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    const onMoveEnd = () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
      renderTimerRef.current = setTimeout(() => renderOverlay(), 200)
    }

    const onResize = () => {
      syncSize()
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
      renderTimerRef.current = setTimeout(() => renderOverlay(), 200)
    }

    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
    map.on('resize', onResize)

    return () => {
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      map.off('resize', onResize)
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [mapRef, windVisible, windOpacity, forecastHour, syncSize, renderOverlay, mapReady])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }}
    />
  )
}
