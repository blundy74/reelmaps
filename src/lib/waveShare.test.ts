/**
 * Self-running checks for the shared marine wave fetch.
 * Run: npx --yes tsx src/lib/waveShare.test.ts
 */
import {
  fetchWaveGrid,
  invalidateWaveCache,
  sampleWavePoint,
  waveGridCovers,
  waveViewportKey,
} from './windField'
import { fetchMarine, marineFromWaveGrid } from './weatherApi'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function fakeMarineJson(pointCount: number, hours: number) {
  const times = Array.from({ length: hours }, (_, h) =>
    `2026-08-29T${String(h).padStart(2, '0')}:00`,
  )
  return Array.from({ length: pointCount }, () => ({
    hourly: {
      time: times,
      wave_height: times.map((_, h) => 0.4 + h * 0.01),
      wave_direction: times.map(() => 180),
      wave_period: times.map(() => 6),
      swell_wave_period: times.map(() => 8),
    },
  }))
}

async function main() {
  const south = 29.45
  const north = 30.66
  const west = -88.96
  const east = -86.79

  const k1 = waveViewportKey(south, north, west, east, 1_000_000)
  const k2 = waveViewportKey(south + 0.02, north + 0.02, west + 0.02, east + 0.02, 1_000_000)
  assert(k1 === k2, `nearby bounds should share a key: ${k1} vs ${k2}`)
  const k3 = waveViewportKey(south, north, west, east, 1_000_000 + 60 * 60 * 1000)
  assert(k1 !== k3, 'cache key must change by hour')

  let marineGets = 0
  const origFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('marine-api.open-meteo.com')) {
      marineGets++
      const latCount = (url.match(/latitude=([^&]+)/)?.[1] ?? '').split(',').filter(Boolean).length
      const body = fakeMarineJson(latCount || 1, 4)
      return new Response(JSON.stringify(body), { status: 200 })
    }
    throw new Error(`unexpected fetch ${url}`)
  }) as typeof fetch

  try {
    invalidateWaveCache()
    const [a, b, c] = await Promise.all([
      fetchWaveGrid(south, north, west, east),
      fetchWaveGrid(south, north, west, east),
      fetchWaveGrid(south + 0.01, north - 0.01, west + 0.01, east - 0.01),
    ])
    assert(a === b && b === c, 'in-flight callers must share one grid object')
    assert(marineGets === 1, `expected 1 marine HTTP call, got ${marineGets}`)
    assert(waveGridCovers(a, south, north, west, east), 'fetched grid should cover the viewport')
    assert(a.heightDataByHour.length >= 1, 'overlay height field missing')
    assert(a.swellPeriodDataByHour.length >= 1, 'rail swell field missing')

    const beforeRail = marineGets
    const marine = await fetchMarine(30.1, -88.0, { south, north, west, east })
    assert(marineGets === beforeRail, 'rail must reuse the viewport payload, not fetch again')
    assert(marine.hourly.length > 0, 'rail hourly rows empty')
    assert(marine.hourly[0].waveHeight > 0, 'rail wave height missing')
    assert(marine.hourly[0].swellPeriod > 0, 'rail swell period missing')

    const sampled = sampleWavePoint(a, 30.1, -88.0, 0)
    assert(sampled.heightM > 0, 'point sample empty')
    const fromGrid = marineFromWaveGrid(a, 30.1, -88.0)
    assert(fromGrid.hourly[0].time === marine.hourly[0].time, 'rail rows should match grid times')

    const again = await fetchWaveGrid(south, north, west, east)
    assert(again === a, 'same viewport/hour must hit cache')
    assert(marineGets === 1, `cache miss caused extra fetch (${marineGets})`)
  } finally {
    globalThis.fetch = origFetch
    invalidateWaveCache()
  }

  console.log('wave share tests passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
