/**
 * AI Fishing Report Generator Lambda
 * Pulls current conditions from our existing data pipeline and generates
 * a natural-language fishing report using Claude API.
 *
 * Runs daily via EventBridge or on-demand via API Gateway.
 * Reports are stored in S3 and served via the tile Lambda.
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const https = require('https')

const s3 = new S3Client({ region: 'us-east-2' })
const BUCKET = process.env.HRRR_BUCKET || 'reelmaps-hrrr'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

// ── Regions ─────────────────────────────────────────────────────────────────

const REGIONS = [
  {
    id: 'se-atlantic',
    name: 'Southeast Atlantic',
    description: 'SE Florida, Bahamas, Gulf Stream, East Coast from Palm Beach to Cape Hatteras',
    lat: 28.0, lng: -79.0,
  },
  {
    id: 'gulf',
    name: 'Gulf of Mexico',
    description: 'Gulf Coast from Texas to Florida Keys, Loop Current, offshore rigs',
    lat: 27.0, lng: -89.0,
  },
  {
    id: 'ne-atlantic',
    name: 'Northeast Atlantic',
    description: 'Mid-Atlantic Bight, canyons (Hudson, Baltimore, Norfolk), New England',
    lat: 39.0, lng: -72.0,
  },
  {
    id: 'pacific',
    name: 'Pacific Coast',
    description: 'Southern California, San Diego, offshore banks, California Current',
    lat: 33.0, lng: -118.0,
  },
]

// ── Data fetching ───────────────────────────────────────────────────────────

async function fetchJson(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        clearTimeout(timer)
        try { resolve(JSON.parse(data)) } catch { resolve(null) }
      })
    }).on('error', (e) => { clearTimeout(timer); reject(e) })
  })
}

async function getConditions(lat, lng) {
  const conditions = {}

  // Weather from Open-Meteo
  try {
    const weather = await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover,weather_code` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`
    )
    if (weather?.current) {
      conditions.temperature = Math.round(weather.current.temperature_2m)
      conditions.windSpeed = Math.round(weather.current.wind_speed_10m)
      conditions.windDirection = weather.current.wind_direction_10m
      conditions.windGusts = Math.round(weather.current.wind_gusts_10m)
      conditions.pressure = weather.current.pressure_msl
      conditions.cloudCover = weather.current.cloud_cover
    }
  } catch (e) { console.warn('Weather fetch failed:', e.message) }

  // Marine data from Open-Meteo
  try {
    const marine = await fetchJson(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}` +
      `&current=wave_height,wave_period,wave_direction,sea_surface_temperature` +
      `&wave_height_unit=ft&temperature_unit=fahrenheit`
    )
    if (marine?.current) {
      conditions.waveHeight = marine.current.wave_height
      conditions.wavePeriod = marine.current.wave_period
      conditions.waveDirection = marine.current.wave_direction
      conditions.sst = marine.current.sea_surface_temperature
    }
  } catch (e) { console.warn('Marine fetch failed:', e.message) }

  // Hotspot manifest
  try {
    const manifest = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: 'hotspot-manifest.json' }))
    const body = await manifest.Body.transformToString()
    const data = JSON.parse(body)
    conditions.hotspotDate = data.date
    conditions.hotspotMaxScore = data.stats?.max_score
    conditions.hotspotMeanScore = data.stats?.mean_score
    conditions.hotspotMoonFactor = data.moon_factor
    conditions.dataSources = data.data_sources
  } catch (e) { console.warn('Hotspot manifest fetch failed:', e.message) }

  // Moon phase
  const ref = new Date('2000-01-06T18:14:00Z')
  const now = new Date()
  const days = (now - ref) / 86400000
  const synodic = 29.53058867
  const phase = (days % synodic) / synodic
  const moonPhases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Third Quarter', 'Waning Crescent']
  conditions.moonPhase = moonPhases[Math.floor(phase * 8) % 8]
  conditions.moonIllumination = Math.round(50 * (1 - Math.cos(2 * Math.PI * phase)))

  // Sunrise/sunset approximation
  const sunrise = new Date()
  sunrise.setUTCHours(11, 0, 0, 0) // ~6am ET rough
  const sunset = new Date()
  sunset.setUTCHours(0, 30, 0, 0) // ~7:30pm ET rough
  conditions.sunrise = '~6:30 AM'
  conditions.sunset = '~7:30 PM'

  return conditions
}

// ── Claude API call ─────────────────────────────────────────────────────────

async function generateReport(region, conditions) {
  const prompt = `You are an expert offshore fishing meteorologist and charter captain writing the daily fishing report for "${region.name}" (${region.description}).

Current conditions at the representative offshore point (${region.lat}°N, ${Math.abs(region.lng)}°W):
- Sea Surface Temperature: ${conditions.sst ? conditions.sst + '°F' : 'unavailable'}
- Air Temperature: ${conditions.temperature ? conditions.temperature + '°F' : 'unavailable'}
- Wind: ${conditions.windSpeed ? conditions.windSpeed + ' mph' : 'unavailable'} from ${conditions.windDirection ? conditions.windDirection + '°' : '?'}${conditions.windGusts ? ', gusting ' + conditions.windGusts + ' mph' : ''}
- Waves: ${conditions.waveHeight ? conditions.waveHeight + ' ft' : 'unavailable'}${conditions.wavePeriod ? ' at ' + conditions.wavePeriod + 's period' : ''}
- Barometric Pressure: ${conditions.pressure ? conditions.pressure.toFixed(1) + ' mb' : 'unavailable'}
- Cloud Cover: ${conditions.cloudCover != null ? conditions.cloudCover + '%' : 'unavailable'}
- Moon Phase: ${conditions.moonPhase || 'unknown'} (${conditions.moonIllumination || '?'}% illumination)
- Sunrise: ${conditions.sunrise}, Sunset: ${conditions.sunset}
- AI Hotspot Data: ${conditions.dataSources ? `SST: ${conditions.dataSources.sst ? 'yes' : 'no'}, Chlorophyll: ${conditions.dataSources.chlorophyll ? 'yes' : 'no'}` : 'unavailable'}
- Hotspot Score: max ${conditions.hotspotMaxScore || '?'}, mean ${conditions.hotspotMeanScore || '?'}

Write a concise, actionable daily fishing report (3-4 paragraphs). Include:
1. Overall assessment and fishability rating (1-10)
2. Sea conditions and comfort level for different boat sizes
3. Which species are most likely biting given the SST, time of year (${new Date().toLocaleDateString('en-US', { month: 'long' })}), and conditions
4. Best strategies for the day (trolling, bottom fishing, live bait, etc.)
5. Best time windows (dawn bite, afternoon lull, etc.)
6. Any weather concerns or windows to watch

Write in a conversational but authoritative tone. Be specific about species and tactics. Keep it under 250 words. Do NOT use markdown headers — just flowing paragraphs.`

  const body = JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.content?.[0]?.text) {
            resolve(parsed.content[0].text)
          } else {
            reject(new Error('No text in Claude response: ' + data.slice(0, 200)))
          }
        } catch (e) {
          reject(new Error('Failed to parse Claude response: ' + e.message))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

// ── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set')
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) }
  }

  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const reports = {}

  for (const region of REGIONS) {
    console.log(`Generating report for ${region.name}...`)
    try {
      const conditions = await getConditions(region.lat, region.lng)
      console.log(`Conditions for ${region.name}:`, JSON.stringify(conditions).slice(0, 300))

      const text = await generateReport(region, conditions)
      console.log(`Report for ${region.name}: ${text.length} chars`)

      reports[region.id] = {
        region: region.name,
        description: region.description,
        text,
        conditions,
        generatedAt: now.toISOString(),
      }
    } catch (e) {
      console.error(`Failed to generate report for ${region.name}:`, e.message)
      reports[region.id] = {
        region: region.name,
        text: 'Report unavailable — check back shortly.',
        error: e.message,
        generatedAt: now.toISOString(),
      }
    }
  }

  // Save to S3
  const manifest = {
    date: dateStr,
    generatedAt: now.toISOString(),
    regions: Object.keys(reports),
    reports,
  }

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: 'fishing-reports/latest.json',
    Body: JSON.stringify(manifest),
    ContentType: 'application/json',
    CacheControl: 'max-age=300',
  }))

  // Also save dated version for history
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `fishing-reports/${dateStr}.json`,
    Body: JSON.stringify(manifest),
    ContentType: 'application/json',
  }))

  console.log(`Done. ${Object.keys(reports).length} reports generated.`)
  return { statusCode: 200, body: JSON.stringify({ date: dateStr, regions: Object.keys(reports) }) }
}
