/**
 * windField.ts
 *
 * Fetches wind data from Open-Meteo for a grid covering the current map bounds,
 * converts speed + direction into u/v vector components, and provides bilinear
 * interpolation so the particle renderer can sample wind at any coordinate.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WindGrid {
  lats: number[]   // sorted ascending (south → north)
  lngs: number[]   // sorted ascending (west → east)
  // Hourly data: [hourIndex][latIdx][lngIdx]
  uDataByHour: number[][][]
  vDataByHour: number[][][]
  pressureDataByHour: number[][][]  // pressure_msl in hPa (mb)
  cloudCoverByHour: number[][][]    // cloud_cover 0-100%
  hours: number  // number of forecast hours available
  // Convenience: current hour (index 0) flattened for backward compat
  uData: number[][]
  vData: number[][]
  pressureData: number[][]
  cloudCoverData: number[][]
  timestamp: number
}

export interface WindVector {
  u: number
  v: number
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes (longer to avoid rate limits)
let cachedGrid: WindGrid | null = null
let inflight: Promise<WindGrid> | null = null // dedup concurrent requests

function isCacheValid(): boolean {
  return cachedGrid !== null && Date.now() - cachedGrid.timestamp < CACHE_TTL_MS
}

export function invalidateWindCache(): void {
  cachedGrid = null
}

/** Shared 429 cooldown so overlapping callers do not stampede the free marine API. */
let marineBackoffUntil = 0

function parseRetryAfterMs(res: Response, attempt: number): number {
  const raw = res.headers.get('Retry-After')
  if (raw) {
    const sec = Number(raw)
    if (Number.isFinite(sec) && sec > 0) return Math.min(sec * 1000, 60_000)
    const when = Date.parse(raw)
    if (Number.isFinite(when)) return Math.min(Math.max(0, when - Date.now()), 60_000)
  }
  return 3000 * Math.pow(3, attempt)
}

/** Fetch with retry on 429 (rate limit) — waits and retries up to 3 times */
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const cooldown = marineBackoffUntil - Date.now()
    if (cooldown > 0) {
      await new Promise(r => setTimeout(r, cooldown))
    }
    const res = await fetch(url)
    if (res.status === 429 && attempt < retries) {
      const wait = parseRetryAfterMs(res, attempt)
      marineBackoffUntil = Date.now() + wait
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)
    return res
  }
  throw new Error('Open-Meteo: max retries exceeded')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Meteorological direction → u, v vector components (m/s). */
function dirSpeedToUV(speedMs: number, dirDeg: number): { u: number; v: number } {
  // Meteorological convention: direction is where wind comes FROM, measured
  // clockwise from north.  We want the direction the wind is going TO.
  const rad = (dirDeg * Math.PI) / 180
  // u = east component (positive = wind blowing eastward)
  // v = north component (positive = wind blowing northward)
  const u = -speedMs * Math.sin(rad)
  const v = -speedMs * Math.cos(rad)
  return { u, v }
}

/** Build an evenly-spaced array of `count` values between `min` and `max`. */
function linspace(min: number, max: number, count: number): number[] {
  if (count <= 1) return [(min + max) / 2]
  const step = (max - min) / (count - 1)
  return Array.from({ length: count }, (_, i) => min + step * i)
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

const GRID_SIZE = 8

/**
 * Fetch wind data for a ~15x15 grid spanning the given map bounds.
 * Open-Meteo supports comma-separated coordinates (up to ~300 per request).
 */
export async function fetchWindGrid(
  south: number,
  north: number,
  west: number,
  east: number,
): Promise<WindGrid> {
  if (isCacheValid()) return cachedGrid!
  if (inflight) return inflight // dedup concurrent calls
  inflight = _fetchWindGridImpl(south, north, west, east)
  try {
    const result = await inflight
    return result
  } finally {
    inflight = null
  }
}

async function _fetchWindGridImpl(
  south: number, north: number, west: number, east: number,
): Promise<WindGrid> {

  const lats = linspace(south, north, GRID_SIZE)
  const lngs = linspace(west, east, GRID_SIZE)

  // Build flat arrays of every (lat, lng) pair.
  const flatLats: number[] = []
  const flatLngs: number[] = []
  for (const lat of lats) {
    for (const lng of lngs) {
      flatLats.push(Math.round(lat * 10000) / 10000)
      flatLngs.push(Math.round(lng * 10000) / 10000)
    }
  }

  const FORECAST_HOURS = 24

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${flatLats.join(',')}` +
    `&longitude=${flatLngs.join(',')}` +
    `&hourly=wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover` +
    `&forecast_hours=${FORECAST_HOURS}` +
    `&wind_speed_unit=ms`

  const res = await fetchWithRetry(url)

  const json = await res.json()

  const results: Array<{
    hourly: { wind_speed_10m: number[]; wind_direction_10m: number[]; pressure_msl: number[]; cloud_cover: number[] }
  }> = Array.isArray(json) ? json : [json]

  // Figure out how many hours we actually got
  const numHours = results[0]?.hourly?.wind_speed_10m?.length ?? 1

  // Build 3D grids: [hour][lat][lng]
  // results is flat: results[latIdx * lngs.length + lngIdx] has .hourly arrays
  const uDataByHour: number[][][] = []
  const vDataByHour: number[][][] = []
  const pressureDataByHour: number[][][] = []
  const cloudCoverByHour: number[][][] = []

  for (let h = 0; h < numHours; h++) {
    const uHour: number[][] = []
    const vHour: number[][] = []
    const pHour: number[][] = []
    const cHour: number[][] = []
    for (let li = 0; li < lats.length; li++) {
      const uRow: number[] = []
      const vRow: number[] = []
      const pRow: number[] = []
      const cRow: number[] = []
      for (let gi = 0; gi < lngs.length; gi++) {
        const entry = results[li * lngs.length + gi]
        if (entry?.hourly) {
          const { u, v } = dirSpeedToUV(
            entry.hourly.wind_speed_10m[h] ?? 0,
            entry.hourly.wind_direction_10m[h] ?? 0,
          )
          uRow.push(u)
          vRow.push(v)
          pRow.push(entry.hourly.pressure_msl?.[h] ?? 1013)
          cRow.push(entry.hourly.cloud_cover?.[h] ?? 0)
        } else {
          uRow.push(0)
          vRow.push(0)
          pRow.push(1013)
          cRow.push(0)
        }
      }
      uHour.push(uRow)
      vHour.push(vRow)
      pHour.push(pRow)
      cHour.push(cRow)
    }
    uDataByHour.push(uHour)
    vDataByHour.push(vHour)
    pressureDataByHour.push(pHour)
    cloudCoverByHour.push(cHour)
  }

  const grid: WindGrid = {
    lats, lngs,
    uDataByHour, vDataByHour, pressureDataByHour, cloudCoverByHour,
    hours: numHours,
    uData: uDataByHour[0] ?? [],
    vData: vDataByHour[0] ?? [],
    pressureData: pressureDataByHour[0] ?? [],
    cloudCoverData: cloudCoverByHour[0] ?? [],
    timestamp: Date.now(),
  }
  cachedGrid = grid
  return grid
}

// ---------------------------------------------------------------------------
// Bilinear interpolation
// ---------------------------------------------------------------------------

/**
 * Interpolate wind (u, v) at an arbitrary (lat, lng) from the grid.
 * Returns { u: 0, v: 0 } if the point is outside the grid.
 */
export function interpolateWind(
  lat: number,
  lng: number,
  grid: WindGrid,
): WindVector {
  const { lats, lngs, uData, vData } = grid

  // Find bounding indices in lat direction.
  let li = 0
  while (li < lats.length - 1 && lats[li + 1] < lat) li++
  let gi = 0
  while (gi < lngs.length - 1 && lngs[gi + 1] < lng) gi++

  // Clamp to grid edges.
  if (li >= lats.length - 1) li = lats.length - 2
  if (gi >= lngs.length - 1) gi = lngs.length - 2
  if (li < 0) li = 0
  if (gi < 0) gi = 0

  const latRange = lats[li + 1] - lats[li]
  const lngRange = lngs[gi + 1] - lngs[gi]

  // Normalised fractional position within cell.
  const tLat = latRange === 0 ? 0 : (lat - lats[li]) / latRange
  const tLng = lngRange === 0 ? 0 : (lng - lngs[gi]) / lngRange

  // Clamp fractions to [0,1] for points beyond edges.
  const a = Math.max(0, Math.min(1, tLat))
  const b = Math.max(0, Math.min(1, tLng))

  // Bilinear blend for each component.
  const blend = (d: number[][]) => {
    const v00 = d[li][gi]
    const v10 = d[li + 1][gi]
    const v01 = d[li][gi + 1]
    const v11 = d[li + 1][gi + 1]
    return (
      v00 * (1 - a) * (1 - b) +
      v10 * a * (1 - b) +
      v01 * (1 - a) * b +
      v11 * a * b
    )
  }

  return { u: blend(uData), v: blend(vData) }
}

/**
 * Return scalar wind speed (m/s) from a vector.
 */
export function windSpeed(vec: WindVector): number {
  return Math.sqrt(vec.u * vec.u + vec.v * vec.v)
}

/**
 * Interpolate wind at a specific forecast hour (with blending between hours for smooth transitions).
 * hourFloat can be fractional, e.g. 2.5 means halfway between hour 2 and hour 3.
 */
export function interpolateWindAtHour(
  lat: number, lng: number, grid: WindGrid, hourFloat: number,
): WindVector {
  const h0 = Math.floor(hourFloat)
  const h1 = Math.min(h0 + 1, grid.hours - 1)
  const t = hourFloat - h0

  const clampH = (h: number) => Math.max(0, Math.min(h, grid.hours - 1))

  // Get wind at both hours
  const gridH0 = { ...grid, uData: grid.uDataByHour[clampH(h0)], vData: grid.vDataByHour[clampH(h0)] }
  const gridH1 = { ...grid, uData: grid.uDataByHour[clampH(h1)], vData: grid.vDataByHour[clampH(h1)] }

  const w0 = interpolateWind(lat, lng, gridH0)
  const w1 = interpolateWind(lat, lng, gridH1)

  // Lerp between the two hours
  return {
    u: w0.u + (w1.u - w0.u) * t,
    v: w0.v + (w1.v - w0.v) * t,
  }
}

// ---------------------------------------------------------------------------
// Wave grid — ONE marine fetch per viewport + hour, shared by color overlay,
// arrow overlay, and right-rail wave rows. Do not grow this grid.
// ---------------------------------------------------------------------------

export interface WaveGrid {
  lats: number[]
  lngs: number[]
  heightDataByHour: number[][][] // [hour][lat][lng] metres
  directionDataByHour: number[][][]
  periodDataByHour: number[][][]
  swellPeriodDataByHour: number[][][]
  heightData: number[][]   // current hour (index 0) for backward compat
  directionData: number[][]
  periodData: number[][]
  times: string[]
  hours: number
  timestamp: number
  cacheKey: string
}

/** Same 12×12 overlay sampling as before — share the fetch, do not thin the field. */
const WAVE_GRID_SIZE = 12
const WAVE_FORECAST_HOURS = 72
const WAVE_HOUR_MS = 60 * 60 * 1000
const WAVE_BOUNDS_QUANTUM = 4 // 0.25°
const WAVE_COVER_SLACK = 0.05

const waveCache = new Map<string, WaveGrid>()
let waveInflight: Promise<WaveGrid> | null = null

export function waveViewportKey(
  south: number, north: number, west: number, east: number,
  atMs: number = Date.now(),
): string {
  const q = (v: number) => (Math.round(v * WAVE_BOUNDS_QUANTUM) / WAVE_BOUNDS_QUANTUM).toFixed(2)
  const hour = Math.floor(atMs / WAVE_HOUR_MS)
  return `${q(south)}|${q(north)}|${q(west)}|${q(east)}|${hour}`
}

function waveHourBucket(atMs: number = Date.now()): number {
  return Math.floor(atMs / WAVE_HOUR_MS)
}

export function waveGridCovers(
  grid: WaveGrid,
  south: number, north: number, west: number, east: number,
): boolean {
  if (grid.lats.length < 2 || grid.lngs.length < 2) return false
  if (waveHourBucket(grid.timestamp) !== waveHourBucket()) return false
  return (
    grid.lats[0] <= south + WAVE_COVER_SLACK &&
    grid.lats[grid.lats.length - 1] >= north - WAVE_COVER_SLACK &&
    grid.lngs[0] <= west + WAVE_COVER_SLACK &&
    grid.lngs[grid.lngs.length - 1] >= east - WAVE_COVER_SLACK
  )
}

function findCachedWaveGrid(
  south: number, north: number, west: number, east: number,
): WaveGrid | null {
  const key = waveViewportKey(south, north, west, east)
  const exact = waveCache.get(key)
  if (exact) return exact
  for (const grid of waveCache.values()) {
    if (waveGridCovers(grid, south, north, west, east)) return grid
  }
  return null
}

export function invalidateWaveCache(): void {
  waveCache.clear()
}

export function peekWaveGrid(): WaveGrid | null {
  let newest: WaveGrid | null = null
  for (const grid of waveCache.values()) {
    if (!newest || grid.timestamp > newest.timestamp) newest = grid
  }
  return newest
}

export async function fetchWaveGrid(
  south: number,
  north: number,
  west: number,
  east: number,
): Promise<WaveGrid> {
  const cached = findCachedWaveGrid(south, north, west, east)
  if (cached) return cached

  if (waveInflight) {
    try {
      const incoming = await waveInflight
      if (waveGridCovers(incoming, south, north, west, east)) return incoming
      const after = findCachedWaveGrid(south, north, west, east)
      if (after) return after
    } catch {
      // Fall through and fetch this viewport.
    }
  }

  const promise = _fetchWaveGridImpl(south, north, west, east)
    .then((grid) => {
      waveCache.set(grid.cacheKey, grid)
      return grid
    })
    .catch((err) => {
      const stale = findCachedWaveGrid(south, north, west, east) ?? peekWaveGrid()
      if (stale) return stale
      throw err
    })
    .finally(() => {
      if (waveInflight === promise) waveInflight = null
    })

  waveInflight = promise
  return promise
}

function emptyLayer(nLat: number, nLng: number): number[][] {
  return Array.from({ length: nLat }, () => Array<number>(nLng).fill(0))
}

function layerAtHour(
  results: Array<{ hourly?: Record<string, Array<number | string> | undefined> }>,
  field: string,
  hour: number,
  nLat: number,
  nLng: number,
): number[][] {
  const layer = emptyLayer(nLat, nLng)
  for (let li = 0; li < nLat; li++) {
    for (let gi = 0; gi < nLng; gi++) {
      const raw = results[li * nLng + gi]?.hourly?.[field]?.[hour]
      layer[li][gi] = typeof raw === 'number' ? raw : 0
    }
  }
  return layer
}

async function _fetchWaveGridImpl(
  south: number, north: number, west: number, east: number,
): Promise<WaveGrid> {
  const latSpan = Math.max(0.2, north - south)
  const lngSpan = Math.max(0.2, east - west)
  const padLat = latSpan * 0.08
  const padLng = lngSpan * 0.08
  const s = south - padLat
  const n = north + padLat
  const w = west - padLng
  const e = east + padLng

  const lats = linspace(s, n, WAVE_GRID_SIZE)
  const lngs = linspace(w, e, WAVE_GRID_SIZE)

  const flatLats: number[] = []
  const flatLngs: number[] = []
  for (const lat of lats) {
    for (const lng of lngs) {
      flatLats.push(Math.round(lat * 10000) / 10000)
      flatLngs.push(Math.round(lng * 10000) / 10000)
    }
  }

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'

  const url =
    `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${flatLats.join(',')}` +
    `&longitude=${flatLngs.join(',')}` +
    `&hourly=wave_height,wave_direction,wave_period,swell_wave_period` +
    `&forecast_hours=${WAVE_FORECAST_HOURS}` +
    `&timezone=${encodeURIComponent(browserTz)}`

  const res = await fetchWithRetry(url)
  const json = await res.json()
  const results: Array<{ hourly?: Record<string, Array<number | string> | undefined> }> =
    Array.isArray(json) ? json : [json]

  const numHours = results[0]?.hourly?.wave_height?.length ?? 1
  const times = (results[0]?.hourly?.time ?? []).filter((t): t is string => typeof t === 'string').slice(0, numHours)
  const nLat = lats.length
  const nLng = lngs.length

  const heightDataByHour: number[][][] = []
  const directionDataByHour: number[][][] = []
  const periodDataByHour: number[][][] = []
  const swellPeriodDataByHour: number[][][] = []

  for (let h = 0; h < numHours; h++) {
    heightDataByHour.push(layerAtHour(results, 'wave_height', h, nLat, nLng))
    directionDataByHour.push(layerAtHour(results, 'wave_direction', h, nLat, nLng))
    periodDataByHour.push(layerAtHour(results, 'wave_period', h, nLat, nLng))
    swellPeriodDataByHour.push(layerAtHour(results, 'swell_wave_period', h, nLat, nLng))
  }

  const grid: WaveGrid = {
    lats, lngs,
    heightDataByHour,
    directionDataByHour,
    periodDataByHour,
    swellPeriodDataByHour,
    heightData: heightDataByHour[0] ?? [],
    directionData: directionDataByHour[0] ?? [],
    periodData: periodDataByHour[0] ?? [],
    times,
    hours: numHours,
    timestamp: Date.now(),
    cacheKey: waveViewportKey(south, north, west, east),
  }
  return grid
}

/**
 * Check if a lat/lng point is on land by examining the raw wave grid cells.
 * Returns true if ANY of the 4 surrounding grid cells have zero/near-zero height,
 * meaning the point is on or near a coastline. This is fast (no GPU queries).
 */
export function isLandPoint(lat: number, lng: number, grid: WaveGrid, hourIdx: number = 0): boolean {
  const { lats, lngs, heightDataByHour, heightData } = grid
  const data = heightDataByHour[Math.min(hourIdx, (heightDataByHour?.length ?? 1) - 1)] ?? heightData

  let li = 0
  while (li < lats.length - 1 && lats[li + 1] < lat) li++
  let gi = 0
  while (gi < lngs.length - 1 && lngs[gi + 1] < lng) gi++

  li = Math.max(0, Math.min(li, lats.length - 2))
  gi = Math.max(0, Math.min(gi, lngs.length - 2))

  // If ANY corner of the cell has zero wave height, it's land/coast
  const LAND = 0.05
  return (
    data[li][gi] < LAND ||
    data[li + 1][gi] < LAND ||
    data[li][gi + 1] < LAND ||
    data[li + 1][gi + 1] < LAND
  )
}

/** Bilinear interpolation helper for a 2D grid */
export function bilinearInterp(lat: number, lng: number, lats: number[], lngs: number[], data: number[][]): number {
  let li = 0
  while (li < lats.length - 1 && lats[li + 1] < lat) li++
  let gi = 0
  while (gi < lngs.length - 1 && lngs[gi + 1] < lng) gi++

  if (li >= lats.length - 1) li = lats.length - 2
  if (gi >= lngs.length - 1) gi = lngs.length - 2
  if (li < 0) li = 0
  if (gi < 0) gi = 0

  const latRange = lats[li + 1] - lats[li]
  const lngRange = lngs[gi + 1] - lngs[gi]

  const a = latRange === 0 ? 0 : Math.max(0, Math.min(1, (lat - lats[li]) / latRange))
  const b = lngRange === 0 ? 0 : Math.max(0, Math.min(1, (lng - lngs[gi]) / lngRange))

  const v00 = data[li][gi], v10 = data[li + 1][gi], v01 = data[li][gi + 1], v11 = data[li + 1][gi + 1]
  return v00 * (1 - a) * (1 - b) + v10 * a * (1 - b) + v01 * (1 - a) * b + v11 * a * b
}

/** Interpolate wave height at a point from the grid (current hour). */
export function interpolateWaveHeight(lat: number, lng: number, grid: WaveGrid): number {
  return bilinearInterp(lat, lng, grid.lats, grid.lngs, grid.heightData)
}

/** Interpolate wave height at a specific forecast hour (with smooth blending). */
export function interpolateWaveHeightAtHour(
  lat: number, lng: number, grid: WaveGrid, hourFloat: number,
): number {
  const h0 = Math.floor(hourFloat)
  const h1 = Math.min(h0 + 1, grid.hours - 1)
  const t = hourFloat - h0

  const clampH = (h: number) => Math.max(0, Math.min(h, grid.hours - 1))

  const val0 = bilinearInterp(lat, lng, grid.lats, grid.lngs, grid.heightDataByHour[clampH(h0)])
  const val1 = bilinearInterp(lat, lng, grid.lats, grid.lngs, grid.heightDataByHour[clampH(h1)])

  return val0 + (val1 - val0) * t
}

function sampleWaveLayerAtHour(
  lat: number, lng: number, grid: WaveGrid, hour: number, layers: number[][][],
): number {
  const h = Math.max(0, Math.min(Math.round(hour), grid.hours - 1))
  const data = layers[h]
  if (!data) return 0
  return bilinearInterp(lat, lng, grid.lats, grid.lngs, data)
}

/** Sample the shared viewport grid at a point for rail / marine rows. */
export function sampleWavePoint(
  grid: WaveGrid,
  lat: number,
  lng: number,
  hour: number,
): { heightM: number; direction: number; period: number; swellPeriod: number } {
  return {
    heightM: sampleWaveLayerAtHour(lat, lng, grid, hour, grid.heightDataByHour),
    direction: sampleWaveLayerAtHour(lat, lng, grid, hour, grid.directionDataByHour),
    period: sampleWaveLayerAtHour(lat, lng, grid, hour, grid.periodDataByHour),
    swellPeriod: sampleWaveLayerAtHour(lat, lng, grid, hour, grid.swellPeriodDataByHour),
  }
}
