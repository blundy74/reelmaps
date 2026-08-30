/**
 * Loop/sail and tight Fit must distinguish ~1°F, not crush to one red.
 * Run: npx --yes tsx src/lib/sstPalette.test.ts
 */
import { GIBS_SST_ENTRIES } from './gibsSstColormap'
import {
  fishingBandColor,
  recolorSstPixel,
  parseSstScaleUrl,
  applySstScaleUrl,
  fahrenheitToCelsius,
  sstPaintRange,
} from './sstPalette'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function nearestGibs(tC: number) {
  let best = GIBS_SST_ENTRIES[0]
  let d = Infinity
  for (const e of GIBS_SST_ENTRIES) {
    const dd = Math.abs(e.tC - tC)
    if (dd < d) {
      d = dd
      best = e
    }
  }
  return best
}

function pack(c: { r: number; g: number; b: number }): number {
  return (c.r << 16) | (c.g << 8) | c.b
}

function main() {
  const c85 = fishingBandColor(85, 78, 86)
  const c86 = fishingBandColor(86, 78, 86)
  const c87 = fishingBandColor(87, 78, 86)
  const c88 = fishingBandColor(88, 78, 86)
  assert(pack(c85) !== pack(c86), `78–86: 85 and 86 must differ ${JSON.stringify(c85)} ${JSON.stringify(c86)}`)
  assert(pack(c86) !== pack(c87), `78–86: 86 and 87 must differ ${JSON.stringify(c86)} ${JSON.stringify(c87)}`)
  assert(pack(c87) !== pack(c88), `78–86: 87 and 88 must differ ${JSON.stringify(c87)} ${JSON.stringify(c88)}`)

  const f86 = fishingBandColor(86, 86, 88)
  const f87 = fishingBandColor(87, 86, 88)
  const f88 = fishingBandColor(88, 86, 88)
  assert(pack(f86) !== pack(f87), 'Fit 86–88: 86 vs 87')
  assert(pack(f87) !== pack(f88), 'Fit 86–88: 87 vs 88')
  assert(pack(f86) !== pack(f88), 'Fit 86–88: 86 vs 88')

  const e86 = nearestGibs(fahrenheitToCelsius(86))
  const e87 = nearestGibs(fahrenheitToCelsius(87))
  const e88 = nearestGibs(fahrenheitToCelsius(88))
  const r86 = recolorSstPixel(e86.r, e86.g, e86.b, 255, 78, 86)
  const r87 = recolorSstPixel(e87.r, e87.g, e87.b, 255, 78, 86)
  const r88 = recolorSstPixel(e88.r, e88.g, e88.b, 255, 78, 86)
  assert(pack(r86) !== pack(r87), 'recolor Loop/sail: 86 vs 87')
  assert(pack(r87) !== pack(r88), 'recolor Loop/sail: 87 vs 88')

  const gomPaint = sstPaintRange({ preset: 'gom', minF: 78, maxF: 86 })
  assert(gomPaint.maxF === 90, `Loop/sail paint must extend past 86: ${gomPaint.maxF}`)
  assert(pack(fishingBandColor(86, gomPaint.minF, gomPaint.maxF)) !== pack(fishingBandColor(87, gomPaint.minF, gomPaint.maxF)), 'paint 86 vs 87')
  assert(pack(fishingBandColor(87, gomPaint.minF, gomPaint.maxF)) !== pack(fishingBandColor(88, gomPaint.minF, gomPaint.maxF)), 'paint 87 vs 88')

  const url = applySstScaleUrl('https://gibs.earthdata.nasa.gov/wms/x', 78, 90)
  assert(url.startsWith('sstscale://78,90,v18/'), `band token ${url}`)
  const parsed = parseSstScaleUrl(url)
  assert(parsed != null && parsed.minF === 78 && parsed.maxF === 90, 'parse band url')
  assert(parsed!.httpsUrl.startsWith('https://'), 'https restored')
  const legacy = parseSstScaleUrl('sstscale://78,86/gibs.earthdata.nasa.gov/wms/x')
  assert(legacy != null && legacy.minF === 78, 'legacy url still parses')

  console.log('sstPalette.test.ts: ok')
}

main()
