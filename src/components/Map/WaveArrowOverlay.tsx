/**
 * WaveArrowOverlay — animated wave particles with arched line shapes.
 * Faster and denser when waves are higher. No rendering over land.
 *
 * Land masking uses a pre-rendered bitmap from Natural Earth 50m land
 * polygons. The bitmap is rebuilt once per map move (cheap), and each
 * particle does a single pixel lookup per frame (nearly free).
 */

import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import {
  fetchWaveGrid,
  interpolateWaveHeightAtHour,
  invalidateWaveCache,
  type WaveGrid,
} from '../../lib/windField'
import { getLandData, drawLandMask } from '../../lib/landMask'
import { useWeatherStore } from '../../store/weatherStore'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
}

const BASE_PARTICLE_COUNT = 500
const MAX_AGE_CALM = 180     // slow lifecycle for calm seas
const MAX_AGE_ROUGH = 60     // fast lifecycle for rough seas
const MOVE_DEBOUNCE_MS = 600
const ARCH_WIDTH = 10        // base width of the arch in pixels
const PEAK_OPACITY = 0.5
const LAND_THRESHOLD = 0.02  // wave height below this = land, skip rendering

interface WaveParticle {
  lat: number
  lng: number
  age: number
  maxAge: number
  heightAtSpawn: number
}

function randomWaveParticle(bounds: maplibregl.LngLatBounds): WaveParticle {
  const s = bounds.getSouth(), n = bounds.getNorth()
  const w = bounds.getWest(), e = bounds.getEast()
  return {
    lat: s + Math.random() * (n - s),
    lng: w + Math.random() * (e - w),
    age: Math.floor(Math.random() * MAX_AGE_CALM),
    maxAge: MAX_AGE_CALM,
    heightAtSpawn: 0,
  }
}

/** Bilinear interpolation for wave direction */
function interpDirection(lat: number, lng: number, grid: WaveGrid): number {
  const { lats, lngs, directionData } = grid
  let li = 0
  while (li < lats.length - 1 && lats[li + 1] < lat) li++
  let gi = 0
  while (gi < lngs.length - 1 && lngs[gi + 1] < lng) gi++
  li = Math.max(0, Math.min(li, lats.length - 2))
  gi = Math.max(0, Math.min(gi, lngs.length - 2))
  const latR = lats[li + 1] - lats[li]
  const lngR = lngs[gi + 1] - lngs[gi]
  const a = latR === 0 ? 0 : Math.max(0, Math.min(1, (lat - lats[li]) / latR))
  const b = lngR === 0 ? 0 : Math.max(0, Math.min(1, (lng - lngs[gi]) / lngR))
  return directionData[li][gi] * (1 - a) * (1 - b) +
    directionData[li + 1][gi] * a * (1 - b) +
    directionData[li][gi + 1] * (1 - a) * b +
    directionData[li + 1][gi + 1] * a * b
}

/** Draw an arched (curved) line at the given position */
function drawArch(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  width: number,
  archHeight: number,
  alpha: number,
  brightness: number,
  lineWidth: number,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  const halfW = width / 2
  ctx.beginPath()
  ctx.moveTo(-halfW, 0)
  ctx.quadraticCurveTo(0, -archHeight, halfW, 0)
  ctx.strokeStyle = `rgba(${brightness}, ${brightness}, 255, ${alpha})`
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.stroke()
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Land mask bitmap — pre-rendered once per map move, pixel-lookup per particle
// ---------------------------------------------------------------------------

interface LandMaskBitmap {
  data: Uint8ClampedArray
  width: number
  height: number
}

/**
 * Render Natural Earth land polygons to a 1-bit-per-pixel bitmap.
 * Pixels under land have alpha > 0.  Checked per-particle each frame.
 */
async function buildLandMaskBitmap(
  map: maplibregl.Map,
  cw: number,
  ch: number,
): Promise<LandMaskBitmap> {
  const land = await getLandData()
  const offscreen = document.createElement('canvas')
  offscreen.width = cw
  offscreen.height = ch
  const ctx = offscreen.getContext('2d')!
  ctx.fillStyle = 'rgba(255,0,0,1)'
  drawLandMask(ctx, map, land)
  const imageData = ctx.getImageData(0, 0, cw, ch)
  return { data: imageData.data, width: cw, height: ch }
}

/** Fast check: is pixel (x, y) on land? */
function isScreenPointOnLand(mask: LandMaskBitmap, x: number, y: number): boolean {
  const ix = Math.round(x)
  const iy = Math.round(y)
  if (ix < 0 || ix >= mask.width || iy < 0 || iy >= mask.height) return false
  // Check alpha channel (every 4th byte)
  return mask.data[(iy * mask.width + ix) * 4 + 3] > 0
}

export default function WaveArrowOverlay({ mapRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const gridRef = useRef<WaveGrid | null>(null)
  const particlesRef = useRef<WaveParticle[]>([])
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const landMaskRef = useRef<LandMaskBitmap | null>(null)

  const wavesVisible = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'waves')?.visible ?? false,
  )
  const forecastHourRef = useRef(0)
  const forecastHour = useWeatherStore((s) => s.selectedForecastHour)
  forecastHourRef.current = forecastHour

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

  const fetchGrid = useCallback(async () => {
    const map = mapRef.current
    if (!map) return
    const bounds = map.getBounds()
    try {
      gridRef.current = await fetchWaveGrid(
        bounds.getSouth(), bounds.getNorth(),
        bounds.getWest(), bounds.getEast(),
      )
    } catch { /* handled silently */ }
  }, [mapRef])

  /** Rebuild land mask bitmap + refetch wave grid after map move */
  const rebuildAfterMove = useCallback(async () => {
    const map = mapRef.current
    if (!map) return
    const container = map.getContainer()
    invalidateWaveCache()
    // Build mask and fetch grid in parallel
    const [mask] = await Promise.all([
      buildLandMaskBitmap(map, container.clientWidth, container.clientHeight),
      fetchGrid(),
    ])
    landMaskRef.current = mask
  }, [mapRef, fetchGrid])

  const scheduleFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    fetchTimerRef.current = setTimeout(() => rebuildAfterMove(), MOVE_DEBOUNCE_MS)
  }, [rebuildAfterMove])

  useEffect(() => {
    const map = mapRef.current
    const canvas = canvasRef.current
    if (!map || !canvas) return
    if (!wavesVisible) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      landMaskRef.current = null
      return
    }

    syncSize()
    const bounds = map.getBounds()
    particlesRef.current = Array.from({ length: BASE_PARTICLE_COUNT }, () =>
      randomWaveParticle(bounds),
    )
    // Initial load: build land mask + fetch wave grid
    rebuildAfterMove()

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const frame = () => {
      if (!running) return
      const grid = gridRef.current
      const mask = landMaskRef.current
      const container = map.getContainer()
      const cw = container.clientWidth
      const ch = container.clientHeight
      const currentBounds = map.getBounds()

      ctx.clearRect(0, 0, cw, ch)

      if (grid) {
        const particles = particlesRef.current
        const s = currentBounds.getSouth(), n = currentBounds.getNorth()
        const w = currentBounds.getWest(), e = currentBounds.getEast()

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]

          if (p.age >= p.maxAge || p.lat < s || p.lat > n || p.lng < w || p.lng > e) {
            // Reset particle
            const newP = randomWaveParticle(currentBounds)
            const h = interpolateWaveHeightAtHour(newP.lat, newP.lng, grid, forecastHourRef.current)

            // Skip land — check both wave data AND the land mask bitmap
            if (h < LAND_THRESHOLD) {
              newP.age = 0
              newP.maxAge = 10
              newP.heightAtSpawn = 0
              particles[i] = newP
              continue
            }
            if (mask) {
              const spawnPx = map.project([newP.lng, newP.lat])
              if (isScreenPointOnLand(mask, spawnPx.x, spawnPx.y)) {
                newP.age = 0
                newP.maxAge = 10
                newP.heightAtSpawn = 0
                particles[i] = newP
                continue
              }
            }

            newP.maxAge = Math.max(MAX_AGE_ROUGH, Math.round(MAX_AGE_CALM - h * 30))
            newP.heightAtSpawn = h
            newP.age = 0
            particles[i] = newP
            continue
          }

          // Skip land particles
          if (p.heightAtSpawn < LAND_THRESHOLD) {
            p.age++
            continue
          }

          const height = p.heightAtSpawn
          const dir = interpDirection(p.lat, p.lng, grid)
          const angle = ((dir + 180) * Math.PI) / 180

          const speedBase = 0.00002
          const speedScale = 0.5 + height * 0.5
          const speed = speedBase * speedScale
          const cosLat = Math.cos((p.lat * Math.PI) / 180)
          p.lng += Math.sin(angle) * speed / cosLat
          p.lat += Math.cos(angle) * speed
          p.age++

          // Project to screen
          const px = map.project([p.lng, p.lat])
          if (px.x < -30 || px.x > cw + 30 || px.y < -30 || px.y > ch + 30) continue

          // Skip if this particle has drifted onto land
          if (mask && isScreenPointOnLand(mask, px.x, px.y)) {
            p.age = p.maxAge // kill it so it respawns in water next cycle
            continue
          }

          // Lifecycle fade
          const ageRatio = p.age / p.maxAge
          const lifeFade = ageRatio < 0.15 ? ageRatio / 0.15
            : ageRatio > 0.7 ? (1 - ageRatio) / 0.3
            : 1
          const alpha = Math.max(0.03, lifeFade * PEAK_OPACITY)

          const archWidth = ARCH_WIDTH + height * 3
          const archHeight = 3 + height * 2
          const brightness = Math.min(200 + height * 15, 255)
          const lineW = 1.2 + Math.min(height * 0.2, 0.8)

          drawArch(ctx, px.x, px.y, angle, archWidth, archHeight, alpha, brightness, lineW)
        }
      }

      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)

    const onMoveStart = () => {}
    const onMoveEnd = () => scheduleFetch()
    const onResize = () => {
      syncSize()
      const newBounds = map.getBounds()
      particlesRef.current = Array.from({ length: BASE_PARTICLE_COUNT }, () =>
        randomWaveParticle(newBounds),
      )
      // Rebuild mask at new size
      rebuildAfterMove()
    }

    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
    map.on('resize', onResize)

    return () => {
      running = false
      cancelAnimationFrame(animRef.current)
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      map.off('resize', onResize)
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      landMaskRef.current = null
    }
  }, [mapRef, wavesVisible, syncSize, rebuildAfterMove, scheduleFetch])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    />
  )
}
