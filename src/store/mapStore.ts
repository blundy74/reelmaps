import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MapLayer, BasemapId, FishingSpot, ClickedPoint } from '../types'
import { LAYER_REGISTRY } from '../lib/layerUrls'
import { getDefaultDate, toISODate } from '../lib/utils'
import { DEFAULT_SST_RANGE, type SstRange } from '../lib/sstPalette'

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
  'altimetry': true,
  'current-arrows': true,
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

function mergeLayersFromRegistry(prev?: MapLayer[]): MapLayer[] {
  const byId = new Map((prev ?? []).map((l) => [l.id, l]))
  return LAYER_REGISTRY.map((def) => {
    const old = byId.get(def.id)
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      group: def.group,
      visible: old?.visible ?? DEFAULT_VISIBLE[def.id] ?? false,
      opacity: old?.opacity ?? DEFAULT_OPACITY[def.id] ?? 0.8,
      hasDateControl: def.dateDependent,
      attribution: def.attribution,
      advanced: def.advanced,
    }
  })
}

function buildInitialLayers(): MapLayer[] {
  return mergeLayersFromRegistry()
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

  // Lasso select tool
  lassoMode: boolean

  // Fly-to target (set to trigger map.flyTo, consumed by FishingMap)
  flyToTarget: { lat: number; lng: number; zoom?: number } | null

  // Visible map bounds (lng/lat) — used by SST fit-to-view
  mapBounds: { west: number; south: number; east: number; north: number } | null

  // SST palette domain (GIBS tiles rematched client-side)
  sstRange: SstRange

  /** In-flight oceanography / overlay fetches — not persisted. */
  loadingLayers: Record<string, boolean>

  // Actions
  setViewState: (vs: Partial<MapState['viewState']>) => void
  setLayerLoading: (id: string, loading: boolean) => void
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
  setLassoMode: (active: boolean) => void
  setFlyToTarget: (target: { lat: number; lng: number; zoom?: number } | null) => void
  setMapBounds: (bounds: MapState['mapBounds']) => void
  setSstRange: (range: SstRange) => void
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
      lassoMode: false,
      flyToTarget: null,
      mapBounds: null,
      sstRange: DEFAULT_SST_RANGE,
      loadingLayers: {},

      setViewState: (vs) =>
        set((state) => ({ viewState: { ...state.viewState, ...vs } })),

      setLayerLoading: (id, loading) =>
        set((state) => {
          if (!!state.loadingLayers[id] === loading) return state
          return { loadingLayers: { ...state.loadingLayers, [id]: loading } }
        }),

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
      setLassoMode: (active) => set({ lassoMode: active }),
      setFlyToTarget: (target) => set({ flyToTarget: target }),
      setMapBounds: (bounds) => set({ mapBounds: bounds }),
      setSstRange: (range) => set({ sstRange: range }),
    }),
    {
      name: 'reelmaps-map-state',
      version: 14,
      migrate: (persisted, version) => {
        const state = persisted as {
          layers?: MapLayer[]
          basemap?: MapState['basemap']
          selectedDate?: string
          sidebarOpen?: boolean
          viewState?: MapState['viewState']
          droppedPin?: MapState['droppedPin']
          sstRange?: SstRange
        }
        let sstRange = state.sstRange ?? DEFAULT_SST_RANGE
        // v12 defaulted to GOM 78–86, which clips late-summer 88s. Product default is Fit.
        if (version < 13 && sstRange.preset === 'gom') {
          sstRange = DEFAULT_SST_RANGE
        }
        const layers = mergeLayersFromRegistry(state.layers)
        // v14 product lock: arrows + SSH contours on; raster fill / zonal currents off.
        if (version < 14) {
          for (const l of layers) {
            if (l.id === 'current-arrows' || l.id === 'altimetry') l.visible = true
            if (l.id === 'currents' || l.id === 'ssh-anomaly') l.visible = false
          }
        }
        return {
          layers,
          basemap: state.basemap ?? 'satellite',
          selectedDate: state.selectedDate ?? toISODate(getDefaultDate()),
          sidebarOpen: state.sidebarOpen ?? true,
          viewState: state.viewState ?? {
            longitude: -80,
            latitude: 30,
            zoom: 4,
            bearing: 0,
            pitch: 0,
          },
          droppedPin: state.droppedPin ?? null,
          sstRange,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.layers = mergeLayersFromRegistry(state.layers)
          if (!state.sstRange) state.sstRange = DEFAULT_SST_RANGE
        }
      },
      partialize: (state) => ({
        layers: state.layers,
        basemap: state.basemap,
        selectedDate: state.selectedDate,
        sidebarOpen: state.sidebarOpen,
        viewState: state.viewState,
        droppedPin: state.droppedPin,
        sstRange: state.sstRange,
      }),
    },
  ),
)

// Convenience selectors
export const selectLayersByGroup = (group: MapLayer['group']) =>
  (state: MapState) => state.layers.filter((l) => l.group === group)

export const selectVisibleLayers = (state: MapState) =>
  state.layers.filter((l) => l.visible)
