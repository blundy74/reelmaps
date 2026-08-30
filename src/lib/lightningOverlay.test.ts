/**
 * Live lightning chip: RealEarth GLM FED, not GIBS, not radar-coupled.
 * Run: npx --yes tsx src/lib/lightningOverlay.test.ts
 */
import {
  FISHING_MAP_SYNC_SPOT_IDS,
  GLM_DENSITY_LAYER,
  GLM_IMAGERY_BELOW_IDS,
  GLM_SPOT_LAYER_IDS,
  GLM_TILE_REFRESH_MS,
  LIGHTNING_GLM_STAMP,
  LIGHTNING_GLM_TITLE,
  LIGHTNING_HRRR_STAMP,
  LIGHTNING_HRRR_TITLE,
  chlorophyll7DaySubIds,
  coveringTileZoom,
  glmFlashesFromApi,
  glmImageryBeforeId,
  glmTileCacheBust,
  hasRealEarthWatermarkHeader,
  hideGlmDensityRaster,
  rgbaLooksLikeWatermark,
  hrrrForecastHour,
  hrrrNowOffsetHours,
  isUsableRasterTile,
  layersThatMustStayBelowGlm,
  lightningChipVisible,
  lightningLegend,
  radarForcesLightning,
  realEarthGlmFedUrl,
  realEarthGlmHttpsUrl,
  realEarthGlmProbeUrl,
  realEarthGlmTileUrl,
  restackAfterFishingMapSync,
  restackGlmAboveImagery,
  tileCacheKey,
  tileScreenRect,
  usesGibsGlm,
  usesIemGlmErrorTiles,
  viewportBounds,
  visibleXyzTiles,
} from './lightningOverlay'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  const glmUrl = realEarthGlmFedUrl(1)
  const httpsUrl = realEarthGlmHttpsUrl(1)
  assert(httpsUrl === 'https://realearth.ssec.wisc.edu/tiles/GOESEastGLMFEDRadC/{z}/{x}/{y}.png?t=1', 'https template')
  assert(glmUrl.includes('tiles/GOESEastGLMFEDRadC/{z}/{x}/{y}.png'), 'RealEarth FED xyz')
  assert(
    glmUrl.startsWith('https://realearth.ssec.wisc.edu/') || glmUrl.startsWith('/proxy/realearth/'),
    'production is native https like Radar; Vite :5173 uses /proxy/realearth',
  )
  assert(!glmUrl.startsWith('noref://'), 'Amplify must not use noref:// for GLM')
  assert(httpsUrl.startsWith('https://realearth.ssec.wisc.edu/tiles/GOESEastGLMFEDRadC/'), 'https helper')
  assert(glmUrl.includes('{z}/{x}/{y}.png'), 'OSM xyz placeholders')
  assert(glmUrl.includes('?t=1'), 'cache-bust query')
  assert(!usesGibsGlm(glmUrl), 'GIBS GLM density is gone')
  assert(!usesIemGlmErrorTiles(glmUrl), 'do not use IEM fake-red tiles')
  assert(!glmUrl.includes('GOES-East_GLM_Flash_Extent_Density'), 'no GIBS layer id')
  assert(!usesGibsGlm(httpsUrl) && !usesIemGlmErrorTiles(httpsUrl), 'https helper stays off GIBS/IEM')

  const probe = realEarthGlmProbeUrl(1)
  assert(probe.includes('/5/8/13.png'), 'Gulf probe tile')
  assert(!probe.includes('{z}'), 'probe is a concrete tile')
  assert(probe.includes('GOESEastGLMFEDRadC'), 'probe is RealEarth FED')

  const tileUrl = realEarthGlmTileUrl(7, 31, 53, 1)
  assert(tileUrl.includes('/7/31/53.png'), 'concrete FED tile')
  assert(!tileUrl.includes('{z}'), 'tile url has no placeholders')
  assert(!tileUrl.startsWith('noref://'), 'tile url is not noref')
  assert(
    tileUrl.startsWith('https://realearth.ssec.wisc.edu/') || tileUrl.startsWith('/proxy/realearth/'),
    'tile url is native https or Vite proxy',
  )
  assert(!usesGibsGlm(tileUrl) && !usesIemGlmErrorTiles(tileUrl), 'tile url stays off GIBS/IEM')
  assert(tileCacheKey(1, { z: 7, x: 31, y: 53 }) === '1/7/31/53', 'cache key')

  const radarOnly = [
    { id: 'radar', visible: true },
    { id: 'lightning', visible: false },
    { id: 'hrrr-lightning', visible: false },
  ]
  assert(!lightningChipVisible(radarOnly), 'radar-on is not lightning-on')
  assert(radarForcesLightning(radarOnly) === true, 'detect radar coupling')
  assert(lightningChipVisible([{ id: 'lightning', visible: true }]), 'chip id lightning')
  assert(
    !lightningChipVisible([{ id: 'hrrr-lightning', visible: true }, { id: 'lightning', visible: false }]),
    'HRRR forecast overlay is not the Lightning chip',
  )

  assert(glmFlashesFromApi({ flashes: [], count: 0 }).length === 0, 'empty API is not fake bursts')
  assert(glmFlashesFromApi({ flashes: [{ lat: 27, lon: -85 }], count: 0 }).length === 0, 'count 0 wins')
  assert(glmFlashesFromApi({ flashes: [{ lat: 27, lon: -85 }], count: 1 }).length === 1, 'real points kept')
  assert(glmFlashesFromApi({ flashes: [{ lat: NaN, lon: -85 }], count: 1 }).length === 0, 'bad coords dropped')

  const glm = lightningLegend('glm')
  assert(glm.title === LIGHTNING_GLM_TITLE, 'GLM title')
  assert(glm.stamp === LIGHTNING_GLM_STAMP, 'GLM age line')
  assert(glm.stamp.includes('5 min'), '5-min FED')
  const hrrr = lightningLegend('hrrr')
  assert(hrrr.title === LIGHTNING_HRRR_TITLE, 'HRRR fallback title')
  assert(hrrr.stamp === LIGHTNING_HRRR_STAMP, 'HRRR stamp is not live GLM')

  // Same hour math as HrrrOverlay: 08Z run at 17Z → fh09 (fh00 is the past analysis).
  const now = Date.UTC(2026, 7, 30, 17, 0, 0)
  const fh = hrrrForecastHour({ run_date: '20260830', run_hour: '08' }, 4, 4, now)
  assert(fh === 9, `HRRR hour math expected 9 got ${fh}`)
  assert(hrrrNowOffsetHours([], now) === 4, 'empty hourly defaults to 4')

  assert(!isUsableRasterTile({ ok: false }), 'failed response')
  assert(!isUsableRasterTile({ ok: true, contentType: 'text/html', byteLength: 200 }), 'non-image')
  assert(!isUsableRasterTile({ ok: true, contentType: 'image/png', byteLength: 10 }), 'empty body')
  assert(isUsableRasterTile({ ok: true, contentType: 'image/png', byteLength: 400, naturalWidth: 256, naturalHeight: 256 }), 'real png')

  const hdr = { get: (n: string) => (n === 'RE-Watermark' ? 'Size limit exceeded' : null) }
  assert(hasRealEarthWatermarkHeader(hdr), 'watermark header')
  const black = new Uint8Array(4 * 4)
  for (let i = 0; i < black.length; i += 4) black[i + 3] = 255
  assert(rgbaLooksLikeWatermark(black, 2, 2), 'opaque black is watermark')
  const clear = new Uint8Array(4 * 4)
  assert(!rgbaLooksLikeWatermark(clear, 2, 2), 'transparent is not watermark')

  const a = glmTileCacheBust(0)
  const b = glmTileCacheBust(GLM_TILE_REFRESH_MS)
  assert(b === a + 1, 'cache-bust steps every 5 min')

  assert(GLM_IMAGERY_BELOW_IDS.includes('sst-mur'), 'SST analysis stays under GLM')
  assert(GLM_IMAGERY_BELOW_IDS.includes('satellite-imagery'), 'sat imagery stays under GLM')
  assert(chlorophyll7DaySubIds().includes('chlorophyll-7day-d0'), '7-day chl sublayers listed')
  assert(layersThatMustStayBelowGlm().includes('chlorophyll-7day-d6'), 'chl-7day-d6 under GLM')
  assert(GLM_SPOT_LAYER_IDS.includes('fishing-spots-fads'), 'FADs restack above GLM')

  const stack: string[] = [
    'sst-mur',
    GLM_DENSITY_LAYER,
    'chlorophyll-7day-d0',
    'fishing-spots',
  ]
  const fakeMap = {
    getLayer: (id: string) => (stack.includes(id) ? { id } : undefined),
    moveLayer: (id: string) => {
      const i = stack.indexOf(id)
      if (i < 0) return
      stack.splice(i, 1)
      stack.push(id)
    },
  }
  restackGlmAboveImagery(fakeMap)
  assert(stack.indexOf(GLM_DENSITY_LAYER) > stack.indexOf('sst-mur'), 'GLM above SST')
  assert(stack.indexOf(GLM_DENSITY_LAYER) > stack.indexOf('chlorophyll-7day-d0'), 'GLM above chl-7day')
  assert(stack.indexOf('fishing-spots') > stack.indexOf(GLM_DENSITY_LAYER), 'spots above GLM')
  assert(stack[stack.length - 1] === 'fishing-spots', 'spots last after restack')

  const buried: string[] = [GLM_DENSITY_LAYER, 'sst-mur', 'clusters']
  const buriedMap = {
    getLayer: (id: string) => (buried.includes(id) ? { id } : undefined),
    moveLayer: (id: string) => {
      const i = buried.indexOf(id)
      if (i < 0) return
      buried.splice(i, 1)
      buried.push(id)
    },
  }
  restackGlmAboveImagery(buriedMap)
  assert(buried.indexOf('sst-mur') < buried.indexOf(GLM_DENSITY_LAYER), 'idle restack unburies GLM')
  assert(buried.indexOf('clusters') > buried.indexOf(GLM_DENSITY_LAYER), 'clusters stay on top')

  // UA 14 failure: sstRange change removes sst-mur and addLayer-without-beforeId
  // puts it on top of GLM. Old syncLayers only moveLayer'd spots, so GLM stayed buried.
  const ua14: string[] = ['sst-mur', GLM_DENSITY_LAYER, 'fishing-spots']
  const ua14Map = {
    getLayer: (id: string) => (ua14.includes(id) ? { id } : undefined),
    moveLayer: (id: string) => {
      const i = ua14.indexOf(id)
      if (i < 0) return
      ua14.splice(i, 1)
      ua14.push(id)
    },
    removeLayer: (id: string) => {
      const i = ua14.indexOf(id)
      if (i >= 0) ua14.splice(i, 1)
    },
    addLayer: (layer: { id: string }, beforeId?: string) => {
      const existing = ua14.indexOf(layer.id)
      if (existing >= 0) ua14.splice(existing, 1)
      if (beforeId) {
        const at = ua14.indexOf(beforeId)
        if (at >= 0) {
          ua14.splice(at, 0, layer.id)
          return
        }
      }
      ua14.push(layer.id)
    },
  }
  ua14Map.removeLayer('sst-mur')
  ua14Map.addLayer({ id: 'sst-mur' }) // UA 14: no beforeId → SST on top
  assert(ua14.indexOf('sst-mur') > ua14.indexOf(GLM_DENSITY_LAYER), 'UA 14 bury: SST above GLM')
  restackAfterFishingMapSync(ua14Map)
  assert(ua14.indexOf(GLM_DENSITY_LAYER) > ua14.indexOf('sst-mur'), 'sync restack: GLM above sst-mur')
  assert(ua14.indexOf('fishing-spots') > ua14.indexOf(GLM_DENSITY_LAYER), 'sync restack: spots above GLM')

  // New addLayer path: if GLM exists, imagery inserts below it.
  assert(glmImageryBeforeId(ua14Map) === GLM_DENSITY_LAYER, 'beforeId is GLM when present')
  ua14Map.removeLayer('sst-mur')
  ua14Map.addLayer({ id: 'sst-mur' }, glmImageryBeforeId(ua14Map))
  assert(ua14.indexOf('sst-mur') < ua14.indexOf(GLM_DENSITY_LAYER), 'addLayer beforeId keeps SST under GLM')
  assert(glmImageryBeforeId({ getLayer: () => undefined }) === undefined, 'no beforeId when GLM absent')
  assert(FISHING_MAP_SYNC_SPOT_IDS.includes('fishing-spots'), 'sync restack lifts fishing-spots')

  const g = globalThis as { window?: { location: { port: string } } }
  const prev = g.window
  try {
    g.window = { location: { port: '5173' } }
    const vite = realEarthGlmFedUrl(1)
    assert(vite.startsWith('/proxy/realearth/'), 'Vite :5173 uses same-origin proxy')
    assert(!vite.startsWith('noref://'), 'Vite path is not noref')
    const viteTile = realEarthGlmTileUrl(7, 33, 53, 1)
    assert(viteTile.startsWith('/proxy/realearth/'), 'Vite tile is same-origin proxy')
    assert(viteTile.includes('/7/33/53.png'), 'Vite tile xyz')

    g.window = { location: { port: '' } }
    const amplify = realEarthGlmFedUrl(1)
    assert(amplify === httpsUrl, 'Amplify uses native https template')
    assert(!amplify.startsWith('noref://'), 'Amplify is not noref')
    const ampTile = realEarthGlmTileUrl(7, 33, 53, 1)
    assert(ampTile.startsWith('https://realearth.ssec.wisc.edu/tiles/GOESEastGLMFEDRadC/7/33/53.png'), 'Amplify tile is native https')
    assert(!ampTile.startsWith('noref://'), 'Amplify tile is not noref')
  } finally {
    if (prev === undefined) delete g.window
    else g.window = prev
  }

  // UA 16: canvas FED covering — Gulf 29.3863°N 88.3037°W z≈6.4 includes 7/31–33/53.
  assert(coveringTileZoom(6.4) === 7, 'z≈6.4 covers with z=7 FED tiles')
  assert(coveringTileZoom(6) === 6, 'integer zoom stays 1:1')
  assert(coveringTileZoom(8.9) === 8, 'cap at GLM max zoom')
  const gulf = viewportBounds({ lat: 29.3863, lon: -88.3037 }, 6.4, 1100, 700)
  const gulfTiles = visibleXyzTiles(gulf, 6.4)
  assert(gulfTiles.length > 0 && gulfTiles.every((t) => t.z === 7), 'Gulf covering zoom is 7')
  const has = (x: number, y: number) => gulfTiles.some((t) => t.z === 7 && t.x === x && t.y === y)
  assert(has(31, 53), 'includes 7/31/53')
  assert(has(32, 53), 'includes 7/32/53')
  assert(has(33, 53), 'includes 7/33/53')

  const rect = tileScreenRect({ z: 7, x: 32, y: 53 }, ([lon, lat]) => ({ x: lon, y: -lat }))
  assert(rect.w > 0 && rect.h > 0, 'tile NW/SE projects to a positive screen rect')

  const hideCalls: string[] = []
  hideGlmDensityRaster({
    getLayer: (id) => (id === GLM_DENSITY_LAYER ? { id } : undefined),
    setLayoutProperty: (id, key, value) => { hideCalls.push(`${id}:${key}:${String(value)}`) },
  })
  assert(hideCalls[0] === `${GLM_DENSITY_LAYER}:visibility:none`, 'canvas path hides MapLibre GLM raster')

  console.log('lightningOverlay.test.ts: ok')
}

main()
