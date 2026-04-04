import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { useMapStore } from '../../store/mapStore'

// ---------------------------------------------------------------------------
// Haversine distance in nautical miles
// ---------------------------------------------------------------------------

function haversineNM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const meters = R * c
  return meters / 1852 // 1 NM = 1852 m
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_ID = 'measure-line-source'
const LINE_LAYER_ID = 'measure-line-layer'
const VERTEX_LAYER_ID = 'measure-vertex-layer'
const NM_TO_SM = 1.15078
const NM_TO_KM = 1.852

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
}

export default function MeasureTool({ mapRef }: Props) {
  const measureMode = useMapStore((s) => s.measureMode)
  const pointsRef = useRef<[number, number][]>([]) // [lng, lat][]
  const markersRef = useRef<maplibregl.Marker[]>([])
  const finishedRef = useRef(false)
  const [panelData, setPanelData] = useState<{ totalNM: number } | null>(null)

  // ---------------------------------------------------------------------------
  // Cleanup helpers
  // ---------------------------------------------------------------------------

  const clearMeasurement = useCallback(() => {
    const map = mapRef.current
    if (map) {
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID)
      if (map.getLayer(VERTEX_LAYER_ID)) map.removeLayer(VERTEX_LAYER_ID)
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    }
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []
    pointsRef.current = []
    finishedRef.current = false
    setPanelData(null)
  }, [mapRef])

  // ---------------------------------------------------------------------------
  // Update the GeoJSON line on the map
  // ---------------------------------------------------------------------------

  const updateLine = useCallback(() => {
    const map = mapRef.current
    if (!map) return

    const points = pointsRef.current
    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: points.length >= 2 ? points : [],
          },
          properties: {},
        },
        // Vertex points
        ...points.map((p) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: p },
          properties: {},
        })),
      ],
    }

    const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    if (src) {
      src.setData(geojson)
    } else {
      map.addSource(SOURCE_ID, { type: 'geojson', data: geojson })
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#00e5ff',
          'line-width': 2,
          'line-dasharray': [4, 3],
        },
      })
      map.addLayer({
        id: VERTEX_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#00e5ff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
    }
  }, [mapRef])

  // ---------------------------------------------------------------------------
  // Add distance label markers between segments
  // ---------------------------------------------------------------------------

  const updateLabels = useCallback(() => {
    // Remove old label markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const map = mapRef.current
    if (!map) return
    const points = pointsRef.current
    if (points.length < 2) {
      setPanelData(null)
      return
    }

    let totalNM = 0

    for (let i = 1; i < points.length; i++) {
      const [lng1, lat1] = points[i - 1]
      const [lng2, lat2] = points[i]
      const segNM = haversineNM(lat1, lng1, lat2, lng2)
      totalNM += segNM

      // Midpoint for segment label
      const midLng = (lng1 + lng2) / 2
      const midLat = (lat1 + lat2) / 2

      const el = document.createElement('div')
      el.style.cssText =
        'background:rgba(0,0,0,0.75);color:#00e5ff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;pointer-events:none;'
      el.textContent = `${segNM.toFixed(2)} NM`

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([midLng, midLat])
        .addTo(map)
      markersRef.current.push(marker)
    }

    // Total distance label at last point
    if (points.length >= 2) {
      const last = points[points.length - 1]
      const el = document.createElement('div')
      el.style.cssText =
        'background:rgba(0,229,255,0.9);color:#000;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap;pointer-events:none;'
      el.textContent = `Total: ${totalNM.toFixed(2)} NM`

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(last)
        .addTo(map)
      markersRef.current.push(marker)
    }

    setPanelData({ totalNM })
  }, [mapRef])

  // ---------------------------------------------------------------------------
  // Map click handler for measure mode
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!measureMode) {
      clearMeasurement()
      map.getCanvas().style.cursor = ''
      return
    }

    // Set crosshair cursor
    map.getCanvas().style.cursor = 'crosshair'
    finishedRef.current = false
    pointsRef.current = []
    setPanelData(null)

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (finishedRef.current) return
      pointsRef.current.push([e.lngLat.lng, e.lngLat.lat])
      updateLine()
      updateLabels()
    }

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault()
      finishedRef.current = true
      map.getCanvas().style.cursor = ''
    }

    map.on('click', onClick)
    map.on('dblclick', onDblClick)

    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDblClick)
    }
  }, [measureMode, mapRef, clearMeasurement, updateLine, updateLabels])

  // ---------------------------------------------------------------------------
  // Floating results panel
  // ---------------------------------------------------------------------------

  if (!panelData) return null

  const totalNM = panelData.totalNM
  const totalSM = totalNM * NM_TO_SM
  const totalKM = totalNM * NM_TO_KM

  return (
    <div className="absolute top-16 right-3 z-40 glass border border-ocean-600 rounded-xl p-3 text-xs text-slate-200 shadow-lg min-w-[180px] animate-fade-in">
      <div className="font-semibold text-cyan-400 mb-2">Distance</div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Nautical mi</span>
          <span className="font-mono">{totalNM.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Statute mi</span>
          <span className="font-mono">{totalSM.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Kilometers</span>
          <span className="font-mono">{totalKM.toFixed(2)}</span>
        </div>
      </div>
      <button
        onClick={() => {
          clearMeasurement()
          useMapStore.getState().setMeasureMode(false)
        }}
        className="mt-3 w-full py-1.5 rounded-lg bg-ocean-800 hover:bg-ocean-700 text-slate-300 text-xs font-medium transition-colors border border-ocean-600"
      >
        Clear
      </button>
    </div>
  )
}
