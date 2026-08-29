/**
 * MapLibre protocol: fetch a NASA GIBS SST PNG and rematch its official
 * colormap onto a captain-chosen °F domain (default GOM 78–86).
 *
 * Usage: prefix the GIBS https URL with `sstscale://minF,maxF/`
 *   e.g. sstscale://78,86/gibs.earthdata.nasa.gov/wms/...
 */

import maplibregl from 'maplibre-gl'
import { parseSstScaleUrl, recolorSstPixel } from './sstPalette'

let registered = false

export function registerSstScaleProtocol(): void {
  if (registered) return
  registered = true

  maplibregl.addProtocol('sstscale', async (params, abortController) => {
    const parsed = parseSstScaleUrl(params.url)
    if (!parsed) {
      throw new Error(`sstscale: bad URL ${params.url}`)
    }

    const res = await fetch(parsed.httpsUrl, { signal: abortController.signal })
    const blob = await res.blob()
    const img = await createImageBitmap(blob)

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, img.width, img.height)
    const px = imageData.data
    const { minF, maxF } = parsed

    for (let i = 0; i < px.length; i += 4) {
      const c = recolorSstPixel(px[i], px[i + 1], px[i + 2], px[i + 3], minF, maxF)
      px[i] = c.r
      px[i + 1] = c.g
      px[i + 2] = c.b
      px[i + 3] = c.a
    }

    ctx.putImageData(imageData, 0, 0)

    const resultBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/png'),
    )
    const data = await resultBlob.arrayBuffer()
    return { data: new Uint8Array(data) }
  })
}
