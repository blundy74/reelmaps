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

/** Distance-based simplification — keep a point only if it's far enough from the last kept point */
function simplifyPoints(pts: [number, number][], minDist: number): [number, number][] {
  if (pts.length < 2) return pts
  const out: [number, number][] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i]
    const [lx, ly] = out[out.length - 1]
    if ((px - lx) ** 2 + (py - ly) ** 2 >= minDist * minDist) {
      out.push(pts[i])
    }
  }
  // Always include the last point
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1])
  return out
}

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
  const rafRef = useRef(0)

  const pushToSource = useCallback((map: maplibregl.Map, points: [number, number][], closed = false) => {
    if (points.length < 2) return
    // Simplify for rendering — ~0.002° ≈ 200m, keeps visual smooth without flooding GeoJSON
    const simplified = simplifyPoints(points, 0.002)
    const coords = closed && simplified.length > 2
      ? [...simplified, simplified[0]]
      : simplified

    const isPolygon = closed && simplified.length > 2
    const geometry: GeoJSON.Geometry = isPolygon
      ? { type: 'Polygon' as const, coordinates: [coords] }
      : { type: 'LineString' as const, coordinates: coords }

    const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource
    if (src) {
      src.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry, properties: {} }],
      })
    }
  }, [])

  const cleanup = useCallback((map: maplibregl.Map) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
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

    let pendingRaf = false

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (e.originalEvent.button !== 0) return
      drawingRef.current = true
      pointsRef.current = [[e.lngLat.lng, e.lngLat.lat]]
      map.dragPan.disable()
    }

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!drawingRef.current) return
      pointsRef.current.push([e.lngLat.lng, e.lngLat.lat])
      // Batch rendering to one update per animation frame
      if (!pendingRaf) {
        pendingRaf = true
        rafRef.current = requestAnimationFrame(() => {
          pendingRaf = false
          pushToSource(map, pointsRef.current)
        })
      }
    }

    const onMouseUp = () => {
      if (!drawingRef.current) return
      drawingRef.current = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      map.dragPan.enable()

      const polygon = pointsRef.current
      if (polygon.length < 5) {
        pointsRef.current = []
        const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource
        if (src) src.setData({ type: 'FeatureCollection', features: [] })
        return
      }

      // Close the polygon
      polygon.push(polygon[0])
      pushToSource(map, polygon, true)

      // Find spots inside the polygon (use full-resolution points, not simplified)
      const inside = spots.filter(s => pointInPolygon([s.lng, s.lat], polygon))

      if (inside.length > 0) {
        setSelectedSpots(inside)
        setShowResults(true)
      } else {
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [mapRef, lassoMode, spots, pushToSource, cleanup])

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
