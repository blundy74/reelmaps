/**
 * Live lightning (OVERLAYS chip id `lightning`) — RealEarth GOES-East GLM FED.
 * Live GLM is painted on the LightningOverlay <canvas> (DOM above SST).
 * The MapLibre glm-density-layer raster is HRRR fallback only — sparse FED
 * PNGs are invisible over opaque MUR when MapLibre composites raster-on-raster.
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

export const GLM_DENSITY_LAYER = 'glm-density-layer'
/** Native FED tile zoom cap — overzoom these rather than requesting empty z9+. */
export const GLM_FED_MAX_ZOOM = 8
export const GLM_FED_MAX_TILES = 64
const MERCATOR_MAX_LAT = 85.0511287798066

export type XyzTile = { z: number; x: number; y: number }

export type LonLatBounds = {
  west: number
  south: number
  east: number
  north: number
}

/** Same list RadarOverlay uses, plus FADs — stay above GLM after restack. */
export const GLM_SPOT_LAYER_IDS = [
  'clusters',
  'cluster-count',
  'fishing-spots',
  'fishing-spots-rigs',
  'fishing-spots-fads',
  'fishing-spots-labels',
] as const

/** Imagery rasters that must stay under live GLM FED. */
export const GLM_IMAGERY_BELOW_IDS = [
  'sst-mur',
  'sst-goes',
  'chlorophyll',
  'true-color-viirs',
  'sargassum',
  'satellite-imagery',
] as const

export function chlorophyll7DaySubIds(days = 7): string[] {
  return Array.from({ length: days }, (_, d) => `chlorophyll-7day-d${d}`)
}

export function layersThatMustStayBelowGlm(): string[] {
  return [...GLM_IMAGERY_BELOW_IDS, ...chlorophyll7DaySubIds()]
}

type LayerStackMap = {
  getLayer(id: string): unknown
  moveLayer(id: string, beforeId?: string): void
}

/**
 * Put the MapLibre lightning raster (HRRR fallback) on top of imagery, then
 * fishing-spot layers above it. Live GLM FED is a DOM canvas, not this layer.
 */
export function restackGlmAboveImagery(map: LayerStackMap): void {
  if (!map.getLayer(GLM_DENSITY_LAYER)) return
  map.moveLayer(GLM_DENSITY_LAYER)
  for (const id of GLM_SPOT_LAYER_IDS) {
    if (map.getLayer(id)) map.moveLayer(id)
  }
}

/**
 * Insert new imagery rasters under live GLM so SST rebuilds cannot land on top.
 * MapLibre addLayer without beforeId always appends — that is the UA 14 bury.
 */
export function glmImageryBeforeId(map: { getLayer(id: string): unknown }): string | undefined {
  return map.getLayer(GLM_DENSITY_LAYER) ? GLM_DENSITY_LAYER : undefined
}

/** Spot layers FishingMap.syncLayers lifts after imagery add/rebuild. */
export const FISHING_MAP_SYNC_SPOT_IDS = [
  'clusters',
  'cluster-count',
  'fishing-spots',
  'fishing-spots-rigs',
  'fishing-spots-fads',
  'fishing-spots-labels',
  'user-clusters',
  'user-cluster-count',
  'user-spots',
  'user-spots-labels',
] as const

/**
 * End of FishingMap.syncLayers: spots to the top, then the MapLibre lightning
 * raster (HRRR) above imagery and spots above that raster.
 */
export function restackAfterFishingMapSync(map: LayerStackMap): void {
  for (const id of FISHING_MAP_SYNC_SPOT_IDS) {
    if (map.getLayer(id)) map.moveLayer(id)
  }
  restackGlmAboveImagery(map)
}

/** Hide MapLibre GLM raster while the canvas overlay is the live product. */
export function hideGlmDensityRaster(map: {
  getLayer(id: string): unknown
  setLayoutProperty(id: string, key: string, value: unknown): void
}): void {
  if (!map.getLayer(GLM_DENSITY_LAYER)) return
  map.setLayoutProperty(GLM_DENSITY_LAYER, 'visibility', 'none')
}

export function clampMercatorLat(lat: number): number {
  return Math.min(MERCATOR_MAX_LAT, Math.max(-MERCATOR_MAX_LAT, lat))
}

export function lonToTileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * 2 ** z
}

export function latToTileY(lat: number, z: number): number {
  const latRad = clampMercatorLat(lat) * Math.PI / 180
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * 2 ** z
}

export function tileXToLon(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180
}

export function tileYToLat(y: number, z: number): number {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI
}

function mercatorY(lat: number): number {
  const latRad = clampMercatorLat(lat) * Math.PI / 180
  return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2
}

function mercatorYToLat(y: number): number {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI
}

/** Axis-aligned WebMercator bounds for a camera + CSS viewport size. */
export function viewportBounds(
  center: { lat: number; lon: number },
  zoom: number,
  widthPx: number,
  heightPx: number,
): LonLatBounds {
  const world = 256 * 2 ** zoom
  const lngSpan = (widthPx / world) * 360
  const mercSpan = heightPx / world
  const cy = mercatorY(center.lat)
  return {
    west: center.lon - lngSpan / 2,
    east: center.lon + lngSpan / 2,
    north: mercatorYToLat(cy - mercSpan / 2),
    south: mercatorYToLat(cy + mercSpan / 2),
  }
}

/**
 * Integer XYZ zoom that covers the map. ceil so z≈6.4 uses z=7 FED tiles
 * (the live RealEarth cells for the Gulf UA 15 screenshot).
 */
export function coveringTileZoom(
  mapZoom: number,
  minZ = 0,
  maxZ = GLM_FED_MAX_ZOOM,
): number {
  if (!Number.isFinite(mapZoom)) return minZ
  return Math.max(minZ, Math.min(maxZ, Math.ceil(mapZoom - 1e-9)))
}

function wrappedTileXs(west: number, east: number, z: number): number[] {
  const n = 2 ** z
  const xStart = Math.floor(lonToTileX(west, z))
  const xEnd = Math.floor(lonToTileX(east, z))
  const xs: number[] = []
  const seen = new Set<number>()
  const push = (x: number) => {
    const wrapped = ((x % n) + n) % n
    if (seen.has(wrapped)) return
    seen.add(wrapped)
    xs.push(wrapped)
  }
  if (west <= east) {
    for (let x = xStart; x <= xEnd; x++) push(x)
  } else {
    for (let x = xStart; x < n; x++) push(x)
    for (let x = 0; x <= xEnd; x++) push(x)
  }
  return xs
}

export function xyzTilesAtZoom(bounds: LonLatBounds, z: number): XyzTile[] {
  const n = 2 ** z
  const y0 = Math.max(0, Math.min(n - 1, Math.floor(latToTileY(bounds.north, z))))
  const y1 = Math.max(0, Math.min(n - 1, Math.floor(latToTileY(bounds.south, z))))
  const yMin = Math.min(y0, y1)
  const yMax = Math.max(y0, y1)
  const tiles: XyzTile[] = []
  for (const x of wrappedTileXs(bounds.west, bounds.east, z)) {
    for (let y = yMin; y <= yMax; y++) tiles.push({ z, x, y })
  }
  return tiles
}

/** Visible OSM XYZ tiles for map bounds + covering zoom. */
export function visibleXyzTiles(
  bounds: LonLatBounds,
  mapZoom: number,
  opts?: { minZ?: number; maxZ?: number; maxTiles?: number },
): XyzTile[] {
  const minZ = opts?.minZ ?? 0
  const maxZ = opts?.maxZ ?? GLM_FED_MAX_ZOOM
  const maxTiles = opts?.maxTiles ?? GLM_FED_MAX_TILES
  let z = coveringTileZoom(mapZoom, minZ, maxZ)
  while (z > minZ) {
    const tiles = xyzTilesAtZoom(bounds, z)
    if (tiles.length <= maxTiles) return tiles
    z -= 1
  }
  return xyzTilesAtZoom(bounds, minZ).slice(0, maxTiles)
}

export function tileCacheKey(bust: number | string, tile: XyzTile): string {
  return `${bust}/${tile.z}/${tile.x}/${tile.y}`
}

/** Screen-axis rect from projecting the tile's NW / SE lon-lat. */
export function tileScreenRect(
  tile: XyzTile,
  project: (lngLat: [number, number]) => { x: number; y: number },
): { x: number; y: number; w: number; h: number } {
  const west = tileXToLon(tile.x, tile.z)
  const east = tileXToLon(tile.x + 1, tile.z)
  const north = tileYToLat(tile.y, tile.z)
  const south = tileYToLat(tile.y + 1, tile.z)
  const nw = project([west, north])
  const se = project([east, south])
  return { x: nw.x, y: nw.y, w: se.x - nw.x, h: se.y - nw.y }
}

/** Vite same-origin proxy on :5173; production uses native https:// like Radar. */
export function realEarthGlmFedUrl(cacheBust: number | string = glmTileCacheBust()): string {
  const path = `tiles/${REALEARTH_GLM_FED_LAYER}/{z}/{x}/{y}.png?t=${cacheBust}`
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `/proxy/realearth/${path}`
  }
  return realEarthGlmHttpsUrl(cacheBust)
}

export function realEarthGlmHttpsUrl(cacheBust: number | string = glmTileCacheBust()): string {
  return `${REALEARTH_GLM_FED_BASE}/{z}/{x}/{y}.png?t=${cacheBust}`
}

/** Concrete RealEarth FED tile (same Vite-vs-https rule as the template). */
export function realEarthGlmTileUrl(
  z: number,
  x: number,
  y: number,
  cacheBust: number | string = glmTileCacheBust(),
): string {
  return realEarthGlmFedUrl(cacheBust)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
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
