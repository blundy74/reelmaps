/**
 * Run: npx --yes tsx src/lib/landMask.test.ts
 */
import {
  parseWmsBbox3857,
  clipRingToBBox,
  evenOddLandAt,
  harborLandInflatePx,
  harborLandPadDeg,
  type LandRing,
} from './landMask'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function ringFrom(coords: number[][]): LandRing {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { coords, minLng, maxLng, minLat, maxLat }
}

function main() {
  const parsed = parseWmsBbox3857('https://example.com/wms?BBOX=-9750000,3500000,-9740000,3510000')
  assert(parsed != null && parsed.xmin === -9750000 && parsed.ymax === 3510000, 'bbox')
  assert(parseWmsBbox3857('https://example.com/wms?BBOX={bbox-epsg-3857}') == null, 'placeholder')

  // Continent-sized square that fully contains an Orange Beach harbor tile.
  // Clip returns empty (no edge crosses the tile) — that was the z13 miss.
  const continent = [
    [-100, 20],
    [-70, 20],
    [-70, 40],
    [-100, 40],
    [-100, 20],
  ]
  const west = -87.58
  const east = -87.54
  const south = 30.25
  const north = 30.29
  const clipped = clipRingToBBox(continent, west, east, south, north)
  const land = [ringFrom(continent)]
  const centerLand = evenOddLandAt(land, (west + east) / 2, (south + north) / 2)
  assert(centerLand, 'harbor tile center is land')
  assert(clipped.length >= 3 || centerLand, 'inland tile still punches via clip or contains')
  assert(!evenOddLandAt(land, -88.5, 18), 'south of continent is water')

  // Lake hole: even-odd must stay water inside the hole.
  const hole = [
    [-87.57, 30.26],
    [-87.55, 30.26],
    [-87.55, 30.28],
    [-87.57, 30.28],
    [-87.57, 30.26],
  ]
  assert(!evenOddLandAt([ringFrom(continent), ringFrom(hole)], -87.56, 30.27), 'lake hole is water')

  assert(harborLandInflatePx(-87.54, -87.58, 30.29, 30.25) >= 12, 'harbor tiles inflate land')
  assert(harborLandInflatePx(-80, -95, 32, 24) <= 6, 'basin tiles stay tight')
  assert(harborLandPadDeg(-87.54, -87.58, 30.29, 30.25) >= 0.08, 'harbor pad covers 10m slop')
  assert(harborLandPadDeg(-80, -95, 32, 24) <= 0.02, 'basin pad stays small')
  const nearbyCoast = [
    [-88.0, 30.0],
    [-87.62, 30.0],
    [-87.62, 30.5],
    [-88.0, 30.5],
    [-88.0, 30.0],
  ]
  const pad = harborLandPadDeg(east, west, north, south)
  assert(
    clipRingToBBox(nearbyCoast, west - pad, east + pad, south - pad, north + pad).length >= 3,
    'padded clip reaches 10m coast 0.05° west of the harbor tile',
  )

  console.log('landMask.test.ts: ok')
}

main()
