/**
 * Custom MapLibre protocol: fetch a raster tile, apply a light blur,
 * return PNG bytes. Used by the Advanced oceanography rasters
 * (currents, ssh-anomaly) — those stay off until toggled.
 *
 * Processed tiles are LRU-cached so a second pan does not re-decode.
 */

import maplibregl from 'maplibre-gl'
import { OceanTileCache } from './oceanTileCache'

const BLUR_PX = 2
const cache = new OceanTileCache(64)

let registered = false

export function registerSmoothProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol('smooth', async (params, abortController) => {
    const cached = cache.get(params.url)
    if (cached) return { data: cached }

    const url = params.url.replace('smooth://', 'https://')
    const res = await fetch(url, { signal: abortController.signal })
    if (!res.ok) throw new Error(`smooth tile ${res.status}`)
    const blob = await res.blob()
    if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const img = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    ctx.filter = `blur(${BLUR_PX}px)`
    ctx.globalAlpha = 0.55
    ctx.drawImage(img, 0, 0)
    ctx.filter = 'none'
    ctx.globalAlpha = 1
    img.close()

    const resultBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('smooth toBlob failed'))), 'image/png'),
    )
    const data = new Uint8Array(await resultBlob.arrayBuffer())
    cache.set(params.url, data)
    return { data }
  })
}
