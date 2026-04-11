/**
 * PressureOverlay — draws isobar contour lines on a canvas overlay.
 * Uses marching squares to find contour lines at 4 mb intervals.
 */

import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { fetchWindGrid, bilinearInterp, type WindGrid } from '../../lib/windField'
import { useWeatherStore } from '../../store/weatherStore'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
  mapReady?: number
}

const ISOBAR_INTERVAL = 4 // mb between contour lines
const SAMPLE_SCALE = 4    // sample every N pixels for marching squares

/**
 * Marching squares: for each cell in the sampled grid, determine which edges
 * the contour crosses and draw line segments accordingly.
 */
function drawIsobars(
  ctx: CanvasRenderingContext2D,
  pressureGrid: number[][],  // [rows][cols] of pressure values at pixel positions
  rows: number,
  cols: number,
  scale: number,
  opacity: number,
) {
  // Find min/max pressure to determine which isobar levels to draw
  let minP = Infinity
  let maxP = -Infinity
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = pressureGrid[r][c]
      if (v < minP) minP = v
      if (v > maxP) maxP = v
    }
  }

  const startLevel = Math.ceil(minP / ISOBAR_INTERVAL) * ISOBAR_INTERVAL
  const endLevel = Math.floor(maxP / ISOBAR_INTERVAL) * ISOBAR_INTERVAL

  ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * opacity})`
  ctx.lineWidth = 1
  ctx.font = '10px monospace'
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * opacity})`

  for (let level = startLevel; level <= endLevel; level += ISOBAR_INTERVAL) {
    let labelPlaced = false
    let segCount = 0

    ctx.beginPath()

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const tl = pressureGrid[r][c]
        const tr = pressureGrid[r][c + 1]
        const br = pressureGrid[r + 1][c + 1]
        const bl = pressureGrid[r + 1][c]

        // Marching squares case index (4-bit)
        let caseIdx = 0
        if (tl >= level) caseIdx |= 8
        if (tr >= level) caseIdx |= 4
        if (br >= level) caseIdx |= 2
        if (bl >= level) caseIdx |= 1

        if (caseIdx === 0 || caseIdx === 15) continue

        // Pixel coordinates of cell corners
        const x0 = c * scale
        const y0 = r * scale
        const x1 = (c + 1) * scale
        const y1 = (r + 1) * scale

        // Interpolate edge crossing points
        const lerp = (a: number, b: number, va: number, vb: number) => {
          const t = vb - va === 0 ? 0.5 : (level - va) / (vb - va)
          return a + t * (b - a)
        }

        // Edge midpoints: top, right, bottom, left
        const topX = lerp(x0, x1, tl, tr)
        const topY = y0
        const rightX = x1
        const rightY = lerp(y0, y1, tr, br)
        const bottomX = lerp(x0, x1, bl, br)
        const bottomY = y1
        const leftX = x0
        const leftY = lerp(y0, y1, tl, bl)

        // Draw line segments based on case
        const segments: [number, number, number, number][] = []

        switch (caseIdx) {
          case 1: segments.push([leftX, leftY, bottomX, bottomY]); break
          case 2: segments.push([bottomX, bottomY, rightX, rightY]); break
          case 3: segments.push([leftX, leftY, rightX, rightY]); break
          case 4: segments.push([topX, topY, rightX, rightY]); break
          case 5:
            // Saddle point — use average to disambiguate
            segments.push([leftX, leftY, topX, topY])
            segments.push([bottomX, bottomY, rightX, rightY])
            break
          case 6: segments.push([topX, topY, bottomX, bottomY]); break
          case 7: segments.push([leftX, leftY, topX, topY]); break
          case 8: segments.push([topX, topY, leftX, leftY]); break
          case 9: segments.push([topX, topY, bottomX, bottomY]); break
          case 10:
            // Saddle point
            segments.push([topX, topY, rightX, rightY])
            segments.push([leftX, leftY, bottomX, bottomY])
            break
          case 11: segments.push([topX, topY, rightX, rightY]); break
          case 12: segments.push([leftX, leftY, rightX, rightY]); break
          case 13: segments.push([bottomX, bottomY, rightX, rightY]); break
          case 14: segments.push([leftX, leftY, bottomX, bottomY]); break
        }

        for (const [sx, sy, ex, ey] of segments) {
          ctx.moveTo(sx, sy)
          ctx.lineTo(ex, ey)
          segCount++

          // Place label near the middle of the canvas
          if (!labelPlaced && segCount > 5 && r > rows * 0.2 && r < rows * 0.8 && c > cols * 0.2 && c < cols * 0.8) {
            const lx = (sx + ex) / 2
            const ly = (sy + ey) / 2
            ctx.stroke()
            ctx.fillText(`${level}`, lx + 2, ly - 2)
            ctx.beginPath()
            labelPlaced = true
          }
        }
      }
    }

    ctx.stroke()
  }
}

export default function PressureOverlay({ mapRef, mapReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pressureVisible = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'pressure')?.visible ?? false,
  )
  const pressureOpacity = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'pressure')?.opacity ?? 0.6,
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

    // Pick the right hour's pressure data
    const hourIdx = Math.max(0, Math.min(Math.floor(forecastHour), grid.hours - 1))
    const pData = grid.pressureDataByHour[hourIdx] ?? grid.pressureData

    // Build a sampled pressure grid at pixel positions
    const cols = Math.ceil(cw / SAMPLE_SCALE)
    const rows = Math.ceil(ch / SAMPLE_SCALE)
    const pressureGrid: number[][] = []

    for (let r = 0; r < rows; r++) {
      const row: number[] = []
      for (let c = 0; c < cols; c++) {
        const px = c * SAMPLE_SCALE + SAMPLE_SCALE / 2
        const py = r * SAMPLE_SCALE + SAMPLE_SCALE / 2
        const lngLat = map.unproject([px, py])
        const pressure = bilinearInterp(lngLat.lat, lngLat.lng, grid.lats, grid.lngs, pData)
        row.push(pressure)
      }
      pressureGrid.push(row)
    }

    ctx.clearRect(0, 0, cw, ch)
    drawIsobars(ctx, pressureGrid, rows, cols, SAMPLE_SCALE, pressureOpacity)
  }, [mapRef, pressureOpacity, forecastHour])

  useEffect(() => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return

    if (!pressureVisible) {
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
  }, [mapRef, pressureVisible, pressureOpacity, forecastHour, syncSize, renderOverlay, mapReady])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
    />
  )
}
