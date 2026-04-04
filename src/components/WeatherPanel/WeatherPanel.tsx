import { useEffect } from 'react'
import { useWeatherStore } from '../../store/weatherStore'
import { useMapStore } from '../../store/mapStore'
import { cn } from '../../lib/utils'
import CurrentConditions from './CurrentConditions'
import HourlyForecast from './HourlyForecast'
import DailyForecast from './DailyForecast'
import MarineConditions from './MarineConditions'
import TideChart from './TideChart'
import WeatherOverlayControls from './WeatherOverlayControls'

const TABS: { id: 'forecast' | 'marine' | 'overlays'; label: string }[] = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'marine', label: 'Marine' },
  { id: 'overlays', label: 'Overlays' },
]

export default function WeatherPanel() {
  const {
    panelOpen,
    tab,
    setTab,
    location,
    current,
    hourly,
    daily,
    marine,
    loading,
    error,
    fetchWeather,
  } = useWeatherStore()

  const droppedPin = useMapStore((s) => s.droppedPin)
  const clickedPoint = useMapStore((s) => s.clickedPoint)

  // Auto-fetch weather when a pin is dropped or map is clicked
  useEffect(() => {
    if (!panelOpen) return
    const loc = droppedPin ?? clickedPoint
    if (loc) {
      fetchWeather(loc.lat, loc.lng)
    }
  }, [panelOpen, droppedPin, clickedPoint, fetchWeather])

  // Fetch for default location on first open
  useEffect(() => {
    if (panelOpen && !current && !loading && !location) {
      // Default to map center: Gulf of Mexico
      fetchWeather(28.0, -88.5)
    }
  }, [panelOpen, current, loading, location, fetchWeather])

  return (
    <aside
      className={cn(
        'flex-shrink-0 bg-ocean-900 border-l border-ocean-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden',
        panelOpen ? 'w-80' : 'w-0 opacity-0',
      )}
    >
      {/* Tab header */}
      <div className="flex border-b border-ocean-700 flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 px-2 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors',
              tab === t.id
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Location label */}
        {location && (
          <div className="text-[10px] text-slate-500 px-1">
            {location.lat.toFixed(3)}°N, {Math.abs(location.lng).toFixed(3)}°W
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-500">Loading weather...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
            <p className="text-xs text-red-400">{error}</p>
            {location && (
              <button
                onClick={() => fetchWeather(location.lat, location.lng)}
                className="text-xs text-cyan-400 mt-2 hover:underline"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {/* Forecast Tab */}
        {tab === 'forecast' && !loading && current && (
          <>
            <CurrentConditions weather={current} />
            <HourlyForecast entries={hourly} />
            <DailyForecast entries={daily} />
          </>
        )}

        {/* Marine Tab */}
        {tab === 'marine' && !loading && (
          <>
            {marine ? (
              <>
                <MarineConditions marine={marine} />
                {location && (
                  <div className="border-t border-ocean-700 pt-4">
                    <TideChart lat={location.lat} lng={location.lng} />
                  </div>
                )}
              </>
            ) : !error && (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">
                  Click on the map or drop a pin to see marine conditions
                </p>
              </div>
            )}
          </>
        )}

        {/* Overlays Tab */}
        {tab === 'overlays' && (
          <WeatherOverlayControls />
        )}

        {/* Empty state */}
        {!loading && !error && !current && tab === 'forecast' && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500">
              Click on the map or drop a pin to see weather conditions
            </p>
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-ocean-700">
        <p className="text-[9px] text-slate-600 text-center">
          Weather data by Open-Meteo.com | Radar by RainViewer
        </p>
      </div>
    </aside>
  )
}
