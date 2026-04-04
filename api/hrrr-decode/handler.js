/**
 * HRRR Decode Lambda (Node.js) — no Docker, no Python.
 *
 * Fetches HRRR precipitation forecast from NOMADS GRIB2 filter,
 * which returns a small GRIB2 file (~2-7MB) for just the APCP variable.
 * Parses the data using the .idx byte-range approach on the BDP S3 bucket,
 * converts to a lat/lon grid via the HRRR projection params, and stores
 * as compressed uint8 binary in our S3 bucket.
 *
 * Triggered hourly by EventBridge.
 */

const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3')
const https = require('https')
const zlib = require('zlib')

const BUCKET = process.env.HRRR_BUCKET || 'reelmaps-hrrr'
const NOAA_BUCKET = 'noaa-hrrr-bdp-pds'
const FORECAST_HOURS = 19 // fh00-fh18
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-2' })

// Output grid: regular lat/lon covering CONUS + offshore
const OUT_LAT_MIN = 20.0
const OUT_LAT_MAX = 55.0
const OUT_LNG_MIN = -130.0
const OUT_LNG_MAX = -60.0
const OUT_RES = 0.05 // ~5.5km — good enough for weather viz, keeps grids small
const OUT_LAT_COUNT = Math.ceil((OUT_LAT_MAX - OUT_LAT_MIN) / OUT_RES)
const OUT_LNG_COUNT = Math.ceil((OUT_LNG_MAX - OUT_LNG_MIN) / OUT_RES)

/**
 * Fetch a URL and return a Buffer.
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

/**
 * Find the latest available HRRR run.
 */
async function findLatestRun() {
  const now = new Date()
  for (let hoursAgo = 2; hoursAgo <= 8; hoursAgo++) {
    const check = new Date(now.getTime() - hoursAgo * 3600000)
    const dateStr = check.toISOString().slice(0, 10).replace(/-/g, '')
    const hourStr = String(check.getUTCHours()).padStart(2, '0')
    // Check via HTTPS (public bucket, no auth needed)
    const url = `https://noaa-hrrr-bdp-pds.s3.amazonaws.com/hrrr.${dateStr}/conus/hrrr.t${hourStr}z.wrfsfcf00.grib2.idx`
    try {
      const resp = await fetchUrl(url)
      if (resp.length > 100) {
        console.log(`Found HRRR run: ${dateStr}/${hourStr}`)
        return { dateStr, hourStr }
      }
    } catch { continue }
  }
  throw new Error('No HRRR run found in the last 8 hours')
}

/**
 * Parse .idx file to find byte range for APCP (precipitation).
 */
function parseIdx(idxContent) {
  const lines = idxContent.toString().split('\n').filter(l => l.trim())
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(':')
    if (parts.length >= 4 && parts[3].includes('APCP')) {
      const start = parseInt(parts[1])
      const end = i + 1 < lines.length ? parseInt(lines[i + 1].split(':')[1]) - 1 : undefined
      return { start, end }
    }
  }
  // Fallback: try PRATE
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(':')
    if (parts.length >= 4 && parts[3].includes('PRATE')) {
      const start = parseInt(parts[1])
      const end = i + 1 < lines.length ? parseInt(lines[i + 1].split(':')[1]) - 1 : undefined
      return { start, end }
    }
  }
  return null
}

/**
 * Download the APCP field from a HRRR forecast file via S3 byte-range.
 * Then use NOMADS filter as fallback to get a decoded grid.
 */
async function downloadPrecipGrid(dateStr, hourStr, fh) {
  // Use NOMADS filter — returns a small GRIB2 for just APCP, subset to CONUS
  const fhStr = String(fh).padStart(2, '0')
  const url = `https://nomads.ncep.noaa.gov/cgi-bin/filter_hrrr_2d.pl`
    + `?dir=%2Fhrrr.${dateStr}%2Fconus`
    + `&file=hrrr.t${hourStr}z.wrfsfcf${fhStr}.grib2`
    + `&var_APCP=on`
    + `&subregion=`
    + `&toplat=${OUT_LAT_MAX}&bottomlat=${OUT_LAT_MIN}`
    + `&leftlon=${OUT_LNG_MIN}&rightlon=${OUT_LNG_MAX}`

  try {
    const gribData = await fetchUrl(url)
    console.log(`Downloaded fh${fhStr}: ${gribData.length} bytes from NOMADS`)
    return gribData
  } catch (e) {
    console.warn(`NOMADS failed for fh${fhStr}: ${e.message}`)
    return null
  }
}

/**
 * Extract precipitation values from a GRIB2 buffer.
 *
 * GRIB2 format (simplified for a single-message file from NOMADS filter):
 * - Section 0: Indicator (16 bytes, starts with "GRIB")
 * - Section 1: Identification
 * - Section 3: Grid Definition (contains Nx, Ny, lat/lng bounds)
 * - Section 5: Data Representation (contains R, E, D for unpacking)
 * - Section 6: Bitmap
 * - Section 7: Data (packed values)
 * - Section 8: End ("7777")
 *
 * For NOMADS subset: data is typically simple packing (template 5.0).
 * Value = (R + rawVal * 2^E) / 10^D
 */
function parseGrib2Simple(buf) {
  // Find "GRIB" header
  let pos = buf.indexOf('GRIB')
  if (pos < 0) throw new Error('Not a GRIB2 file')

  // Section 0: Indicator (16 bytes)
  const totalLength = Number(buf.readBigUInt64BE(pos + 8))
  pos += 16

  let nx = 0, ny = 0
  let latFirst = 0, lngFirst = 0, latLast = 0, lngLast = 0
  let refValue = 0, binaryScale = 0, decimalScale = 0, nbits = 0
  let dataStart = 0, dataLength = 0
  let hasBitmap = false

  // Walk through sections
  while (pos < buf.length - 4) {
    if (buf.toString('ascii', pos, pos + 4) === '7777') break

    const sectionLen = buf.readUInt32BE(pos)
    const sectionNum = buf.readUInt8(pos + 4)

    if (sectionLen < 5 || sectionLen > buf.length - pos) break

    if (sectionNum === 3) {
      // Grid Definition Section
      // Template 3.0 (lat/lon) or 3.30 (Lambert Conformal)
      const template = buf.readUInt16BE(pos + 12)
      if (template === 0) {
        // Regular lat/lon grid
        nx = buf.readUInt32BE(pos + 30)
        ny = buf.readUInt32BE(pos + 34)
        latFirst = buf.readInt32BE(pos + 46) / 1e6
        lngFirst = buf.readInt32BE(pos + 50) / 1e6
        latLast = buf.readInt32BE(pos + 55) / 1e6
        lngLast = buf.readInt32BE(pos + 59) / 1e6
      } else if (template === 30) {
        // Lambert Conformal — NOMADS subsets reproject to lat/lon, so this shouldn't happen
        // but just in case, extract what we can
        nx = buf.readUInt32BE(pos + 30)
        ny = buf.readUInt32BE(pos + 34)
        latFirst = buf.readInt32BE(pos + 38) / 1e6
        lngFirst = buf.readInt32BE(pos + 42) / 1e6
      }
    }

    if (sectionNum === 5) {
      // Data Representation Section
      const numPoints = buf.readUInt32BE(pos + 5)
      const template5 = buf.readUInt16BE(pos + 9)
      if (template5 === 0) {
        // Simple packing
        refValue = buf.readFloatBE(pos + 11)
        binaryScale = buf.readInt16BE(pos + 15)
        decimalScale = buf.readInt16BE(pos + 17)
        nbits = buf.readUInt8(pos + 19)
      }
    }

    if (sectionNum === 6) {
      // Bitmap section
      const indicator = buf.readUInt8(pos + 5)
      hasBitmap = indicator === 0
    }

    if (sectionNum === 7) {
      // Data section
      dataStart = pos + 5
      dataLength = sectionLen - 5
    }

    pos += sectionLen
  }

  if (nx === 0 || ny === 0 || nbits === 0) {
    throw new Error(`Could not parse GRIB2: nx=${nx}, ny=${ny}, nbits=${nbits}`)
  }

  // Unpack data
  const numPoints = nx * ny
  const values = new Float32Array(numPoints)
  const E = Math.pow(2, binaryScale)
  const D = Math.pow(10, decimalScale)

  if (nbits > 0 && dataLength > 0) {
    let bitPos = 0
    for (let i = 0; i < numPoints; i++) {
      // Read nbits from the data buffer
      const byteIdx = dataStart + Math.floor(bitPos / 8)
      const bitOffset = bitPos % 8

      let rawVal = 0
      let bitsLeft = nbits
      let curByte = byteIdx

      while (bitsLeft > 0) {
        if (curByte >= buf.length) break
        const availBits = 8 - (curByte === byteIdx ? bitOffset : 0)
        const bitsToRead = Math.min(bitsLeft, availBits)
        const shift = availBits - bitsToRead
        const mask = ((1 << bitsToRead) - 1)
        rawVal = (rawVal << bitsToRead) | ((buf[curByte] >> shift) & mask)
        bitsLeft -= bitsToRead
        curByte++
      }

      values[i] = (refValue + rawVal * E) / D
      bitPos += nbits
    }
  }

  // Normalize longitudes to -180..180
  if (lngFirst > 180) lngFirst -= 360
  if (lngLast > 180) lngLast -= 360

  return { values, nx, ny, latFirst, lngFirst, latLast, lngLast }
}

/**
 * Quantize precipitation (mm) to uint8 with logarithmic scale.
 */
function quantize(values) {
  const out = new Uint8Array(values.length)
  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    if (v <= 0.01) { out[i] = 0; continue }
    out[i] = Math.min(255, Math.max(1, Math.round(Math.log(1 + v * 10) / Math.log(501) * 255)))
  }
  return out
}

/**
 * Resample the GRIB2 grid to our regular output grid.
 */
function resampleToOutputGrid(parsed) {
  const { values, nx, ny, latFirst, lngFirst, latLast, lngLast } = parsed
  const output = new Float32Array(OUT_LAT_COUNT * OUT_LNG_COUNT)

  const srcLatStep = (latLast - latFirst) / (ny - 1)
  const srcLngStep = (lngLast - lngFirst) / (nx - 1)

  for (let row = 0; row < OUT_LAT_COUNT; row++) {
    const lat = OUT_LAT_MIN + row * OUT_RES
    const srcRow = (lat - latFirst) / srcLatStep
    if (srcRow < 0 || srcRow >= ny - 1) continue

    const r0 = Math.floor(srcRow)
    const r1 = Math.min(r0 + 1, ny - 1)
    const rFrac = srcRow - r0

    for (let col = 0; col < OUT_LNG_COUNT; col++) {
      const lng = OUT_LNG_MIN + col * OUT_RES
      const srcCol = (lng - lngFirst) / srcLngStep
      if (srcCol < 0 || srcCol >= nx - 1) continue

      const c0 = Math.floor(srcCol)
      const c1 = Math.min(c0 + 1, nx - 1)
      const cFrac = srcCol - c0

      // Bilinear interpolation (GRIB2 data is row-major, north-to-south or south-to-north)
      const v00 = values[r0 * nx + c0]
      const v10 = values[r1 * nx + c0]
      const v01 = values[r0 * nx + c1]
      const v11 = values[r1 * nx + c1]

      output[row * OUT_LNG_COUNT + col] =
        v00 * (1 - rFrac) * (1 - cFrac) +
        v10 * rFrac * (1 - cFrac) +
        v01 * (1 - rFrac) * cFrac +
        v11 * rFrac * cFrac
    }
  }

  return output
}

async function processForecastHour(dateStr, hourStr, fh) {
  const fhStr = String(fh).padStart(2, '0')
  console.log(`Processing fh${fhStr}...`)

  const gribData = await downloadPrecipGrid(dateStr, hourStr, fh)
  if (!gribData) return false

  try {
    const parsed = parseGrib2Simple(gribData)
    console.log(`Parsed: ${parsed.nx}x${parsed.ny}, lat ${parsed.latFirst}-${parsed.latLast}, lng ${parsed.lngFirst}-${parsed.lngLast}`)

    const resampled = resampleToOutputGrid(parsed)
    const quantized = quantize(resampled)
    const compressed = zlib.gzipSync(Buffer.from(quantized.buffer))

    const key = `grids/${dateStr}/${hourStr}/fh${fhStr}.bin.gz`
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: compressed,
      ContentType: 'application/octet-stream',
      ContentEncoding: 'gzip',
      Metadata: {
        lat_min: String(OUT_LAT_MIN),
        lat_max: String(OUT_LAT_MAX),
        lng_min: String(OUT_LNG_MIN),
        lng_max: String(OUT_LNG_MAX),
        lat_count: String(OUT_LAT_COUNT),
        lng_count: String(OUT_LNG_COUNT),
        lat_res: String(OUT_RES),
        lng_res: String(OUT_RES),
      },
    }))
    console.log(`Uploaded ${key} (${compressed.length} bytes)`)
    return true
  } catch (e) {
    console.error(`Parse/upload failed for fh${fhStr}:`, e.message)
    return false
  }
}

exports.handler = async (event) => {
  try {
    const { dateStr, hourStr } = await findLatestRun()
    console.log(`Processing HRRR run ${dateStr}/${hourStr}`)

    const available = []
    for (let fh = 0; fh < FORECAST_HOURS; fh++) {
      const ok = await processForecastHour(dateStr, hourStr, fh)
      if (ok) available.push(fh)
    }

    // Write manifest
    const manifest = {
      run_date: dateStr,
      run_hour: hourStr,
      forecast_hours: available,
      generated_at: new Date().toISOString(),
      grid: {
        lat_min: OUT_LAT_MIN, lat_max: OUT_LAT_MAX,
        lng_min: OUT_LNG_MIN, lng_max: OUT_LNG_MAX,
        resolution: OUT_RES,
      },
    }

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: 'latest.json',
      Body: JSON.stringify(manifest),
      ContentType: 'application/json',
      CacheControl: 'max-age=300',
    }))

    console.log(`Done. ${available.length} forecast hours processed.`)
    return { statusCode: 200, body: JSON.stringify({ run: `${dateStr}/${hourStr}`, hours: available.length }) }
  } catch (e) {
    console.error('HRRR decode failed:', e.message)
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
