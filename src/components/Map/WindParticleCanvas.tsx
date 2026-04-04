/**
 * WindParticleCanvas.tsx
 *
 * A full-viewport canvas overlay that renders Windy.com-style flowing wind
 * particles anchored to geographic coordinates on a MapLibre map.
 */

import { useEffect, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import {
  fetchWindGrid,
  interpolateWindAtHour,
  windSpeed,
  invalidateWindCache,
  type WindGrid,
} from '../../lib/windField'
import { useWeatherStore } from '../../store/weatherStore'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
}

const PARTICLE_COUNT = 2000
const MAX_AGE = 100
const TRAIL_ALPHA = 0.92
// Thicker lines on mobile for visibility on small high-DPI screens
const LINE_WIDTH = typeof window !== 'undefined' && window.innerWidth < 768 ? 2.2 : 1.4
const MOVE_DEBOUNCE_MS = 600

// Speed factor: degrees per second per (m/s of wind)
const DEG_PER_MS_LAT = 1 / 110540
const DEG_PER_MS_LNG = (lat: number) => 1 / (111320 * Math.cos((lat * Math.PI) / 180))

// Scale how fast particles move visually (tuned for natural look)
const TIME_SCALE = 800

function windColour(speed: number, alpha = 1): string {
  const s = Math.max(0, Math.min(speed, 30))
  let r: number, g: number, b: number
  if (s < 3) {
    const t = s / 3
    r = 60; g = 140 + t * 60; b = 255
  } else if (s < 8) {
    const t = (s - 3) / 5
    r = 60 - t * 30; g = 200 + t * 55; b = 255 - t * 155
  } else if (s < 15) {
    const t = (s - 8) / 7
    r = 30 + t * 225; g = 255 - t * 80; b = 100 - t * 80
  } else {
    const t = Math.min((s - 15) / 15, 1)
    r = 255; g = 175 - t * 135; b = 20 + t * 100
  }
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`
}

// Particle stored in GEOGRAPHIC coordinates
interface Particle {
  lat: number
  lng: number
  age: number
  maxAge: number
}

function randomParticleGeo(bounds: maplibregl.LngLatBounds): Particle {
  const s = bounds.getSouth(), n = bounds.getNorth()
  const w = bounds.getWest(), e = bounds.getEast()
  return {
    lat: s + Math.random() * (n - s),
    lng: w + Math.random() * (e - w),
    age: Math.floor(Math.random() * MAX_AGE),
    maxAge: MAX_AGE + Math.floor(Math.random() * 40 - 20),
  }
}

export default function WindParticleCanvas({ mapRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const gridRef = useRef<WindGrid | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMovingRef = useRef(false)

  const windVisible = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'wind')?.visible ?? false,
  )
  const windOpacity = useWeatherStore(
    (s) => s.overlays.find((o) => o.id === 'wind')?.opacity ?? 0.8,
  )
  const forecastHourRef = useRef(0)
  // Update ref on store change so animation loop reads latest without re-mounting
  const forecastHour = useWeatherStore((s) => s.selectedForecastHour)
  forecastHourRef.current = forecastHour

  const syncSize = useCallback(() => {
    const canvas = canvasRef.current
    const map = mapRef.current
    if (!canvas || !map) return
    const container = map.getContainer()
    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [mapRef])

  const fetchGrid = useCallback(async () => {
    const map = mapRef.current
    if (!map) return
    const bounds = map.getBounds()
    try {
      const grid = await fetchWindGrid(
        bounds.getSouth(), bounds.getNorth(),
        bounds.getWest(), bounds.getEast(),
      )
      gridRef.current = grid
    } catch (err) {
      console.warn('[WindParticles] grid fetch failed', err)
    }
  }, [mapRef])

  const scheduleFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    invalidateWindCache()
    fetchTimerRef.current = setTimeout(() => fetchGrid(), MOVE_DEBOUNCE_MS)
  }, [fetchGrid])

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

    // Initialize particles in geographic space
    const bounds = map.getBounds()
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
      randomParticleGeo(bounds),
    )

    fetchGrid()

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let running = true

    const frame = () => {
      if (!running) return
      const grid = gridRef.current
      const container = map.getContainer()
      const cw = container.clientWidth
      const ch = container.clientHeight
      const currentBounds = map.getBounds()

      if (isMovingRef.current) {
        // During map movement: clear fully, draw particles at current projected positions
        // No trail effect since old trails would be at wrong pixel positions
        ctx.clearRect(0, 0, cw, ch)
      } else {
        // When map is still: use fade trail effect
        ctx.globalCompositeOperation = 'destination-in'
        ctx.fillStyle = `rgba(0,0,0,${TRAIL_ALPHA})`
        ctx.fillRect(0, 0, cw, ch)
        ctx.globalCompositeOperation = 'source-over'
      }

      ctx.globalAlpha = windOpacity

      if (grid) {
        const particles = particlesRef.current
        const s = currentBounds.getSouth(), n = currentBounds.getNorth()
        const w = currentBounds.getWest(), e = currentBounds.getEast()

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]

          // Reset if aged out or outside current view
          if (p.age >= p.maxAge ||
              p.lat < s || p.lat > n || p.lng < w || p.lng > e) {
            particles[i] = randomParticleGeo(currentBounds)
            particles[i].age = 0
            continue
          }

          // Get wind at particle's geographic position
          const wind = interpolateWindAtHour(p.lat, p.lng, grid, forecastHourRef.current)
          const speed = windSpeed(wind)

          // Project current position to pixels
          const oldPx = map.project([p.lng, p.lat])

          // Move particle in geographic space
          const dLng = wind.u * DEG_PER_MS_LNG(p.lat) * TIME_SCALE / 60
          const dLat = wind.v * DEG_PER_MS_LAT * TIME_SCALE / 60

          p.lng += dLng
          p.lat += dLat
          p.age++

          // Project new position to pixels
          const newPx = map.project([p.lng, p.lat])

          // Skip if both points are off screen
          if ((oldPx.x < -50 || oldPx.x > cw + 50 || oldPx.y < -50 || oldPx.y > ch + 50) &&
              (newPx.x < -50 || newPx.x > cw + 50 || newPx.y < -50 || newPx.y > ch + 50)) {
            continue
          }

          // Fade at birth/death
          const ageRatio = p.age / p.maxAge
          const lifeFade = ageRatio < 0.1 ? ageRatio / 0.1
            : ageRatio > 0.85 ? (1 - ageRatio) / 0.15
            : 1
          const alpha = Math.max(0.05, lifeFade * 0.9)

          ctx.beginPath()
          ctx.moveTo(oldPx.x, oldPx.y)
          ctx.lineTo(newPx.x, newPx.y)
          ctx.strokeStyle = windColour(speed, alpha)
          ctx.lineWidth = LINE_WIDTH + speed * 0.04
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }

      ctx.globalAlpha = 1
      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)

    // Map events
    const onMoveStart = () => { isMovingRef.current = true }
    const onMoveEnd = () => {
      isMovingRef.current = false
      scheduleFetch()
    }
    const onResize = () => {
      syncSize()
      const newBounds = map.getBounds()
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () =>
        randomParticleGeo(newBounds),
      )
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
    }
  }, [mapRef, windVisible, windOpacity, syncSize, fetchGrid, scheduleFetch])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  )
}
