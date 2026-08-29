/**
 * SSH anomaly isolines from a GIBS MEaSUREs tile.
 * Lines only — no fill. Fat 0 (zero-anomaly) contour is the fishing edge.
 */

import { lookupColorValue, sshLookup } from './gibsColormaps'

export const SSH_CONTOUR_LEVELS = [-0.30, -0.20, -0.10, -0.05, 0, 0.05, 0.10, 0.20, 0.30]

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
 * Marching squares isoline segments in pixel space.
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

/** Draw fishing-chart SSH contours onto a transparent canvas (pixel = grid). */
export function drawSshContours(
  ctx: CanvasRenderingContext2D,
  grid: Float32Array,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = 1

  const zero = isolineSegments(grid, w, h, 0)

  for (const level of SSH_CONTOUR_LEVELS) {
    if (level === 0) continue
    const segs = isolineSegments(grid, w, h, level)
    const mag = Math.abs(level)
    const width = mag >= 0.2 ? 1.35 : mag >= 0.1 ? 1.1 : 0.85
    const color = level < 0
      ? mag >= 0.2 ? 'rgba(37, 99, 235, 0.85)' : 'rgba(56, 189, 248, 0.75)'
      : mag >= 0.2 ? 'rgba(220, 38, 38, 0.85)' : 'rgba(249, 115, 22, 0.75)'
    strokeSegs(ctx, segs, color, width)
  }

  // Fat zero-anomaly contour — the Loop / eddy edge captains fish.
  ctx.save()
  ctx.shadowColor = 'rgba(4, 12, 24, 0.85)'
  ctx.shadowBlur = 2
  strokeSegs(ctx, zero, 'rgba(226, 232, 240, 0.98)', 3.4)
  ctx.restore()
  strokeSegs(ctx, zero, 'rgba(15, 23, 42, 0.95)', 1.15)
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
  const t2 = performance.now()
  return { decodeMs: t1 - t0, isolineMs: t2 - t1, segments }
}
