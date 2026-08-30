/**
 * First-load camera: user's water, not the old East Coast / Bahamas default.
 *
 * Logged-in + My Spots → fit those spots.
 * No spots → Gulf of Mexico, Gulf-wide.
 * An explicit share hash (not a leftover app default) still wins.
 */

export const GULF_HOME = {
  latitude: 28,
  longitude: -88,
  zoom: 5,
  bearing: 0,
  pitch: 0,
} as const

/** Legacy persist / Amplify leftover — Florida-Atlantic, not the Gulf. */
export const LEGACY_EAST_COAST = {
  latitude: 30,
  longitude: -80,
  zoom: 4,
} as const

export interface ViewportLike {
  latitude: number
  longitude: number
  zoom: number
}

export interface SpotLike {
  lat: number
  lng: number
}

function near(a: number, b: number, eps: number): boolean {
  return Math.abs(a - b) < eps
}

/** True when the camera is still an app default, not a captain-chosen view. */
export function isGenericHomeView(vs: ViewportLike): boolean {
  const east =
    near(vs.latitude, LEGACY_EAST_COAST.latitude, 0.08)
    && near(vs.longitude, LEGACY_EAST_COAST.longitude, 0.08)
    && vs.zoom <= 4.6
  const gulf =
    near(vs.latitude, GULF_HOME.latitude, 0.08)
    && near(vs.longitude, GULF_HOME.longitude, 0.08)
    && vs.zoom <= 5.6
  const bahamas =
    near(vs.latitude, 27.1837, 0.15)
    && near(vs.longitude, -74.1113, 0.15)
  return east || gulf || bahamas
}

/** Share links have a specific camera. Leftover `#lat=30&lng=-80&z=4` is not a share. */
export function isExplicitShareView(vs: ViewportLike | null): boolean {
  if (!vs) return false
  return !isGenericHomeView(vs)
}

export function spotsBoundingBox(spots: SpotLike[]): {
  west: number
  south: number
  east: number
  north: number
} | null {
  if (!spots.length) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const s of spots) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) continue
    if (s.lat < south) south = s.lat
    if (s.lat > north) north = s.lat
    if (s.lng < west) west = s.lng
    if (s.lng > east) east = s.lng
  }
  if (!Number.isFinite(west)) return null
  // Pad so a tight Orange Beach cluster does not slam into the rails.
  const padLat = Math.max((north - south) * 0.12, 0.18)
  const padLng = Math.max((east - west) * 0.12, 0.22)
  return {
    west: west - padLng,
    south: south - padLat,
    east: east + padLng,
    north: north + padLat,
  }
}

export function spotsHomeCenter(spots: SpotLike[]): ViewportLike | null {
  const box = spotsBoundingBox(spots)
  if (!box) return null
  const latitude = (box.south + box.north) / 2
  const longitude = (box.west + box.east) / 2
  const span = Math.max(box.north - box.south, (box.east - box.west) * 0.8)
  let zoom = 7.2
  if (span > 8) zoom = 5
  else if (span > 4) zoom = 5.8
  else if (span > 2) zoom = 6.4
  else if (span > 1) zoom = 7
  return { latitude, longitude, zoom }
}
