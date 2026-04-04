/**
 * Windy.com-style vertical icon bar on the right side of the map.
 * Each icon toggles a weather overlay or feature.
 */

import { useWeatherStore } from '../../store/weatherStore'
import { useMapStore } from '../../store/mapStore'
import { cn } from '../../lib/utils'

interface WeatherFeature {
  id: string
  label: string
  icon: React.ReactNode
  type: 'weather-overlay' | 'map-layer'
}

const FEATURES: WeatherFeature[] = [
  {
    id: 'radar',
    label: 'Weather radar',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
  {
    id: 'hrrr-wind',
    label: 'Wind speed (HRRR)',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M9.59 4.59A2 2 0 1111 8H2" strokeLinecap="round" />
        <path d="M12.59 19.41A2 2 0 1014 16H2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'hrrr-gust',
    label: 'Wind gusts (HRRR)',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M17.73 7.73A2.5 2.5 0 1119.5 12H2" strokeLinecap="round" />
        <path d="M9.59 4.59A2 2 0 1111 8H6" strokeLinecap="round" />
        <path d="M2 12h3" strokeLinecap="round" strokeDasharray="2 2" />
      </svg>
    ),
  },
  {
    id: 'hrrr-lightning',
    label: 'Lightning forecast',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'hrrr-cloud',
    label: 'Cloud cover (HRRR)',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
      </svg>
    ),
  },
  {
    id: 'hrrr-vis',
    label: 'Visibility / Fog',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      </svg>
    ),
  },
  {
    id: 'sst-mur',
    label: 'Sea temperature',
    type: 'map-layer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M12 9V2M12 9a3 3 0 106 0M12 9a3 3 0 10-6 0" />
        <path d="M12 22a5 5 0 005-5V9h-10v8a5 5 0 005 5z" />
      </svg>
    ),
  },
  {
    id: 'wind',
    label: 'Wind',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M9.59 4.59A2 2 0 1111 8H2" strokeLinecap="round" />
        <path d="M12.59 19.41A2 2 0 1014 16H2" strokeLinecap="round" />
        <path d="M17.73 7.73A2.5 2.5 0 1119.5 12H2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'waves',
    label: 'Waves',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
        <path d="M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
        <path d="M2 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'pressure',
    label: 'Pressure',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 3.5L6 2M16 3.5L18 2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'true-color-viirs',
    label: 'Satellite',
    type: 'map-layer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    id: 'cloud-cover',
    label: 'Clouds',
    type: 'weather-overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
      </svg>
    ),
  },
  {
    id: 'currents',
    label: 'Currents',
    type: 'map-layer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
        <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
        <path d="M2 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'chlorophyll',
    label: 'Chlorophyll',
    type: 'map-layer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M12 22V8" />
        <path d="M5 12c0-5 7-10 7-10s7 5 7 10-3.13 7-7 7-7-2-7-7z" />
      </svg>
    ),
  },
  {
    id: 'bathymetry',
    label: 'Depth',
    type: 'map-layer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M2 20l4-4 4 2 4-6 4 4 4-8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 20h20" />
      </svg>
    ),
  },
  {
    id: 'bathymetry-contours',
    label: 'Contours',
    type: 'map-layer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <ellipse cx="12" cy="14" rx="9" ry="5" />
        <ellipse cx="12" cy="13" rx="6" ry="3.5" />
        <ellipse cx="12" cy="12" rx="3" ry="2" />
      </svg>
    ),
  },
  {
    id: 'noaa-charts',
    label: 'Nautical charts',
    type: 'map-layer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M9 3l6 3v15l-6-3V3z" />
        <path d="M3 6l6-3v15l-6 3V6z" />
        <path d="M15 6l6-3v15l-6 3V6z" />
      </svg>
    ),
  },
  {
    id: 'fishing-spots',
    label: 'Fishing spots',
    type: 'map-layer',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M18 3l-3 9h6l-3 9" />
        <circle cx="8" cy="8" r="3" />
        <path d="M8 11v6" />
        <path d="M5 14h6" />
      </svg>
    ),
  },
]

export default function WeatherIconBar() {
  const weatherOverlays = useWeatherStore((s) => s.overlays)
  const toggleWeatherOverlay = useWeatherStore((s) => s.toggleOverlay)
  const mapLayers = useMapStore((s) => s.layers)
  const toggleMapLayer = useMapStore((s) => s.toggleLayer)

  const isActive = (feature: WeatherFeature): boolean => {
    if (feature.type === 'weather-overlay') {
      return weatherOverlays.find((o) => o.id === feature.id)?.visible ?? false
    }
    return mapLayers.find((l) => l.id === feature.id)?.visible ?? false
  }

  const handleToggle = (feature: WeatherFeature) => {
    if (feature.type === 'weather-overlay') {
      toggleWeatherOverlay(feature.id)
    } else {
      toggleMapLayer(feature.id)
    }
  }

  return (
    <div className="absolute top-14 right-3 z-20 flex flex-col gap-1">
      {FEATURES.map((feature) => {
        const active = isActive(feature)
        return (
          <button
            key={feature.id}
            onClick={() => handleToggle(feature)}
            title={feature.label}
            className={cn(
              'group relative flex items-center justify-center w-9 h-9 rounded-lg transition-all',
              active
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'glass border border-ocean-600/50 text-slate-400 hover:text-slate-200 hover:border-ocean-500',
            )}
          >
            {feature.icon}
            {/* Tooltip */}
            <span className="absolute right-full mr-2 px-2 py-1 rounded-md bg-ocean-900 border border-ocean-700 text-xs text-slate-300 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg">
              {feature.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
