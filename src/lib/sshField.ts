/**
 * Sea-level-anomaly grid for SSH isolines.
 * Preferred: NOAA CoastWatch ERDDAP nesdisSSH1day (numeric SLA, latest time).
 * Fallback: GIBS MEaSUREs viewport GetMap (colormap decode) — last TIME 2019-01-22.
 * One viewport grid so isolines do not tile-seam. Not a live invented feed.
 */

import { decodeSshAnomaly } from './sshContours'
import { humanIsoDate } from './utils'

const ERDDAP_DATASET = 'nesdisSSH1day'
const ERDDAP_DIRECT = 'https://coastwatch.pfeg.noaa.gov/erddap'
const ERDDAP_PROXY = '/proxy/erddap'
const ERDDAP_TIMEOUT_MS = 8000
const NATIVE_DEG = 0.25

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
/** GIBS capabilities default and last period end. Later dates are empty. */
export const SSH_GIBS_TIME = '2019-01-22'

export type SshSource = 'erddap' | 'gibs'

export interface SshGrid {
  west: number
  south: number
  east: number
  north: number
  cols: number
  rows: number
  sla: Float32Array
  fieldDate: string
  source: SshSource
  fetchedAt: number
}

export function sshAgeStamp(iso: string): string {
  return `SSH ${humanIsoDate(iso)}`
}

let lastSshGrid: SshGrid | null = null

export function latestSshGrid(): SshGrid | null {
  return lastSshGrid
}

export function padSshBounds(
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

export function sshGridCovers(
  grid: SshGrid,
  south: number,
  north: number,
  west: number,
  east: number,
): boolean {
  return grid.south <= south && grid.north >= north && grid.west <= west && grid.east >= east
}

function strideFor(south: number, north: number, west: number, east: number): number {
  let s = 1
  const cells = (stride: number) =>
    (Math.ceil((north - south) / (NATIVE_DEG * stride)) + 1)
    * (Math.ceil((east - west) / (NATIVE_DEG * stride)) + 1)
  while (cells(s) > 14_000 && s < 16) s *= 2
  return s
}

function erddapQueryUrl(root: string, south: number, north: number, west: number, east: number, stride: number): string {
  const q = `sla[(last)][(${south.toFixed(3)}):${stride}:(${north.toFixed(3)})][(${west.toFixed(3)}):${stride}:(${east.toFixed(3)})]`
  return `${root}/griddap/${ERDDAP_DATASET}.json?${q}`
}

interface ErddapTable {
  table?: {
    columnNames?: string[]
    rows?: Array<[string, number, number, number | null]>
  }
}

export function parseErddapSla(json: ErddapTable): SshGrid | null {
  const rows = json.table?.rows
  if (!rows?.length) return null
  const lats = [...new Set(rows.map((r) => r[1]))].sort((a, b) => b - a)
  const lons = [...new Set(rows.map((r) => r[2]))].sort((a, b) => a - b)
  if (lats.length < 3 || lons.length < 3) return null
  const sla = new Float32Array(lats.length * lons.length)
  sla.fill(NaN)
  const latI = new Map(lats.map((v, i) => [v, i]))
  const lonI = new Map(lons.map((v, i) => [v, i]))
  let valid = 0
  const fieldDate = String(rows[0][0]).slice(0, 10)
  for (const [, lat, lon, v] of rows) {
    const i = lonI.get(lon)
    const j = latI.get(lat)
    if (i == null || j == null) continue
    if (v == null || Number.isNaN(Number(v))) continue
    sla[j * lons.length + i] = Number(v)
    valid++
  }
  if (valid < 8) return null
  return {
    west: lons[0],
    east: lons[lons.length - 1],
    north: lats[0],
    south: lats[lats.length - 1],
    cols: lons.length,
    rows: lats.length,
    sla,
    fieldDate,
    source: 'erddap',
    fetchedAt: Date.now(),
  }
}

async function fetchErddap(
  south: number,
  north: number,
  west: number,
  east: number,
  signal: AbortSignal | undefined,
): Promise<SshGrid | null> {
  const stride = strideFor(south, north, west, east)
  const roots = [ERDDAP_PROXY, ERDDAP_DIRECT]
  for (const root of roots) {
    const url = erddapQueryUrl(root, south, north, west, east, stride)
    const ctrl = new AbortController()
    const onAbort = () => ctrl.abort()
    signal?.addEventListener('abort', onAbort)
    const timer = setTimeout(() => ctrl.abort(), ERDDAP_TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) continue
      const json = (await res.json()) as ErddapTable
      const grid = parseErddapSla(json)
      if (grid) return grid
    } catch {
      /* try next root or fall through */
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
  return null
}

function mercatorX(lng: number): number {
  return lng * 20037508.34 / 180
}

function mercatorY(lat: number): number {
  const clipped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const r = Math.PI * clipped / 180
  return Math.log(Math.tan(Math.PI / 4 + r / 2)) * 20037508.34 / Math.PI
}

function gibsLod(zoom: number): { cols: number; rows: number } {
  if (zoom < 5) return { cols: 96, rows: 72 }
  if (zoom < 7) return { cols: 140, rows: 104 }
  return { cols: 180, rows: 132 }
}

async function fetchGibsViewport(
  south: number,
  north: number,
  west: number,
  east: number,
  zoom: number,
  signal?: AbortSignal,
): Promise<SshGrid | null> {
  const { cols, rows } = gibsLod(zoom)
  const qs = [
    'SERVICE=WMS',
    'VERSION=1.3.0',
    'REQUEST=GetMap',
    'CRS=EPSG:3857',
    `WIDTH=${cols}`,
    `HEIGHT=${rows}`,
    'FORMAT=image/png',
    'TRANSPARENT=TRUE',
    'LAYERS=JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies',
    `TIME=${SSH_GIBS_TIME}`,
    `BBOX=${mercatorX(west)},${mercatorY(south)},${mercatorX(east)},${mercatorY(north)}`,
  ].join('&')
  const res = await fetch(`${GIBS_WMS}?${qs}`, { signal })
  if (!res.ok) return null
  const blob = await res.blob()
  const img = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    img.close()
    return null
  }
  ctx.drawImage(img, 0, 0)
  const w = img.width
  const h = img.height
  const rgba = ctx.getImageData(0, 0, w, h).data
  img.close()
  const sla = decodeSshAnomaly(rgba, w, h)
  let valid = 0
  for (let i = 0; i < sla.length; i++) if (!isNaN(sla[i])) valid++
  if (valid < 16) return null
  return {
    west,
    south,
    east,
    north,
    cols: w,
    rows: h,
    sla,
    fieldDate: SSH_GIBS_TIME,
    source: 'gibs',
    fetchedAt: Date.now(),
  }
}

export async function fetchSshGrid(
  south: number,
  north: number,
  west: number,
  east: number,
  zoom: number,
  signal?: AbortSignal,
): Promise<SshGrid | null> {
  const b = padSshBounds(south, north, west, east)
  if (b.west > b.east) return null
  const erddap = await fetchErddap(b.south, b.north, b.west, b.east, signal)
  if (erddap) {
    lastSshGrid = erddap
    return erddap
  }
  if (signal?.aborted) return null
  const gibs = await fetchGibsViewport(b.south, b.north, b.west, b.east, zoom, signal)
  if (gibs) lastSshGrid = gibs
  return gibs
}
