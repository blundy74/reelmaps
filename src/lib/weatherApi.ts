/**
 * Weather API client — fetches from Open-Meteo (free, no API key)
 * and RainViewer (free radar tiles).
 */

import type {
  CurrentWeather,
  HourlyEntry,
  DailyEntry,
  MarineData,
  MarineHourlyEntry,
} from './weatherTypes'

// ── Helpers ──────────────────────────────────────────────────────────────────

const C_TO_F = (c: number) => (c * 9) / 5 + 32
const KMH_TO_MPH = (k: number) => k * 0.621371
const KMH_TO_KT = (k: number) => k * 0.539957
const M_TO_FT = (m: number) => m * 3.28084
const MM_TO_IN = (m: number) => m * 0.03937
const M_TO_MI = (m: number) => m * 0.000621371

// Simple in-memory cache: key → { data, timestamp }
const cache = new Map<string, { data: unknown; ts: number }>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

function cacheKey(prefix: string, lat: number, lng: number): string {
  return `${prefix}:${lat.toFixed(2)}:${lng.toFixed(2)}`
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() })
}

// ── Open-Meteo Forecast API ─────────────────────────────────────────────────

interface ForecastResult {
  current: CurrentWeather
  hourly: HourlyEntry[]
  daily: DailyEntry[]
}

export async function fetchForecast(lat: number, lng: number): Promise<ForecastResult> {
  const key = cacheKey('forecast', lat, lng)
  const cached = getCached<ForecastResult>(key)
  if (cached) return cached

  const hourlyParams = [
    'temperature_2m', 'apparent_temperature', 'relative_humidity_2m',
    'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    'pressure_msl', 'cloud_cover', 'visibility',
    'precipitation', 'precipitation_probability',
    'weather_code', 'is_day',
  ].join(',')

  const dailyParams = [
    'temperature_2m_max', 'temperature_2m_min',
    'wind_speed_10m_max', 'wind_gusts_10m_max', 'wind_direction_10m_dominant',
    'precipitation_sum', 'precipitation_probability_max',
    'weather_code', 'sunrise', 'sunset',
  ].join(',')

  // Use the browser's timezone so times match the user's clock exactly
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}`
    + `&current=${hourlyParams}`
    + `&hourly=${hourlyParams}`
    + `&daily=${dailyParams}`
    + `&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`
    + `&forecast_days=7&timezone=${encodeURIComponent(browserTz)}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo forecast error: ${res.status}`)
  const data = await res.json()

  const current: CurrentWeather = {
    temperature: data.current.temperature_2m,
    apparentTemperature: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windDirection: data.current.wind_direction_10m,
    windGusts: data.current.wind_gusts_10m,
    pressure: data.current.pressure_msl,
    cloudCover: data.current.cloud_cover,
    visibility: data.current.visibility * 0.000621371, // m → mi
    precipitation: data.current.precipitation,
    weatherCode: data.current.weather_code,
    isDay: !!data.current.is_day,
  }

  // Find the current hour index — match against the user's current time
  const now = new Date()
  const nowHour = now.getFullYear() + '-'
    + String(now.getMonth() + 1).padStart(2, '0') + '-'
    + String(now.getDate()).padStart(2, '0') + 'T'
    + String(now.getHours()).padStart(2, '0')

  let nowIndex = 0
  for (let i = 0; i < data.hourly.time.length; i++) {
    if (data.hourly.time[i].slice(0, 13) >= nowHour) {
      nowIndex = i
      break
    }
  }

  // Start 8 hours before the current hour for past data playback.
  const PAST_HOURS = 8
  const startIndex = Math.max(0, nowIndex - PAST_HOURS)
  // 26 total hours: 8h past + 18h future
  const TOTAL_HOURS = 26
  const hourly: HourlyEntry[] = data.hourly.time.slice(startIndex, startIndex + TOTAL_HOURS).map((t: string, idx: number) => {
    const i = startIndex + idx
    return {
      time: t,
      temperature: data.hourly.temperature_2m[i],
      windSpeed: data.hourly.wind_speed_10m[i],
      windDirection: data.hourly.wind_direction_10m[i],
      windGusts: data.hourly.wind_gusts_10m[i],
      precipitation: data.hourly.precipitation[i],
      precipProbability: data.hourly.precipitation_probability[i],
      cloudCover: data.hourly.cloud_cover[i],
      weatherCode: data.hourly.weather_code[i],
      isDay: !!data.hourly.is_day[i],
    }
  })

  const daily: DailyEntry[] = data.daily.time.map((d: string, i: number) => ({
    date: d,
    tempHigh: data.daily.temperature_2m_max[i],
    tempLow: data.daily.temperature_2m_min[i],
    windSpeedMax: data.daily.wind_speed_10m_max[i],
    windGustsMax: data.daily.wind_gusts_10m_max[i],
    windDirectionDominant: data.daily.wind_direction_10m_dominant[i],
    precipSum: data.daily.precipitation_sum[i],
    precipProbabilityMax: data.daily.precipitation_probability_max[i],
    weatherCode: data.daily.weather_code[i],
    sunrise: data.daily.sunrise[i],
    sunset: data.daily.sunset[i],
  }))

  const result = { current, hourly, daily }
  setCache(key, result)
  return result
}

// ── Open-Meteo Marine API ───────────────────────────────────────────────────

export async function fetchMarine(lat: number, lng: number): Promise<MarineData> {
  const key = cacheKey('marine', lat, lng)
  const cached = getCached<MarineData>(key)
  if (cached) return cached

  const params = [
    'wave_height', 'wave_direction', 'wave_period',
    'wind_wave_height', 'wind_wave_direction', 'wind_wave_period',
    'swell_wave_height', 'swell_wave_direction', 'swell_wave_period',
    'ocean_current_velocity', 'ocean_current_direction',
    'sea_surface_temperature',
  ].join(',')

  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}`
    + `&hourly=${params}&forecast_days=3&timezone=auto`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo marine error: ${res.status}`)
  const data = await res.json()

  const hourly: MarineHourlyEntry[] = data.hourly.time.slice(0, 72).map((t: string, i: number) => ({
    time: t,
    waveHeight: M_TO_FT(data.hourly.wave_height?.[i] ?? 0),
    waveDirection: data.hourly.wave_direction?.[i] ?? 0,
    wavePeriod: data.hourly.wave_period?.[i] ?? 0,
    windWaveHeight: M_TO_FT(data.hourly.wind_wave_height?.[i] ?? 0),
    windWaveDirection: data.hourly.wind_wave_direction?.[i] ?? 0,
    windWavePeriod: data.hourly.wind_wave_period?.[i] ?? 0,
    swellHeight: M_TO_FT(data.hourly.swell_wave_height?.[i] ?? 0),
    swellDirection: data.hourly.swell_wave_direction?.[i] ?? 0,
    swellPeriod: data.hourly.swell_wave_period?.[i] ?? 0,
    oceanCurrentSpeed: KMH_TO_KT(data.hourly.ocean_current_velocity?.[i] ?? 0),
    oceanCurrentDirection: data.hourly.ocean_current_direction?.[i] ?? 0,
    seaSurfaceTemp: C_TO_F(data.hourly.sea_surface_temperature?.[i] ?? 0),
  }))

  const result: MarineData = { hourly }
  setCache(key, result)
  return result
}

// ── RainViewer API (radar tiles) ────────────────────────────────────────────

export interface RainViewerFrame {
  time: number
  path: string
}

export interface RainViewerData {
  host: string
  past: RainViewerFrame[]
  nowcast: RainViewerFrame[]
}

const RADAR_CACHE_TTL = 4 * 60 * 1000 // 4 minutes — frames rotate out quickly

export async function fetchRainViewerFrames(): Promise<RainViewerData> {
  const key = 'rainviewer'
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < RADAR_CACHE_TTL) return entry.data as RainViewerData

  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
  if (!res.ok) throw new Error(`RainViewer error: ${res.status}`)
  const data = await res.json()

  const result: RainViewerData = {
    host: data.host,
    past: data.radar.past ?? [],
    nowcast: data.radar.nowcast ?? [],
  }
  cache.set(key, { data: result, ts: Date.now() })
  return result
}

/** Build a RainViewer radar tile URL for MapLibre */
export function rainViewerTileUrl(host: string, path: string): string {
  // Color scheme 2 = universal (vivid), smooth=0 (crisp raw reflectivity), snow=1
  return `${host}${path}/256/{z}/{x}/{y}/2/0_1.png`
}
