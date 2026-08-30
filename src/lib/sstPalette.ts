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
/** Paint domain for Loop/sail — lock chip stays 78–86 but late-August 87–90 must stay distinct. */
export const SST_GOM_PAINT_MAX_F = 90
export const SST_WIDE_MIN_F = 50
export const SST_WIDE_MAX_F = 90
/** Cache-bust token so MapLibre rebuilds rematched tiles after palette changes. */
export const SST_SCALE_TOKEN = 'v17'
/** Minimum fishing window — tight enough that 1°F Gulf structure still paints. */
export const SST_MIN_SPAN_F = 1.5
/** Cap so a mixed-basin view cannot crush the Gulf to one red. */
export const SST_MAX_FIT_SPAN_F = 5

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

/** Domain actually rematched onto tiles / legend. Loop/sail chip stays 78–86. */
export function sstPaintRange(range: SstRange): { minF: number; maxF: number } {
  if (range.preset === 'gom') {
    return { minF: SST_GOM_MIN_F, maxF: SST_GOM_PAINT_MAX_F }
  }
  return { minF: range.minF, maxF: range.maxF }
}

/** Continuous rainbow — used only as a fallback lerp. Map paint uses FISHING_BANDS. */
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

/**
 * Discrete fishing SST bands — each step is a different ink so 1°F rips read.
 * Index 0 = cold extension, 1–10 = in-range blue→red, 11–12 = hot extension
 * (late-summer 87–88 when the lock is 78–86).
 */
export const FISHING_BANDS: [number, number, number][] = [
  [8, 0, 96],
  [0, 20, 200],
  [0, 110, 255],
  [0, 210, 255],
  [0, 255, 170],
  [50, 220, 0],
  [200, 255, 0],
  [255, 200, 0],
  [255, 120, 0],
  [255, 40, 0],
  [220, 0, 30],
  [180, 0, 120],
  [255, 80, 180],
]

export const SST_GRADIENT_CSS =
  'linear-gradient(to right, #0014c8, #006eff, #00d2ff, #00ffaa, #32dc00, #c8ff00, #ffc800, #ff7800, #ff2800, #dc001e)'

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

/** 0.5°F ticks on a tight Fit; 1°F ticks on Loop/sail and Wide. */
export function fishingBandStep(minF: number, maxF: number): number {
  const span = Math.max(maxF - minF, 0.5)
  return span <= 3 ? 0.5 : 1
}

export function fishingInRangeBands(minF: number, maxF: number): number {
  const step = fishingBandStep(minF, maxF)
  return Math.max(2, Math.round((maxF - minF) / step) + 1)
}

/**
 * Solid fishing-chart color for one °F. Adjacent 1°F (or 0.5°F) ticks
 * get different ink. Values just above the lock stay distinct so a
 * late-August 78–86 chip does not crush 86 / 87 / 88 into one red slab.
 */
export function fishingBandColor(
  tF: number,
  minF: number,
  maxF: number,
): { r: number; g: number; b: number } {
  const step = fishingBandStep(minF, maxF)
  const nIn = fishingInRangeBands(minF, maxF)
  let i: number
  if (tF < minF) {
    i = 0
  } else if (tF > maxF) {
    const above = Math.max(0, Math.floor((tF - maxF) / step - 1e-9))
    i = Math.min(FISHING_BANDS.length - 1, 11 + above)
  } else {
    const band = Math.min(nIn - 1, Math.max(0, Math.floor((tF - minF) / step + 1e-9)))
    i = nIn === 1 ? 10 : 1 + Math.round((band * 9) / (nIn - 1))
  }
  const c = FISHING_BANDS[Math.max(0, Math.min(FISHING_BANDS.length - 1, i))]
  return { r: c[0], g: c[1], b: c[2] }
}

function rgbHex(c: { r: number; g: number; b: number }): string {
  const h = (n: number) => n.toString(16).padStart(2, '0')
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`
}

/** Stepped legend that matches the map (not a smooth smear). */
export function sstLegendGradient(minF: number, maxF: number): string {
  const step = fishingBandStep(minF, maxF)
  const nIn = fishingInRangeBands(minF, maxF)
  const parts: string[] = []
  for (let b = 0; b < nIn; b++) {
    const c = fishingBandColor(minF + b * step, minF, maxF)
    const hex = rgbHex(c)
    const pct0 = (b / nIn) * 100
    const pct1 = ((b + 1) / nIn) * 100
    parts.push(`${hex} ${pct0.toFixed(1)}%`, `${hex} ${pct1.toFixed(1)}%`)
  }
  return `linear-gradient(to right, ${parts.join(', ')})`
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
  const c = fishingBandColor(tF, minF, maxF)
  return { r: c.r, g: c.g, b: c.b, a: 230 }
}

/** Token in the protocol URL busts MapLibre's tile cache when the palette changes. */
export function applySstScaleUrl(url: string, minF: number, maxF: number): string {
  const a = Number(minF.toFixed(1))
  const b = Number(maxF.toFixed(1))
  if (url.startsWith('https://')) {
    return url.replace('https://', `sstscale://${a},${b},${SST_SCALE_TOKEN}/`)
  }
  return url
}

export function parseSstScaleUrl(url: string): { minF: number; maxF: number; httpsUrl: string } | null {
  const m = url.match(/^sstscale:\/\/(-?[\d.]+),(-?[\d.]+)(?:,[a-z0-9]+)?\/(.+)$/)
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
  // Inner percentiles (not p5–p95): late-August Gulf is 86–89. A 80–88.5
  // window paints the whole basin one red and hides 1°F rips.
  let minF = percentile(sorted, 0.15)
  let maxF = percentile(sorted, 0.85)
  if (!Number.isFinite(minF) || !Number.isFinite(maxF)) return null
  if (maxF - minF > SST_MAX_FIT_SPAN_F) {
    const mid = percentile(sorted, 0.5)
    minF = mid - SST_MAX_FIT_SPAN_F / 2
    maxF = mid + SST_MAX_FIT_SPAN_F / 2
  }
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

/** Sample SST °F at one lon/lat. Null when the layer is off-product or the pixel is nodata. */
export async function sampleSstAtPoint(
  layerId: string,
  date: string,
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<number | null> {
  const layer = SST_GIBS_LAYER[layerId]
  if (!layer) return null
  const pad = 0.02
  const bounds = {
    west: lng - pad,
    south: lat - pad,
    east: lng + pad,
    north: lat + pad,
  }
  const { xmin, ymin, xmax, ymax } = lngLatBoundsTo3857(bounds)
  if (!(xmax > xmin) || !(ymax > ymin)) return null

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    CRS: 'EPSG:3857',
    WIDTH: '5',
    HEIGHT: '5',
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
  for (let i = 0; i < data.length; i += 4) {
    const tC = rgbToCelsius(data[i], data[i + 1], data[i + 2], data[i + 3])
    if (tC === null) continue
    temps.push(celsiusToFahrenheit(tC))
  }
  if (!temps.length) return null
  temps.sort((a, b) => a - b)
  return temps[Math.floor(temps.length / 2)]
}
