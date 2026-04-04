/**
 * NOAA Weather Alerts API client — fetches active marine weather alerts.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface MarineAlert {
  id: string
  event: string
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Extreme' | string
  headline: string
  description: string
  expires: string
}

// ── Cache ───────────────────────────────────────────────────────────────────

const cache = new Map<string, { data: unknown; ts: number }>()
const ALERT_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < ALERT_CACHE_TTL) return entry.data as T
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() })
}

// ── Marine alert event names ────────────────────────────────────────────────

const MARINE_EVENTS = new Set([
  'Small Craft Advisory',
  'Small Craft Advisory for Hazardous Seas',
  'Small Craft Advisory for Rough Bar',
  'Small Craft Advisory for Winds',
  'Gale Warning',
  'Gale Watch',
  'Storm Warning',
  'Storm Watch',
  'Hurricane Force Wind Warning',
  'Hurricane Force Wind Watch',
  'Hurricane Warning',
  'Hurricane Watch',
  'Tropical Storm Warning',
  'Tropical Storm Watch',
  'Special Marine Warning',
  'Marine Weather Statement',
  'Coastal Flood Advisory',
  'Coastal Flood Warning',
  'Coastal Flood Watch',
  'High Surf Advisory',
  'High Surf Warning',
  'Rip Current Statement',
  'Beach Hazards Statement',
  'Hazardous Seas Warning',
  'Hazardous Seas Watch',
  'Heavy Freezing Spray Warning',
  'Heavy Freezing Spray Watch',
  'Tsunami Warning',
  'Tsunami Watch',
  'Tsunami Advisory',
])

// ── Fetch marine alerts ─────────────────────────────────────────────────────

export async function fetchMarineAlerts(lat: number, lng: number): Promise<MarineAlert[]> {
  const key = `alerts:${lat.toFixed(2)}:${lng.toFixed(2)}`
  const cached = getCached<MarineAlert[]>(key)
  if (cached) return cached

  const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'ReelMaps/1.0' },
  })
  if (!res.ok) {
    // NWS returns 404 for points over open ocean — treat as no alerts
    if (res.status === 404) {
      setCache(key, [])
      return []
    }
    throw new Error(`NWS alerts error: ${res.status}`)
  }

  const data = await res.json()

  const alerts: MarineAlert[] = (data.features ?? [])
    .map((f: { properties: Record<string, string>; id: string }) => ({
      id: f.id,
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline ?? f.properties.event,
      description: f.properties.description ?? '',
      expires: f.properties.expires ?? '',
    }))
    .filter((a: MarineAlert) => MARINE_EVENTS.has(a.event))

  setCache(key, alerts)
  return alerts
}
