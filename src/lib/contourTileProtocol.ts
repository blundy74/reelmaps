/**
 * Custom MapLibre protocol that fetches SSH anomaly tiles and re-renders
 * them with a diverging smooth-gradient color ramp with contour-like banding.
 *
 * Blue = negative anomaly (cold-core eddies, downwelling)
 * Red  = positive anomaly (warm-core eddies, upwelling)
 *
 * Upscales tiles 2x and applies Gaussian smoothing for high-quality output.
 */

import maplibregl from 'maplibre-gl'

// ── Smooth color ramp (interpolated, not hard bands) ────────────────────────

// Color stops: value → [r, g, b]
// We'll smoothly interpolate between these for a gradient effect,
// then add subtle contour emphasis at key thresholds.
const COLOR_STOPS: [number, number, number, number][] = [
  // [anomaly_value, r, g, b]
  [-0.35,  10,  20, 110],
  [-0.25,  20,  45, 155],
  [-0.18,  35,  75, 195],
  [-0.12,  55, 115, 220],
  [-0.07,  90, 155, 235],
  [-0.03, 140, 195, 245],
  [-0.01, 200, 220, 245],
  [ 0.00, 230, 230, 235], // near-zero: pale gray
  [ 0.01, 245, 220, 200],
  [ 0.03, 245, 195, 140],
  [ 0.07, 240, 160,  90],
  [ 0.12, 230, 120,  55],
  [ 0.18, 210,  80,  35],
  [ 0.25, 185,  50,  20],
  [ 0.35, 150,  25,  10],
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Smoothly interpolate the color ramp at a given anomaly value.
 */
function anomalyToColor(val: number): { r: number; g: number; b: number; a: number } {
  // Clamp to ramp range
  const clamped = Math.max(COLOR_STOPS[0][0], Math.min(COLOR_STOPS[COLOR_STOPS.length - 1][0], val))

  // Find surrounding stops
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [v0, r0, g0, b0] = COLOR_STOPS[i]
    const [v1, r1, g1, b1] = COLOR_STOPS[i + 1]
    if (clamped >= v0 && clamped <= v1) {
      const t = v1 === v0 ? 0 : (clamped - v0) / (v1 - v0)
      // Apply subtle contour emphasis: modulate alpha slightly at band edges
      const contourT = Math.sin(val * Math.PI * 15) * 0.08 // subtle banding
      const baseAlpha = Math.abs(val) < 0.015 ? 40 : 190 // fade near zero
      const alpha = Math.min(220, Math.max(30, baseAlpha + contourT * 255))
      return {
        r: Math.round(lerp(r0, r1, t)),
        g: Math.round(lerp(g0, g1, t)),
        b: Math.round(lerp(b0, b1, t)),
        a: Math.round(alpha),
      }
    }
  }
  return { r: 0, g: 0, b: 0, a: 0 }
}

/**
 * Estimate anomaly value from source tile pixel colors.
 * The NASA GIBS SSH layer uses a blue-white-red diverging ramp.
 */
function pixelToAnomaly(r: number, g: number, b: number, a: number): number | null {
  if (a < 30) return null

  const intensity = (r + g + b) / 3

  // Near-white = near zero
  if (intensity > 220 && Math.abs(r - b) < 25) return 0

  // Approximate anomaly from the color balance
  // Blue-heavy = negative, red-heavy = positive
  const diff = r - b
  const magnitude = Math.abs(diff) / 255

  // Also factor in green channel for better accuracy
  const greenBias = (g - Math.min(r, b)) / 255
  const adjustedMag = magnitude * (1 - greenBias * 0.3)

  return Math.sign(diff) * adjustedMag * 0.4
}

/**
 * Apply a box blur to a Float32Array grid.
 */
function blurGrid(grid: Float32Array, w: number, h: number, radius: number): Float32Array {
  const out = new Float32Array(w * h)
  const count = new Float32Array(w * h)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const val = grid[y * w + x]
      if (isNaN(val)) continue

      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(w - 1, x + radius)
      const y0 = Math.max(0, y - radius)
      const y1 = Math.min(h - 1, y + radius)

      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) {
          out[yy * w + xx] += val
          count[yy * w + xx] += 1
        }
      }
    }
  }

  for (let i = 0; i < out.length; i++) {
    out[i] = count[i] > 0 ? out[i] / count[i] : NaN
  }
  return out
}

let registered = false

export function registerContourProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol('contour', async (params, abortController) => {
    const url = params.url.replace('contour://', 'https://')

    const res = await fetch(url, { signal: abortController.signal })
    const blob = await res.blob()
    const img = await createImageBitmap(blob)

    const srcW = img.width
    const srcH = img.height
    // Upscale 2x for smoother output
    const scale = 2
    const outW = srcW * scale
    const outH = srcH * scale

    // Read source pixels
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = srcW
    srcCanvas.height = srcH
    const srcCtx = srcCanvas.getContext('2d')!
    srcCtx.drawImage(img, 0, 0)
    const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data

    // Convert source pixels to anomaly values
    const anomalyGrid = new Float32Array(srcW * srcH)
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const i = (y * srcW + x) * 4
        const val = pixelToAnomaly(srcData[i], srcData[i + 1], srcData[i + 2], srcData[i + 3])
        anomalyGrid[y * srcW + x] = val ?? NaN
      }
    }

    // Blur the anomaly grid for smoother gradients
    const smoothed = blurGrid(anomalyGrid, srcW, srcH, 2)

    // Upscale with bilinear interpolation and apply color ramp
    const outCanvas = document.createElement('canvas')
    outCanvas.width = outW
    outCanvas.height = outH
    const outCtx = outCanvas.getContext('2d')!
    const outImgData = outCtx.createImageData(outW, outH)
    const out = outImgData.data

    for (let oy = 0; oy < outH; oy++) {
      for (let ox = 0; ox < outW; ox++) {
        // Map output pixel back to source coordinates
        const sx = ox / scale
        const sy = oy / scale

        // Bilinear interpolation of anomaly value
        const x0 = Math.floor(sx)
        const y0 = Math.floor(sy)
        const x1 = Math.min(x0 + 1, srcW - 1)
        const y1 = Math.min(y0 + 1, srcH - 1)
        const fx = sx - x0
        const fy = sy - y0

        const v00 = smoothed[y0 * srcW + x0]
        const v10 = smoothed[y0 * srcW + x1]
        const v01 = smoothed[y1 * srcW + x0]
        const v11 = smoothed[y1 * srcW + x1]

        // Skip if any neighbor is NaN (no data)
        if (isNaN(v00) || isNaN(v10) || isNaN(v01) || isNaN(v11)) {
          const idx = (oy * outW + ox) * 4
          out[idx] = out[idx + 1] = out[idx + 2] = out[idx + 3] = 0
          continue
        }

        const val = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) +
                    v01 * (1 - fx) * fy + v11 * fx * fy

        const color = anomalyToColor(val)
        const idx = (oy * outW + ox) * 4
        out[idx] = color.r
        out[idx + 1] = color.g
        out[idx + 2] = color.b
        out[idx + 3] = color.a
      }
    }

    outCtx.putImageData(outImgData, 0, 0)

    // Final subtle canvas blur for extra smoothness
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = outW
    finalCanvas.height = outH
    const fctx = finalCanvas.getContext('2d')!
    fctx.filter = 'blur(1.5px)'
    fctx.drawImage(outCanvas, 0, 0)
    fctx.filter = 'none'

    const resultBlob = await new Promise<Blob>((resolve) =>
      finalCanvas.toBlob((b) => resolve(b!), 'image/png'),
    )
    const data = await resultBlob.arrayBuffer()
    return { data: new Uint8Array(data) }
  })
}
