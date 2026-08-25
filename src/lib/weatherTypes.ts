/** Weather data types for the ReelMaps weather panel */

export interface CurrentWeather {
  temperature: number       // °F
  apparentTemperature: number // °F
  humidity: number          // %
  windSpeed: number         // mph
  windDirection: number     // degrees
  windGusts: number         // mph
  pressure: number          // mb (hPa)
  cloudCover: number        // %
  visibility: number       // miles
  precipitation: number     // inches
  weatherCode: number       // WMO code
  isDay: boolean
}

export interface HourlyEntry {
  time: string              // ISO 8601
  temperature: number
  windSpeed: number
  windDirection: number
  windGusts: number
  precipitation: number
  precipProbability: number
  cloudCover: number
  weatherCode: number
  isDay: boolean
}

export interface DailyEntry {
  date: string              // YYYY-MM-DD
  tempHigh: number
  tempLow: number
  windSpeedMax: number
  windGustsMax: number
  windDirectionDominant: number
  precipSum: number
  precipProbabilityMax: number
  weatherCode: number
  sunrise: string
  sunset: string
}

export interface MarineData {
  hourly: MarineHourlyEntry[]
}

export interface MarineHourlyEntry {
  time: string
  waveHeight: number        // ft
  waveDirection: number     // degrees
  wavePeriod: number        // seconds
  windWaveHeight: number
  windWaveDirection: number
  windWavePeriod: number
  swellHeight: number
  swellDirection: number
  swellPeriod: number
  oceanCurrentSpeed: number // knots
  oceanCurrentDirection: number
  seaSurfaceTemp: number   // °F
}

export interface WeatherOverlayDef {
  id: string
  name: string
  visible: boolean
  opacity: number
}

/** WMO Weather Interpretation Codes → labels & icons */
export const WMO_CODES: Record<number, { label: string; icon: string; nightIcon?: string }> = {
  0: { label: 'Clear sky', icon: '☀️', nightIcon: '🌙' },
  1: { label: 'Mainly clear', icon: '🌤️', nightIcon: '🌙' },
  2: { label: 'Partly cloudy', icon: '⛅', nightIcon: '☁️' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Foggy', icon: '🌫️' },
  48: { label: 'Rime fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Moderate drizzle', icon: '🌦️' },
  55: { label: 'Dense drizzle', icon: '🌧️' },
  61: { label: 'Slight rain', icon: '🌦️' },
  63: { label: 'Moderate rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Slight snow', icon: '🌨️' },
  73: { label: 'Moderate snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  80: { label: 'Slight showers', icon: '🌦️' },
  81: { label: 'Moderate showers', icon: '🌧️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'T-storm w/ hail', icon: '⛈️' },
  99: { label: 'T-storm w/ heavy hail', icon: '⛈️' },
}

/** Get the correct weather icon for the time of day */
export function getWeatherIcon(code: number, isDay: boolean): string {
  const wmo = WMO_CODES[code]
  if (!wmo) return '?'
  if (!isDay && wmo.nightIcon) return wmo.nightIcon
  return wmo.icon
}

/** Cardinal direction from degrees */
export function degreesToCardinal(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

/** Beaufort scale from wind speed (mph) */
export function windToBeaufort(mph: number): { force: number; label: string } {
  if (mph < 1) return { force: 0, label: 'Calm' }
  if (mph <= 3) return { force: 1, label: 'Light air' }
  if (mph <= 7) return { force: 2, label: 'Light breeze' }
  if (mph <= 12) return { force: 3, label: 'Gentle breeze' }
  if (mph <= 18) return { force: 4, label: 'Moderate breeze' }
  if (mph <= 24) return { force: 5, label: 'Fresh breeze' }
  if (mph <= 31) return { force: 6, label: 'Strong breeze' }
  if (mph <= 38) return { force: 7, label: 'Near gale' }
  if (mph <= 46) return { force: 8, label: 'Gale' }
  if (mph <= 54) return { force: 9, label: 'Strong gale' }
  if (mph <= 63) return { force: 10, label: 'Storm' }
  if (mph <= 72) return { force: 11, label: 'Violent storm' }
  return { force: 12, label: 'Hurricane' }
}

/** mph → knots (Windy Basic / marine convention) */
export function mphToKnots(mph: number): number {
  return mph * 0.868976
}

/** Windy-style heat color for wind or gust cells (input: knots). */
export function windHeatColor(kt: number): { bg: string; fg: string } {
  if (kt < 6) return { bg: '#1b5e32', fg: '#e8f5e9' }
  if (kt < 10) return { bg: '#2e7d32', fg: '#ffffff' }
  if (kt < 14) return { bg: '#7cb342', fg: '#111827' }
  if (kt < 18) return { bg: '#c0ca33', fg: '#111827' }
  if (kt < 22) return { bg: '#fdd835', fg: '#111827' }
  if (kt < 26) return { bg: '#fb8c00', fg: '#111827' }
  if (kt < 32) return { bg: '#f4511e', fg: '#ffffff' }
  if (kt < 40) return { bg: '#d32f2f', fg: '#ffffff' }
  return { bg: '#ad1457', fg: '#ffffff' }
}

/** Sea-state heat color for wave-height cells (input: feet). */
export function seasHeatColor(ft: number): { bg: string; fg: string } {
  if (ft < 1.5) return { bg: '#1b5e32', fg: '#e8f5e9' }
  if (ft < 3) return { bg: '#2e7d32', fg: '#ffffff' }
  if (ft < 5) return { bg: '#c0ca33', fg: '#111827' }
  if (ft < 8) return { bg: '#fb8c00', fg: '#111827' }
  if (ft < 12) return { bg: '#f4511e', fg: '#ffffff' }
  return { bg: '#d32f2f', fg: '#ffffff' }
}

/** Sea state from wave height (ft) */
export function waveHeightToSeaState(ft: number): { state: number; label: string } {
  if (ft < 0.33) return { state: 0, label: 'Glassy' }
  if (ft < 1) return { state: 1, label: 'Rippled' }
  if (ft < 2) return { state: 2, label: 'Smooth' }
  if (ft < 4) return { state: 3, label: 'Slight' }
  if (ft < 8) return { state: 4, label: 'Moderate' }
  if (ft < 13) return { state: 5, label: 'Rough' }
  if (ft < 20) return { state: 6, label: 'Very rough' }
  if (ft < 30) return { state: 7, label: 'High' }
  if (ft < 46) return { state: 8, label: 'Very high' }
  return { state: 9, label: 'Phenomenal' }
}
