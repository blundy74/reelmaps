/**
 * Coastline clip for the wave overlay.
 *
 * The 50m Natural Earth mask was the "sloppy triangles" over Mobile Bay and
 * inland spikes near Foley / Gulf Shores. Clip order:
 *   1. Prefer the basemap's OSM `water` fill (same shoreline as Carto Dark).
 *   2. Fall back to Natural Earth 10m land, viewport-clipped and inflated so
 *      the wave blur cannot sit on visible land.
 */

import type maplibregl from 'maplibre-gl'
import { pointInPolygon } from './pointInPolygon'

// ---------------------------------------------------------------------------
// Types & cache
// ---------------------------------------------------------------------------

export interface LandRing {
  coords: number[][]    // [lng, lat] pairs
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

export interface LandData {
  rings: LandRing[]
}

export interface DrawLandMaskOptions {
  /** Extra screen-pixel radius treated as land (eats blur halo / coastline mismatch). */
  inflatePx?: number
  /** Extra semi-transparent stroke for a short water-side fade. */
  featherPx?: number
}

let landDataPromise: Promise<LandData> | null = null

type LngLat = [number, number]

// ---------------------------------------------------------------------------
// Viewport polygon clip (Sutherland–Hodgman against a lng/lat box)
// ---------------------------------------------------------------------------

function lerp(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function clipAgainstEdge(
  input: LngLat[],
  inside: (p: LngLat) => boolean,
  intersect: (a: LngLat, b: LngLat) => LngLat,
): LngLat[] {
  if (input.length === 0) return []
  const out: LngLat[] = []
  for (let i = 0; i < input.length; i++) {
    const cur = input[i]
    const prev = input[(i + input.length - 1) % input.length]
    const curIn = inside(cur)
    const prevIn = inside(prev)
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur))
      out.push(cur)
    } else if (prevIn) {
      out.push(intersect(prev, cur))
    }
  }
  return out
}

/** Clip a ring to a lng/lat bounding box. Drops the duplicate closing vertex. */
export function clipRingToBBox(
  coords: number[][],
  minLng: number,
  maxLng: number,
  minLat: number,
  maxLat: number,
): LngLat[] {
  let poly: LngLat[] = coords.map((c) => [c[0], c[1]])
  if (
    poly.length > 1 &&
    poly[0][0] === poly[poly.length - 1][0] &&
    poly[0][1] === poly[poly.length - 1][1]
  ) {
    poly = poly.slice(0, -1)
  }
  const den = (a: LngLat, b: LngLat, i: 0 | 1) => (b[i] - a[i]) || 1e-12
  poly = clipAgainstEdge(poly, (p) => p[0] >= minLng, (a, b) => lerp(a, b, (minLng - a[0]) / den(a, b, 0)))
  poly = clipAgainstEdge(poly, (p) => p[0] <= maxLng, (a, b) => lerp(a, b, (maxLng - a[0]) / den(a, b, 0)))
  poly = clipAgainstEdge(poly, (p) => p[1] >= minLat, (a, b) => lerp(a, b, (minLat - a[1]) / den(a, b, 1)))
  poly = clipAgainstEdge(poly, (p) => p[1] <= maxLat, (a, b) => lerp(a, b, (maxLat - a[1]) / den(a, b, 1)))
  return poly
}

// ---------------------------------------------------------------------------
// Lazy loader — dynamic import keeps topojson-client + JSON out of main bundle
// ---------------------------------------------------------------------------

async function loadLandData(): Promise<LandData> {
  const [topoModule, dataModule] = await Promise.all([
    import('topojson-client'),
    import('world-atlas/land-10m.json'),
  ])

  const feature = topoModule.feature
  const topo = dataModule.default ?? dataModule
  const geojson = feature(topo as any, (topo as any).objects.land)
  const feats = (geojson as any).features ?? [geojson]
  const rings: LandRing[] = []

  for (const feat of feats) {
    const geom = feat.geometry
    const coordArrays: number[][][] =
      geom.type === 'Polygon'
        ? geom.coordinates
        : geom.type === 'MultiPolygon'
        ? geom.coordinates.flat()
        : []

    for (const coords of coordArrays) {
      let minLng = Infinity, maxLng = -Infinity
      let minLat = Infinity, maxLat = -Infinity
      for (const pt of coords) {
        if (pt[0] < minLng) minLng = pt[0]
        if (pt[0] > maxLng) maxLng = pt[0]
        if (pt[1] < minLat) minLat = pt[1]
        if (pt[1] > maxLat) maxLat = pt[1]
      }
      rings.push({ coords, minLng, maxLng, minLat, maxLat })
    }
  }

  return { rings }
}

export function getLandData(): Promise<LandData> {
  if (!landDataPromise) {
    landDataPromise = loadLandData()
  }
  return landDataPromise
}

// ---------------------------------------------------------------------------
// Canvas land-mask drawing (for destination-out compositing)
// ---------------------------------------------------------------------------

function traceLandMask(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  land: LandData,
): number {
  const bounds = map.getBounds()
  const west = bounds.getWest()
  const east = bounds.getEast()
  const south = bounds.getSouth()
  const north = bounds.getNorth()
  const wrapsDateline = west > east

  // Pad so inflate/feather strokes at the screen edge still have geometry.
  const pad = 0.4
  const vMinLng = west - pad
  const vMaxLng = east + pad
  const vMinLat = south - pad
  const vMaxLat = north + pad

  ctx.beginPath()
  let traced = 0

  for (const ring of land.rings) {
    if (
      ring.maxLng < vMinLng || ring.minLng > vMaxLng ||
      ring.maxLat < vMinLat || ring.minLat > vMaxLat
    ) {
      continue
    }

    const coords = wrapsDateline
      ? ring.coords
      : clipRingToBBox(ring.coords, vMinLng, vMaxLng, vMinLat, vMaxLat)

    if (coords.length < 3) continue

    const first = map.project([coords[0][0], coords[0][1]])
    ctx.moveTo(first.x, first.y)
    let lastX = first.x
    let lastY = first.y

    for (let i = 1; i < coords.length; i++) {
      const pt = map.project([coords[i][0], coords[i][1]])
      // Drop sub-pixel vertices — 10m is denser than a screen at Gulf zooms.
      if ((pt.x - lastX) * (pt.x - lastX) + (pt.y - lastY) * (pt.y - lastY) < 0.64) {
        continue
      }
      ctx.lineTo(pt.x, pt.y)
      lastX = pt.x
      lastY = pt.y
    }
    ctx.closePath()
    traced++
  }

  return traced
}

/**
 * Draw all visible land polygons as filled paths on `ctx`.
 * Optional inflate/feather strokes expand land in screen space so a blurred
 * wave field never sits on the basemap's visible land.
 */
export function drawLandMask(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  land: LandData,
  options: DrawLandMaskOptions = {},
): void {
  const inflatePx = options.inflatePx ?? 0
  const featherPx = options.featherPx ?? 0

  const traced = traceLandMask(ctx, map, land)
  if (traced === 0) return

  ctx.fill('evenodd')

  if (inflatePx > 0 || featherPx > 0) {
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = ctx.fillStyle
  }
  if (inflatePx > 0) {
    ctx.globalAlpha = 1
    ctx.lineWidth = inflatePx * 2
    ctx.stroke()
  }
  if (featherPx > 0) {
    ctx.lineWidth = (inflatePx + featherPx) * 2
    ctx.globalAlpha = 0.4
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

/**
 * Punch land out of an already-drawn wave field (destination-out).
 * Inflates land a few pixels so the wave blur cannot leak onto shore.
 */
export function eraseWavesOverLand(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  land: LandData,
  options: DrawLandMaskOptions = {},
): void {
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = 'rgba(0,0,0,1)'
  drawLandMask(ctx, map, land, {
    inflatePx: options.inflatePx ?? 4,
    featherPx: options.featherPx ?? 2,
  })
  ctx.restore()
  ctx.globalCompositeOperation = 'source-over'
}

function addRingToPath(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  coords: number[][],
): void {
  if (coords.length < 3) return
  const first = map.project([coords[0][0], coords[0][1]])
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < coords.length; i++) {
    const pt = map.project([coords[i][0], coords[i][1]])
    ctx.lineTo(pt.x, pt.y)
  }
  ctx.closePath()
}

function addGeometryToPath(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  geometry: maplibregl.MapGeoJSONFeature['geometry'] | null | undefined,
): void {
  if (!geometry) return
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) addRingToPath(ctx, map, ring)
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) addRingToPath(ctx, map, ring)
    }
  }
}

function queryRenderedWater(map: maplibregl.Map): maplibregl.MapGeoJSONFeature[] | null {
  if (!map.getLayer('water')) return null
  try {
    const features = map.queryRenderedFeatures({ layers: ['water'] })
    return features.length > 0 ? features : null
  } catch {
    return null
  }
}

/**
 * Keep only the basemap's OSM water polygons (Carto `water` fill).
 * This matches the coastline on screen — Mobile Bay, barrier islands, etc.
 * Returns false when the style has no water layer yet.
 */
function keepOnlyRenderedWater(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
): boolean {
  const features = queryRenderedWater(map)
  if (!features) return false

  // Build an opaque water mask first. destination-in of a stroke after a fill
  // would keep only the outline; compositing the whole mask avoids that.
  const mask = document.createElement('canvas')
  mask.width = ctx.canvas.width
  mask.height = ctx.canvas.height
  const m = mask.getContext('2d')
  if (!m) return false
  m.fillStyle = '#000'
  m.strokeStyle = '#000'
  m.lineJoin = 'round'
  m.lineCap = 'round'
  m.lineWidth = 1.25
  m.beginPath()
  for (const f of features) addGeometryToPath(m, map, f.geometry)
  m.fill('nonzero')
  m.stroke()

  ctx.save()
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0)
  ctx.restore()
  ctx.globalCompositeOperation = 'source-over'
  return true
}

/**
 * Clip a drawn wave field to water. Prefers the basemap water polygons so
 * the overlay follows the same shoreline the user sees; falls back to
 * Natural Earth 10m land when that layer is missing (e.g. mid-style-switch).
 */
export async function clipWavesToCoast(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  options: DrawLandMaskOptions = {},
): Promise<void> {
  if (keepOnlyRenderedWater(ctx, map)) return
  const land = await getLandData()
  eraseWavesOverLand(ctx, map, land, options)
}

const MERCATOR_MAX = 20037508.342789244

function xToLng(x: number): number {
  return (x * 180) / MERCATOR_MAX
}

function yToLat(y: number): number {
  const lat = (y * 180) / MERCATOR_MAX
  return (Math.atan(Math.sinh((lat * Math.PI) / 180)) * 180) / Math.PI
}

function lngToX(lng: number): number {
  return (lng * MERCATOR_MAX) / 180
}

function latToY(lat: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const y = Math.log(Math.tan(((90 + clamped) * Math.PI) / 360)) / (Math.PI / 180)
  return (y * MERCATOR_MAX) / 180
}

function makeMaskCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      return new OffscreenCanvas(w, h)
    } catch {
      /* fall through */
    }
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }
  return null
}

export function parseWmsBbox3857(url: string): { xmin: number; ymin: number; xmax: number; ymax: number } | null {
  const m = url.match(/BBOX=([^&]+)/i)
  if (!m) return null
  const raw = decodeURIComponent(m[1])
  if (raw.includes('{')) return null
  const parts = raw.split(',').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  return { xmin: parts[0], ymin: parts[1], xmax: parts[2], ymax: parts[3] }
}

/**
 * Even-odd test against land rings. Used when a harbor-scale tile sits
 * entirely inside a continent so Sutherland–Hodgman clip returns empty.
 */
export function evenOddLandAt(rings: LandRing[], lng: number, lat: number): boolean {
  let inside = false
  for (const ring of rings) {
    if (lng < ring.minLng || lng > ring.maxLng || lat < ring.minLat || lat > ring.maxLat) continue
    if (pointInPolygon([lng, lat], ring.coords as [number, number][])) inside = !inside
  }
  return inside
}

/** Extra land pixels at small (harbor) tile spans so 10m coast still punches streets. */
export function harborLandInflatePx(east: number, west: number, north: number, south: number): number {
  const span = Math.max(east - west, north - south)
  if (span < 0.08) return 22
  if (span < 0.25) return 12
  if (span < 0.8) return 6
  return 2
}

/**
 * How far (degrees) to search for 10m land outside a tile.
 * world-atlas 10m misses Gulf barrier islands by ~0.05°.
 */
export function harborLandPadDeg(east: number, west: number, north: number, south: number): number {
  const span = Math.max(east - west, north - south)
  if (span < 0.08) return 0.09
  if (span < 0.2) return 0.05
  if (span < 0.6) return 0.02
  return 0.01
}

/**
 * Punch land out of a WMS SST tile using the existing 10m land mask.
 * Cheap: one offscreen canvas fill per tile, no new data source.
 */
export async function eraseLandFromTile(
  imageData: ImageData,
  bbox: { xmin: number; ymin: number; xmax: number; ymax: number },
): Promise<void> {
  const land = await getLandData()
  const w = imageData.width
  const h = imageData.height
  const west = xToLng(bbox.xmin)
  const east = xToLng(bbox.xmax)
  const south = yToLat(bbox.ymin)
  const north = yToLat(bbox.ymax)
  if (!(east > west) || !(north > south)) return

  const mask = makeMaskCanvas(w, h)
  const ctx = mask?.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#000'
  ctx.beginPath()
  const padDeg = harborLandPadDeg(east, west, north, south)
  const clipW = west - padDeg
  const clipE = east + padDeg
  const clipS = south - padDeg
  const clipN = north + padDeg
  let traced = 0
  for (const ring of land.rings) {
    if (ring.maxLng < clipW || ring.minLng > clipE || ring.maxLat < clipS || ring.minLat > clipN) continue
    const coords = clipRingToBBox(ring.coords, clipW, clipE, clipS, clipN)
    if (coords.length < 3) continue
    const x0 = ((lngToX(coords[0][0]) - bbox.xmin) / (bbox.xmax - bbox.xmin)) * w
    const y0 = ((bbox.ymax - latToY(coords[0][1])) / (bbox.ymax - bbox.ymin)) * h
    ctx.moveTo(x0, y0)
    for (let i = 1; i < coords.length; i++) {
      const x = ((lngToX(coords[i][0]) - bbox.xmin) / (bbox.xmax - bbox.xmin)) * w
      const y = ((bbox.ymax - latToY(coords[i][1])) / (bbox.ymax - bbox.ymin)) * h
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    traced++
  }
  if (traced === 0) {
    const cx = (west + east) / 2
    const cy = (south + north) / 2
    if (!evenOddLandAt(land.rings, cx, cy)) return
    ctx.fillRect(0, 0, w, h)
  } else {
    ctx.fill('evenodd')
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#000'
    const spanX = Math.max(east - west, 1e-9)
    const padPx = (padDeg / spanX) * w
    ctx.lineWidth = Math.max(harborLandInflatePx(east, west, north, south), padPx) * 2
    ctx.stroke()
  }
  const landPx = ctx.getImageData(0, 0, w, h).data
  const px = imageData.data
  for (let i = 0; i < px.length; i += 4) {
    if (landPx[i + 3] > 20) px[i + 3] = 0
  }
}

/** Paint opaque pixels on land (for the particle bitmap). */
export async function paintLandMask(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  options: DrawLandMaskOptions = {},
): Promise<void> {
  const features = queryRenderedWater(map)
  if (features) {
    ctx.fillStyle = 'rgba(255,0,0,1)'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,1)'
    ctx.beginPath()
    for (const f of features) addGeometryToPath(ctx, map, f.geometry)
    ctx.fill('nonzero')
    ctx.restore()
    return
  }
  const land = await getLandData()
  ctx.fillStyle = 'rgba(255,0,0,1)'
  drawLandMask(ctx, map, land, options)
}
