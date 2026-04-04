import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CurrentWeather,
  HourlyEntry,
  DailyEntry,
  MarineData,
  WeatherOverlayDef,
} from '../lib/weatherTypes'
import { fetchForecast, fetchMarine } from '../lib/weatherApi'
import type { UnitSystem } from '../lib/units'

export interface HomePort {
  name: string
  lat: number
  lng: number
}

interface WeatherState {
  // Panel UI
  panelOpen: boolean
  tab: 'forecast' | 'marine' | 'overlays' | 'account'

  // Location for weather query
  location: { lat: number; lng: number } | null

  // Forecast data
  current: CurrentWeather | null
  hourly: HourlyEntry[]
  daily: DailyEntry[]

  // Marine data
  marine: MarineData | null

  // Weather overlays on map
  overlays: WeatherOverlayDef[]

  // Radar animation
  radarFrameIndex: number

  // Forecast hour index for overlay animation (0 = current, 1 = +1h, etc.)
  selectedForecastHour: number

  // Playback speed: seconds per forecast hour (lower = faster)
  playbackSpeed: number

  // Unit system
  unitSystem: UnitSystem

  // Home port
  homePort: HomePort | null

  // Default overlay opacity (applied to all weather overlays)
  defaultOverlayOpacity: number

  // Fetch state
  loading: boolean
  error: string | null

  // Actions
  setPanelOpen: (open: boolean) => void
  setTab: (tab: WeatherState['tab']) => void
  setHomePort: (port: HomePort | null) => void
  setDefaultOverlayOpacity: (opacity: number) => void
  setLocation: (loc: { lat: number; lng: number } | null) => void
  fetchWeather: (lat: number, lng: number) => Promise<void>
  toggleOverlay: (id: string) => void
  setOverlayOpacity: (id: string, opacity: number) => void
  setRadarFrameIndex: (idx: number) => void
  setSelectedForecastHour: (hour: number) => void
  setPlaybackSpeed: (speed: number) => void
  setUnitSystem: (system: UnitSystem) => void
}

const DEFAULT_OVERLAYS: WeatherOverlayDef[] = [
  { id: 'radar', name: 'Rain Radar', visible: false, opacity: 0.7 },
  { id: 'hrrr-wind', name: 'Wind Speed (HRRR)', visible: false, opacity: 0.6 },
  { id: 'hrrr-gust', name: 'Wind Gusts (HRRR)', visible: false, opacity: 0.6 },
  { id: 'hrrr-vis', name: 'Visibility (HRRR)', visible: false, opacity: 0.6 },
  { id: 'hrrr-lightning', name: 'Lightning Forecast (HRRR)', visible: false, opacity: 0.7 },
  { id: 'hrrr-cloud', name: 'Cloud Cover (HRRR)', visible: false, opacity: 0.5 },
  { id: 'lightning', name: 'Lightning (Live)', visible: false, opacity: 1.0 },
  { id: 'lightning-sound', name: 'Thunder Sound', visible: false, opacity: 1.0 },
  { id: 'cloud-cover', name: 'Cloud Cover (Legacy)', visible: false, opacity: 0.5 },
  { id: 'wind', name: 'Wind Animation', visible: false, opacity: 0.2 },
  { id: 'waves', name: 'Wave Height', visible: false, opacity: 0.6 },
  { id: 'pressure', name: 'Pressure', visible: false, opacity: 0.6 },
]

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set, get) => ({
      panelOpen: false,
      tab: 'forecast',
      location: null,
      current: null,
      hourly: [],
      daily: [],
      marine: null,
      overlays: DEFAULT_OVERLAYS,
      radarFrameIndex: -1,
      selectedForecastHour: 0,
      playbackSpeed: 1.0,
      unitSystem: 'imperial' as UnitSystem,
      homePort: null as HomePort | null,
      defaultOverlayOpacity: 0.7,
      loading: false,
      error: null,

      setPanelOpen: (open) => set({ panelOpen: open }),
      setTab: (tab) => set({ tab }),
      setLocation: (loc) => set({ location: loc }),
      setRadarFrameIndex: (idx) => set({ radarFrameIndex: idx }),
      setSelectedForecastHour: (hour) => set({ selectedForecastHour: hour }),
      setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
      setUnitSystem: (system) => set({ unitSystem: system }),
      setHomePort: (port) => set({ homePort: port }),
      setDefaultOverlayOpacity: (opacity) => set({ defaultOverlayOpacity: opacity }),

      toggleOverlay: (id) =>
        set((s) => ({
          overlays: s.overlays.map((o) =>
            o.id === id ? { ...o, visible: !o.visible } : o,
          ),
        })),

      setOverlayOpacity: (id, opacity) =>
        set((s) => ({
          overlays: s.overlays.map((o) =>
            o.id === id ? { ...o, opacity } : o,
          ),
        })),

      fetchWeather: async (lat, lng) => {
        set({ loading: true, error: null, location: { lat, lng } })
        try {
          const [forecast, marine] = await Promise.allSettled([
            fetchForecast(lat, lng),
            fetchMarine(lat, lng),
          ])

          const updates: Partial<WeatherState> = { loading: false }

          if (forecast.status === 'fulfilled') {
            updates.current = forecast.value.current
            updates.hourly = forecast.value.hourly
            updates.daily = forecast.value.daily
          }

          if (marine.status === 'fulfilled') {
            updates.marine = marine.value
          }

          if (forecast.status === 'rejected' && marine.status === 'rejected') {
            updates.error = 'Failed to fetch weather data'
          }

          set(updates)
        } catch {
          set({ loading: false, error: 'Failed to fetch weather data' })
        }
      },
    }),
    {
      name: 'reelmaps-weather',
      version: 10,
      partialize: (s) => ({
        panelOpen: s.panelOpen,
        tab: s.tab,
        overlays: s.overlays,
        unitSystem: s.unitSystem,
      }),
    },
  ),
)
