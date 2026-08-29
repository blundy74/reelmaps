/**
 * OSCAR surface currents from NASA GIBS U/V WMS (no API key).
 * One pair of viewport images, decoded via the official GIBS colormap.
 * LOD: coarser GetMap at low zoom so a Gulf view stays under a couple seconds.
 */

import { lookupColorValue, oscarLookup } from './gibsColormaps'

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
/** Last date published on GIBS OSCAR WMS (5-day product). */
export const OSCAR_GIBS_TIME = '2024-07-17'

const MS_TO_KT = 1.94384
export const OSCAR_SPEED_MAX_KT = 4

export interface OscarGrid {
  west: number
  south: number
  east: number
  north: number
  cols: number
  rows: number
  u: Float32Array
  v: Float32Array
  fetchedAt: number
}

interface Lod {
  cols: number
  rows: number
  spacingPx: number
}

/** Fewer pixels at Gulf-scale zoom; denser only when zoomed in. */
export function oscarLod(zoom: number): Lod {
  if (zoom < 5) return { cols: 72, rows: 56, spacingPx: 52 }
  if (zoom < 7) return { cols: 112, rows: 84, spacingPx: 40 }
  return { cols: 160, rows: 120, spacingPx: 36 }
}

function mercatorX(lng: number): number {
  return lng * 20037508.34 / 180
}

function mercatorY(lat: number): number {
  const clipped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const r = Math.PI * clipped / 180
  return Math.log(Math.tan(Math.PI / 4 + r / 2)) * 20037508.34 / Math.PI
}

function oscarUrl(layer: 'zonal' | 'meridional', west: number, south: number, east: number, north: number, w: number, h: number): string {
  const name = layer === 'zonal'
    ? 'OSCAR_Sea_Surface_Currents_Zonal'
    : 'OSCAR_Sea_Surface_Currents_Meridional'
  const minx = mercatorX(west)
  const miny = mercatorY(south)
  const maxx = mercatorX(east)
  const maxy = mercatorY(north)
  const qs = [
    'SERVICE=WMS',
    'VERSION=1.3.0',
    'REQUEST=GetMap',
    'CRS=EPSG:3857',
    `WIDTH=${w}`,
    `HEIGHT=${h}`,
    'FORMAT=image/png',
    'TRANSPARENT=TRUE',
    `LAYERS=${name}`,
    `TIME=${OSCAR_GIBS_TIME}`,
    `BBOX=${minx},${miny},${maxx},${maxy}`,
  ].join('&')
  return `${GIBS_WMS}?${qs}`
}

function decodeUv(img: ImageBitmap, out: Float32Array): number {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0
  ctx.drawImage(img, 0, 0)
  const px = ctx.getImageData(0, 0, img.width, img.height).data
  const lut = oscarLookup()
  let valid = 0
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    const v = lookupColorValue(lut, px[p], px[p + 1], px[p + 2], px[p + 3])
    out[i] = v
    if (!isNaN(v)) valid++
  }
  return valid
}

export function padBounds(
  south: number,
  north: number,
  west: number,
  east: number,
  padFrac = 0.22,
): { south: number; north: number; west: number; east: number } {
  const latPad = (north - south) * padFrac
  const lngPad = (east - west) * padFrac
  return {
    south: Math.max(-80, south - latPad),
    north: Math.min(80, north + latPad),
    west: west - lngPad,
    east: east + lngPad,
  }
}

export function gridCovers(
  grid: OscarGrid,
  south: number,
  north: number,
  west: number,
  east: number,
): boolean {
  return grid.south <= south && grid.north >= north && grid.west <= west && grid.east >= east
}

export async function fetchOscarGrid(
  south: number,
  north: number,
  west: number,
  east: number,
  zoom: number,
  signal?: AbortSignal,
): Promise<OscarGrid | null> {
  const lod = oscarLod(zoom)
  const b = padBounds(south, north, west, east)
  const uUrl = oscarUrl('zonal', b.west, b.south, b.east, b.north, lod.cols, lod.rows)
  const vUrl = oscarUrl('meridional', b.west, b.south, b.east, b.north, lod.cols, lod.rows)

  const [uRes, vRes] = await Promise.all([
    fetch(uUrl, { signal }),
    fetch(vUrl, { signal }),
  ])
  if (!uRes.ok || !vRes.ok) return null

  const [uBlob, vBlob] = await Promise.all([uRes.blob(), vRes.blob()])
  const [uImg, vImg] = await Promise.all([createImageBitmap(uBlob), createImageBitmap(vBlob)])

  const u = new Float32Array(lod.cols * lod.rows)
  const v = new Float32Array(lod.cols * lod.rows)
  const uValid = decodeUv(uImg, u)
  const vValid = decodeUv(vImg, v)
  uImg.close()
  vImg.close()
  if (uValid < 8 || vValid < 8) return null

  return {
    west: b.west,
    south: b.south,
    east: b.east,
    north: b.north,
    cols: lod.cols,
    rows: lod.rows,
    u,
    v,
    fetchedAt: Date.now(),
  }
}

export function sampleOscar(
  grid: OscarGrid,
  lat: number,
  lng: number,
): { speedKt: number; angleDeg: number } | null {
  const { west, south, east, north, cols, rows, u, v } = grid
  const fx = (lng - west) / (east - west) * (cols - 1)
  const fy = (north - lat) / (north - south) * (rows - 1)
  if (fx < 0 || fy < 0 || fx > cols - 1 || fy > rows - 1) return null

  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(x0 + 1, cols - 1)
  const y1 = Math.min(y0 + 1, rows - 1)
  const tx = fx - x0
  const ty = fy - y0

  const at = (x: number, y: number, field: Float32Array) => field[y * cols + x]
  const u00 = at(x0, y0, u)
  const u10 = at(x1, y0, u)
  const u01 = at(x0, y1, u)
  const u11 = at(x1, y1, u)
  const v00 = at(x0, y0, v)
  const v10 = at(x1, y0, v)
  const v01 = at(x0, y1, v)
  const v11 = at(x1, y1, v)
  if ([u00, u10, u01, u11, v00, v10, v01, v11].some((n) => isNaN(n))) return null

  const uu = u00 * (1 - tx) * (1 - ty) + u10 * tx * (1 - ty) + u01 * (1 - tx) * ty + u11 * tx * ty
  const vv = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty
  const speedKt = Math.hypot(uu, vv) * MS_TO_KT
  if (speedKt < 0.08) return null
  const angleDeg = (Math.atan2(uu, vv) * 180) / Math.PI
  return { speedKt, angleDeg }
}

export function speedToArrowColor(speedKt: number): string {
  const t = Math.max(0, Math.min(1, speedKt / OSCAR_SPEED_MAX_KT))
  if (t < 0.25) {
    const s = t / 0.25
    return `rgba(125, 211, 252, ${0.55 + s * 0.25})`
  }
  if (t < 0.5) {
    const s = (t - 0.25) / 0.25
    return `rgba(${Math.round(125 + s * 109)}, ${Math.round(211 - s * 21)}, ${Math.round(252 - s * 149)}, 0.85)`
  }
  if (t < 0.75) {
    const s = (t - 0.5) / 0.25
    return `rgba(${Math.round(234 + s * 15)}, ${Math.round(190 - s * 80)}, ${Math.round(103 - s * 103)}, 0.92)`
  }
  return 'rgba(239, 68, 68, 0.95)'
}
