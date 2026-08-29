/**
 * MapLibre contour:// protocol — SSH isolines, not a fill.
 *
 * Fetches a GIBS SSH anomaly tile, decodes the official colormap, and
 * draws contour lines (fat 0-anomaly). Processed tiles are cached so
 * pan/zoom reuse does not re-decode on the main thread.
 */

import maplibregl from 'maplibre-gl'
import { OceanTileCache } from './oceanTileCache'
import { decodeSshAnomaly, drawSshContours } from './sshContours'

const cache = new OceanTileCache(80)
let registered = false

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('contour toBlob failed'))), 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

export function registerContourProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol('contour', async (params, abortController) => {
    const cached = cache.get(params.url)
    if (cached) return { data: cached }

    const url = params.url.replace('contour://', 'https://')
    const res = await fetch(url, { signal: abortController.signal })
    if (!res.ok) throw new Error(`contour tile ${res.status}`)
    const blob = await res.blob()
    if (abortController.signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const img = await createImageBitmap(blob)
    const w = img.width
    const h = img.height

    const src = document.createElement('canvas')
    src.width = w
    src.height = h
    const sctx = src.getContext('2d', { willReadFrequently: true })!
    sctx.drawImage(img, 0, 0)
    img.close()
    const rgba = sctx.getImageData(0, 0, w, h).data

    const grid = decodeSshAnomaly(rgba, w, h)
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const octx = out.getContext('2d')!
    drawSshContours(octx, grid, w, h)

    const data = await canvasToPng(out)
    cache.set(params.url, data)
    return { data }
  })
}
