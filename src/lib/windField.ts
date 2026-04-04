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

/** Fetch with retry on 429 (rate limit) — waits and retries up to 3 times */
async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url)
    if (res.status === 429 && attempt < retries) {
      // Wait with exponential backoff: 3s, 9s, 27s
      await new Promise(r => setTimeout(r, 3000 * Math.pow(3, attempt)))
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
// Wave grid (separate cache)
// ---------------------------------------------------------------------------

export interface WaveGrid {
  lats: number[]
  lngs: number[]
  heightDataByHour: number[][][] // [hour][lat][lng]
  heightData: number[][]   // current hour (index 0) for backward compat
  directionData: number[][]
  periodData: number[][]
  hours: number
  timestamp: number
}

let cachedWaveGrid: WaveGrid | null = null
let inflightWave: Promise<WaveGrid> | null = null

export function invalidateWaveCache(): void {
  cachedWaveGrid = null
}

export async function fetchWaveGrid(
  south: number,
  north: number,
  west: number,
  east: number,
): Promise<WaveGrid> {
  if (cachedWaveGrid && Date.now() - cachedWaveGrid.timestamp < CACHE_TTL_MS) {
    return cachedWaveGrid
  }
  if (inflightWave) return inflightWave
  inflightWave = _fetchWaveGridImpl(south, north, west, east)
  try {
    return await inflightWave
  } finally {
    inflightWave = null
  }
}

const WAVE_GRID_SIZE = 12 // 12x12 = 144 points — balanced resolution vs rate limits

async function _fetchWaveGridImpl(
  south: number, north: number, west: number, east: number,
): Promise<WaveGrid> {
  const lats = linspace(south, north, WAVE_GRID_SIZE)
  const lngs = linspace(west, east, WAVE_GRID_SIZE)

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
    `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${flatLats.join(',')}` +
    `&longitude=${flatLngs.join(',')}` +
    `&hourly=wave_height,wave_direction,wave_period` +
    `&forecast_hours=${FORECAST_HOURS}`

  const res = await fetchWithRetry(url)
  const json = await res.json()
  const results: Array<{
    hourly: { wave_height: number[]; wave_direction: number[]; wave_period: number[] }
  }> = Array.isArray(json) ? json : [json]

  const numHours = results[0]?.hourly?.wave_height?.length ?? 1

  // Build hourly height grids — results[latIdx * lngs.length + lngIdx]
  const heightDataByHour: number[][][] = []
  for (let h = 0; h < numHours; h++) {
    const heightHour: number[][] = []
    for (let li = 0; li < lats.length; li++) {
      const hRow: number[] = []
      for (let gi = 0; gi < lngs.length; gi++) {
        const entry = results[li * lngs.length + gi]
        hRow.push(entry?.hourly?.wave_height?.[h] ?? 0)
      }
      heightHour.push(hRow)
    }
    heightDataByHour.push(heightHour)
  }

  // Direction and period for current hour (index 0) for the marine panel
  const directionData: number[][] = []
  const periodData: number[][] = []
  for (let li = 0; li < lats.length; li++) {
    const dRow: number[] = []
    const pRow: number[] = []
    for (let gi = 0; gi < lngs.length; gi++) {
      const entry = results[li * lngs.length + gi]
      dRow.push(entry?.hourly?.wave_direction?.[0] ?? 0)
      pRow.push(entry?.hourly?.wave_period?.[0] ?? 0)
    }
    directionData.push(dRow)
    periodData.push(pRow)
  }

  const grid: WaveGrid = {
    lats, lngs,
    heightDataByHour,
    heightData: heightDataByHour[0] ?? [],
    directionData, periodData,
    hours: numHours,
    timestamp: Date.now(),
  }
  cachedWaveGrid = grid
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
