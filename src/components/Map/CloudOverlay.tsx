/**
 * CloudOverlay — semi-transparent white/gray canvas overlay showing cloud cover
 * from Open-Meteo forecast data. Animates with the forecast play button.
 */

import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { fetchWindGrid, bilinearInterp, type WindGrid } from '../../lib/windField'
import { useWeatherStore } from '../../store/weatherStore'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
}

const SCALE = 3 // render at 1/3 resolution, upscale with blur for smooth look

export default function CloudOverlay({ mapRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cloudVisible = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'cloud-cover')?.visible ?? false,
  )
  const cloudOpacity = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'cloud-cover')?.opacity ?? 0.5,
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

    // Pick the two bounding hours for interpolation
    const h0 = Math.floor(forecastHour)
    const h1 = Math.min(h0 + 1, grid.hours - 1)
    const t = forecastHour - h0
    const clampH = (h: number) => Math.max(0, Math.min(h, grid.hours - 1))
    const cloudData0 = grid.cloudCoverByHour[clampH(h0)]
    const cloudData1 = grid.cloudCoverByHour[clampH(h1)]

    if (!cloudData0 || !cloudData1) return

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const px = x * SCALE + SCALE / 2
        const py = y * SCALE + SCALE / 2
        const lngLat = map.unproject([px, py])

        const c0 = bilinearInterp(lngLat.lat, lngLat.lng, grid.lats, grid.lngs, cloudData0)
        const c1 = bilinearInterp(lngLat.lat, lngLat.lng, grid.lats, grid.lngs, cloudData1)
        const cover = c0 + (c1 - c0) * t // 0-100

        // White cloud with alpha proportional to cloud cover
        // Low cover = transparent, high cover = opaque white/light gray
        const alpha = Math.round((cover / 100) * 200) // max alpha ~200 (let overlay opacity handle final)
        const brightness = cover > 70 ? 220 : 240 // slightly darker for heavy clouds

        const idx = (y * sw + x) * 4
        data[idx] = brightness
        data[idx + 1] = brightness
        data[idx + 2] = brightness
        data[idx + 3] = alpha
      }
    }

    offCtx.putImageData(imageData, 0, 0)

    ctx.clearRect(0, 0, cw, ch)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    if (typeof ctx.filter !== 'undefined') {
      ctx.filter = 'blur(8px)'
    }

    ctx.globalAlpha = cloudOpacity
    ctx.drawImage(offscreen, 0, 0, sw, sh, 0, 0, cw, ch)
    ctx.globalAlpha = 1
    ctx.filter = 'none'
  }, [mapRef, cloudOpacity, forecastHour])

  useEffect(() => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return

    if (!cloudVisible) {
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
  }, [mapRef, cloudVisible, cloudOpacity, forecastHour, syncSize, renderOverlay])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}
    />
  )
}
