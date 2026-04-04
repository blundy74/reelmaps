import type { BasemapId } from '../types'

interface UrlState {
  lat: number
  lng: number
  zoom: number
  basemap: BasemapId
  layers: string[]
}

/**
 * Write current map state into the URL hash fragment.
 */
export function syncStateToUrl(
  viewState: { latitude: number; longitude: number; zoom: number },
  basemap: string,
  activeLayers: string[],
) {
  const params = new URLSearchParams()
  params.set('lat', viewState.latitude.toFixed(4))
  params.set('lng', viewState.longitude.toFixed(4))
  params.set('z', viewState.zoom.toFixed(1))
  params.set('b', basemap)
  if (activeLayers.length > 0) {
    params.set('l', activeLayers.join(','))
  }
  // Use replaceState to avoid polluting browser history on every move
  const hash = `#${params.toString()}`
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', hash)
  }
}

/**
 * Parse URL hash and return map state, or null if no valid hash present.
 */
export function parseUrlState(): UrlState | null {
  const hash = window.location.hash.slice(1) // strip leading #
  if (!hash) return null

  const params = new URLSearchParams(hash)
  const lat = parseFloat(params.get('lat') ?? '')
  const lng = parseFloat(params.get('lng') ?? '')
  const zoom = parseFloat(params.get('z') ?? '')

  if (isNaN(lat) || isNaN(lng) || isNaN(zoom)) return null

  const basemap = (params.get('b') ?? 'satellite') as BasemapId
  const layerStr = params.get('l') ?? ''
  const layers = layerStr ? layerStr.split(',').filter(Boolean) : []

  return { lat, lng, zoom, basemap, layers }
}
