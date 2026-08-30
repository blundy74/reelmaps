/**
 * Live lightning chip: RealEarth GLM FED, not GIBS, not radar-coupled.
 * Run: npx --yes tsx src/lib/lightningOverlay.test.ts
 */
import {
  GLM_TILE_REFRESH_MS,
  LIGHTNING_GLM_STAMP,
  LIGHTNING_GLM_TITLE,
  LIGHTNING_HRRR_STAMP,
  LIGHTNING_HRRR_TITLE,
  glmFlashesFromApi,
  glmTileCacheBust,
  hrrrForecastHour,
  hrrrNowOffsetHours,
  isUsableRasterTile,
  lightningChipVisible,
  lightningLegend,
  radarForcesLightning,
  realEarthGlmFedUrl,
  realEarthGlmProbeUrl,
  usesGibsGlm,
  usesIemGlmErrorTiles,
} from './lightningOverlay'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  const glmUrl = realEarthGlmFedUrl(1)
  assert(glmUrl.includes('realearth.ssec.wisc.edu/tiles/GOESEastGLMFEDRadC'), 'RealEarth FED xyz')
  assert(glmUrl.includes('{z}/{x}/{y}.png'), 'OSM xyz placeholders')
  assert(glmUrl.includes('?t=1'), 'cache-bust query')
  assert(!usesGibsGlm(glmUrl), 'GIBS GLM density is gone')
  assert(!usesIemGlmErrorTiles(glmUrl), 'do not use IEM fake-red tiles')
  assert(!glmUrl.includes('GOES-East_GLM_Flash_Extent_Density'), 'no GIBS layer id')

  const probe = realEarthGlmProbeUrl(1)
  assert(probe.includes('/5/8/13.png'), 'Gulf probe tile')
  assert(!probe.includes('{z}'), 'probe is a concrete tile')

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

  const a = glmTileCacheBust(0)
  const b = glmTileCacheBust(GLM_TILE_REFRESH_MS)
  assert(b === a + 1, 'cache-bust steps every 5 min')

  console.log('lightningOverlay.test.ts: ok')
}

main()
