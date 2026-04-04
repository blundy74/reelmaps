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
