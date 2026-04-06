/**
 * URL builders for all map data layers.
 *
 * Sources:
 *  - NASA GIBS WMS: https://gibs.earthdata.nasa.gov
 *  - NOAA ERDDAP: https://coastwatch.noaa.gov (removed — EPSG:4326 only)
 *  - GEBCO WMS: https://www.gebco.net
 *  - NOAA Nautical Charts: https://gis.charttools.noaa.gov
 *  - OpenSeaMap XYZ: https://tiles.openseamap.org
 *  - Esri World Imagery XYZ: https://server.arcgisonline.com
 */

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi'
// CoastWatch ERDDAP removed — only supports EPSG:4326, incompatible with MapLibre tiles
// AOML ERDDAP removed — only supports EPSG:4326 and proxy only works in Vite dev
// GEBCO WMS replaced by Esri Ocean Base XYZ tiles + GEBCO contour XYZ tiles
const NOAA_CHARTS_WMS =
  'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/exts/MaritimeChartService/WMSServer'

/**
 * Build WMS query string for a 256-px tile.
 *
 * IMPORTANT: Do NOT use URLSearchParams here — it percent-encodes curly
 * braces, turning `{bbox-epsg-3857}` into `%7Bbbox-epsg-3857%7D` which
 * MapLibre GL cannot find and substitute.  Build the string manually and
 * append BBOX as a raw literal at the end.
 */
function wmsParams(params: Record<string, string>): string {
  const base: Record<string, string> = {
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    CRS: 'EPSG:3857',
    WIDTH: '256',
    HEIGHT: '256',
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
  }
  const merged = { ...base, ...params }
  const qs = Object.entries(merged)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  // BBOX must be a raw MapLibre placeholder — never percent-encoded
  return `${qs}&BBOX={bbox-epsg-3857}`
}

// ---------------------------------------------------------------------------
// NASA GIBS — free, no API key, WMS
// ---------------------------------------------------------------------------

/** MUR Sea Surface Temperature — 1 km, daily, global */
export function sstMurUrl(date: string): string {
  return `${GIBS_WMS}?${wmsParams({
    LAYERS: 'GHRSST_L4_MUR_Sea_Surface_Temperature',
    TIME: date,
  })}`
}

/** MUR SST Anomaly — deviation from climatological mean */
export function sstAnomalyUrl(date: string): string {
  return `${GIBS_WMS}?${wmsParams({
    LAYERS: 'GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies',
    TIME: date,
  })}`
}

/** VIIRS Suomi-NPP True Color corrected reflectance — 250 m, daily */
export function trueColorViirsSNPPUrl(date: string): string {
  return `${GIBS_WMS}?${wmsParams({
    LAYERS: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    FORMAT: 'image/jpeg',
    TIME: date,
  })}`
}

/** VIIRS NOAA-20 True Color corrected reflectance — 250 m, daily */
export function trueColorViirs20Url(date: string): string {
  return `${GIBS_WMS}?${wmsParams({
    LAYERS: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
    FORMAT: 'image/jpeg',
    TIME: date,
  })}`
}

/** MODIS Aqua True Color — 250 m, daily */
export function trueColorModisAquaUrl(date: string): string {
  return `${GIBS_WMS}?${wmsParams({
    LAYERS: 'MODIS_Aqua_CorrectedReflectance_TrueColor',
    FORMAT: 'image/jpeg',
    TIME: date,
  })}`
}

/** VIIRS NOAA-20 Chlorophyll-a — 1 km, daily */
export function chlorophyllUrl(date: string): string {
  return `${GIBS_WMS}?${wmsParams({
    LAYERS: 'VIIRS_NOAA20_Chlorophyll_a',
    TIME: date,
  })}`
}

/** Build 7-day chlorophyll composite tile URLs (one per day, blended on map) */
export function chlorophyll7DayUrls(endDate: string): string[] {
  const urls: string[] = []
  const end = new Date(endDate)
  for (let i = 0; i < 7; i++) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    urls.push(`${GIBS_WMS}?${wmsParams({
      LAYERS: 'VIIRS_NOAA20_Chlorophyll_a',
      TIME: dateStr,
    })}`)
  }
  return urls
}

/** SMAP Sea Surface Salinity — 40 km, 8-day running mean */
export function salinityUrl(date: string): string {
  // SMAP salinity data typically lags 1-2 months. If the requested date is
  // too recent, fall back to 2 months prior to avoid blank tiles.
  const requested = new Date(date)
  const twoMonthsAgo = new Date()
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
  const effectiveDate = requested > twoMonthsAgo
    ? twoMonthsAgo.toISOString().split('T')[0]
    : date
  return `${GIBS_WMS}?${wmsParams({
    LAYERS: 'SMAP_L3_Sea_Surface_Salinity_CAP_8Day_RunningMean',
    TIME: effectiveDate,
  })}`
}

/** NOAA nowCOAST RTOFS Surface Currents via HRRR tile API (smoothed).
 *  Uses the smooth:// protocol for Gaussian blur on the low-res data. */
export function currentsUrl(_date: string): string[] {
  const base = 'smooth://nowcoast.noaa.gov/geoserver/grtofs/wms'
  const params = [
    'SERVICE=WMS', 'VERSION=1.3.0', 'REQUEST=GetMap',
    'CRS=EPSG%3A3857', 'WIDTH=512', 'HEIGHT=512',
    'FORMAT=image%2Fpng', 'TRANSPARENT=TRUE',
    'LAYERS=rtofs_east_sfc_currents',
  ].join('&')
  return [`${base}?${params}&BBOX={bbox-epsg-3857}`]
}

/** NASA GIBS Sea Surface Height Anomalies — smoothed via smooth:// protocol. */
export function sshAnomalyUrl(_date: string): string {
  const base = GIBS_WMS.replace('https://', 'smooth://')
  return `${base}?${wmsParams({
    LAYERS: 'JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies',
    WIDTH: '512',
    HEIGHT: '512',
  })}`
}

/** Altimetry overlay — same SSH data but processed through contour:// protocol
 *  for diverging contour-banded visualization (blue=downwelling, red=upwelling). */
export function altimetryUrl(_date: string): string {
  const base = GIBS_WMS.replace('https://', 'contour://')
  return `${base}?${wmsParams({
    LAYERS: 'JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies',
    WIDTH: '512',
    HEIGHT: '512',
  })}`
}

// ---------------------------------------------------------------------------
// Sargassum / Weedline Detection (NOAA AOML / USF AFAI)
// ---------------------------------------------------------------------------

/** Sargassum AFAI 7-day composite — floating algae detection from MODIS/VIIRS.
 *  Proxied through our tile Lambda which reprojects BBOX from 3857→4326.
 *  Covers Gulf of Mexico, Caribbean, and tropical Atlantic (0-38N, 98W-38W). */
export function sargassumUrl(_date: string): string {
  const TILE_BASE = import.meta.env.VITE_HRRR_TILE_URL || 'https://xhac6pdww5.execute-api.us-east-2.amazonaws.com'
  return `${TILE_BASE}/tiles/sargassum/wms?BBOX={bbox-epsg-3857}`
}

// ---------------------------------------------------------------------------
// NASA GIBS — GOES-East geostationary SST
// ---------------------------------------------------------------------------

/** VIIRS SNPP SST Day — global, ~1 km, daily (replaces broken GOES SST) */
export function sstGoesUrl(date: string): string {
  return `${GIBS_WMS}?${wmsParams({
    LAYERS: 'VIIRS_SNPP_L2_Sea_Surface_Temp_Day',
    TIME: date,
  })}`
}

// ---------------------------------------------------------------------------
// Bathymetry
// ---------------------------------------------------------------------------

/** Esri World Ocean Base — beautiful blue gradient bathymetry with hillshade, z0-16 */
export function esriOceanBaseTiles(): string[] {
  return [
    'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
  ]
}

/** GEBCO Bathymetric Contour Lines — transparent overlay showing depth contours */
export function gebcoContourTiles(): string[] {
  return [
    'https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/GEBCO_contours/MapServer/tile/{z}/{y}/{x}',
  ]
}

/** NOAA Official Nautical Charts (US coastal waters) */
export function noaaChartsUrl(): string {
  return `${NOAA_CHARTS_WMS}?${wmsParams({
    LAYERS: '0,1,2,3,4,5,6,7',
    VERSION: '1.3.0',
  })}`
}

/** OpenSeaMap — XYZ tile overlay: buoys, lights, hazards, depths */
export function openSeaMapTiles(): string[] {
  return ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png']
}

// ---------------------------------------------------------------------------
// HRRR Precipitation Forecast Tiles (self-hosted)
// ---------------------------------------------------------------------------

const HRRR_TILE_BASE = import.meta.env.VITE_HRRR_TILE_URL || 'https://xhac6pdww5.execute-api.us-east-2.amazonaws.com'

/** Build a HRRR tile URL for any variable */
export function hrrrTileUrl(variable: string, runDate: string, runHour: string, fh: number): string {
  return `${HRRR_TILE_BASE}/tiles/hrrr/${variable}/${runDate}/${runHour}/fh${String(fh).padStart(2, '0')}/{z}/{x}/{y}.png`
}

/** Build a HRRR precipitation forecast tile URL (backward compat) */
export function hrrrPrecipUrl(runDate: string, runHour: string, fh: number): string {
  return `${HRRR_TILE_BASE}/tiles/hrrr/${runDate}/${runHour}/fh${String(fh).padStart(2, '0')}/{z}/{x}/{y}.png`
}

/** Fetch the HRRR latest manifest */
export async function fetchHrrrManifest(): Promise<{
  run_date: string
  run_hour: string
  forecast_hours: number[]
  variables?: Record<string, number[]>
} | null> {
  if (!HRRR_TILE_BASE) return null
  try {
    const res = await fetch(`${HRRR_TILE_BASE}/tiles/hrrr/latest.json`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// ---------------------------------------------------------------------------
// Base imagery
// ---------------------------------------------------------------------------

/** Esri World Imagery — high-res satellite (no key required for development) */
export function esriSatelliteTiles(): string[] {
  return [
    'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  ]
}

/** CARTO Dark Matter (with labels for city names) — vector style URL */
export const CARTO_DARK_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

/** CARTO Positron (light, with labels) — vector style URL */
export const CARTO_LIGHT_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

/** OpenFreeMap Liberty — free, no key, full vector style */
export const OPENFREEMAP_STYLE =
  'https://tiles.openfreemap.org/styles/liberty'

/** Map basemap ID → style URL */
export function basemapStyleUrl(id: string): string {
  switch (id) {
    case 'light':
      return CARTO_LIGHT_STYLE
    case 'dark':
    case 'satellite':
    case 'nautical':
    default:
      return CARTO_DARK_STYLE
  }
}

// ---------------------------------------------------------------------------
// Layer registry — metadata for each layer
// ---------------------------------------------------------------------------

export interface LayerDef {
  id: string
  name: string
  description: string
  group: 'satellite' | 'oceanography' | 'charts' | 'fishing'
  sourceType: 'raster-wms' | 'raster-xyz' | 'geojson'
  /** true = URL contains a date that must be substituted */
  dateDependent: boolean
  maxzoom?: number
  tileSize?: number
  attribution: string
}

export const LAYER_REGISTRY: LayerDef[] = [
  {
    id: 'sst-mur',
    name: 'Sea Surface Temp (SST)',
    description: 'NASA MUR — 1 km daily global SST. Shows water temperature breaks critical for finding fish.',
    group: 'satellite',
    sourceType: 'raster-wms',
    dateDependent: true,
    attribution: 'NASA JPL MUR SST via NASA GIBS',
  },
  {
    id: 'sst-anomaly',
    name: 'SST Anomaly',
    description: 'Temperature deviation from the long-term average. Positive = warmer than normal.',
    group: 'satellite',
    sourceType: 'raster-wms',
    dateDependent: true,
    attribution: 'NASA JPL MUR via NASA GIBS',
  },
  {
    id: 'true-color-viirs',
    name: 'True Color (VIIRS)',
    description: 'VIIRS NOAA-20 true color satellite imagery — 250 m, daily. Shows cloud cover, turbidity, and ocean color.',
    group: 'satellite',
    sourceType: 'raster-wms',
    dateDependent: true,
    attribution: 'VIIRS NOAA-20 via NASA GIBS',
  },
  {
    id: 'true-color-modis',
    name: 'True Color (MODIS)',
    description: 'MODIS Aqua true color composite — 250 m, daily. Alternative to VIIRS coverage.',
    group: 'satellite',
    sourceType: 'raster-wms',
    dateDependent: true,
    attribution: 'MODIS Aqua via NASA GIBS',
  },
  {
    id: 'chlorophyll',
    name: 'Chlorophyll-a',
    description: 'Phytoplankton / ocean color (VIIRS NOAA-20) — 1 km daily. High chlorophyll = productive water = baitfish = gamefish.',
    group: 'satellite',
    sourceType: 'raster-wms',
    dateDependent: true,
    attribution: 'VIIRS NOAA-20 via NASA GIBS',
  },
  {
    id: 'chlorophyll-7day',
    name: 'Chlorophyll 7-Day Avg',
    description: '7-day composite of chlorophyll-a — fills cloud gaps by stacking the last 7 daily satellite passes. Best for finding persistent productive water.',
    group: 'satellite',
    sourceType: 'raster-wms',
    dateDependent: true,
    attribution: 'VIIRS NOAA-20 via NASA GIBS (7-day composite)',
  },
  {
    id: 'salinity',
    name: 'Sea Surface Salinity',
    description: 'NASA SMAP salinity — 40 km, 8-day mean. Salinity fronts often align with temperature breaks.',
    group: 'satellite',
    sourceType: 'raster-wms',
    dateDependent: true,
    attribution: 'NASA SMAP via NASA GIBS',
  },
  {
    id: 'currents',
    name: 'Ocean Currents',
    description: 'NOAA RTOFS/HYCOM surface currents — high resolution (~8 km), real-time ocean forecast. Shows Loop Current, eddies, and drift patterns.',
    group: 'oceanography',
    sourceType: 'raster-wms',
    dateDependent: false,
    attribution: 'NOAA nowCOAST RTOFS/HYCOM',
  },
  {
    id: 'ssh-anomaly',
    name: 'Sea Surface Height',
    description: 'Sea surface height anomaly — positive = warm-core eddies (Loop Current), negative = cold-core eddies. Critical for finding the Gulf Stream edge.',
    group: 'oceanography',
    sourceType: 'raster-wms',
    dateDependent: false,
    attribution: 'JPL MEaSUREs via NASA GIBS',
  },
  {
    id: 'altimetry',
    name: 'Altimetry (Contour)',
    description: 'Satellite altimetry with contour bands — blue = downwelling (cold-core eddies), red = upwelling (warm-core eddies). Sharp bands highlight current edges and convergence zones.',
    group: 'oceanography',
    sourceType: 'raster-wms',
    dateDependent: false,
    attribution: 'JPL MEaSUREs via NASA GIBS',
  },
  {
    id: 'current-arrows',
    name: 'Current Arrows',
    description: 'Geostrophic current direction and speed arrows from OSCAR satellite altimetry. Shows where currents converge (bait concentration) and eddy boundaries.',
    group: 'oceanography',
    sourceType: 'geojson', // rendered via canvas overlay, not MapLibre layer
    dateDependent: false,
    attribution: 'NOAA OSCAR via ERDDAP',
  },
  {
    id: 'sst-goes',
    name: 'SST Daily (VIIRS)',
    description: 'VIIRS S-NPP sea surface temperature — daily daytime pass, ~1 km global coverage.',
    group: 'satellite',
    sourceType: 'raster-wms',
    dateDependent: true,
    attribution: 'NOAA GOES-East via NASA GIBS',
  },
  {
    id: 'bathymetry',
    name: 'Ocean Bathymetry',
    description: 'Esri World Ocean Base — color-shaded ocean depth with hillshade relief. High detail in US coastal waters.',
    group: 'charts',
    sourceType: 'raster-xyz',
    dateDependent: false,
    attribution: 'Esri, GEBCO, NOAA, National Geographic',
  },
  {
    id: 'bathymetry-contours',
    name: 'Depth Contours',
    description: 'GEBCO bathymetric contour lines — shows drop-offs, ledges, and depth breaks. Overlay on any basemap.',
    group: 'charts',
    sourceType: 'raster-xyz',
    dateDependent: false,
    attribution: 'GEBCO / NOAA NCEI',
  },
  {
    id: 'noaa-charts',
    name: 'NOAA Nautical Charts',
    description: 'Official NOAA raster nautical charts with depth soundings, hazards, and aids to navigation.',
    group: 'charts',
    sourceType: 'raster-wms',
    dateDependent: false,
    attribution: 'NOAA Office of Coast Survey',
  },
  {
    id: 'openseamap',
    name: 'OpenSeaMap',
    description: 'Community nautical overlay — buoys, lights, wrecks, hazards, and marine facilities.',
    group: 'charts',
    sourceType: 'raster-xyz',
    dateDependent: false,
    attribution: '© OpenSeaMap contributors',
  },
  {
    id: 'satellite-imagery',
    name: 'Satellite Imagery',
    description: 'Esri World Imagery — high-resolution basemap satellite photography.',
    group: 'charts',
    sourceType: 'raster-xyz',
    dateDependent: false,
    attribution: 'Esri, DigitalGlobe, GeoEye',
  },
  {
    id: 'hotspot',
    name: 'Fishing Hotspots (AI)',
    description: 'AI-scored fishing probability heat map. Composites SST temperature breaks, chlorophyll color breaks, bathymetric features, and ocean current edges. Updates every 6 hours.',
    group: 'fishing',
    sourceType: 'raster-xyz',
    dateDependent: true,
    attribution: 'ReelMaps — NOAA MUR SST, VIIRS Chlorophyll, GEBCO Bathymetry, AVISO SSH',
  },
  {
    id: 'hotspot-inshore',
    name: 'Inshore Hotspots',
    description: 'Fishing hotspots within 9 nautical miles of the coastline. Optimized for nearshore species like red snapper, king mackerel, cobia, and reef fish.',
    group: 'fishing',
    sourceType: 'raster-xyz',
    dateDependent: true,
    attribution: 'ReelMaps — Inshore (<9 NM)',
  },
  {
    id: 'hotspot-offshore',
    name: 'Offshore Hotspots',
    description: 'Fishing hotspots beyond 9 nautical miles from coastline. Optimized for pelagic species like tuna, marlin, mahi-mahi, wahoo, and swordfish.',
    group: 'fishing',
    sourceType: 'raster-xyz',
    dateDependent: true,
    attribution: 'ReelMaps — Offshore (>9 NM)',
  },
  {
    id: 'sargassum',
    name: 'Sargassum / Weedlines (7-day Avg)',
    description: 'Satellite-detected floating Sargassum seaweed from NOAA AFAI (Alternative Floating Algae Index). 7-day composite at ~1.5km resolution. Weedlines concentrate mahi-mahi, wahoo, tuna, and billfish along their edges. Gulf of Mexico, Caribbean, and tropical Atlantic.',
    group: 'fishing',
    sourceType: 'raster-wms',
    dateDependent: false,
    attribution: 'NOAA AOML / USF Optical Oceanography Lab',
  },
  {
    id: 'fishing-spots',
    name: 'Fishing Spots',
    description: 'Offshore fishing hotspots — reefs, wrecks, ledges, canyons, and more.',
    group: 'fishing',
    sourceType: 'geojson',
    dateDependent: false,
    attribution: 'ReelMaps community',
  },
]

/** Build the tile URL(s) for a given layer ID and date */
export function buildTileUrl(layerId: string, date: string): string[] {
  switch (layerId) {
    case 'sst-mur':
      return [sstMurUrl(date)]
    case 'sst-anomaly':
      return [sstAnomalyUrl(date)]
    case 'true-color-viirs':
      return [trueColorViirs20Url(date)]
    case 'true-color-modis':
      return [trueColorModisAquaUrl(date)]
    case 'chlorophyll':
      return [chlorophyllUrl(date)]
    case 'chlorophyll-7day':
      return chlorophyll7DayUrls(date)
    case 'salinity':
      return [salinityUrl(date)]
    case 'currents':
      return currentsUrl(date)
    case 'ssh-anomaly':
      return [sshAnomalyUrl(date)]
    case 'altimetry':
      return [altimetryUrl(date)]
    case 'sargassum':
      return [sargassumUrl(date)]
    case 'current-arrows':
      return [] // rendered via canvas overlay, not raster tiles
    case 'sst-goes':
      return [sstGoesUrl(date)]
    case 'bathymetry':
      return esriOceanBaseTiles()
    case 'bathymetry-contours':
      return gebcoContourTiles()
    case 'noaa-charts':
      return [noaaChartsUrl()]
    case 'openseamap':
      return openSeaMapTiles()
    case 'satellite-imagery':
      return esriSatelliteTiles()
    default:
      return []
  }
}
