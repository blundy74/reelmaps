/**
 * Land mask using Natural Earth 50m land polygons (via world-atlas TopoJSON).
 *
 * Loaded lazily — only fetched when waves overlay is first toggled on.
 * Both topojson-client and the JSON data are dynamically imported so they
 * don't add to the initial bundle or slow down app startup.
 *
 * Provides:
 *  1. drawLandMask(ctx, map, land) — draws filled land polygons on a canvas
 *     in screen space for destination-out coastline clipping.
 *  2. Pre-computed bounding boxes per ring for fast viewport culling.
 */

import type maplibregl from 'maplibre-gl'

// ---------------------------------------------------------------------------
// Types & cache
// ---------------------------------------------------------------------------

interface LandRing {
  coords: number[][]    // [lng, lat] pairs
  minLng: number
  maxLng: number
  minLat: number
  maxLat: number
}

export interface LandData {
  rings: LandRing[]
}

let landDataPromise: Promise<LandData> | null = null

// ---------------------------------------------------------------------------
// Lazy loader — dynamic import keeps topojson-client + JSON out of main bundle
// ---------------------------------------------------------------------------

async function loadLandData(): Promise<LandData> {
  const [topoModule, dataModule] = await Promise.all([
    import('topojson-client'),
    import('world-atlas/land-50m.json'),
  ])

  const feature = topoModule.feature
  const topo = dataModule.default ?? dataModule
  const geojson = feature(topo as any, (topo as any).objects.land)
  const rings: LandRing[] = []

  for (const feat of (geojson as any).features) {
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

/**
 * Draw all visible land polygons as filled paths on `ctx`.
 * Uses pre-computed bounding boxes for fast viewport rejection.
 */
export function drawLandMask(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  land: LandData,
): void {
  const bounds = map.getBounds()
  const vMinLng = bounds.getWest() - 2
  const vMaxLng = bounds.getEast() + 2
  const vMinLat = bounds.getSouth() - 2
  const vMaxLat = bounds.getNorth() + 2

  ctx.beginPath()

  for (const ring of land.rings) {
    // Fast AABB reject using pre-computed bounds
    if (ring.maxLng < vMinLng || ring.minLng > vMaxLng ||
        ring.maxLat < vMinLat || ring.minLat > vMaxLat) {
      continue
    }

    const coords = ring.coords
    const first = map.project([coords[0][0], coords[0][1]])
    ctx.moveTo(first.x, first.y)

    for (let i = 1; i < coords.length; i++) {
      const pt = map.project([coords[i][0], coords[i][1]])
      ctx.lineTo(pt.x, pt.y)
    }
    ctx.closePath()
  }

  ctx.fill()
}
