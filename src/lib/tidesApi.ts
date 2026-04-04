/**
 * NOAA CO-OPS Tides API client — fetches nearest tide station and predictions.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface TideStation {
  id: string
  name: string
  lat: number
  lng: number
  distance: number // miles
}

export interface TidePrediction {
  time: string
  height: number
  type: 'H' | 'L'
}

// ── Cache ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: unknown; ts: number }>()
const STATION_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
const PREDICTION_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < ttl) return entry.data as T
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() })
}

// ── Haversine distance (miles) ──────────────────────────────────────────────

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Fetch nearest tide station ──────────────────────────────────────────────

interface RawStation {
  id: string
  name: string
  lat: number
  lng: number
}

let stationListPromise: Promise<RawStation[]> | null = null

async function getStationList(): Promise<RawStation[]> {
  const key = 'tide-stations'
  const cached = getCached<RawStation[]>(key, STATION_CACHE_TTL)
  if (cached) return cached

  if (!stationListPromise) {
    stationListPromise = (async () => {
      const res = await fetch(
        'https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels',
      )
      if (!res.ok) throw new Error(`NOAA stations error: ${res.status}`)
      const data = await res.json()
      const stations: RawStation[] = (data.stations ?? []).map(
        (s: { id: string; name: string; lat: number; lng: number }) => ({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
        }),
      )
      setCache(key, stations)
      stationListPromise = null
      return stations
    })()
  }

  return stationListPromise
}

export async function fetchNearestTideStation(lat: number, lng: number): Promise<TideStation> {
  const stations = await getStationList()

  let nearest: TideStation | null = null
  let minDist = Infinity

  for (const s of stations) {
    const d = haversineDistance(lat, lng, s.lat, s.lng)
    if (d < minDist) {
      minDist = d
      nearest = { id: s.id, name: s.name, lat: s.lat, lng: s.lng, distance: d }
    }
  }

  if (!nearest) throw new Error('No tide stations found')
  return nearest
}

// ── Continuous tide data (6-min interval) ──────────────────────────────────

export interface TideContinuous {
  time: string
  height: number
}

// ── Fetch tide predictions (high/low only) ─────────────────────────────────

export async function fetchTidePredictions(stationId: string): Promise<TidePrediction[]> {
  const key = `tide-pred:${stationId}`
  const cached = getCached<TidePrediction[]>(key, PREDICTION_CACHE_TTL)
  if (cached) return cached

  const now = new Date()
  const beginDate =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')

  const url =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
    `?begin_date=${beginDate}&range=72&station=${stationId}` +
    `&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt` +
    `&interval=hilo&format=json&application=ReelMaps`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`NOAA tide predictions error: ${res.status}`)
  const data = await res.json()

  const predictions: TidePrediction[] = (data.predictions ?? []).map(
    (p: { t: string; v: string; type: string }) => ({
      time: p.t,
      height: parseFloat(p.v),
      type: p.type === 'H' ? 'H' : 'L',
    }),
  )

  setCache(key, predictions)
  return predictions
}

// ── Fetch continuous tide curve (6-minute intervals) ───────────────────────

export async function fetchTideContinuous(stationId: string): Promise<TideContinuous[]> {
  const key = `tide-cont:${stationId}`
  const cached = getCached<TideContinuous[]>(key, PREDICTION_CACHE_TTL)
  if (cached) return cached

  const now = new Date()
  const beginDate =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')

  const url =
    `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
    `?begin_date=${beginDate}&range=72&station=${stationId}` +
    `&product=predictions&datum=MLLW&units=english&time_zone=lst_ldt` +
    `&interval=6&format=json&application=ReelMaps`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`NOAA tide continuous error: ${res.status}`)
  const data = await res.json()

  const continuous: TideContinuous[] = (data.predictions ?? []).map(
    (p: { t: string; v: string }) => ({
      time: p.t,
      height: parseFloat(p.v),
    }),
  )

  setCache(key, continuous)
  return continuous
}
