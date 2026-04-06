/**
 * HRRR Tile Lambda — serves precipitation forecast tiles as PNG.
 *
 * Reads pre-processed uint8 grids from S3, extracts the tile's bounding box,
 * bilinear interpolates to 256x256, applies a precipitation color ramp,
 * and returns a PNG image.
 *
 * URL: GET /tiles/hrrr/{run_date}/{run_hour}/fh{FH}/{z}/{x}/{y}.png
 * Also: GET /tiles/hrrr/latest.json (proxy to S3 manifest)
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3')
const { PNG } = require('pngjs')
const zlib = require('zlib')

const BUCKET = process.env.HRRR_BUCKET || 'reelmaps-hrrr'
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-2' })

// ── Grid cache (persists across warm Lambda invocations) ────────────────────

const gridCache = new Map() // key: "date/hour/fh" → { data, meta }
const MAX_CACHE = 25

// ── Precipitation color ramp (uint8 → RGBA) ────────────────────────────────

const COLOR_RAMP = new Uint8Array(256 * 4) // 256 entries × 4 bytes (RGBA)

function buildColorRamp() {
  // Standard NWS/AccuWeather-style radar color scale.
  // 0 = transparent (no precip, below 0.25 mm/h threshold)
  COLOR_RAMP[0] = 0; COLOR_RAMP[1] = 0; COLOR_RAMP[2] = 0; COLOR_RAMP[3] = 0

  for (let i = 1; i <= 255; i++) {
    let r, g, b, a
    if (i <= 30) {
      // Light rain (0.25-1 mm/h): dark green → green
      const t = i / 30
      r = 0; g = Math.round(100 + t * 100); b = 0; a = Math.round(80 + t * 60)
    } else if (i <= 70) {
      // Light-moderate (1-3 mm/h): green → yellow
      const t = (i - 30) / 40
      r = Math.round(t * 255); g = Math.round(200 + t * 55); b = 0; a = 150
    } else if (i <= 110) {
      // Moderate (3-7 mm/h): yellow → dark yellow/orange
      const t = (i - 70) / 40
      r = 255; g = Math.round(255 - t * 100); b = 0; a = 165
    } else if (i <= 150) {
      // Moderate-heavy (7-15 mm/h): orange → red-orange
      const t = (i - 110) / 40
      r = 255; g = Math.round(155 - t * 100); b = 0; a = 175
    } else if (i <= 190) {
      // Heavy (15-30 mm/h): red
      const t = (i - 150) / 40
      r = 255; g = Math.round(55 - t * 55); b = 0; a = 185
    } else if (i <= 230) {
      // Very heavy (30-60 mm/h): dark red → magenta
      const t = (i - 190) / 40
      r = Math.round(255 - t * 50); g = 0; b = Math.round(t * 150); a = 195
    } else {
      // Extreme (60+ mm/h): magenta → pink
      const t = (i - 230) / 25
      r = Math.round(205 + t * 50); g = Math.round(t * 100); b = Math.round(150 + t * 80); a = 200
    }
    const off = i * 4
    COLOR_RAMP[off] = r
    COLOR_RAMP[off + 1] = g
    COLOR_RAMP[off + 2] = b
    COLOR_RAMP[off + 3] = a
  }
}
buildColorRamp()

// ── Wind speed color ramp (linear 0-40 m/s → 0-255) ────────────────────────
const WIND_RAMP = new Uint8Array(256 * 4)
function buildWindRamp() {
  WIND_RAMP[0] = 0; WIND_RAMP[1] = 0; WIND_RAMP[2] = 0; WIND_RAMP[3] = 0
  for (let i = 1; i <= 255; i++) {
    let r, g, b, a
    const ms = (i / 255) * 40  // 0-40 m/s
    const kt = ms * 1.94384
    if (kt <= 5) { r = 100; g = 180; b = 230; a = Math.round(60 + (kt/5)*50) }        // Light blue
    else if (kt <= 10) { const t=(kt-5)/5; r = Math.round(100-30*t); g = Math.round(180+40*t); b = Math.round(230-160*t); a = 130 } // → Green
    else if (kt <= 15) { const t=(kt-10)/5; r = Math.round(70+185*t); g = Math.round(220+35*t); b = Math.round(70-70*t); a = 150 } // → Yellow
    else if (kt <= 20) { const t=(kt-15)/5; r = 255; g = Math.round(255-100*t); b = 0; a = 165 }  // → Orange
    else if (kt <= 30) { const t=(kt-20)/10; r = 255; g = Math.round(155-155*t); b = 0; a = 180 } // → Red
    else if (kt <= 45) { const t=(kt-30)/15; r = Math.round(255-60*t); g = 0; b = Math.round(t*180); a = 195 } // → Magenta
    else { r = 200; g = 50; b = 200; a = 210 } // Purple
    const off = i * 4
    WIND_RAMP[off]=r; WIND_RAMP[off+1]=g; WIND_RAMP[off+2]=b; WIND_RAMP[off+3]=a
  }
}
buildWindRamp()

// ── Gust color ramp (linear 0-50 m/s → 0-255) ─────────────────────────────
const GUST_RAMP = new Uint8Array(256 * 4)
function buildGustRamp() {
  GUST_RAMP[0] = 0; GUST_RAMP[1] = 0; GUST_RAMP[2] = 0; GUST_RAMP[3] = 0
  for (let i = 1; i <= 255; i++) {
    let r, g, b, a
    const ms = (i / 255) * 50
    const kt = ms * 1.94384
    if (kt <= 15) { r = 0; g = 180; b = 0; a = Math.round(50 + (kt/15)*80) }
    else if (kt <= 20) { const t=(kt-15)/5; r=Math.round(255*t); g=Math.round(180+75*t); b=0; a=140 }
    else if (kt <= 25) { const t=(kt-20)/5; r=255; g=Math.round(255-100*t); b=0; a=160 }
    else if (kt <= 30) { const t=(kt-25)/5; r=255; g=Math.round(155-155*t); b=0; a=175 }
    else if (kt <= 40) { const t=(kt-30)/10; r=255; g=0; b=Math.round(t*100); a=190 }
    else { r=220; g=0; b=150; a=200 }
    const off = i * 4
    GUST_RAMP[off]=r; GUST_RAMP[off+1]=g; GUST_RAMP[off+2]=b; GUST_RAMP[off+3]=a
  }
}
buildGustRamp()

// ── Visibility color ramp (inverted: high value = low vis = strong color) ──
const VIS_RAMP = new Uint8Array(256 * 4)
function buildVisRamp() {
  VIS_RAMP[0] = 0; VIS_RAMP[1] = 0; VIS_RAMP[2] = 0; VIS_RAMP[3] = 0
  for (let i = 1; i <= 255; i++) {
    let r, g, b, a
    // i=255 means 0mi vis (densest fog), i=1 means ~10mi vis
    const fogIntensity = i / 255
    if (fogIntensity <= 0.3) { r=200; g=200; b=150; a=Math.round(40+fogIntensity/0.3*60) } // Light haze (yellow-gray)
    else if (fogIntensity <= 0.5) { const t=(fogIntensity-0.3)/0.2; r=Math.round(200+55*t); g=Math.round(200-80*t); b=Math.round(150-150*t); a=Math.round(100+t*40) } // → Orange
    else if (fogIntensity <= 0.7) { const t=(fogIntensity-0.5)/0.2; r=255; g=Math.round(120-120*t); b=0; a=Math.round(140+t*30) } // → Red
    else { const t=(fogIntensity-0.7)/0.3; r=Math.round(255-80*t); g=0; b=Math.round(t*100); a=Math.round(170+t*30) } // → Dark red/purple
    const off = i * 4
    VIS_RAMP[off]=r; VIS_RAMP[off+1]=g; VIS_RAMP[off+2]=b; VIS_RAMP[off+3]=a
  }
}
buildVisRamp()

// ── Lightning color ramp (0=no threat, 255=extreme) ────────────────────────
const LIGHTNING_RAMP = new Uint8Array(256 * 4)
function buildLightningRamp() {
  LIGHTNING_RAMP[0] = 0; LIGHTNING_RAMP[1] = 0; LIGHTNING_RAMP[2] = 0; LIGHTNING_RAMP[3] = 0
  for (let i = 1; i <= 255; i++) {
    let r, g, b, a
    const t = i / 255
    if (t <= 0.2) { r=255; g=255; b=100; a=Math.round(40+t/0.2*80) }         // Faint yellow
    else if (t <= 0.5) { const s=(t-0.2)/0.3; r=255; g=Math.round(255-80*s); b=Math.round(100-100*s); a=Math.round(120+s*50) } // → Orange
    else if (t <= 0.8) { const s=(t-0.5)/0.3; r=255; g=Math.round(175-175*s); b=0; a=Math.round(170+s*30) } // → Red
    else { const s=(t-0.8)/0.2; r=255; g=0; b=Math.round(s*200); a=Math.round(200+s*30) } // → Magenta
    const off = i * 4
    LIGHTNING_RAMP[off]=r; LIGHTNING_RAMP[off+1]=g; LIGHTNING_RAMP[off+2]=b; LIGHTNING_RAMP[off+3]=a
  }
}
buildLightningRamp()

// ── Cloud cover ramp (0=clear, 255=overcast) ───────────────────────────────
const CLOUD_RAMP = new Uint8Array(256 * 4)
function buildCloudRamp() {
  CLOUD_RAMP[0] = 0; CLOUD_RAMP[1] = 0; CLOUD_RAMP[2] = 0; CLOUD_RAMP[3] = 0
  for (let i = 1; i <= 255; i++) {
    // White/gray with increasing opacity
    const coverage = i / 255
    const brightness = 220 + Math.round(coverage * 35) // 220-255 (light gray to white)
    const alpha = Math.round(coverage * 140) // 0-140 (semi-transparent)
    const off = i * 4
    CLOUD_RAMP[off] = brightness
    CLOUD_RAMP[off + 1] = brightness
    CLOUD_RAMP[off + 2] = brightness
    CLOUD_RAMP[off + 3] = alpha
  }
}
buildCloudRamp()

// ── Wave height color ramp (0=calm, 255=10ft+) ────────────────────────────
// Aggressive blue darkening: 1ft=light blue, 5ft=dark navy, 10ft+=near black
const WAVE_RAMP = new Uint8Array(256 * 4)
function buildWaveRamp() {
  WAVE_RAMP[0] = 0; WAVE_RAMP[1] = 0; WAVE_RAMP[2] = 0; WAVE_RAMP[3] = 0
  for (let i = 1; i <= 255; i++) {
    // i maps to 0-5m wave height (0-255 → 0-5m)
    // 1ft=0.3m→15, 2ft=0.6m→31, 3ft=0.9m→46, 4ft=1.2m→61, 5ft=1.5m→77
    const meters = (i / 255) * 5.0
    const feet = meters * 3.28084
    let r, g, b, a

    if (feet <= 1) {
      // Very light blue (calm)
      const t = feet
      r = Math.round(120 - t * 30); g = Math.round(200 - t * 30); b = Math.round(230 - t * 15); a = Math.round(50 + t * 80)
    } else if (feet <= 2) {
      const t = (feet - 1)
      r = Math.round(90 - t * 45); g = Math.round(170 - t * 50); b = Math.round(215 - t * 30); a = Math.round(130 + t * 20)
    } else if (feet <= 3) {
      const t = (feet - 2)
      r = Math.round(45 - t * 25); g = Math.round(120 - t * 45); b = Math.round(185 - t * 30); a = Math.round(150 + t * 15)
    } else if (feet <= 4) {
      const t = (feet - 3)
      r = Math.round(20 - t * 14); g = Math.round(75 - t * 35); b = Math.round(155 - t * 35); a = Math.round(165 + t * 10)
    } else if (feet <= 5) {
      const t = (feet - 4)
      r = Math.round(6 - t * 4); g = Math.round(40 - t * 25); b = Math.round(120 - t * 40); a = Math.round(175 + t * 10)
    } else if (feet <= 8) {
      // Dark navy to near-black (gradual above 5ft)
      const t = (feet - 5) / 3
      r = Math.round(2 - t * 2); g = Math.round(15 - t * 10); b = Math.round(80 - t * 35); a = Math.round(185 + t * 10)
    } else {
      // 8ft+ near black
      r = 0; g = Math.round(5); b = Math.round(40); a = 200
    }

    const off = i * 4
    WAVE_RAMP[off] = Math.max(0, r)
    WAVE_RAMP[off + 1] = Math.max(0, g)
    WAVE_RAMP[off + 2] = Math.max(0, b)
    WAVE_RAMP[off + 3] = Math.max(0, a)
  }
}
buildWaveRamp()

// ── Fishing hotspot color ramp (0=none, 255=highest probability) ──────────
// Cool blue → teal → green → yellow → orange → red → magenta/white
const HOTSPOT_RAMP = new Uint8Array(256 * 4)
function buildHotspotRamp() {
  HOTSPOT_RAMP[0] = 0; HOTSPOT_RAMP[1] = 0; HOTSPOT_RAMP[2] = 0; HOTSPOT_RAMP[3] = 0
  for (let i = 1; i <= 255; i++) {
    const t = i / 255
    let r, g, b, a
    if (t < 0.15) {
      // Very low: transparent blue hint
      const s = t / 0.15
      r = 10; g = Math.round(30 + s * 60); b = Math.round(80 + s * 80); a = Math.round(30 + s * 50)
    } else if (t < 0.30) {
      // Low: blue to teal
      const s = (t - 0.15) / 0.15
      r = Math.round(10 + s * 10); g = Math.round(90 + s * 80); b = Math.round(160 - s * 30); a = Math.round(80 + s * 30)
    } else if (t < 0.50) {
      // Medium: teal to green-yellow
      const s = (t - 0.30) / 0.20
      r = Math.round(20 + s * 180); g = Math.round(170 + s * 60); b = Math.round(130 - s * 100); a = Math.round(110 + s * 30)
    } else if (t < 0.70) {
      // High: yellow to orange
      const s = (t - 0.50) / 0.20
      r = Math.round(200 + s * 55); g = Math.round(230 - s * 100); b = Math.round(30 - s * 20); a = Math.round(140 + s * 30)
    } else if (t < 0.85) {
      // Very high: orange to red
      const s = (t - 0.70) / 0.15
      r = 255; g = Math.round(130 - s * 100); b = Math.round(10 + s * 20); a = Math.round(170 + s * 30)
    } else {
      // Extreme: red to bright magenta
      const s = (t - 0.85) / 0.15
      r = 255; g = Math.round(30 + s * 40); b = Math.round(30 + s * 160); a = Math.round(200 + s * 40)
    }
    const off = i * 4
    HOTSPOT_RAMP[off] = Math.min(255, Math.max(0, r))
    HOTSPOT_RAMP[off + 1] = Math.min(255, Math.max(0, g))
    HOTSPOT_RAMP[off + 2] = Math.min(255, Math.max(0, b))
    HOTSPOT_RAMP[off + 3] = Math.min(255, Math.max(0, a))
  }
}
buildHotspotRamp()

// ── Sargassum / Weedline color ramp (0=none, 255=dense sargassum) ─────────
// Dark teal → green → yellow → orange → red
const SARGASSUM_RAMP = new Uint8Array(256 * 4)
function buildSargassumRamp() {
  SARGASSUM_RAMP[0] = 0; SARGASSUM_RAMP[1] = 0; SARGASSUM_RAMP[2] = 0; SARGASSUM_RAMP[3] = 0
  for (let i = 1; i <= 255; i++) {
    const t = i / 255
    let r, g, b, a
    if (t < 0.1) {
      r = 38; g = 70; b = 83; a = Math.round(t * 10 * 180)
    } else if (t < 0.3) {
      const s = (t - 0.1) / 0.2
      r = Math.round(38 + s * 4); g = Math.round(70 + s * 87); b = Math.round(83 + s * 60); a = 200
    } else if (t < 0.5) {
      const s = (t - 0.3) / 0.2
      r = Math.round(42 + s * 191); g = Math.round(157 + s * 39); b = Math.round(143 - s * 37); a = 220
    } else if (t < 0.7) {
      const s = (t - 0.5) / 0.2
      r = Math.round(233 + s * 11); g = Math.round(196 - s * 34); b = Math.round(106 - s * 9); a = 235
    } else {
      const s = (t - 0.7) / 0.3
      r = Math.round(244 - s * 13); g = Math.round(162 - s * 50); b = Math.round(97 - s * 16); a = 250
    }
    const off = i * 4
    SARGASSUM_RAMP[off] = r; SARGASSUM_RAMP[off + 1] = g; SARGASSUM_RAMP[off + 2] = b; SARGASSUM_RAMP[off + 3] = a
  }
}
buildSargassumRamp()

// Map variable name to its color ramp
const RAMPS = {
  precip: COLOR_RAMP,
  wind: WIND_RAMP,
  gust: GUST_RAMP,
  vis: VIS_RAMP,
  lightning: LIGHTNING_RAMP,
  cloud: CLOUD_RAMP,
  waves: WAVE_RAMP,
  hotspot: HOTSPOT_RAMP,
  sargassum: SARGASSUM_RAMP,
}

// ── Web Mercator math ───────────────────────────────────────────────────────

function tileBbox(z, x, y) {
  const n = Math.pow(2, z)
  const lngMin = (x / n) * 360 - 180
  const lngMax = ((x + 1) / n) * 360 - 180
  const latMaxRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
  const latMinRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)))
  return {
    latMin: latMinRad * 180 / Math.PI,
    latMax: latMaxRad * 180 / Math.PI,
    lngMin,
    lngMax,
  }
}

// ── Grid loading from S3 ────────────────────────────────────────────────────

async function loadGrid(variable, runDate, runHour, fh) {
  const cacheKey = `${variable}/${runDate}/${runHour}/fh${String(fh).padStart(2, '0')}`
  if (gridCache.has(cacheKey)) return gridCache.get(cacheKey)

  // Try variable-specific path first, fall back to legacy path (precip only)
  const s3Key = variable === 'precip'
    ? `grids/${runDate}/${runHour}/fh${String(fh).padStart(2, '0')}.bin.gz`
    : `grids/${variable}/${runDate}/${runHour}/fh${String(fh).padStart(2, '0')}.bin.gz`

  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }))
    const compressed = await resp.Body.transformToByteArray()
    const raw = zlib.gunzipSync(Buffer.from(compressed))
    const meta = resp.Metadata || {}

    const grid = {
      data: new Uint8Array(raw),
      latMin: parseFloat(meta.lat_min || '20'),
      latMax: parseFloat(meta.lat_max || '55'),
      lngMin: parseFloat(meta.lng_min || '-130'),
      lngMax: parseFloat(meta.lng_max || '-60'),
      latCount: parseInt(meta.lat_count || '1167', 10),
      lngCount: parseInt(meta.lng_count || '2334', 10),
    }

    // Evict oldest if cache is full
    if (gridCache.size >= MAX_CACHE) {
      const oldest = gridCache.keys().next().value
      gridCache.delete(oldest)
    }
    gridCache.set(cacheKey, grid)
    return grid
  } catch (e) {
    console.error(`Failed to load grid ${s3Key}:`, e.message)
    return null
  }
}

// ── Hotspot grid loading from S3 ───────────────────────────────────────────

async function loadHotspotGrid(date, gridType = 'hotspot') {
  // Today → latest run; past dates → daily average
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const variant = (date === today) ? 'latest' : 'daily'
  const cacheKey = `${gridType}/${date}/${variant}`
  if (gridCache.has(cacheKey)) return gridCache.get(cacheKey)

  // Try the preferred variant first, fall back to the other
  const s3Key = `grids/${gridType}/${date}/${variant}.bin.gz`
  const fallbackKey = `grids/${gridType}/${date}/${variant === 'latest' ? 'daily' : 'latest'}.bin.gz`
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }))
    const compressed = await resp.Body.transformToByteArray()
    const raw = zlib.gunzipSync(Buffer.from(compressed))
    const meta = resp.Metadata || {}

    const grid = {
      data: new Uint8Array(raw),
      latMin: parseFloat(meta.lat_min || '20'),
      latMax: parseFloat(meta.lat_max || '55'),
      lngMin: parseFloat(meta.lng_min || '-130'),
      lngMax: parseFloat(meta.lng_max || '-60'),
      latCount: parseInt(meta.lat_count || '875', 10),
      lngCount: parseInt(meta.lng_count || '1750', 10),
    }

    if (gridCache.size >= MAX_CACHE) {
      const oldest = gridCache.keys().next().value
      gridCache.delete(oldest)
    }
    gridCache.set(cacheKey, grid)
    return grid
  } catch (e) {
    // Fall back to the other variant
    try {
      const resp2 = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: fallbackKey }))
      const compressed2 = await resp2.Body.transformToByteArray()
      const raw2 = zlib.gunzipSync(Buffer.from(compressed2))
      const meta2 = resp2.Metadata || {}
      const grid = {
        data: new Uint8Array(raw2),
        latMin: parseFloat(meta2.lat_min || '20'),
        latMax: parseFloat(meta2.lat_max || '55'),
        lngMin: parseFloat(meta2.lng_min || '-130'),
        lngMax: parseFloat(meta2.lng_max || '-60'),
        latCount: parseInt(meta2.lat_count || '875', 10),
        lngCount: parseInt(meta2.lng_count || '1750', 10),
      }
      if (gridCache.size >= MAX_CACHE) {
        const oldest = gridCache.keys().next().value
        gridCache.delete(oldest)
      }
      gridCache.set(cacheKey, grid)
      return grid
    } catch (e2) {
      console.error(`Failed to load hotspot grid ${s3Key} and ${fallbackKey}:`, e2.message)
      return null
    }
  }
}

// ── Tile rendering ──────────────────────────────────────────────────────────

function renderTile(grid, bbox, ramp) {
  const SIZE = 256
  const png = new PNG({ width: SIZE, height: SIZE })

  const { latMin, latMax, lngMin, lngMax } = bbox
  const gLatMin = grid.latMin
  const gLngMin = grid.lngMin
  const gLatStep = (grid.latMax - grid.latMin) / (grid.latCount - 1)
  const gLngStep = (grid.lngMax - grid.lngMin) / (grid.lngCount - 1)

  for (let py = 0; py < SIZE; py++) {
    const lat = latMax - (py / SIZE) * (latMax - latMin)

    const gRow = (lat - gLatMin) / gLatStep
    if (gRow < 0 || gRow >= grid.latCount - 1) {
      for (let px = 0; px < SIZE; px++) {
        const off = (py * SIZE + px) * 4
        png.data[off] = 0; png.data[off + 1] = 0; png.data[off + 2] = 0; png.data[off + 3] = 0
      }
      continue
    }

    const r0 = Math.floor(gRow)
    const r1 = Math.min(r0 + 1, grid.latCount - 1)
    const rFrac = gRow - r0

    for (let px = 0; px < SIZE; px++) {
      const lng = lngMin + (px / SIZE) * (lngMax - lngMin)
      const gCol = (lng - gLngMin) / gLngStep

      const off = (py * SIZE + px) * 4

      if (gCol < 0 || gCol >= grid.lngCount - 1) {
        png.data[off] = 0; png.data[off + 1] = 0; png.data[off + 2] = 0; png.data[off + 3] = 0
        continue
      }

      const c0 = Math.floor(gCol)
      const c1 = Math.min(c0 + 1, grid.lngCount - 1)
      const cFrac = gCol - c0

      // Bilinear interpolation on the 0.035° grid — smooth but detailed
      const v00 = grid.data[r0 * grid.lngCount + c0]
      const v10 = grid.data[r1 * grid.lngCount + c0]
      const v01 = grid.data[r0 * grid.lngCount + c1]
      const v11 = grid.data[r1 * grid.lngCount + c1]

      const val = Math.round(
        v00 * (1 - rFrac) * (1 - cFrac) +
        v10 * rFrac * (1 - cFrac) +
        v01 * (1 - rFrac) * cFrac +
        v11 * rFrac * cFrac
      )

      const cOff = val * 4
      png.data[off] = ramp[cOff]
      png.data[off + 1] = ramp[cOff + 1]
      png.data[off + 2] = ramp[cOff + 2]
      png.data[off + 3] = ramp[cOff + 3]
    }
  }

  return PNG.sync.write(png)
}

// ── Transparent 1x1 PNG (for out-of-bounds tiles) ───────────────────────────

const EMPTY_PNG = (() => {
  const p = new PNG({ width: 1, height: 1 })
  p.data[0] = 0; p.data[1] = 0; p.data[2] = 0; p.data[3] = 0
  return PNG.sync.write(p)
})()

// ── Lambda handler ──────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const path = event.rawPath || event.path || ''
  const headers = {
    'Content-Type': 'image/png',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=3600',
  }

  // GET /tiles/depth?lat=XX&lng=XX — proxy ETOPO depth lookup from ERDDAP
  if (path.includes('/tiles/depth')) {
    const params = event.queryStringParameters || {}
    const lat = parseFloat(params.lat)
    const lng = parseFloat(params.lng)
    if (isNaN(lat) || isNaN(lng)) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'lat and lng required' }) }
    }
    try {
      const https = require('https')
      const erddapUrl = `https://coastwatch.pfeg.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json?z[(${lat.toFixed(4)})][(${lng.toFixed(4)})]`
      const data = await new Promise((resolve, reject) => {
        https.get(erddapUrl, { timeout: 8000 }, (res) => {
          const chunks = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
          res.on('error', reject)
        }).on('error', reject)
      })
      const parsed = JSON.parse(data)
      const z = parsed?.table?.rows?.[0]?.[2]
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' },
        body: JSON.stringify({ depth: z ?? null, lat, lng }),
      }
    } catch {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ depth: null }) }
    }
  }

  // GET /tiles/sargassum/{...} — proxy AOML ERDDAP Sargassum WMS (CORS + reprojection)
  // AOML ERDDAP only supports EPSG:4326, but MapLibre sends EPSG:3857 bbox.
  // We reproject the bbox from 3857→4326 before forwarding.
  if (path.includes('/tiles/sargassum/wms')) {
    const params = event.queryStringParameters || {}
    // Function URLs may put bbox in rawQueryString; parse it if queryStringParameters is empty
    let bboxStr = params.BBOX || params.bbox || ''
    if (!bboxStr && event.rawQueryString) {
      const m = event.rawQueryString.match(/BBOX=([^&]+)/i)
      if (m) bboxStr = decodeURIComponent(m[1])
    }
    console.log('Sargassum request:', JSON.stringify({ path, bboxStr, params, rawQS: event.rawQueryString }))
    const bbox3857 = bboxStr.split(',').map(Number)
    if (bbox3857.length !== 4 || bbox3857.some(isNaN)) {
      return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
    }

    // Reproject Web Mercator (3857) → WGS84 (4326)
    function mercToLng(x) { return (x / 20037508.342789244) * 180 }
    function mercToLat(y) {
      const lat = (y / 20037508.342789244) * 180
      return (180 / Math.PI) * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2)
    }
    const minLng = mercToLng(bbox3857[0])
    const minLat = mercToLat(bbox3857[1])
    const maxLng = mercToLng(bbox3857[2])
    const maxLat = mercToLat(bbox3857[3])

    // WMS 1.1.1 with SRS=EPSG:4326 uses BBOX=minx(lng),miny(lat),maxx(lng),maxy(lat)
    const bbox4326 = `${minLng},${minLat},${maxLng},${maxLat}`
    const wmsUrl = `https://cwcgom.aoml.noaa.gov/erddap/wms/noaa_aoml_atlantic_oceanwatch_AFAI_7D/request` +
      `?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true` +
      `&LAYERS=noaa_aoml_atlantic_oceanwatch_AFAI_7D:AFAI&SRS=EPSG:4326` +
      `&WIDTH=512&HEIGHT=512&TIME=${(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) + 'T12:00:00Z'; })()}&STYLES=&COLORSCALERANGE=-0.002,0.01&BBOX=${bbox4326}`

    try {
      const https = require('https')
      console.log('Sargassum WMS URL:', wmsUrl)
      const imgData = await new Promise((resolve, reject) => {
        https.get(wmsUrl, { timeout: 15000 }, (res) => {
          const chunks = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => {
            const buf = Buffer.concat(chunks)
            console.log(`Sargassum WMS response: status=${res.statusCode}, size=${buf.length}, isPNG=${buf.length > 4 && buf[0] === 0x89}`)
            // Verify it's actually a PNG (starts with \x89PNG)
            if (buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50) {
              resolve(buf)
            } else {
              // ERDDAP returned an error XML — return empty tile
              console.log('Sargassum non-PNG response:', buf.toString('utf-8').slice(0, 200))
              resolve(EMPTY_PNG)
            }
          })
          res.on('error', reject)
        }).on('error', reject)
      })
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
        body: imgData.toString('base64'),
        isBase64Encoded: true,
      }
    } catch (e) {
      return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
    }
  }

  // GET /tiles/hrrr/fishing-reports/latest.json — proxy fishing report from S3
  if (path.includes('fishing-reports')) {
    const s3Key = path.includes('/latest.json') ? 'fishing-reports/latest.json' : path.replace(/.*fishing-reports\//, 'fishing-reports/')
    try {
      const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }))
      const body = await resp.Body.transformToString()
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
        body,
      }
    } catch (e) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No fishing report found' }) }
    }
  }

  // GET /tiles/hrrr/latest.json — proxy manifest from S3
  if (path.endsWith('latest.json')) {
    try {
      const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: 'latest.json' }))
      const body = await resp.Body.transformToString()
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
        },
        body,
      }
    } catch (e) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No manifest found' }) }
    }
  }

  // GET /tiles/hotspot/{date}/{z}/{x}/{y}.png — fishing hotspot tiles (combined)
  // GET /tiles/hotspot-inshore/{date}/{z}/{x}/{y}.png — inshore hotspot tiles
  // GET /tiles/hotspot-offshore/{date}/{z}/{x}/{y}.png — offshore hotspot tiles
  const matchHotspot = path.match(/\/tiles\/(hotspot(?:-inshore|-offshore)?)\/(\d{8})\/(\d+)\/(\d+)\/(\d+)\.png/)
  if (matchHotspot) {
    const [, hsVariant, hsDate, hsZ, hsX, hsY] = matchHotspot
    const z = parseInt(hsZ, 10), x = parseInt(hsX, 10), y = parseInt(hsY, 10)
    if (z < 3 || z > 10) {
      return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
    }
    const bbox = tileBbox(z, x, y)
    if (bbox.latMax < 20 || bbox.latMin > 55 || bbox.lngMax < -130 || bbox.lngMin > -60) {
      return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
    }
    const grid = await loadHotspotGrid(hsDate, hsVariant)
    if (!grid) {
      return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
    }
    const pngBuffer = renderTile(grid, bbox, HOTSPOT_RAMP)
    return { statusCode: 200, headers, body: pngBuffer.toString('base64'), isBase64Encoded: true }
  }

  // GET /tiles/sargassum/{date}/{z}/{x}/{y}.png — sargassum 7-day tiles
  // GET /tiles/sargassum-daily/{date}/{z}/{x}/{y}.png — sargassum daily tiles
  const matchSargassum = path.match(/\/tiles\/(sargassum(?:-daily)?)\/(\d{8})\/(\d+)\/(\d+)\/(\d+)\.png/)
  if (matchSargassum) {
    const [, sVariant, sDate, sZ, sX, sY] = matchSargassum
    const z = parseInt(sZ, 10), x = parseInt(sX, 10), y = parseInt(sY, 10)
    if (z < 3 || z > 10) {
      return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
    }
    const bbox = tileBbox(z, x, y)
    if (bbox.latMax < 0 || bbox.latMin > 38 || bbox.lngMax < -98 || bbox.lngMin > -38) {
      return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
    }
    const grid = await loadHotspotGrid(sDate, sVariant)
    if (!grid) {
      return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
    }
    const pngBuffer = renderTile(grid, bbox, SARGASSUM_RAMP)
    return { statusCode: 200, headers, body: pngBuffer.toString('base64'), isBase64Encoded: true }
  }

  // GET /tiles/hotspot/meta/manifest.json — proxy hotspot manifest
  if (path.includes('hotspot') && path.endsWith('manifest.json')) {
    try {
      const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: 'hotspot-manifest.json' }))
      const body = await resp.Body.transformToString()
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
        body,
      }
    } catch (e) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No hotspot manifest' }) }
    }
  }

  // GET /tiles/hrrr/{variable}/{run_date}/{run_hour}/fh{FH}/{z}/{x}/{y}.png
  // Also supports legacy: /tiles/hrrr/{run_date}/{run_hour}/fh{FH}/{z}/{x}/{y}.png (defaults to precip)
  const matchVar = path.match(/\/tiles\/hrrr\/(wind|gust|vis|precip|lightning|cloud|waves)\/(\d{8})\/(\d{2})\/fh(\d{2})\/(\d+)\/(\d+)\/(\d+)\.png/)
  const matchLegacy = path.match(/\/tiles\/hrrr\/(\d{8})\/(\d{2})\/fh(\d{2})\/(\d+)\/(\d+)\/(\d+)\.png/)

  let variable, runDate, runHour, fh, z, x, y

  if (matchVar) {
    [, variable, runDate, runHour] = matchVar
    fh = parseInt(matchVar[4], 10)
    z = parseInt(matchVar[5], 10)
    x = parseInt(matchVar[6], 10)
    y = parseInt(matchVar[7], 10)
  } else if (matchLegacy) {
    variable = 'precip'
    ;[, runDate, runHour] = matchLegacy
    fh = parseInt(matchLegacy[3], 10)
    z = parseInt(matchLegacy[4], 10)
    x = parseInt(matchLegacy[5], 10)
    y = parseInt(matchLegacy[6], 10)
  } else {
    return { statusCode: 400, headers, body: 'Invalid tile path' }
  }

  // Validate zoom
  if (z < 3 || z > 10) {
    return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
  }

  // Check tile is in CONUS range
  const bbox = tileBbox(z, x, y)
  if (bbox.latMax < 20 || bbox.latMin > 55 || bbox.lngMax < -130 || bbox.lngMin > -60) {
    return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
  }

  // Load grid and render tile with the appropriate color ramp
  const grid = await loadGrid(variable, runDate, runHour, fh)
  if (!grid) {
    return { statusCode: 200, headers, body: EMPTY_PNG.toString('base64'), isBase64Encoded: true }
  }

  const ramp = RAMPS[variable] || COLOR_RAMP
  const pngBuffer = renderTile(grid, bbox, ramp)

  return {
    statusCode: 200,
    headers,
    body: pngBuffer.toString('base64'),
    isBase64Encoded: true,
  }
}
