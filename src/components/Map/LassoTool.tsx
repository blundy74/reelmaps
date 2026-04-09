/**
 * LassoTool — draw a freeform polygon on the map to select user spots.
 * Activated via lassoMode in mapStore. Draws on mouse drag, selects spots
 * inside the polygon on mouse up.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMapStore } from '../../store/mapStore'
import { useUserSpotsStore } from '../../store/userSpotsStore'
import { pointInPolygon } from '../../lib/pointInPolygon'
import type { SavedSpot } from '../../lib/apiClient'
import LassoResultsModal from './LassoResultsModal'

const SOURCE_ID = 'lasso-source'
const FILL_LAYER = 'lasso-fill'
const LINE_LAYER = 'lasso-line'

interface Props {
  mapRef: React.RefObject<maplibregl.Map | null>
}

export default function LassoTool({ mapRef }: Props) {
  const lassoMode = useMapStore((s) => s.lassoMode)
  const setLassoMode = useMapStore((s) => s.setLassoMode)
  const spots = useUserSpotsStore((s) => s.spots)
  const [selectedSpots, setSelectedSpots] = useState<SavedSpot[]>([])
  const [showResults, setShowResults] = useState(false)

  const drawingRef = useRef(false)
  const pointsRef = useRef<[number, number][]>([])

  const updatePolygon = useCallback((map: maplibregl.Map, points: [number, number][], closed = false) => {
    if (points.length < 2) return

    const coords = closed && points.length > 2
      ? [...points, points[0]]
      : points

    const isPolygon = closed && points.length > 2
    const geometry: GeoJSON.Geometry = isPolygon
      ? { type: 'Polygon' as const, coordinates: [coords] }
      : { type: 'LineString' as const, coordinates: coords }

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry,
        properties: {},
      }],
    }

    const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource
    if (src) {
      src.setData(geojson)
    }
  }, [])

  const cleanup = useCallback((map: maplibregl.Map) => {
    if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER)
    if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER)
    if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
    map.dragPan.enable()
    map.getCanvas().style.cursor = ''
    drawingRef.current = false
    pointsRef.current = []
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!lassoMode) {
      cleanup(map)
      return
    }

    // Setup
    map.getCanvas().style.cursor = 'crosshair'

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }

    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#06b6d4',
          'fill-opacity': 0.12,
        },
      })
    }

    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#06b6d4',
          'line-width': 2,
          'line-dasharray': [4, 3],
        },
      })
    }

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button !== 0) return // left click only
      drawingRef.current = true
      pointsRef.current = [[e.lngLat.lng, e.lngLat.lat]]
      map.dragPan.disable()
    }

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!drawingRef.current) return
      pointsRef.current.push([e.lngLat.lng, e.lngLat.lat])
      // Throttle updates — only update every 3rd point for performance
      if (pointsRef.current.length % 3 === 0) {
        updatePolygon(map, pointsRef.current)
      }
    }

    const onMouseUp = () => {
      if (!drawingRef.current) return
      drawingRef.current = false
      map.dragPan.enable()

      const polygon = pointsRef.current
      if (polygon.length < 5) {
        // Too few points — not a meaningful polygon
        pointsRef.current = []
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource
        if (src) src.setData({ type: 'FeatureCollection', features: [] })
        return
      }

      // Close the polygon
      polygon.push(polygon[0])
      updatePolygon(map, polygon, true)

      // Find spots inside the polygon
      const inside = spots.filter(s => pointInPolygon([s.lng, s.lat], polygon))

      if (inside.length > 0) {
        setSelectedSpots(inside)
        setShowResults(true)
      } else {
        // No spots found — clear and stay in lasso mode
        pointsRef.current = []
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource
        if (src) src.setData({ type: 'FeatureCollection', features: [] })
      }
    }

    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)

    return () => {
      map.off('mousedown', onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
    }
  }, [mapRef, lassoMode, spots, updatePolygon, cleanup])

  const handleClose = useCallback(() => {
    setShowResults(false)
    setSelectedSpots([])
    setLassoMode(false)
    const map = mapRef.current
    if (map) cleanup(map)
  }, [mapRef, setLassoMode, cleanup])

  if (!showResults || selectedSpots.length === 0) return null

  return <LassoResultsModal spots={selectedSpots} onClose={handleClose} />
}
