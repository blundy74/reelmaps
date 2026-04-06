import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMapStore } from '../../store/mapStore'
import { useWeatherStore } from '../../store/weatherStore'
import { buildTileUrl, basemapStyleUrl } from '../../lib/layerUrls'
// Radar is now handled by RadarOverlay component
import { FISHING_SPOTS, spotsToGeoJSON, SPOT_TYPE_COLORS } from '../../lib/fishingSpots'
import { formatCoords } from '../../lib/utils'
import type { FishingSpot } from '../../types'
import SpotPopup from './SpotPopup'
import MeasureTool from './MeasureTool'
import WindParticleCanvas from './WindParticleCanvas'
import WindColorOverlay from './WindColorOverlay'
import CloudOverlay from './CloudOverlay'
import WaveColorOverlay from './WaveColorOverlay'
import WaveArrowOverlay from './WaveArrowOverlay'
import PressureOverlay from './PressureOverlay'
import RadarOverlay from './RadarOverlay'
import LightningOverlay from './LightningOverlay'
import HrrrOverlay from './HrrrOverlay'
import HotspotOverlay from './HotspotOverlay'
import SpeciesPredictor from './SpeciesPredictor'
import { createRoot } from 'react-dom/client'
import { syncStateToUrl, parseUrlState } from '../../lib/urlSync'
import { useUserSpotsStore, userSpotsToGeoJSON } from '../../store/userSpotsStore'
import type { SavedSpot } from '../../lib/apiClient'
import { registerSmoothProtocol } from '../../lib/smoothTileProtocol'
import { registerContourProtocol } from '../../lib/contourTileProtocol'
import CurrentArrowOverlay from './CurrentArrowOverlay'
import { SPOT_ICONS, renderIconToImageData, getSpotIcon } from '../../lib/spotIcons'

// ── Layer z-order (lower = rendered first / underneath) ─────────────────────
const LAYER_ORDER = [
  'satellite-imagery',
  'bathymetry',
  'bathymetry-contours',
  'noaa-charts',
  'sst-goes',
  'sst-mur',
  'sst-anomaly',
  'true-color-viirs',
  'true-color-modis',
  'chlorophyll',
  'chlorophyll-7day',
  'salinity',
  'currents',
  'ssh-anomaly',
  'altimetry',
  'current-arrows',
  'openseamap',
  'fishing-spots',
]

// Raster layers (rendered as MapLibre raster layers)
const RASTER_LAYERS = new Set([
  'satellite-imagery',
  'bathymetry',
  'bathymetry-contours',
  'noaa-charts',
  'openseamap',
  'sst-mur',
  'sst-anomaly',
  'sst-goes',
  'true-color-viirs',
  'true-color-modis',
  'chlorophyll',
  'chlorophyll-7day',
  'salinity',
  'currents',
  'ssh-anomaly',
  'altimetry',
])

// Layers whose tile URLs are WMS (contain bbox placeholder)
const WMS_LAYERS = new Set([
  'noaa-charts',
  'sst-mur',
  'sst-anomaly',
  'sst-goes',
  'true-color-viirs',
  'true-color-modis',
  'chlorophyll',
  'chlorophyll-7day',
  'salinity',
  'currents',
  'ssh-anomaly',
  'altimetry',
])

export default function FishingMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const initializedRef = useRef(false)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [speciesPoint, setSpeciesPoint] = useState<{ lat: number; lng: number } | null>(null)

  const {
    layers,
    basemap,
    selectedDate,
    setCursorCoords,
    setSelectedSpot,
    setClickedPoint,
    pinModeActive,
    droppedPin,
    setPinModeActive,
    setDroppedPin,
    flyToTarget,
    setFlyToTarget,
  } = useMapStore()

  // ── Helper: get current layer object by id ───────────────────────────────
  const getLayer = useCallback(
    (id: string) => layers.find((l) => l.id === id),
    [layers],
  )

  // Layers that use 512px tiles for higher visual quality
  const HI_RES_TILES = new Set(['ssh-anomaly', 'altimetry', 'currents'])

  // Low-resolution oceanographic layers that benefit from bilinear smoothing
  const SMOOTH_LAYERS = new Set(['ssh-anomaly', 'currents', 'salinity'])

  // Source zoom overrides for specific layers
  const SOURCE_ZOOM_OVERRIDES: Record<string, { minzoom?: number; maxzoom?: number }> = {}

  // ── Add a raster source + layer to the map ───────────────────────────────
  const addRasterLayer = useCallback(
    (map: maplibregl.Map, layerId: string, tiles: string[], opacity: number) => {
      const sourceId = `${layerId}-source`
      const tileSize = HI_RES_TILES.has(layerId) ? 512 : 256

      if (!map.getSource(sourceId)) {
        const zoomOverride = SOURCE_ZOOM_OVERRIDES[layerId]
        const maxzoom = zoomOverride?.maxzoom ?? (WMS_LAYERS.has(layerId) ? undefined : 18)
        map.addSource(sourceId, {
          type: 'raster',
          tiles,
          tileSize,
          ...(maxzoom ? { maxzoom } : {}),
          ...(zoomOverride?.minzoom ? { minzoom: zoomOverride.minzoom } : {}),
        })
      }

      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': opacity,
            'raster-opacity-transition': { duration: 300, delay: 0 },
            // Bilinear interpolation smooths low-res oceanographic data
            ...(SMOOTH_LAYERS.has(layerId) ? { 'raster-resampling': 'linear' as const } : {}),
          },
        })
      }
    },
    [],
  )

  // ── Create oil rig icon for the map ─────────────────────────────────────
  const ensureRigIcon = useCallback((map: maplibregl.Map) => {
    if (map.hasImage('rig-icon')) return
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    // Draw oil rig silhouette
    ctx.strokeStyle = '#a3a3a3'
    ctx.fillStyle = '#a3a3a3'
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    // Platform base
    ctx.fillRect(6, 20, 20, 3)
    // Legs
    ctx.beginPath()
    ctx.moveTo(9, 23); ctx.lineTo(6, 31)
    ctx.moveTo(23, 23); ctx.lineTo(26, 31)
    ctx.moveTo(16, 23); ctx.lineTo(16, 31)
    ctx.stroke()
    // Derrick (triangle tower)
    ctx.beginPath()
    ctx.moveTo(16, 3)
    ctx.lineTo(10, 20)
    ctx.lineTo(22, 20)
    ctx.closePath()
    ctx.strokeStyle = '#a3a3a3'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // Cross beams on derrick
    ctx.beginPath()
    ctx.moveTo(12, 14); ctx.lineTo(20, 14)
    ctx.moveTo(11, 17); ctx.lineTo(21, 17)
    ctx.stroke()
    // Flame at top
    ctx.fillStyle = '#f59e0b'
    ctx.beginPath()
    ctx.arc(16, 3, 2, 0, Math.PI * 2)
    ctx.fill()

    const imgData = ctx.getImageData(0, 0, size, size)
    map.addImage('rig-icon', { width: size, height: size, data: new Uint8Array(imgData.data.buffer) })
  }, [])

  // ── Create FAD icon for the map ────────────────────────────────────────
  const ensureFadIcon = useCallback((map: maplibregl.Map) => {
    if (map.hasImage('fad-icon')) return
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    const cx = size / 2

    // Mooring line (rope going down into water)
    ctx.strokeStyle = '#a3a3a3'
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(cx, 19)
    ctx.lineTo(cx, 30)
    ctx.stroke()
    ctx.setLineDash([])

    // Anchor weight at bottom
    ctx.fillStyle = '#a3a3a3'
    ctx.fillRect(cx - 3, 28, 6, 3)

    // Water surface line
    ctx.strokeStyle = '#38bdf8'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(2, 19)
    ctx.quadraticCurveTo(8, 16, 16, 19)
    ctx.quadraticCurveTo(24, 22, 30, 19)
    ctx.stroke()

    // FAD float body (yellow buoy/cylinder)
    ctx.fillStyle = '#facc15'
    ctx.strokeStyle = '#ca8a04'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(cx - 7, 8, 14, 12, 3)
    ctx.fill()
    ctx.stroke()

    // Flag/pennant on top of buoy
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.moveTo(cx, 2)
    ctx.lineTo(cx + 7, 5)
    ctx.lineTo(cx, 8)
    ctx.closePath()
    ctx.fill()

    // Flagpole
    ctx.strokeStyle = '#a3a3a3'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx, 2)
    ctx.lineTo(cx, 9)
    ctx.stroke()

    // Dangling attractors (short lines hanging below float)
    ctx.strokeStyle = '#78716c'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx - 4, 20); ctx.lineTo(cx - 5, 25)
    ctx.moveTo(cx + 4, 20); ctx.lineTo(cx + 5, 25)
    ctx.stroke()

    const fadImgData = ctx.getImageData(0, 0, size, size)
    map.addImage('fad-icon', { width: size, height: size, data: new Uint8Array(fadImgData.data.buffer) })
  }, [])

  // ── Add fishing spots GeoJSON source & layers ────────────────────────────
  const addFishingSpotsLayer = useCallback((map: maplibregl.Map, opacity: number) => {
    ensureRigIcon(map)
    ensureFadIcon(map)

    if (!map.getSource('fishing-spots-source')) {
      map.addSource('fishing-spots-source', {
        type: 'geojson',
        data: spotsToGeoJSON(FISHING_SPOTS),
        cluster: true,
        clusterMaxZoom: 6,
        clusterRadius: 20,
        clusterMinPoints: 100,
      })
    }

    // Cluster circles
    if (!map.getLayer('clusters')) {
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'fishing-spots-source',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#f59e0b',
            5, '#ef4444',
            10, '#8b5cf6',
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            16, 5, 20, 10, 24,
          ],
          'circle-opacity': opacity,
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(255,255,255,0.3)',
        },
      })
    }

    // Cluster count labels
    if (!map.getLayer('cluster-count')) {
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'fishing-spots-source',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Bold'],
          'text-size': 11,
        },
        paint: {
          'text-color': '#ffffff',
        },
      })
    }

    // Individual spot circles (exclude rigs — they get their own icon layer)
    if (!map.getLayer('fishing-spots')) {
      map.addLayer({
        id: 'fishing-spots',
        type: 'circle',
        source: 'fishing-spots-source',
        filter: ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'type'], 'rig'], ['!=', ['get', 'type'], 'fad']],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            4, 5,
            8, 8,
            12, 11,
          ],
          'circle-color': [
            'match',
            ['get', 'type'],
            'reef', SPOT_TYPE_COLORS.reef,
            'wreck', SPOT_TYPE_COLORS.wreck,
            'ledge', SPOT_TYPE_COLORS.ledge,
            'canyon', SPOT_TYPE_COLORS.canyon,
            'hump', SPOT_TYPE_COLORS.hump,
            'inlet', SPOT_TYPE_COLORS.inlet,
            'artificial', SPOT_TYPE_COLORS.artificial,
            'rip', SPOT_TYPE_COLORS.rip,
            'rig', SPOT_TYPE_COLORS.rig,
            'fad', SPOT_TYPE_COLORS.fad,
            '#f59e0b',
          ],
          'circle-opacity': opacity,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-opacity': 0.8,
        },
      })
    }

    // Oil rig icon layer (separate from circles)
    if (!map.getLayer('fishing-spots-rigs')) {
      map.addLayer({
        id: 'fishing-spots-rigs',
        type: 'symbol',
        source: 'fishing-spots-source',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'rig']],
        layout: {
          'icon-image': 'rig-icon',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 0.9, 12, 1.1],
          'icon-allow-overlap': true,
        },
        paint: {
          'icon-opacity': opacity,
        },
      })
    }

    // FAD icon layer (separate from circles, like rigs)
    if (!map.getLayer('fishing-spots-fads')) {
      map.addLayer({
        id: 'fishing-spots-fads',
        type: 'symbol',
        source: 'fishing-spots-source',
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'fad']],
        layout: {
          'icon-image': 'fad-icon',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 0.9, 12, 1.1],
          'icon-allow-overlap': true,
        },
        paint: {
          'icon-opacity': opacity,
        },
      })
    }

    // Spot label (visible at higher zoom)
    if (!map.getLayer('fishing-spots-labels')) {
      map.addLayer({
        id: 'fishing-spots-labels',
        type: 'symbol',
        source: 'fishing-spots-source',
        filter: ['!', ['has', 'point_count']],
        minzoom: 8,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-max-width': 10,
        },
        paint: {
          'text-color': '#e2e8f0',
          'text-halo-color': 'rgba(4, 12, 24, 0.9)',
          'text-halo-width': 2,
        },
      })
    }
  }, [ensureRigIcon, ensureFadIcon])

  // ── Remove all managed layers from the map ───────────────────────────────
  const removeLayer = useCallback((map: maplibregl.Map, layerId: string) => {
    if (layerId === 'fishing-spots') {
      ['fishing-spots-labels', 'fishing-spots', 'fishing-spots-rigs', 'fishing-spots-fads', 'cluster-count', 'clusters'].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      if (map.getSource('fishing-spots-source')) map.removeSource('fishing-spots-source')
    } else {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(`${layerId}-source`)) map.removeSource(`${layerId}-source`)
    }
  }, [])

  // ── Sync all layers with current Zustand state ───────────────────────────
  const syncLayers = useCallback(
    (map: maplibregl.Map) => {
      for (const layerId of LAYER_ORDER) {
        const layerState = getLayer(layerId)
        if (!layerState) continue

        if (!layerState.visible) {
          // Hide layers that should not be visible
          if (layerId === 'fishing-spots') {
            ['fishing-spots-labels', 'fishing-spots', 'fishing-spots-rigs', 'fishing-spots-fads', 'cluster-count', 'clusters'].forEach(
              (id) => {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none')
              },
            )
          } else if (layerId === 'chlorophyll-7day') {
            // Hide all 7 sub-layers
            for (let d = 0; d < 7; d++) {
              const subId = `${layerId}-d${d}`
              if (map.getLayer(subId)) map.setLayoutProperty(subId, 'visibility', 'none')
            }
          } else if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, 'visibility', 'none')
          }
          continue
        }

        // Layer should be visible
        if (layerId === 'fishing-spots') {
          if (!map.getSource('fishing-spots-source')) {
            addFishingSpotsLayer(map, layerState.opacity)
          } else {
            ['fishing-spots-labels', 'fishing-spots', 'fishing-spots-rigs', 'fishing-spots-fads', 'cluster-count', 'clusters'].forEach(
              (id) => {
                if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible')
              },
            )
            if (map.getLayer('fishing-spots')) {
              map.setPaintProperty('fishing-spots', 'circle-opacity', layerState.opacity)
              map.setPaintProperty('clusters', 'circle-opacity', layerState.opacity)
            }
          }
        } else if (layerId === 'chlorophyll-7day') {
          // Special handling: 7-day composite = 7 sub-layers blended together
          const dayUrls = buildTileUrl(layerId, selectedDate)
          const perDayOpacity = layerState.opacity / Math.max(dayUrls.length, 1) * 1.8 // slightly boost since many tiles are transparent (clouds)

          for (let d = 0; d < dayUrls.length; d++) {
            const subId = `${layerId}-d${d}`
            const subSrcId = `${subId}-source`
            if (!map.getSource(subSrcId)) {
              map.addSource(subSrcId, { type: 'raster', tiles: [dayUrls[d]], tileSize: 256 })
              map.addLayer({
                id: subId,
                type: 'raster',
                source: subSrcId,
                paint: { 'raster-opacity': perDayOpacity },
              })
            } else {
              map.setLayoutProperty(subId, 'visibility', 'visible')
              map.setPaintProperty(subId, 'raster-opacity', perDayOpacity)
              const src = map.getSource(subSrcId) as maplibregl.RasterTileSource
              if (src?.setTiles) src.setTiles([dayUrls[d]])
            }
          }
        } else if (RASTER_LAYERS.has(layerId)) {
          const tiles = buildTileUrl(layerId, selectedDate)
          if (!tiles.length) continue

          if (!map.getSource(`${layerId}-source`)) {
            addRasterLayer(map, layerId, tiles, layerState.opacity)
          } else {
            map.setLayoutProperty(layerId, 'visibility', 'visible')
            map.setPaintProperty(layerId, 'raster-opacity', layerState.opacity)

            // Update tile URLs when date changes (WMS and date-dependent XYZ layers)
            const src = map.getSource(`${layerId}-source`) as maplibregl.RasterTileSource
            if (src && typeof src.setTiles === 'function') {
              src.setTiles(tiles)
            }
          }
        }
      }

      // Always move fishing spot layers to the very top so they're never covered
      const spotLayers = ['clusters', 'cluster-count', 'fishing-spots', 'fishing-spots-labels']
      for (const id of spotLayers) {
        if (map.getLayer(id)) map.moveLayer(id)
      }
    },
    [getLayer, selectedDate, addRasterLayer, addFishingSpotsLayer],
  )

  // ── Drop / move the draggable coordinate pin ────────────────────────────
  const dropPin = useCallback(
    (map: maplibregl.Map, lat: number, lng: number) => {
      setDroppedPin({ lat, lng })

      if (pinMarkerRef.current) {
        // Move existing marker instead of recreating it
        pinMarkerRef.current.setLngLat([lng, lat])
        return
      }

      // Build a flag and flagpole element
      const el = document.createElement('div')
      el.className = 'dropped-pin-el'
      el.style.cssText = `
        width: 28px; height: 44px; cursor: grab;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));
      `
      el.innerHTML = `
        <svg viewBox="0 0 28 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Flagpole -->
          <line x1="4" y1="2" x2="4" y2="46" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
          <!-- Flag -->
          <path d="M4 2 L24 8 L4 16 Z" fill="#06b6d4" stroke="#0891b2" stroke-width="1"/>
          <!-- Base dot -->
          <circle cx="4" cy="46" r="2.5" fill="#06b6d4" stroke="#ffffff" stroke-width="1"/>
        </svg>
      `

      const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .addTo(map)

      marker.on('drag', () => {
        const pos = marker.getLngLat()
        setDroppedPin({ lat: pos.lat, lng: pos.lng })
      })

      marker.on('dragstart', () => {
        el.style.cursor = 'grabbing'
      })

      marker.on('dragend', () => {
        el.style.cursor = 'grab'
        const pos = marker.getLngLat()
        setDroppedPin({ lat: pos.lat, lng: pos.lng })
      })

      pinMarkerRef.current = marker
    },
    [setDroppedPin],
  )

  // ── Remove pin marker when droppedPin is cleared from store ────────────
  useEffect(() => {
    if (droppedPin === null && pinMarkerRef.current) {
      pinMarkerRef.current.remove()
      pinMarkerRef.current = null
    }
  }, [droppedPin])

  // ── Fly to target when set from search bar ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyToTarget) return
    map.flyTo({ center: [flyToTarget.lng, flyToTarget.lat], zoom: flyToTarget.zoom ?? 10, duration: 2000 })
    setFlyToTarget(null)
  }, [flyToTarget, setFlyToTarget])

  // ── Update map cursor when pin mode toggles ──────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.getCanvas().style.cursor = pinModeActive ? 'crosshair' : ''
  }, [pinModeActive])

  // ── Initialize map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return
    initializedRef.current = true

    // Register smooth:// tile protocol for blurred oceanographic layers
    registerSmoothProtocol()
    registerContourProtocol()

    const { viewState, basemap: initialBasemap } = useMapStore.getState()
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapStyleUrl(initialBasemap),
      center: [viewState.longitude, viewState.latitude],
      zoom: viewState.zoom,
      maxZoom: 18,
      minZoom: 2,
      attributionControl: false,
      pitchWithRotate: true,
      dragRotate: true,
    })

    // Controls — all in bottom-right to avoid overlapping the icon bar and pin button
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'nautical', maxWidth: 120 }), 'bottom-left')
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left',
    )
    map.addControl(new maplibregl.FullscreenControl(), 'bottom-right')
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'bottom-right',
    )

    // Cursor coordinates
    map.on('mousemove', (e) => {
      setCursorCoords({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      // Show crosshair when pin mode is active (read from store directly to avoid stale closure)
      if (useMapStore.getState().pinModeActive) {
        map.getCanvas().style.cursor = 'crosshair'
      }
    })
    map.on('mouseleave', () => setCursorCoords(null))

    // Click on fishing spots
    map.on('click', 'fishing-spots', (e) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as {
        id: string
        name: string
        type: string
        depth: number
        rating: number
        species: string
        region: string
        description: string
      }

      const spot = FISHING_SPOTS.find((s) => s.id === props.id)
      if (!spot) return

      setSelectedSpot(spot)
      openSpotPopup(map, spot, e.lngLat)
    })

    // Click on rig icons
    map.on('click', 'fishing-spots-rigs', (e) => {
      if (!e.features?.length) return
      const props = e.features[0].properties as { id: string }
      const spot = FISHING_SPOTS.find((s) => s.id === props.id)
      if (!spot) return
      setSelectedSpot(spot)
      openSpotPopup(map, spot, e.lngLat)
    })

    // Click on clusters → zoom in
    map.on('click', 'clusters', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
      if (!features.length) return
      const clusterId = features[0].properties!.cluster_id
      const src = map.getSource('fishing-spots-source') as maplibregl.GeoJSONSource
      src.getClusterExpansionZoom(clusterId).then((zoom) => {
        const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number]
        map.easeTo({ center: coords, zoom })
      })
    })

    // Pointer cursors
    map.on('mouseenter', 'fishing-spots', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'fishing-spots', () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('mouseenter', 'fishing-spots-rigs', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'fishing-spots-rigs', () => {
      map.getCanvas().style.cursor = ''
    })
    map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = ''
    })

    // Click on empty map — also handles pin drop
    map.on('click', (e) => {
      const { pinModeActive: isPinMode } = useMapStore.getState()

      if (isPinMode) {
        // Drop / move pin to clicked location
        dropPin(map, e.lngLat.lat, e.lngLat.lng)
        setPinModeActive(false)
        map.getCanvas().style.cursor = ''
        return
      }

      const queryLayers = ['fishing-spots', 'fishing-spots-rigs', 'fishing-spots-fads', 'clusters'].filter(id => map.getLayer(id))
      const features = queryLayers.length
        ? map.queryRenderedFeatures(e.point, { layers: queryLayers })
        : []
      if (!features.length) {
        setClickedPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng })
        if (popupRef.current) {
          popupRef.current.remove()
          popupRef.current = null
        }
        setSelectedSpot(null)
      }
    })

    // Right-click / long-press → Species Predictor
    map.on('contextmenu', (e) => {
      e.preventDefault()
      setSpeciesPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    // ── URL deep-link: restore state from hash on load ──────────────────
    const urlState = parseUrlState()
    if (urlState) {
      map.setCenter([urlState.lng, urlState.lat])
      map.setZoom(urlState.zoom)
      // Apply basemap and layers from URL
      const store = useMapStore.getState()
      if (urlState.basemap && urlState.basemap !== store.basemap) {
        store.setBasemap(urlState.basemap)
      }
      if (urlState.layers.length > 0) {
        // Enable URL layers, disable others (except fishing-spots which is a base layer)
        const urlLayerSet = new Set(urlState.layers)
        for (const l of store.layers) {
          if (urlLayerSet.has(l.id) && !l.visible) store.toggleLayer(l.id)
          else if (!urlLayerSet.has(l.id) && l.visible && l.id !== 'fishing-spots') store.toggleLayer(l.id)
        }
      }
    }

    // ── Sync URL hash on map move ──────────────────────────────────────
    map.on('moveend', () => {
      const center = map.getCenter()
      const z = map.getZoom()
      // Update store so sidebar components can react to map position
      useMapStore.getState().setViewState({ latitude: center.lat, longitude: center.lng, zoom: z })
      const { basemap: currentBasemap, layers: currentLayers } = useMapStore.getState()
      const activeLayers = currentLayers.filter((l) => l.visible).map((l) => l.id)
      syncStateToUrl(
        { latitude: center.lat, longitude: center.lng, zoom: z },
        currentBasemap,
        activeLayers,
      )
    })

    map.once('style.load', () => {
      // Use the latest store state directly to avoid stale closure
      const latestLayers = useMapStore.getState().layers
      const latestDate = useMapStore.getState().selectedDate
      const latestGetLayer = (id: string) => latestLayers.find((l) => l.id === id)

      for (const layerId of LAYER_ORDER) {
        const layerState = latestGetLayer(layerId)
        if (!layerState || !layerState.visible) continue
        if (layerId === 'fishing-spots') {
          addFishingSpotsLayer(map, layerState.opacity)
        } else if (layerId === 'chlorophyll-7day') {
          const dayUrls = buildTileUrl(layerId, latestDate)
          const perDayOpacity = layerState.opacity / Math.max(dayUrls.length, 1) * 1.8
          for (let d = 0; d < dayUrls.length; d++) {
            const subId = `${layerId}-d${d}`
            const subSrcId = `${subId}-source`
            if (!map.getSource(subSrcId)) {
              map.addSource(subSrcId, { type: 'raster', tiles: [dayUrls[d]], tileSize: 256 })
              map.addLayer({ id: subId, type: 'raster', source: subSrcId, paint: { 'raster-opacity': perDayOpacity } })
            }
          }
        } else if (RASTER_LAYERS.has(layerId)) {
          const tiles = buildTileUrl(layerId, latestDate)
          if (tiles.length) addRasterLayer(map, layerId, tiles, layerState.opacity)
        }
      }
    })

    mapRef.current = map

    return () => {
      if (popupRef.current) popupRef.current.remove()
      if (pinMarkerRef.current) pinMarkerRef.current.remove()
      map.remove()
      mapRef.current = null
      initializedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Switch basemap style when basemap changes ──────────────────────────
  const prevBasemapRef = useRef(basemap)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (basemap === prevBasemapRef.current) return
    prevBasemapRef.current = basemap

    const newStyle = basemapStyleUrl(basemap)
    map.setStyle(newStyle)

    // setStyle strips all custom layers — re-add them once the new style loads
    map.once('style.load', () => {
      syncLayers(map)
    })
  }, [basemap, syncLayers])

  // ── Re-sync layers whenever state changes ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const sync = () => syncLayers(map)

    if (map.isStyleLoaded()) {
      sync()
    } else {
      map.once('style.load', sync)
    }
  }, [syncLayers, layers, selectedDate])

  // ── User spots layer (imported from CSV/GPX/FIT) ──────────────────────────
  const userSpots = useUserSpotsStore((s) => s.spots)

  /** Ensure all spot icon images are loaded into MapLibre */
  const loadSpotIcons = useCallback((map: maplibregl.Map) => {
    for (const icon of SPOT_ICONS) {
      const imgId = `spot-icon-${icon.key}`
      if (!map.hasImage(imgId)) {
        const img = renderIconToImageData(icon, 36)
        map.addImage(imgId, img)
      }
    }
  }, [])

  const addUserSpotsToMap = useCallback((map: maplibregl.Map, spots: SavedSpot[]) => {
    loadSpotIcons(map)

    const geojson = userSpotsToGeoJSON(spots)
    const sourceId = 'user-spots-source'

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 40,
        clusterMinPoints: 5,
      })

      // Cluster circles
      map.addLayer({
        id: 'user-clusters',
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#06b6d4', 10, '#0891b2', 50, '#0e7490'],
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 50, 24],
          'circle-stroke-width': 2,
          'circle-stroke-color': 'rgba(6, 182, 212, 0.3)',
        },
      })

      map.addLayer({
        id: 'user-cluster-count',
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Bold'],
          'text-size': 11,
        },
        paint: { 'text-color': '#ffffff' },
      })

      // Individual user spots — rendered as icon symbols
      map.addLayer({
        id: 'user-spots',
        type: 'symbol',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['concat', 'spot-icon-', ['coalesce', ['get', 'icon'], 'fish']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 0.8, 12, 1],
          'icon-allow-overlap': true,
          'icon-anchor': 'center',
        },
      })

      // Labels at higher zoom
      map.addLayer({
        id: 'user-spots-labels',
        type: 'symbol',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        minzoom: 9,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 10,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#67e8f9',
          'text-halo-color': 'rgba(4, 12, 24, 0.9)',
          'text-halo-width': 2,
        },
      })

      // Click handler — show read-only attribute popup
      map.on('click', 'user-spots', (e) => {
        if (!e.features?.length) return
        const props = e.features[0].properties as Record<string, any>
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number]

        const popupEl = document.createElement('div')
        popupEl.style.cssText = 'padding:10px;min-width:220px;max-width:280px;'

        // Spot name header
        const nameEl = document.createElement('div')
        nameEl.style.cssText = 'color:#e2e8f0;font-size:14px;font-weight:600;margin-bottom:8px;border-bottom:1px solid #1e3a5f;padding-bottom:6px;'
        nameEl.textContent = props.name || 'Unnamed spot'
        popupEl.appendChild(nameEl)

        // Attribute rows
        const attrs: [string, string][] = []
        const lat = coords[1], lng = coords[0]
        attrs.push(['Location', `${Math.abs(lat).toFixed(5)}\u00B0${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(5)}\u00B0${lng >= 0 ? 'E' : 'W'}`])
        if (props.depthFt != null && props.depthFt !== 0) attrs.push(['Depth', `${Number(props.depthFt).toLocaleString()} ft`])
        if (props.spotType) attrs.push(['Type', String(props.spotType)])
        if (props.species) attrs.push(['Species', String(props.species)])
        if (props.notes) attrs.push(['Notes', String(props.notes)])

        // Also show any extra properties that were imported but not in the standard fields
        const standardKeys = new Set(['id', 'name', 'depthFt', 'spotType', 'species', 'notes', 'icon', 'cluster', 'point_count', 'point_count_abbreviated'])
        for (const [key, val] of Object.entries(props)) {
          if (standardKeys.has(key) || val == null || val === '' || val === 'undefined' || val === 'null') continue
          // Format key: snake_case / camelCase → Title Case
          const label = key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
          attrs.push([label, String(val)])
        }

        for (const [label, value] of attrs) {
          const row = document.createElement('div')
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:3px 0;'

          const labelEl = document.createElement('span')
          labelEl.style.cssText = 'color:#64748b;font-size:11px;white-space:nowrap;flex-shrink:0;'
          labelEl.textContent = label

          const valEl = document.createElement('span')
          valEl.style.cssText = 'color:#cbd5e1;font-size:11px;text-align:right;word-break:break-word;'
          valEl.textContent = value

          row.appendChild(labelEl)
          row.appendChild(valEl)
          popupEl.appendChild(row)
        }

        const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 14 })
          .setLngLat(coords)
          .setDOMContent(popupEl)
          .addTo(map)
      })

      map.on('click', 'user-clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['user-clusters'] })
        if (!features.length) return
        const clusterId = features[0].properties!.cluster_id
        const src = map.getSource(sourceId) as maplibregl.GeoJSONSource
        src.getClusterExpansionZoom(clusterId).then((zoom) => {
          const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number]
          map.easeTo({ center: coords, zoom })
        })
      })

      map.on('mouseenter', 'user-spots', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'user-spots', () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'user-clusters', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'user-clusters', () => { map.getCanvas().style.cursor = '' })
    } else {
      // Update existing source data
      const src = map.getSource(sourceId) as maplibregl.GeoJSONSource
      if (src) src.setData(geojson)
    }
  }, [loadSpotIcons])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const apply = () => addUserSpotsToMap(map, userSpots)

    if (map.isStyleLoaded()) {
      apply()
    } else {
      map.once('style.load', apply)
    }

    return () => { map.off('style.load', apply) }
  }, [userSpots, basemap, addUserSpotsToMap])

  // Radar + Lightning overlays are now separate components (RadarOverlay, LightningOverlay)

  // ── Open popup for a fishing spot ────────────────────────────────────────
  const openSpotPopup = (
    map: maplibregl.Map,
    spot: FishingSpot,
    lngLat: maplibregl.LngLat,
  ) => {
    if (popupRef.current) popupRef.current.remove()

    const el = document.createElement('div')
    const root = createRoot(el)
    root.render(<SpotPopup spot={spot} />)

    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: '340px',
      offset: 12,
    })
      .setLngLat(lngLat)
      .setDOMContent(el)
      .addTo(map)

    popup.on('close', () => {
      setSelectedSpot(null)
      root.unmount()
    })

    popupRef.current = popup
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <RadarOverlay mapRef={mapRef} />
      <CloudOverlay mapRef={mapRef} />
      <WaveColorOverlay mapRef={mapRef} />
      <WaveArrowOverlay mapRef={mapRef} />
      <WindColorOverlay mapRef={mapRef} />
      <PressureOverlay mapRef={mapRef} />
      <WindParticleCanvas mapRef={mapRef} />
      <HrrrOverlay mapRef={mapRef} variable="wind" overlayId="hrrr-wind" />
      <HrrrOverlay mapRef={mapRef} variable="gust" overlayId="hrrr-gust" />
      <HrrrOverlay mapRef={mapRef} variable="vis" overlayId="hrrr-vis" />
      <HrrrOverlay mapRef={mapRef} variable="lightning" overlayId="hrrr-lightning" />
      <HrrrOverlay mapRef={mapRef} variable="cloud" overlayId="hrrr-cloud" />
      <HotspotOverlay mapRef={mapRef} />
      <HotspotOverlay mapRef={mapRef} variant="hotspot-inshore" />
      <HotspotOverlay mapRef={mapRef} variant="hotspot-offshore" />
      <HotspotOverlay mapRef={mapRef} variant="sargassum" />
      <HotspotOverlay mapRef={mapRef} variant="sargassum-daily" />
      <LightningOverlay mapRef={mapRef} />
      <CurrentArrowOverlay
        mapRef={mapRef}
        visible={getLayer('current-arrows')?.visible ?? false}
        opacity={getLayer('current-arrows')?.opacity ?? 0.85}
      />
      <MeasureTool mapRef={mapRef} />
      {speciesPoint && (
        <SpeciesPredictor
          lat={speciesPoint.lat}
          lng={speciesPoint.lng}
          onClose={() => setSpeciesPoint(null)}
          className="absolute top-14 right-3 z-30 w-72"
        />
      )}
    </div>
  )
}
