/**
 * Client-side SST palette stretch.
 *
 * NASA GIBS serves pre-colored PNG tiles on a global 0–32°C (~32–90°F) rainbow.
 * In the Gulf that collapses an 8°F fishing window into a washed-out smear.
 * We invert the official GIBS colormap back to °C, then re-apply the same
 * rainbow across a captain-chosen domain. Default is Fit-to-view (p5–p95 of
 * water currently on screen) so late-summer 88s are not clipped. 78–86°F is
 * a Loop / sail lock, not the year-round default.
 *
 * Same idea as contour:// for SSH — no new satellite product, no Lambda.
 */

import { GIBS_SST_ENTRIES } from './gibsSstColormap'

export const SST_GOM_MIN_F = 78
export const SST_GOM_MAX_F = 86
export const SST_WIDE_MIN_F = 50
export const SST_WIDE_MAX_F = 90
export const SST_MIN_SPAN_F = 2

export type SstRangePreset = 'gom' | 'wide' | 'fit'

export interface SstRange {
  preset: SstRangePreset
  minF: number
  maxF: number
}

/** Placeholder until the first viewport sample returns. Wide so we do not clip 88s. */
export const DEFAULT_SST_RANGE: SstRange = {
  preset: 'fit',
  minF: SST_WIDE_MIN_F,
  maxF: SST_WIDE_MAX_F,
}

export const SST_LAYER_IDS = ['sst-mur', 'sst-goes'] as const

export function activeSstLayerId(
  layers: { id: string; visible: boolean }[],
): (typeof SST_LAYER_IDS)[number] | null {
  if (layers.some((l) => l.id === 'sst-goes' && l.visible)) return 'sst-goes'
  if (layers.some((l) => l.id === 'sst-mur' && l.visible)) return 'sst-mur'
  return null
}

/** Same rainbow the map HUD already documented — now actually used for coloring. */
export const SST_RAMP: [number, number, number][] = [
  [5, 0, 128],
  [0, 0, 255],
  [0, 176, 255],
  [0, 255, 255],
  [0, 255, 128],
  [128, 255, 0],
  [255, 255, 0],
  [255, 128, 0],
  [255, 0, 0],
  [128, 0, 0],
]

export const SST_GRADIENT_CSS =
  'linear-gradient(to right, #050080, #0000ff, #00b0ff, #00ffff, #00ff80, #80ff00, #ffff00, #ff8000, #ff0000, #800000)'

const packedToC = new Map<number, number>()
for (const e of GIBS_SST_ENTRIES) {
  packedToC.set((e.r << 16) | (e.g << 8) | e.b, e.tC)
}

function pack(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Invert a GIBS SST pixel to °C. Transparent / nodata → null. */
export function rgbToCelsius(r: number, g: number, b: number, a = 255): number | null {
  if (a < 30) return null
  if (r === 0 && g === 0 && b === 0) return null

  const exact = packedToC.get(pack(r, g, b))
  if (exact !== undefined) return exact

  // PNG is usually exact; blended edges (coast, clouds) miss the LUT.
  let best = Infinity
  let tC = 0
  for (const e of GIBS_SST_ENTRIES) {
    const dr = r - e.r
    const dg = g - e.g
    const db = b - e.b
    const d = dr * dr + dg * dg + db * db
    if (d < best) {
      best = d
      tC = e.tC
    }
  }
  // Far from the ramp (true-color bleed, land, ice) — drop it.
  if (best > 48 * 48) return null
  return tC
}

export function celsiusToFahrenheit(tC: number): number {
  return (tC * 9) / 5 + 32
}

export function fahrenheitToCelsius(tF: number): number {
  return ((tF - 32) * 5) / 9
}

/** Map a 0–1 position onto the SST rainbow. */
export function rampColor(t: number): { r: number; g: number; b: number } {
  const x = Math.max(0, Math.min(1, t)) * (SST_RAMP.length - 1)
  const i = Math.min(Math.floor(x), SST_RAMP.length - 2)
  const f = x - i
  const c0 = SST_RAMP[i]
  const c1 = SST_RAMP[i + 1]
  return {
    r: Math.round(lerp(c0[0], c1[0], f)),
    g: Math.round(lerp(c0[1], c1[1], f)),
    b: Math.round(lerp(c0[2], c1[2], f)),
  }
}

/** Recolor one GIBS SST pixel into the captain-chosen °F domain. */
export function recolorSstPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  minF: number,
  maxF: number,
): { r: number; g: number; b: number; a: number } {
  const tC = rgbToCelsius(r, g, b, a)
  if (tC === null) return { r: 0, g: 0, b: 0, a: 0 }
  const tF = celsiusToFahrenheit(tC)
  const span = Math.max(maxF - minF, 0.01)
  const t = (tF - minF) / span
  const c = rampColor(t)
  return { r: c.r, g: c.g, b: c.b, a: 230 }
}

export function applySstScaleUrl(url: string, minF: number, maxF: number): string {
  const a = Number(minF.toFixed(1))
  const b = Number(maxF.toFixed(1))
  if (url.startsWith('https://')) {
    return url.replace('https://', `sstscale://${a},${b}/`)
  }
  return url
}

export function parseSstScaleUrl(url: string): { minF: number; maxF: number; httpsUrl: string } | null {
  const m = url.match(/^sstscale:\/\/(-?[\d.]+),(-?[\d.]+)\/(.+)$/)
  if (!m) return null
  return {
    minF: parseFloat(m[1]),
    maxF: parseFloat(m[2]),
    httpsUrl: `https://${m[3]}`,
  }
}

export interface LngLatBounds {
  west: number
  south: number
  east: number
  north: number
}

/** Web Mercator meters — same convention GIBS WMS EPSG:3857 BBOX uses. */
export function lngLatBoundsTo3857(b: LngLatBounds): { xmin: number; ymin: number; xmax: number; ymax: number } {
  const MAX = 20037508.342789244
  const lngToX = (lng: number) => (lng * MAX) / 180
  const latToY = (lat: number) => {
    const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
    const y = Math.log(Math.tan(((90 + clamped) * Math.PI) / 360)) / (Math.PI / 180)
    return (y * MAX) / 180
  }
  return {
    xmin: lngToX(b.west),
    ymin: latToY(b.south),
    xmax: lngToX(b.east),
    ymax: latToY(b.north),
  }
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return NaN
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo)
}

export function spanFromTempsF(tempsF: number[]): { minF: number; maxF: number } | null {
  if (tempsF.length < 40) return null
  const sorted = [...tempsF].sort((a, b) => a - b)
  let minF = percentile(sorted, 0.05)
  let maxF = percentile(sorted, 0.95)
  if (!Number.isFinite(minF) || !Number.isFinite(maxF)) return null
  if (maxF - minF < SST_MIN_SPAN_F) {
    const mid = (minF + maxF) / 2
    minF = mid - SST_MIN_SPAN_F / 2
    maxF = mid + SST_MIN_SPAN_F / 2
  }
  // Half-degree ticks so the chip stays readable.
  minF = Math.round(minF * 2) / 2
  maxF = Math.round(maxF * 2) / 2
  if (maxF - minF < SST_MIN_SPAN_F) maxF = minF + SST_MIN_SPAN_F
  return { minF, maxF }
}

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'

const SST_GIBS_LAYER: Record<string, string> = {
  'sst-mur': 'GHRSST_L4_MUR_Sea_Surface_Temperature',
  'sst-goes': 'VIIRS_SNPP_L2_Sea_Surface_Temp_Day',
}

/** Sample the GIBS tiles currently in view and stretch the palette to that water. */
export async function sampleSstRangeFromView(
  layerId: string,
  date: string,
  bounds: LngLatBounds,
  signal?: AbortSignal,
): Promise<{ minF: number; maxF: number } | null> {
  const layer = SST_GIBS_LAYER[layerId]
  if (!layer) return null
  const { xmin, ymin, xmax, ymax } = lngLatBoundsTo3857(bounds)
  if (!(xmax > xmin) || !(ymax > ymin)) return null

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    CRS: 'EPSG:3857',
    WIDTH: '384',
    HEIGHT: '256',
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
    LAYERS: layer,
    TIME: date,
    BBOX: `${xmin},${ymin},${xmax},${ymax}`,
  })

  const res = await fetch(`${GIBS_WMS}?${params.toString()}`, { signal })
  if (!res.ok) return null
  const blob = await res.blob()
  if (!blob.type.includes('png') && !blob.type.includes('octet-stream')) return null

  const img = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, img.width, img.height).data

  const temps: number[] = []
  // Stride a bit — 384×256 is plenty even at every 2nd pixel.
  for (let i = 0; i < data.length; i += 8) {
    const tC = rgbToCelsius(data[i], data[i + 1], data[i + 2], data[i + 3])
    if (tC === null) continue
    temps.push(celsiusToFahrenheit(tC))
  }
  return spanFromTempsF(temps)
}

export function sstLegendLabels(minF: number, maxF: number): { value: string; position: string }[] {
  const mid = (minF + maxF) / 2
  const fmt = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}°F`
  return [
    { value: fmt(minF), position: '0%' },
    { value: fmt(mid), position: '50%' },
    { value: fmt(maxF), position: '100%' },
  ]
}
