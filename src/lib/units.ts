/**
 * Unit conversion and formatting utilities.
 * All functions accept values in a canonical unit and format for the selected system.
 */

export type UnitSystem = 'imperial' | 'metric' | 'nautical'

/** Format temperature (input: Fahrenheit) */
export function formatTemp(fahrenheit: number, system: UnitSystem): string {
  if (system === 'metric') {
    const celsius = (fahrenheit - 32) * (5 / 9)
    return `${Math.round(celsius)}\u00B0C`
  }
  return `${Math.round(fahrenheit)}\u00B0F`
}

/** Format wind speed (input: mph) */
export function formatWindSpeed(mph: number, system: UnitSystem): string {
  if (system === 'metric') {
    const kmh = mph * 1.60934
    return `${Math.round(kmh)} km/h`
  }
  if (system === 'nautical') {
    const kt = mph * 0.868976
    return `${Math.round(kt)} kt`
  }
  return `${Math.round(mph)} mph`
}

/** Format distance (input: nautical miles) */
export function formatDistance(nauticalmiles: number, system: UnitSystem): string {
  if (system === 'metric') {
    const km = nauticalmiles * 1.852
    return `${km.toFixed(1)} km`
  }
  if (system === 'imperial') {
    const mi = nauticalmiles * 1.15078
    return `${mi.toFixed(1)} mi`
  }
  return `${nauticalmiles.toFixed(1)} nm`
}

/** Format wave height (input: feet) */
export function formatWaveHeight(feet: number, system: UnitSystem): string {
  if (system === 'metric') {
    const meters = feet * 0.3048
    return `${meters.toFixed(1)} m`
  }
  return `${feet.toFixed(1)} ft`
}

/** Format pressure (input: millibars) */
export function formatPressure(mb: number, system: UnitSystem): string {
  if (system === 'imperial') {
    const inHg = mb * 0.02953
    return `${inHg.toFixed(2)} inHg`
  }
  return `${Math.round(mb)} mb`
}

/** Format visibility (input: statute miles) */
export function formatVisibility(miles: number, system: UnitSystem): string {
  if (system === 'metric') {
    const km = miles * 1.60934
    return `${km.toFixed(1)} km`
  }
  return `${miles.toFixed(1)} mi`
}

/** Format speed (input: knots) */
export function formatSpeed(knots: number, system: UnitSystem): string {
  if (system === 'metric') {
    const kmh = knots * 1.852
    return `${kmh.toFixed(1)} km/h`
  }
  if (system === 'imperial') {
    const mph = knots * 1.15078
    return `${mph.toFixed(1)} mph`
  }
  return `${knots.toFixed(1)} kt`
}
