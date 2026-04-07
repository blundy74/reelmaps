/**
 * CurrentArrowOverlay — renders ocean current arrows on a canvas overlay.
 *
 * Fetches current velocity and direction from Open-Meteo Marine API
 * (backed by CMEMS/HYCOM ocean model data). Dense grid sampling
 * provides high-resolution current arrows at all zoom levels.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type maplibregl from 'maplibre-gl'

// ── Config ──────────────────────────────────────────────────────────────────

const ARROW_SPACING_PX = 40       // pixels between arrows on screen
const ARROW_LENGTH_MIN = 8        // min arrow length (pixels)
const ARROW_LENGTH_MAX = 28       // max arrow length (pixels)
const SPEED_MAX_KMH = 5           // km/h — speeds above this are clamped
const ARROW_HEAD_SIZE = 4         // arrowhead triangle size in pixels
const FETCH_DEBOUNCE_MS = 1500    // debounce fetches on map move
const DATA_TTL_MS = 10 * 60_000   // re-fetch every 10 minutes
const MAX_POINTS_PER_REQUEST = 400
const MAX_GRID_POINTS = 900       // max total grid points to keep URL short

const MARINE_API = 'https://marine-api.open-meteo.com/v1/marine'

// ── Types ───────────────────────────────────────────────────────────────────

interface CurrentGrid {
  lats: number[]
  lngs: number[]
  speed: Float32Array  // row-major [lat][lng] in km/h
  direction: Float32Array // degrees
  fetchedAt: number
  bounds: { south: number; north: number; west: number; east: number }
}

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
  visible: boolean
  opacity: number
}

// ── Data fetching ───────────────────────────────────────────────────────────

async function fetchCurrentGrid(
  south: number, north: number, west: number, east: number,
  signal?: AbortSignal,
): Promise<CurrentGrid | null> {
  // Pad bounds slightly
  const s = Math.max(-80, south - 0.5)
  const n = Math.min(80, north + 0.5)
  const w = Math.max(-180, west - 0.5)
  const e = Math.min(180, east + 0.5)

  // Calculate adaptive grid resolution based on view size
  const latSpan = n - s
  const lngSpan = e - w
  const maxPerAxis = Math.floor(Math.sqrt(MAX_GRID_POINTS))
  const resolution = Math.max(0.2, Math.max(latSpan, lngSpan) / maxPerAxis)
  const roundedRes = Math.round(resolution * 10) / 10 || 0.5

  // Build grid
  const lats: number[] = []
  const lngs: number[] = []
  for (let lat = s; lat <= n; lat += roundedRes) lats.push(Math.round(lat * 10) / 10)
  for (let lng = w; lng <= e; lng += roundedRes) lngs.push(Math.round(lng * 10) / 10)

  const totalPoints = lats.length * lngs.length
  if (totalPoints === 0) return null

  // Build all lat/lng pairs
  const allLats: string[] = []
  const allLngs: string[] = []
  for (const lat of lats) {
    for (const lng of lngs) {
      allLats.push(lat.toFixed(1))
      allLngs.push(lng.toFixed(1))
    }
  }

  // Fetch in batches if needed
  const speedArr = new Float32Array(totalPoints)
  const dirArr = new Float32Array(totalPoints)
  let fetched = 0

  for (let offset = 0; offset < totalPoints; offset += MAX_POINTS_PER_REQUEST) {
    const batchLats = allLats.slice(offset, offset + MAX_POINTS_PER_REQUEST)
    const batchLngs = allLngs.slice(offset, offset + MAX_POINTS_PER_REQUEST)

    const url = `${MARINE_API}?latitude=${batchLats.join(',')}&longitude=${batchLngs.join(',')}&current=ocean_current_velocity,ocean_current_direction`

    try {
      const res = await fetch(url, { signal })
      if (!res.ok) continue
      const json = await res.json()
      const results = Array.isArray(json) ? json : [json]

      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        const spd = r?.current?.ocean_current_velocity
        const dir = r?.current?.ocean_current_direction
        if (spd != null && dir != null) {
          speedArr[offset + i] = spd
          dirArr[offset + i] = dir
          fetched++
        }
      }
    } catch {
      if (signal?.aborted) return null
    }
  }

  if (fetched < 10) return null

  return {
    lats, lngs, speed: speedArr, direction: dirArr,
    fetchedAt: Date.now(),
    bounds: { south: s, north: n, west: e > w ? w : w, east: e },
  }
}

// ── Interpolation ───────────────────────────────────────────────────────────

function bilinearInterp(
  lat: number, lng: number,
  grid: CurrentGrid,
  field: Float32Array,
): number {
  const { lats, lngs } = grid
  if (lats.length < 2 || lngs.length < 2) return NaN

  // Find surrounding lat indices
  let li = 0
  while (li < lats.length - 1 && lats[li + 1] < lat) li++
  li = Math.max(0, Math.min(li, lats.length - 2))

  let gi = 0
  while (gi < lngs.length - 1 && lngs[gi + 1] < lng) gi++
  gi = Math.max(0, Math.min(gi, lngs.length - 2))

  const latR = lats[li + 1] - lats[li]
  const lngR = lngs[gi + 1] - lngs[gi]
  const a = latR === 0 ? 0 : Math.max(0, Math.min(1, (lat - lats[li]) / latR))
  const b = lngR === 0 ? 0 : Math.max(0, Math.min(1, (lng - lngs[gi]) / lngR))

  const nLng = lngs.length
  const v00 = field[li * nLng + gi]
  const v10 = field[(li + 1) * nLng + gi]
  const v01 = field[li * nLng + (gi + 1)]
  const v11 = field[(li + 1) * nLng + (gi + 1)]

  if (v00 === 0 && v10 === 0 && v01 === 0 && v11 === 0) return 0

  return v00 * (1 - a) * (1 - b) + v10 * a * (1 - b) + v01 * (1 - a) * b + v11 * a * b
}

// ── Arrow drawing ───────────────────────────────────────────────────────────

function speedToColor(speedKmh: number): string {
  const t = Math.min(speedKmh / SPEED_MAX_KMH, 1)
  if (t < 0.3) {
    const s = t / 0.3
    return `rgba(6, ${Math.round(160 + s * 22)}, ${Math.round(212 - s * 12)}, ${0.6 + s * 0.2})`
  }
  if (t < 0.6) {
    const s = (t - 0.3) / 0.3
    return `rgba(${Math.round(6 + s * 234)}, ${Math.round(182 + s * 38)}, ${Math.round(200 - s * 200)}, 0.85)`
  }
  const s = (t - 0.6) / 0.4
  return `rgba(${Math.round(240 + s * 15)}, ${Math.round(220 - s * 160)}, 0, ${0.9 + s * 0.1})`
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angleDeg: number,
  length: number,
  color: string,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'

  // Convert oceanographic direction to screen angle
  const screenAngle = ((angleDeg - 90) * Math.PI) / 180
  const dx = Math.cos(screenAngle) * length
  const dy = Math.sin(screenAngle) * length

  // Shaft
  ctx.beginPath()
  ctx.moveTo(x - dx * 0.4, y - dy * 0.4)
  ctx.lineTo(x + dx * 0.6, y + dy * 0.6)
  ctx.stroke()

  // Arrowhead
  const tipX = x + dx * 0.6
  const tipY = y + dy * 0.6
  const headAngle = Math.atan2(dy, dx)

  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(
    tipX - ARROW_HEAD_SIZE * Math.cos(headAngle - 0.4),
    tipY - ARROW_HEAD_SIZE * Math.sin(headAngle - 0.4),
  )
  ctx.lineTo(
    tipX - ARROW_HEAD_SIZE * Math.cos(headAngle + 0.4),
    tipY - ARROW_HEAD_SIZE * Math.sin(headAngle + 0.4),
  )
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CurrentArrowOverlay({ mapRef, visible, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gridRef = useRef<CurrentGrid | null>(null)
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(false)

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

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    const grid = gridRef.current
    if (!canvas || !map) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cw = canvas.width / (window.devicePixelRatio || 1)
    const ch = canvas.height / (window.devicePixelRatio || 1)
    ctx.clearRect(0, 0, cw, ch)

    if (!visible || !grid || grid.lats.length < 2) return

    ctx.globalAlpha = opacity

    for (let sy = ARROW_SPACING_PX / 2; sy < ch; sy += ARROW_SPACING_PX) {
      for (let sx = ARROW_SPACING_PX / 2; sx < cw; sx += ARROW_SPACING_PX) {
        const lngLat = map.unproject([sx, sy])

        const speed = bilinearInterp(lngLat.lat, lngLat.lng, grid, grid.speed)
        const direction = bilinearInterp(lngLat.lat, lngLat.lng, grid, grid.direction)

        if (speed < 0.1 || isNaN(speed) || isNaN(direction)) continue

        const t = Math.min(speed / SPEED_MAX_KMH, 1)
        const arrowLen = ARROW_LENGTH_MIN + t * (ARROW_LENGTH_MAX - ARROW_LENGTH_MIN)
        const color = speedToColor(speed)

        drawArrow(ctx, sx, sy, direction, arrowLen, color)
      }
    }

    ctx.globalAlpha = 1
  }, [mapRef, visible, opacity])

  const fetchData = useCallback(() => {
    const map = mapRef.current
    if (!map || !visible) return

    const bounds = map.getBounds()
    const south = bounds.getSouth()
    const north = bounds.getNorth()
    const west = bounds.getWest()
    const east = bounds.getEast()

    // Check if existing data covers current view and is fresh
    const d = gridRef.current
    if (d && Date.now() - d.fetchedAt < DATA_TTL_MS &&
        d.bounds.south <= south && d.bounds.north >= north &&
        d.bounds.west <= west && d.bounds.east >= east) {
      render()
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)

    fetchCurrentGrid(south, north, west, east, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return
        if (result) {
          gridRef.current = result
          render()
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [mapRef, visible, render])

  const scheduleFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    fetchTimerRef.current = setTimeout(fetchData, FETCH_DEBOUNCE_MS)
  }, [fetchData])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    syncSize()

    const onResize = () => { syncSize(); render() }
    const onMove = () => { render(); scheduleFetch() }
    const onRender = () => render()

    map.on('resize', onResize)
    map.on('moveend', onMove)
    map.on('render', onRender)
    window.addEventListener('resize', onResize)

    if (visible) fetchData()

    return () => {
      map.off('resize', onResize)
      map.off('moveend', onMove)
      map.off('render', onRender)
      window.removeEventListener('resize', onResize)
      abortRef.current?.abort()
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    }
  }, [mapRef, visible, syncSize, render, fetchData, scheduleFetch])

  useEffect(() => {
    if (visible) {
      fetchData()
    } else {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        const cw = (canvasRef.current?.width ?? 0) / (window.devicePixelRatio || 1)
        const ch = (canvasRef.current?.height ?? 0) / (window.devicePixelRatio || 1)
        ctx.clearRect(0, 0, cw, ch)
      }
    }
  }, [visible, opacity, fetchData])

  void loading

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 15 }}
    />
  )
}
