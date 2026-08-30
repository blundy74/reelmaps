/**
 * Live lightning (OVERLAYS chip id `lightning`) — RealEarth GOES-East GLM FED.
 * HRRR lightning (`hrrr-lightning`) is a separate forecast overlay.
 */


/** University of Wisconsin SSEC RealEarth GOES-East GLM Flash Extent Density (5-min). */
export const REALEARTH_GLM_FED_LAYER = 'GOESEastGLMFEDRadC'
export const REALEARTH_GLM_FED_BASE =
  `https://realearth.ssec.wisc.edu/tiles/${REALEARTH_GLM_FED_LAYER}`

/** Gulf tile that painted live flashes on 2026-08-30 (z5/8/13). */
export const REALEARTH_GLM_PROBE = { z: 5, x: 8, y: 13 } as const

export const GLM_TILE_REFRESH_MS = 5 * 60 * 1000
export const GLM_PROBE_FAILS_BEFORE_HRRR = 2

export const LIGHTNING_GLM_TITLE = 'Lightning (GLM)'
export const LIGHTNING_GLM_STAMP = 'GOES-East · 5 min'
export const LIGHTNING_HRRR_TITLE = 'HRRR lightning threat'
export const LIGHTNING_HRRR_STAMP = 'HRRR lightning threat'

export type LightningProduct = 'glm' | 'hrrr'

export function lightningChipVisible(
  overlays: ReadonlyArray<{ id: string; visible: boolean }>,
): boolean {
  return overlays.some((o) => o.id === 'lightning' && o.visible)
}

/** Radar must never force the live lightning product on. */
export function radarForcesLightning(
  overlays: ReadonlyArray<{ id: string; visible: boolean }>,
): boolean {
  const radarOn = overlays.some((o) => o.id === 'radar' && o.visible)
  const lightningOn = lightningChipVisible(overlays)
  return radarOn && !lightningOn
}

export function glmTileCacheBust(nowMs = Date.now()): number {
  return Math.floor(nowMs / GLM_TILE_REFRESH_MS)
}

/** Same-origin Vite proxy when available; noref:// protocol otherwise. */
export function realEarthGlmFedUrl(cacheBust: number | string = glmTileCacheBust()): string {
  const path = `tiles/${REALEARTH_GLM_FED_LAYER}/{z}/{x}/{y}.png?t=${cacheBust}`
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `/proxy/realearth/${path}`
  }
  return `noref://realearth.ssec.wisc.edu/${path}`
}

export function realEarthGlmHttpsUrl(cacheBust: number | string = glmTileCacheBust()): string {
  return `${REALEARTH_GLM_FED_BASE}/{z}/{x}/{y}.png?t=${cacheBust}`
}

export function realEarthGlmProbeUrl(cacheBust: number | string = glmTileCacheBust()): string {
  const { z, x, y } = REALEARTH_GLM_PROBE
  const path = `tiles/${REALEARTH_GLM_FED_LAYER}/${z}/${x}/${y}.png?t=${cacheBust}`
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `/proxy/realearth/${path}`
  }
  return `https://realearth.ssec.wisc.edu/${path}`
}

export function lightningLegend(product: LightningProduct): {
  title: string
  stamp: string
  unit: string
} {
  if (product === 'hrrr') {
    return { title: LIGHTNING_HRRR_TITLE, stamp: LIGHTNING_HRRR_STAMP, unit: 'threat' }
  }
  return { title: LIGHTNING_GLM_TITLE, stamp: LIGHTNING_GLM_STAMP, unit: 'FED' }
}

export function isUsableRasterTile(meta: {
  ok: boolean
  contentType?: string | null
  byteLength?: number
  naturalWidth?: number
  naturalHeight?: number
}): boolean {
  if (!meta.ok) return false
  const ct = (meta.contentType ?? '').toLowerCase()
  if (ct && !ct.includes('image') && !ct.includes('octet-stream') && !ct.includes('png')) {
    return false
  }
  if (typeof meta.byteLength === 'number' && meta.byteLength < 80) return false
  if (typeof meta.naturalWidth === 'number' && meta.naturalWidth <= 0) return false
  if (typeof meta.naturalHeight === 'number' && meta.naturalHeight <= 0) return false
  return true
}

/** Canvas bursts only when the GLM API actually returns points. */
export function glmFlashesFromApi(data: {
  flashes?: Array<{ lat?: number; lon?: number; energy?: number }> | null
  count?: number
}): Array<{ lat: number; lon: number; energy?: number }> {
  if (!data || (typeof data.count === 'number' && data.count === 0)) return []
  const flashes = data.flashes
  if (!Array.isArray(flashes) || flashes.length === 0) return []
  const out: Array<{ lat: number; lon: number; energy?: number }> = []
  for (const f of flashes) {
    if (typeof f?.lat !== 'number' || typeof f?.lon !== 'number') continue
    if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon)) continue
    out.push({ lat: f.lat, lon: f.lon, energy: f.energy })
  }
  return out
}

/** Same now-offset as HrrrOverlay: first hourly slot within 30 min of now, else 4. */
export function hrrrNowOffsetHours(
  hourly: ReadonlyArray<{ time: string }>,
  nowMs = Date.now(),
): number {
  if (!hourly.length) return 4
  for (let i = 0; i < hourly.length; i++) {
    if (new Date(hourly[i].time).getTime() >= nowMs - 30 * 60 * 1000) return i
  }
  return 4
}

/**
 * Same forecast-hour math as HrrrOverlay.tsx.
 * fh00 is the model analysis hour — often already in the past / empty.
 */
export function hrrrForecastHour(
  manifest: { run_date: string; run_hour: string },
  selectedForecastHour: number,
  nowOffsetHours: number,
  nowMs = Date.now(),
): number {
  const runTime = new Date(
    `${manifest.run_date.slice(0, 4)}-${manifest.run_date.slice(4, 6)}-${manifest.run_date.slice(6, 8)}T${manifest.run_hour}:00:00Z`,
  )
  const runAge = (nowMs - runTime.getTime()) / 3600000
  return Math.round(runAge + (selectedForecastHour - nowOffsetHours))
}

export async function hrrrLightningFallbackUrl(
  selectedForecastHour: number,
  hourly: ReadonlyArray<{ time: string }>,
  nowMs = Date.now(),
): Promise<string | null> {
  const { fetchHrrrManifest, hrrrTileUrl } = await import('./layerUrls')
  const manifest = await fetchHrrrManifest()
  if (!manifest) return null
  const nowOffset = hrrrNowOffsetHours(hourly, nowMs)
  const fh = hrrrForecastHour(manifest, selectedForecastHour, nowOffset, nowMs)
  const available = manifest.variables?.lightning ?? manifest.forecast_hours ?? []
  if (fh < 0 || fh > 18 || (available.length > 0 && !available.includes(fh))) return null
  return hrrrTileUrl('lightning', manifest.run_date, manifest.run_hour, fh)
}

export function hasRealEarthWatermarkHeader(headers: { get(name: string): string | null }): boolean {
  return !!(
    headers.get('RE-Watermark')
    || headers.get('RE-Watemark')
    || headers.get('re-watermark')
  )
}

/** Opaque near-black field = RealEarth error/watermark tile, not GLM FED. */
export function rgbaLooksLikeWatermark(rgba: ArrayLike<number>, width: number, height: number): boolean {
  const n = width * height
  if (n <= 0) return false
  let opaqueBlack = 0
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] > 200 && rgba[i] < 30 && rgba[i + 1] < 30 && rgba[i + 2] < 30) opaqueBlack++
  }
  return opaqueBlack / n > 0.55
}

export function usesGibsGlm(url: string): boolean {
  return url.includes('GOES-East_GLM_Flash_Extent_Density') || url.includes('gibs.earthdata.nasa.gov')
}

export function usesIemGlmErrorTiles(url: string): boolean {
  return url.includes('goes_east_glm_l2_flashagg')
}
