/**
 * CurrentArrowOverlay — renders ocean current arrows on a canvas overlay.
 *
 * Fetches current velocity and direction from Open-Meteo Marine API
 * (CORS-friendly, no proxy needed) and renders a grid of arrows
 * showing current direction and speed.
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import type maplibregl from 'maplibre-gl'

// ── Config ──────────────────────────────────────────────────────────────────

const ARROW_SPACING_PX = 52       // pixels between arrow grid points
const ARROW_LENGTH_MIN = 10       // min arrow length (pixels)
const ARROW_LENGTH_MAX = 34       // max arrow length (pixels)
const SPEED_MAX_KMH = 6           // km/h — speeds above this are clamped
const ARROW_HEAD_SIZE = 5         // arrowhead size in pixels
const FETCH_DEBOUNCE_MS = 2500    // debounce grid fetches on map move
const DATA_TTL_MS = 15 * 60_000   // re-fetch data every 15 minutes
const MAX_POINTS = 400            // max grid points per request (Open-Meteo limit)

const MARINE_API = 'https://marine-api.open-meteo.com/v1/marine'

// ── Types ───────────────────────────────────────────────────────────────────

interface CurrentPoint {
  lat: number
  lng: number
  speed: number     // km/h
  direction: number // degrees (meteorological: direction current is flowing TO)
}

interface CurrentData {
  points: CurrentPoint[]
  fetchedAt: number
  bounds: { south: number; north: number; west: number; east: number }
}

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
  visible: boolean
  opacity: number
}

// ── Data fetching ───────────────────────────────────────────────────────────

async function fetchCurrentData(
  south: number, north: number, west: number, east: number,
  signal?: AbortSignal,
): Promise<CurrentData | null> {
  // Build a grid of lat/lng points within bounds
  const latSpan = north - south
  const lngSpan = east - west

  // Calculate grid resolution based on available points
  const aspect = lngSpan / Math.max(latSpan, 0.1)
  const nLat = Math.max(3, Math.min(20, Math.round(Math.sqrt(MAX_POINTS / aspect))))
  const nLng = Math.max(3, Math.min(20, Math.round(nLat * aspect)))

  const latStep = latSpan / (nLat - 1)
  const lngStep = lngSpan / (nLng - 1)

  const lats: number[] = []
  const lngs: number[] = []

  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLng; j++) {
      lats.push(parseFloat((south + i * latStep).toFixed(2)))
      lngs.push(parseFloat((west + j * lngStep).toFixed(2)))
    }
  }

  // Open-Meteo accepts comma-separated lat/lng arrays
  const url = `${MARINE_API}?latitude=${lats.join(',')}&longitude=${lngs.join(',')}&current=ocean_current_velocity,ocean_current_direction`

  try {
    const res = await fetch(url, { signal })
    if (!res.ok) return null

    const json = await res.json()

    // Response is an array of point results
    const results = Array.isArray(json) ? json : [json]
    const points: CurrentPoint[] = []

    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (!r?.current) continue

      const speed = r.current.ocean_current_velocity
      const direction = r.current.ocean_current_direction

      if (speed == null || direction == null) continue

      points.push({
        lat: r.latitude,
        lng: r.longitude,
        speed,
        direction,
      })
    }

    if (!points.length) return null

    return { points, fetchedAt: Date.now(), bounds: { south, north, west, east } }
  } catch {
    return null
  }
}

// ── Interpolation ───────────────────────────────────────────────────────────

/**
 * Find the nearest current data points and interpolate speed/direction
 * using inverse-distance weighting.
 */
function interpolateCurrent(
  lat: number, lng: number, points: CurrentPoint[], maxDist: number,
): { speed: number; direction: number } | null {
  let totalWeight = 0
  let speedSum = 0
  let dxSum = 0
  let dySum = 0

  for (const p of points) {
    const dlat = p.lat - lat
    const dlng = p.lng - lng
    const dist = Math.sqrt(dlat * dlat + dlng * dlng)

    if (dist > maxDist) continue
    if (dist < 0.001) {
      return { speed: p.speed, direction: p.direction }
    }

    const w = 1 / (dist * dist)
    totalWeight += w
    speedSum += p.speed * w

    // Decompose direction into components to average properly
    const rad = (p.direction * Math.PI) / 180
    dxSum += Math.sin(rad) * w
    dySum += Math.cos(rad) * w
  }

  if (totalWeight === 0) return null

  const avgSpeed = speedSum / totalWeight
  const avgDir = ((Math.atan2(dxSum / totalWeight, dySum / totalWeight) * 180) / Math.PI + 360) % 360

  return { speed: avgSpeed, direction: avgDir }
}

// ── Arrow drawing ───────────────────────────────────────────────────────────

function speedToColor(speedKmh: number): string {
  const t = Math.min(speedKmh / SPEED_MAX_KMH, 1)
  // Cyan (slow) → Yellow (medium) → Red (fast)
  if (t < 0.5) {
    const s = t * 2
    const r = Math.round(6 + s * 239)
    const g = Math.round(182 + s * (220 - 182))
    const b = Math.round(212 - s * 212)
    return `rgb(${r},${g},${b})`
  }
  const s = (t - 0.5) * 2
  const r = Math.round(245 - s * 10)
  const g = Math.round(220 - s * 150)
  const b = Math.round(0)
  return `rgb(${r},${g},${b})`
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angleDeg: number,  // oceanographic: direction current flows TO (0=north, 90=east)
  length: number,
  color: string,
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 1.8
  ctx.lineCap = 'round'

  // Convert oceanographic direction to screen angle
  // 0°=north(up), 90°=east(right) → screen: 0=right, PI/2=down
  const screenAngle = ((angleDeg - 90) * Math.PI) / 180

  const dx = Math.cos(screenAngle) * length
  const dy = Math.sin(screenAngle) * length

  // Arrow shaft
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
    tipX - ARROW_HEAD_SIZE * Math.cos(headAngle - 0.45),
    tipY - ARROW_HEAD_SIZE * Math.sin(headAngle - 0.45),
  )
  ctx.lineTo(
    tipX - ARROW_HEAD_SIZE * Math.cos(headAngle + 0.45),
    tipY - ARROW_HEAD_SIZE * Math.sin(headAngle + 0.45),
  )
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CurrentArrowOverlay({ mapRef, visible, opacity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dataRef = useRef<CurrentData | null>(null)
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [loading, setLoading] = useState(false)

  // Sync canvas size
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

  // Render arrows
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    const data = dataRef.current
    if (!canvas || !map) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cw = canvas.width / (window.devicePixelRatio || 1)
    const ch = canvas.height / (window.devicePixelRatio || 1)
    ctx.clearRect(0, 0, cw, ch)

    if (!visible || !data || !data.points.length) return

    // Calculate max interpolation distance based on data point spacing
    const bounds = map.getBounds()
    const latSpan = bounds.getNorth() - bounds.getSouth()
    const maxDist = latSpan * 0.15 // interpolation radius

    // Draw arrows at a regular screen-space grid
    for (let sy = ARROW_SPACING_PX / 2; sy < ch; sy += ARROW_SPACING_PX) {
      for (let sx = ARROW_SPACING_PX / 2; sx < cw; sx += ARROW_SPACING_PX) {
        const lngLat = map.unproject([sx, sy])
        const lat = lngLat.lat
        const lng = lngLat.lng

        const current = interpolateCurrent(lat, lng, data.points, maxDist)
        if (!current || current.speed < 0.15) continue // skip very weak currents

        const t = Math.min(current.speed / SPEED_MAX_KMH, 1)
        const arrowLen = ARROW_LENGTH_MIN + t * (ARROW_LENGTH_MAX - ARROW_LENGTH_MIN)
        const color = speedToColor(current.speed)

        drawArrow(ctx, sx, sy, current.direction, arrowLen, color, opacity)
      }
    }
  }, [mapRef, visible, opacity])

  // Fetch data for visible bounds
  const fetchData = useCallback(() => {
    const map = mapRef.current
    if (!map || !visible) return

    const bounds = map.getBounds()
    const south = bounds.getSouth()
    const north = bounds.getNorth()
    const west = bounds.getWest()
    const east = bounds.getEast()

    // Check if existing data covers the current view and is fresh
    const d = dataRef.current
    if (d && Date.now() - d.fetchedAt < DATA_TTL_MS &&
        d.bounds.south <= south && d.bounds.north >= north &&
        d.bounds.west <= west && d.bounds.east >= east) {
      render()
      return
    }

    // Cancel previous fetch
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)

    // Pad bounds slightly to avoid re-fetching on small pans
    fetchCurrentData(
      south - 1, north + 1, west - 1, east + 1,
      controller.signal,
    ).then(result => {
      if (controller.signal.aborted) return
      if (result) {
        dataRef.current = result
        render()
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [mapRef, visible, render])

  // Debounced fetch on map move
  const scheduleFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    fetchTimerRef.current = setTimeout(fetchData, FETCH_DEBOUNCE_MS)
  }, [fetchData])

  // Setup listeners
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

  // Re-render when visibility or opacity changes
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

  void loading // loading state available for future UI indicator

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 15 }}
    />
  )
}
