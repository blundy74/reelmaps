import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, subDays } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a Date to YYYY-MM-DD for API queries */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** Yesterday's date — most satellite products have 1-day latency */
export function getDefaultDate(): Date {
  return subDays(new Date(), 1)
}

/** Format decimal degrees to DMS string */
export function formatCoords(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  const latDeg = Math.abs(lat).toFixed(4)
  const lngDeg = Math.abs(lng).toFixed(4)
  return `${latDeg}° ${latDir}  ${lngDeg}° ${lngDir}`
}

/** Convert meters to feet */
export function mToFt(meters: number): number {
  return Math.round(meters * 3.28084)
}

/** Convert km/h to knots */
export function kmhToKnots(kmh: number): number {
  return Math.round(kmh * 0.539957 * 10) / 10
}

/** Returns a depth color for bathymetric coloring */
export function depthColor(depthFt: number): string {
  if (depthFt < 60) return '#1a6b9e'
  if (depthFt < 200) return '#145a82'
  if (depthFt < 600) return '#0e4a6b'
  if (depthFt < 1200) return '#0a3a55'
  if (depthFt < 3000) return '#062a40'
  return '#031825'
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
