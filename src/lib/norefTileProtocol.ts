/**
 * MapLibre protocol: fetch a raster tile without Referer/cookies so
 * third-party CDNs (RealEarth) do not watermark localhost / unregistered
 * sites, and so we can drop their "Size limit exceeded" error tiles.
 */

import maplibregl from 'maplibre-gl'
import { hasRealEarthWatermarkHeader, rgbaLooksLikeWatermark } from './lightningOverlay'

let registered = false

/** 1×1 transparent PNG — used when a provider returns a watermark/error image. */
export const TRANSPARENT_PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XWuoAAAAASUVORK5CYII=',
), (c) => c.charCodeAt(0))

export function norefHttpsUrl(url: string): string {
  return url.replace(/^noref:\/\//, 'https://')
}

export function registerNorefProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol('noref', async (params, abortController) => {
    const url = norefHttpsUrl(params.url)
    const res = await fetch(url, {
      signal: abortController.signal,
      referrer: 'no-referrer',
      credentials: 'omit',
    })
    if (!res.ok) throw new Error(`noref tile ${res.status}`)
    const data = new Uint8Array(await res.arrayBuffer())
    if (hasRealEarthWatermarkHeader(res.headers)) return { data: TRANSPARENT_PNG }

    if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
      try {
        const img = await createImageBitmap(new Blob([data], { type: 'image/png' }))
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          const pix = ctx.getImageData(0, 0, img.width, img.height).data
          img.close()
          if (rgbaLooksLikeWatermark(pix, img.width, img.height)) return { data: TRANSPARENT_PNG }
        } else {
          img.close()
        }
      } catch { /* keep original bytes if decode fails */ }
    }

    return { data }
  })
}
