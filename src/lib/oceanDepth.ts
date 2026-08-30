/** Ocean depth (meters) from ETOPO 2022 via the existing tile proxy. */

const TILE_BASE = import.meta.env.VITE_HRRR_TILE_URL || 'https://xhac6pdww5.execute-api.us-east-2.amazonaws.com'

export async function fetchDepthMeters(lat: number, lng: number): Promise<number | null> {
  try {
    const url = `${TILE_BASE}/tiles/depth?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null)
    if (!res || !res.ok) return null
    const data = await res.json()
    return data?.depth ?? null
  } catch {
    return null
  }
}

/** Positive feet of water. Null on land or nodata. */
export async function fetchDepthFeet(lat: number, lng: number): Promise<number | null> {
  const alt = await fetchDepthMeters(lat, lng)
  if (alt == null || alt >= 0) return null
  return Math.round(Math.abs(alt) * 3.28084)
}

export function formatDepthFeet(ft: number): string {
  return `Depth ${ft.toLocaleString()}'`
}
