import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MapLayer, BasemapId, FishingSpot, ClickedPoint } from '../types'
import { LAYER_REGISTRY } from '../lib/layerUrls'
import { getDefaultDate, toISODate } from '../lib/utils'

// ---------------------------------------------------------------------------
// Build initial layer state from registry
// ---------------------------------------------------------------------------

const DEFAULT_VISIBLE: Record<string, boolean> = {
  'sst-mur': false,
  'fishing-spots': true,
  'bathymetry': false,
  'bathymetry-contours': false,
  'openseamap': false,
  'noaa-charts': false,
  'satellite-imagery': false,
  'true-color-viirs': false,
  'true-color-modis': false,
  'chlorophyll': false,
  'chlorophyll-7day': false,
  'salinity': false,
  'currents': false,
  'ssh-anomaly': false,
  'altimetry': false,
  'current-arrows': false,
  'sst-anomaly': false,
  'sst-goes': false,
  'sargassum': false,
  'sargassum-daily': false,
  'hotspot': false,
  'hotspot-inshore': false,
  'hotspot-offshore': false,
}

const DEFAULT_OPACITY: Record<string, number> = {
  'sst-mur': 0.75,
  'sst-goes': 0.75,
  'sst-anomaly': 0.75,
  'true-color-viirs': 0.90,
  'true-color-modis': 0.90,
  'chlorophyll': 0.75,
  'chlorophyll-7day': 0.80,
  'salinity': 0.70,
  'currents': 0.80,
  'ssh-anomaly': 0.75,
  'altimetry': 0.75,
  'current-arrows': 0.85,
  'bathymetry': 0.85,
  'bathymetry-contours': 0.80,
  'noaa-charts': 0.90,
  'openseamap': 1.0,
  'satellite-imagery': 1.0,
  'sargassum': 0.75,
  'sargassum-daily': 0.75,
  'hotspot': 0.55,
  'hotspot-inshore': 0.55,
  'hotspot-offshore': 0.55,
  'fishing-spots': 1.0,
}

function buildInitialLayers(): MapLayer[] {
  return LAYER_REGISTRY.map((def) => ({
    id: def.id,
    name: def.name,
    description: def.description,
    group: def.group,
    visible: DEFAULT_VISIBLE[def.id] ?? false,
    opacity: DEFAULT_OPACITY[def.id] ?? 0.8,
    hasDateControl: def.dateDependent,
    attribution: def.attribution,
  }))
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface MapState {
  // Map view
  viewState: {
    longitude: number
    latitude: number
    zoom: number
    bearing: number
    pitch: number
  }

  // Layers
  layers: MapLayer[]

  // Basemap
  basemap: BasemapId

  // Selected date for satellite data
  selectedDate: string

  // Sidebar
  sidebarOpen: boolean
  activeTab: 'layers' | 'spots' | 'favorites' | 'my-spots' | 'legend'

  // Fishing spots
  selectedSpot: FishingSpot | null
  clickedPoint: ClickedPoint | null

  // Map cursor coordinates
  cursorCoords: { lat: number; lng: number } | null

  // Dropped pin
  pinModeActive: boolean
  droppedPin: { lat: number; lng: number } | null

  // Measure tool
  measureMode: boolean

  // Fly-to target (set to trigger map.flyTo, consumed by FishingMap)
  flyToTarget: { lat: number; lng: number; zoom?: number } | null

  // Actions
  setViewState: (vs: Partial<MapState['viewState']>) => void
  toggleLayer: (id: string) => void
  setLayerOpacity: (id: string, opacity: number) => void
  setBasemap: (id: BasemapId) => void
  setSelectedDate: (date: string) => void
  setSidebarOpen: (open: boolean) => void
  setActiveTab: (tab: MapState['activeTab']) => void
  setSelectedSpot: (spot: FishingSpot | null) => void
  setClickedPoint: (point: ClickedPoint | null) => void
  setCursorCoords: (coords: { lat: number; lng: number } | null) => void
  setPinModeActive: (active: boolean) => void
  setDroppedPin: (coords: { lat: number; lng: number } | null) => void
  setMeasureMode: (active: boolean) => void
  setFlyToTarget: (target: { lat: number; lng: number; zoom?: number } | null) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      viewState: {
        longitude: -80,
        latitude: 30,
        zoom: 4,
        bearing: 0,
        pitch: 0,
      },

      layers: buildInitialLayers(),
      basemap: 'satellite',
      selectedDate: toISODate(getDefaultDate()),
      sidebarOpen: typeof window !== 'undefined' && window.innerWidth >= 768,
      activeTab: 'layers',
      selectedSpot: null,
      clickedPoint: null,
      cursorCoords: null,
      pinModeActive: false,
      droppedPin: null,
      measureMode: false,
      flyToTarget: null,

      setViewState: (vs) =>
        set((state) => ({ viewState: { ...state.viewState, ...vs } })),

      toggleLayer: (id) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id ? { ...l, visible: !l.visible } : l,
          ),
        })),

      setLayerOpacity: (id, opacity) =>
        set((state) => ({
          layers: state.layers.map((l) =>
            l.id === id ? { ...l, opacity } : l,
          ),
        })),

      setBasemap: (id) => set({ basemap: id }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSelectedSpot: (spot) => set({ selectedSpot: spot }),
      setClickedPoint: (point) => set({ clickedPoint: point }),
      setCursorCoords: (coords) => set({ cursorCoords: coords }),
      setPinModeActive: (active) => set({ pinModeActive: active }),
      setDroppedPin: (coords) => set({ droppedPin: coords }),
      setMeasureMode: (active) => set({ measureMode: active }),
      setFlyToTarget: (target) => set({ flyToTarget: target }),
    }),
    {
      name: 'reelmaps-map-state',
      version: 10,
      partialize: (state) => ({
        layers: state.layers,
        basemap: state.basemap,
        selectedDate: state.selectedDate,
        sidebarOpen: state.sidebarOpen,
        viewState: state.viewState,
        droppedPin: state.droppedPin,
      }),
    },
  ),
)

// Convenience selectors
export const selectLayersByGroup = (group: MapLayer['group']) =>
  (state: MapState) => state.layers.filter((l) => l.group === group)

export const selectVisibleLayers = (state: MapState) =>
  state.layers.filter((l) => l.visible)
