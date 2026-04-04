/**
 * Custom MapLibre protocol that fetches a raster tile, draws it to an
 * offscreen canvas with a Gaussian blur, and returns the smoothed image.
 *
 * Usage:
 *   1. Call `registerSmoothProtocol()` once before creating the map.
 *   2. Prefix tile URLs with `smooth://` instead of `https://`.
 *      e.g. `smooth://nowcoast.noaa.gov/geoserver/...`
 *
 * The blur radius is tunable via the `BLUR_PX` constant.
 */

import maplibregl from 'maplibre-gl'

const BLUR_PX = 4

let registered = false

export function registerSmoothProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol('smooth', async (params, abortController) => {
    // Strip the protocol prefix to get the real HTTPS URL
    const url = params.url.replace('smooth://', 'https://')

    const res = await fetch(url, { signal: abortController.signal })
    const blob = await res.blob()
    const img = await createImageBitmap(blob)

    // Draw the tile to a canvas with a blur filter
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!

    // Draw once normally as the base
    ctx.drawImage(img, 0, 0)

    // Then composite a blurred copy on top for smoothing
    ctx.filter = `blur(${BLUR_PX}px)`
    ctx.globalAlpha = 0.7
    ctx.drawImage(img, 0, 0)
    ctx.filter = 'none'
    ctx.globalAlpha = 1.0

    // Convert back to PNG ArrayBuffer for MapLibre
    const resultBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png'),
    )
    const data = await resultBlob.arrayBuffer()

    return { data: new Uint8Array(data) }
  })
}
