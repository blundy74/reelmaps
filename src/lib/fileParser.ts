/**
 * File parser for fishing spot imports.
 * Supports CSV, GPX (Garmin XML), and FIT (Garmin binary).
 * All parsing happens client-side — only normalized spots are sent to the API.
 */

export interface ParsedSpot {
  name?: string
  lat: number
  lng: number
  depthFt?: number
  notes?: string
  spotType?: string
  species?: string
}

export type FileType = 'csv' | 'gpx' | 'fit'

export function detectFileType(filename: string): FileType | null {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'csv' || ext === 'txt') return 'csv'
  if (ext === 'gpx') return 'gpx'
  if (ext === 'fit') return 'fit'
  return null
}

// ── CSV Parsing ─────────────────────────────────────────────────────────────

const LAT_PATTERNS = /^(lat|latitude|y|lat_deg|position_lat)$/i
const LNG_PATTERNS = /^(lng|lon|long|longitude|x|lng_deg|lon_deg|position_long|position_lng)$/i
const NAME_PATTERNS = /^(name|title|label|waypoint|spot|description|desc|wpt)$/i
const DEPTH_PATTERNS = /^(depth|depth_ft|depth_m|depthft|depthm|ft|meters)$/i

/** Check if a value looks like a latitude (-90 to 90, with decimals typical of coordinates) */
function isLatValue(v: unknown): boolean {
  const n = parseFloat(String(v))
  return !isNaN(n) && n >= -90 && n <= 90 && String(v).includes('.')
}

/** Check if a value looks like a longitude (-180 to 180, with decimals typical of coordinates) */
function isLngValue(v: unknown): boolean {
  const n = parseFloat(String(v))
  return !isNaN(n) && n >= -180 && n <= 180 && String(v).includes('.')
}

/**
 * Scan columns of headerless data to find which indices contain lat/lng values.
 * Returns the first pair where lat comes before lng (per user assumption).
 * A column is a "coordinate column" if 80%+ of its non-empty values are valid coords.
 */
function senseCoordsFromData(rows: unknown[][]): { latIdx: number; lngIdx: number; nameIdx: number; depthIdx: number } | null {
  if (!rows.length) return null
  const colCount = rows[0].length
  const sampleRows = rows.slice(0, Math.min(50, rows.length))

  // Score each column: could it be lat? lng? name? depth?
  const colScores: { latScore: number; lngScore: number; isString: boolean; isDepth: boolean }[] = []

  for (let col = 0; col < colCount; col++) {
    let latHits = 0, lngHits = 0, strHits = 0, depthHits = 0, total = 0
    for (const row of sampleRows) {
      const val = row[col]
      if (val == null || String(val).trim() === '') continue
      total++
      const n = parseFloat(String(val))
      if (isNaN(n)) {
        strHits++
      } else {
        if (isLatValue(val)) latHits++
        if (isLngValue(val)) lngHits++
        // Depth: positive number, not in lat/lng range patterns (typically 0-2000 ft)
        if (n >= 0 && n <= 10000 && !String(val).includes('.') || (String(val).split('.')[1]?.length || 0) <= 1) depthHits++
      }
    }
    const threshold = total * 0.8
    colScores.push({
      latScore: latHits >= threshold ? latHits : 0,
      lngScore: lngHits >= threshold ? lngHits : 0,
      isString: strHits >= threshold,
      isDepth: depthHits >= threshold && !colScores.some(s => s.latScore || s.lngScore), // crude
    })
  }

  // Find the first column that qualifies as lat, then the next that qualifies as lng
  let latIdx = -1, lngIdx = -1, nameIdx = -1, depthIdx = -1

  for (let col = 0; col < colCount; col++) {
    if (latIdx === -1 && colScores[col].latScore > 0) {
      latIdx = col
    } else if (latIdx !== -1 && lngIdx === -1 && colScores[col].lngScore > 0) {
      lngIdx = col
      break
    }
  }

  if (latIdx === -1 || lngIdx === -1) return null

  // Look for a name column (first string column that isn't after coordinates)
  for (let col = 0; col < colCount; col++) {
    if (col !== latIdx && col !== lngIdx && colScores[col].isString) {
      nameIdx = col
      break
    }
  }

  // Look for a depth column (numeric, not lat/lng)
  for (let col = 0; col < colCount; col++) {
    if (col !== latIdx && col !== lngIdx && col !== nameIdx && !colScores[col].isString && colScores[col].lngScore === 0 && colScores[col].latScore === 0) {
      const sampleVal = parseFloat(String(sampleRows[0][col]))
      if (!isNaN(sampleVal) && sampleVal >= 0) {
        depthIdx = col
        break
      }
    }
  }

  return { latIdx, lngIdx, nameIdx, depthIdx }
}

export async function parseCSV(file: File): Promise<{ spots: ParsedSpot[]; columns: string[] }> {
  const Papa = (await import('papaparse')).default

  return new Promise((resolve, reject) => {
    // First pass: parse WITH headers to check for recognized column names
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete(results) {
        if (!results.data?.length) return reject(new Error('No data found in CSV'))

        const columns = results.meta.fields || []

        // Try to detect columns by header names
        const latCol = columns.find(c => LAT_PATTERNS.test(c))
        const lngCol = columns.find(c => LNG_PATTERNS.test(c))

        if (latCol && lngCol) {
          // Headers recognized — use header-based parsing
          const nameCol = columns.find(c => NAME_PATTERNS.test(c))
          const depthCol = columns.find(c => DEPTH_PATTERNS.test(c))

          const spots: ParsedSpot[] = []
          for (const row of results.data as Record<string, unknown>[]) {
            const lat = parseFloat(String(row[latCol]))
            const lng = parseFloat(String(row[lngCol]))
            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue

            spots.push({
              name: nameCol ? String(row[nameCol] || '') : undefined,
              lat,
              lng,
              depthFt: depthCol ? parseFloat(String(row[depthCol])) || undefined : undefined,
            })
          }

          return resolve({ spots, columns })
        }

        // Headers not recognized — re-parse without headers and sense the data
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete(rawResults) {
            let rows = rawResults.data as unknown[][]
            if (!rows?.length) return reject(new Error('No data found in CSV'))

            // If the first row looks like text headers (non-numeric), skip it
            const firstRow = rows[0]
            const numericCount = firstRow.filter(v => !isNaN(parseFloat(String(v)))).length
            const hasHeaderRow = numericCount < firstRow.length / 2
            if (hasHeaderRow) {
              rows = rows.slice(1)
            }

            const detected = senseCoordsFromData(rows)
            if (!detected) {
              return reject(new Error('Could not detect coordinate columns in CSV. Ensure the file contains latitude and longitude values.'))
            }

            const { latIdx, lngIdx, nameIdx, depthIdx } = detected
            const spots: ParsedSpot[] = []

            for (const row of rows) {
              const lat = parseFloat(String(row[latIdx]))
              const lng = parseFloat(String(row[lngIdx]))
              if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue

              spots.push({
                name: nameIdx >= 0 ? String(row[nameIdx] || '') : undefined,
                lat,
                lng,
                depthFt: depthIdx >= 0 ? parseFloat(String(row[depthIdx])) || undefined : undefined,
              })
            }

            const detectedColumns = hasHeaderRow
              ? (firstRow as string[]).map(String)
              : Array.from({ length: (rows[0] || []).length }, (_, i) => `Column ${i + 1}`)

            resolve({ spots, columns: detectedColumns })
          },
          error(err) {
            reject(new Error(`CSV parse error: ${err.message}`))
          },
        })
      },
      error(err) {
        reject(new Error(`CSV parse error: ${err.message}`))
      },
    })
  })
}

// ── GPX Parsing ─────────────────────────────────────────────────────────────

export async function parseGPX(file: File): Promise<ParsedSpot[]> {
  const { gpx } = await import('@tmcw/togeojson')
  const text = await file.text()
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'text/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid GPX file')

  const geojson = gpx(doc)
  const spots: ParsedSpot[] = []

  for (const feature of geojson.features) {
    if (feature.geometry.type === 'Point') {
      const [lng, lat, ele] = feature.geometry.coordinates
      if (isNaN(lat) || isNaN(lng)) continue
      spots.push({
        name: feature.properties?.name || feature.properties?.desc || undefined,
        lat,
        lng,
        depthFt: ele ? Math.round(ele * 3.28084) : undefined, // meters to feet
        notes: feature.properties?.desc || feature.properties?.cmt || undefined,
      })
    }
  }

  // Also extract track points if no waypoints found
  if (spots.length === 0) {
    for (const feature of geojson.features) {
      if (feature.geometry.type === 'LineString') {
        for (const coord of feature.geometry.coordinates) {
          const [lng, lat] = coord
          if (isNaN(lat) || isNaN(lng)) continue
          spots.push({ lat, lng, name: feature.properties?.name || undefined })
        }
      }
      if (feature.geometry.type === 'MultiLineString') {
        for (const line of feature.geometry.coordinates) {
          for (const coord of line) {
            const [lng, lat] = coord
            if (isNaN(lat) || isNaN(lng)) continue
            spots.push({ lat, lng, name: feature.properties?.name || undefined })
          }
        }
      }
    }
  }

  return spots
}

// ── FIT Parsing (Garmin binary) ─────────────────────────────────────────────

export async function parseFIT(file: File): Promise<ParsedSpot[]> {
  const FitParser = (await import('fit-file-parser')).default
  const buffer = await file.arrayBuffer()

  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: 'km/h',
      lengthUnit: 'km',
      temperatureUnit: 'celsius',
      elapsedRecordField: true,
      mode: 'list',
    })

    parser.parse(Buffer.from(buffer), (error: any, data: any) => {
      if (error) return reject(new Error(`FIT parse error: ${error}`))

      const spots: ParsedSpot[] = []

      // Extract waypoints if present
      if (data.waypoints) {
        for (const wp of data.waypoints) {
          if (wp.position_lat != null && wp.position_long != null) {
            spots.push({
              name: wp.name || undefined,
              lat: wp.position_lat,
              lng: wp.position_long,
            })
          }
        }
      }

      // Fall back to record messages (track points)
      if (spots.length === 0 && data.records) {
        // Sample every Nth point to avoid importing thousands of track points
        const step = Math.max(1, Math.floor(data.records.length / 1000))
        for (let i = 0; i < data.records.length; i += step) {
          const rec = data.records[i]
          if (rec.position_lat != null && rec.position_long != null) {
            spots.push({
              lat: rec.position_lat,
              lng: rec.position_long,
            })
          }
        }
      }

      resolve(spots)
    })
  })
}

// ── Unified parser ──────────────────────────────────────────────────────────

export async function parseFile(file: File): Promise<{ spots: ParsedSpot[]; fileType: FileType }> {
  const fileType = detectFileType(file.name)
  if (!fileType) throw new Error(`Unsupported file type: ${file.name}`)

  let spots: ParsedSpot[]
  if (fileType === 'csv') {
    const result = await parseCSV(file)
    spots = result.spots
  } else if (fileType === 'gpx') {
    spots = await parseGPX(file)
  } else {
    spots = await parseFIT(file)
  }

  if (spots.length === 0) throw new Error('No valid spots found in file')
  return { spots, fileType }
}
