/**
 * SSH anomaly isolines — fishing chart, not a rainbow sketch.
 * NOAA nesdisSSH1day SLA. One ink (light slate). 10 cm interval.
 * Fat 0 = FishTrack eddy wall. Leben 17 cm is ADT/Loop — not this field.
 * Lines only, no fill.
 */

import { lookupColorValue, sshLookup } from './gibsColormaps'

export const SSH_INTERVAL_M = 0.10
/** Fat/bold contour is SLA 0 only. Not Leben 17 cm (ADT/Loop proxy). */
export const SSH_FAT_M = 0
/** Regular 10 cm levels, ±80 cm. No ±5 cm. No 17 cm. 0 is fat, not in this set. */
export const SSH_CONTOUR_LEVELS = [
  -0.80, -0.70, -0.60, -0.50, -0.40, -0.30, -0.20, -0.10,
  0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80,
] as const

const SSH_INK = 'rgba(226, 232, 240, 0.32)'
const SSH_INK_HALO = 'rgba(15, 23, 42, 0.4)'
export const SSH_HAIRLINE_WIDTH = 0.45
export const SSH_FAT_WIDTH = 3.4
const FAT_INK = 'rgba(248, 250, 252, 0.92)'

export function decodeSshAnomaly(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
): Float32Array {
  const lut = sshLookup()
  const grid = new Float32Array(w * h)
  for (let i = 0, p = 0; i < grid.length; i++, p += 4) {
    grid[i] = lookupColorValue(lut, rgba[p], rgba[p + 1], rgba[p + 2], rgba[p + 3])
  }
  return grid
}

type Seg = [number, number, number, number]

/**
 * Marching squares isoline segments in grid index space.
 * NaN cells (land / nodata) are skipped so lines stop at the coast.
 */
export function isolineSegments(
  grid: Float32Array,
  w: number,
  h: number,
  level: number,
): Seg[] {
  const segs: Seg[] = []
  for (let y = 0; y < h - 1; y++) {
    const row = y * w
    const row1 = row + w
    for (let x = 0; x < w - 1; x++) {
      const v00 = grid[row + x]
      const v10 = grid[row + x + 1]
      const v01 = grid[row1 + x]
      const v11 = grid[row1 + x + 1]
      if (isNaN(v00) || isNaN(v10) || isNaN(v01) || isNaN(v11)) continue

      let code = 0
      if (v00 >= level) code |= 1
      if (v10 >= level) code |= 2
      if (v11 >= level) code |= 4
      if (v01 >= level) code |= 8
      if (code === 0 || code === 15) continue

      const lerp = (a: number, b: number) => {
        const d = b - a
        return d === 0 ? 0.5 : (level - a) / d
      }
      const top: [number, number] = [x + lerp(v00, v10), y]
      const right: [number, number] = [x + 1, y + lerp(v10, v11)]
      const bottom: [number, number] = [x + lerp(v01, v11), y + 1]
      const left: [number, number] = [x, y + lerp(v00, v01)]

      const push = (a: [number, number], b: [number, number]) => {
        segs.push([a[0], a[1], b[0], b[1]])
      }

      switch (code) {
        case 1: case 14: push(left, top); break
        case 2: case 13: push(top, right); break
        case 3: case 12: push(left, right); break
        case 4: case 11: push(right, bottom); break
        case 6: case 9: push(top, bottom); break
        case 7: case 8: push(left, bottom); break
        case 5:
          push(left, top)
          push(right, bottom)
          break
        case 10:
          push(top, right)
          push(left, bottom)
          break
      }
    }
  }
  return segs
}

function strokeSegs(
  ctx: CanvasRenderingContext2D,
  segs: Seg[],
  color: string,
  width: number,
): void {
  if (!segs.length) return
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  for (const [x1, y1, x2, y2] of segs) {
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
  }
  ctx.stroke()
}

export interface SshGridDraw {
  sla: Float32Array
  cols: number
  rows: number
}

/** Pixel-space draw (GIBS fallback decode or tests). One ink, 10 cm, fat 0. */
export function drawSshContours(
  ctx: CanvasRenderingContext2D,
  grid: Float32Array,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h)
  paintLookLocked(ctx, grid, w, h, (x, y) => [x, y])
}

/** Screen-space draw from a geographic grid (one viewport, no tile seams). */
export function drawSshContoursScreen(
  ctx: CanvasRenderingContext2D,
  grid: SshGridDraw & { west: number; south: number; east: number; north: number },
  toScreen: (lng: number, lat: number) => { x: number; y: number },
): void {
  const { sla, cols, rows, west, south, east, north } = grid
  const lngSpan = east - west
  const latSpan = north - south
  paintLookLocked(ctx, sla, cols, rows, (gx, gy) => {
    const lng = west + (gx / Math.max(1, cols - 1)) * lngSpan
    const lat = north - (gy / Math.max(1, rows - 1)) * latSpan
    const p = toScreen(lng, lat)
    return [p.x, p.y]
  })
}

function paintLookLocked(
  ctx: CanvasRenderingContext2D,
  grid: Float32Array,
  w: number,
  h: number,
  project: (x: number, y: number) => [number, number],
): void {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = 1

  const mapSegs = (level: number): Seg[] =>
    isolineSegments(grid, w, h, level).map(([x1, y1, x2, y2]) => {
      const a = project(x1, y1)
      const b = project(x2, y2)
      return [a[0], a[1], b[0], b[1]]
    })

  for (const level of SSH_CONTOUR_LEVELS) {
    strokeSegs(ctx, mapSegs(level), SSH_INK, SSH_HAIRLINE_WIDTH)
  }

  const fat = mapSegs(SSH_FAT_M)
  ctx.save()
  ctx.shadowColor = SSH_INK_HALO
  ctx.shadowBlur = 2.4
  strokeSegs(ctx, fat, FAT_INK, SSH_FAT_WIDTH)
  ctx.restore()
  strokeSegs(ctx, fat, 'rgba(15, 23, 42, 0.55)', 1.15)
}

/** Isolated timing helper — decode + isolines, no canvas. */
export function measureSshContourWork(rgba: Uint8ClampedArray, w: number, h: number): {
  decodeMs: number
  isolineMs: number
  segments: number
} {
  const t0 = performance.now()
  const grid = decodeSshAnomaly(rgba, w, h)
  const t1 = performance.now()
  let segments = 0
  for (const level of SSH_CONTOUR_LEVELS) {
    segments += isolineSegments(grid, w, h, level).length
  }
  segments += isolineSegments(grid, w, h, SSH_FAT_M).length
  const t2 = performance.now()
  return { decodeMs: t1 - t0, isolineMs: t2 - t1, segments }
}
