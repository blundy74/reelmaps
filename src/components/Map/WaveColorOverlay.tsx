/**
 * WaveColorOverlay — ocean-only wave height visualization with relief shading.
 *
 * Renders an ocean-blue gradient on a canvas overlay, using bilinear-interpolated
 * wave height data from Open-Meteo.
 *
 * Coastline clipping uses the Windy.com technique:
 *   1. Draw wave colours across the full viewport (including over land)
 *   2. Set globalCompositeOperation = 'destination-out'
 *   3. Fill Natural Earth land polygons → erases all wave pixels on land
 *   4. Result: pixel-perfect coastline boundary
 */

import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { fetchWaveGrid, interpolateWaveHeightAtHour, type WaveGrid } from '../../lib/windField'
import { getLandData, drawLandMask } from '../../lib/landMask'
import { useWeatherStore } from '../../store/weatherStore'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
}

// Down-sample factor: render at 1/SCALE resolution, then upscale with blur
const SCALE = 3

// Wave height palette: very light blue at 1ft → dark navy at 5ft
// Stops are in METERS (1ft=0.305m, 2ft=0.61m, 3ft=0.91m, 4ft=1.22m, 5ft=1.52m)
// Aggressive darkening per foot, slight gradient above 5ft
const COLOR_STOPS: [number, number, number, number][] = [
  [0.00, 140, 210, 235],  // 0ft — very light sky blue
  [0.15, 120, 195, 225],  // ~0.5ft — light blue
  [0.305, 95, 175, 215],  // 1ft — light blue
  [0.46,  70, 150, 200],  // 1.5ft — medium-light blue
  [0.61,  50, 125, 185],  // 2ft — medium blue
  [0.76,  35, 100, 170],  // 2.5ft — medium-dark blue
  [0.91,  22,  78, 155],  // 3ft — darker blue
  [1.07,  14,  58, 135],  // 3.5ft — dark blue
  [1.22,   8,  42, 118],  // 4ft — deep blue
  [1.37,   4,  28, 100],  // 4.5ft — very dark blue
  [1.52,   2,  18,  82],  // 5ft — dark navy
  [1.83,   1,  12,  68],  // 6ft — navy (slight gradient continues)
  [2.44,   1,   8,  55],  // 8ft — deep navy
  [3.05,   0,   5,  42],  // 10ft — near black
  [3.66,   0,   3,  32],  // 12ft+ — very dark
]

/** Hermite-smoothed colour lookup from wave height in metres. */
function waveHeightColor(heightM: number): [number, number, number] {
  const h = Math.max(0, heightM)
  let lo = 0
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    if (COLOR_STOPS[i][0] > h) break
    lo = i
  }
  const hi = Math.min(lo + 1, COLOR_STOPS.length - 1)
  if (lo === hi) return [COLOR_STOPS[lo][1], COLOR_STOPS[lo][2], COLOR_STOPS[lo][3]]
  const range = COLOR_STOPS[hi][0] - COLOR_STOPS[lo][0]
  const t = range === 0 ? 0 : (h - COLOR_STOPS[lo][0]) / range
  const st = t * t * (3 - 2 * t) // smoothstep
  return [
    Math.round(COLOR_STOPS[lo][1] + (COLOR_STOPS[hi][1] - COLOR_STOPS[lo][1]) * st),
    Math.round(COLOR_STOPS[lo][2] + (COLOR_STOPS[hi][2] - COLOR_STOPS[lo][2]) * st),
    Math.round(COLOR_STOPS[lo][3] + (COLOR_STOPS[hi][3] - COLOR_STOPS[lo][3]) * st),
  ]
}

export default function WaveColorOverlay({ mapRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const wavesVisible = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'waves')?.visible ?? false,
  )
  const wavesOpacity = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'waves')?.opacity ?? 0.6,
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

    // Fetch wave data and land polygons in parallel
    let grid: WaveGrid
    try {
      grid = await fetchWaveGrid(bounds.getSouth(), bounds.getNorth(), bounds.getWest(), bounds.getEast())
    } catch { return }

    const land = await getLandData()

    const sw = Math.ceil(cw / SCALE)
    const sh = Math.ceil(ch / SCALE)

    // ── Step 1: Render wave colours on a small offscreen canvas ──────────
    const offscreen = document.createElement('canvas')
    offscreen.width = sw
    offscreen.height = sh
    const offCtx = offscreen.getContext('2d')
    if (!offCtx) return

    const imageData = offCtx.createImageData(sw, sh)
    const data = imageData.data

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const idx = (y * sw + x) * 4

        const fullPx = x * SCALE + SCALE / 2
        const fullPy = y * SCALE + SCALE / 2
        const lngLat = map.unproject([fullPx, fullPy])

        const height = interpolateWaveHeightAtHour(lngLat.lat, lngLat.lng, grid, forecastHour)

        if (height < 0.01) {
          data[idx + 3] = 0
          continue
        }

        const [r, g, b] = waveHeightColor(height)
        data[idx] = r
        data[idx + 1] = g
        data[idx + 2] = b
        data[idx + 3] = 255
      }
    }

    offCtx.putImageData(imageData, 0, 0)

    // ── Step 2: Draw the blurred wave field onto the main canvas ─────────
    ctx.clearRect(0, 0, cw, ch)
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    if (typeof ctx.filter !== 'undefined') {
      ctx.filter = 'blur(4px)'
    }

    ctx.globalAlpha = wavesOpacity
    ctx.drawImage(offscreen, 0, 0, sw, sh, 0, 0, cw, ch)
    ctx.globalAlpha = 1
    ctx.filter = 'none'

    // ── Step 3: Erase land pixels using Natural Earth polygons ───────────
    // 'destination-out' means: anywhere we draw becomes transparent,
    // erasing the wave colours beneath. This is how Windy.com clips
    // ocean data at the coastline.
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,1)'
    drawLandMask(ctx, map, land)
    ctx.globalCompositeOperation = 'source-over'
  }, [mapRef, wavesOpacity, forecastHour])

  // Mount/unmount: set up map event listeners (does NOT depend on forecastHour)
  useEffect(() => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return

    if (!wavesVisible) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    syncSize()
    getLandData()
    setTimeout(() => renderOverlay(), 100)

    const onMoveStart = () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    const onMoveEnd = () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
      renderTimerRef.current = setTimeout(() => renderOverlay(), 300)
    }

    const onResize = () => {
      syncSize()
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current)
      renderTimerRef.current = setTimeout(() => renderOverlay(), 300)
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
  }, [mapRef, wavesVisible, wavesOpacity, syncSize, renderOverlay])

  // Re-render on forecast hour change without tearing down listeners
  useEffect(() => {
    if (!wavesVisible || !mapRef.current) return
    renderOverlay()
  }, [forecastHour, wavesVisible, renderOverlay, mapRef])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}
    />
  )
}
