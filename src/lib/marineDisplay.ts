/**
 * Missing model fields must never render as 0°F / 0.0 kt.
 * Open-Meteo wave-grid reuse does not include SST, currents, or swell height.
 */

export const MISSING_DISPLAY = '—'

export function isMissingModelValue(n: number | null | undefined): boolean {
  if (n == null) return true
  if (!Number.isFinite(n)) return true
  return false
}

/** Hardcoded 0 fill from a source that does not provide this field. */
export function isUnavailableZero(n: number | null | undefined): boolean {
  if (isMissingModelValue(n)) return true
  return n === 0
}

export function formatModelTempF(n: number | null | undefined): string {
  if (isUnavailableZero(n)) return MISSING_DISPLAY
  return `${Math.round(n!)}°F`
}

export function formatModelCurrentKt(n: number | null | undefined): string {
  if (isUnavailableZero(n)) return MISSING_DISPLAY
  return `${n!.toFixed(1)} kt`
}

export function formatModelFeet(n: number | null | undefined): string {
  if (isUnavailableZero(n)) return MISSING_DISPLAY
  return `${n!.toFixed(1)} ft`
}
