/**
 * Right-side weather sidebar — contains weather overlays with opacity controls,
 * a forecast toggle button at the top, and the AI Fishing Report.
 */

import { useWeatherStore } from '../../store/weatherStore'
import { cn } from '../../lib/utils'
// import FishingReport from './FishingReport' // temporarily disabled

interface WeatherLayerDef {
  id: string
  name: string
  description: string
  icon: React.ReactNode
}

const WEATHER_LAYERS: WeatherLayerDef[] = [
  {
    id: 'wind',
    name: 'Wind',
    description: 'Animated wind speed & direction',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M9.59 4.59A2 2 0 1111 8H2" strokeLinecap="round" />
        <path d="M12.59 19.41A2 2 0 1014 16H2" strokeLinecap="round" />
        <path d="M17.73 7.73A2.5 2.5 0 1119.5 12H2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'waves',
    name: 'Waves',
    description: 'Wave height & direction',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
        <path d="M2 8c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
        <path d="M2 16c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'pressure',
    name: 'Pressure',
    description: 'Barometric pressure isobars',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'radar',
    name: 'Rain Radar',
    description: 'Live precipitation radar',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2" />
      </svg>
    ),
  },
  {
    id: 'cloud-cover',
    name: 'Clouds',
    description: 'Cloud cover overlay',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
        <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
      </svg>
    ),
  },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function WeatherSidebar({ open, onClose }: Props) {
  const { panelOpen, setPanelOpen, overlays, toggleOverlay, setOverlayOpacity } = useWeatherStore()

  return (
    <>
      {/* Mobile backdrop — fades in/out */}
      <div
        className={cn(
          'md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'bg-ocean-900 border-l border-ocean-700 flex flex-col overflow-hidden',
          // Mobile: fixed drawer with transform transition only
          'fixed top-14 bottom-0 right-0 z-40 w-72 transition-transform duration-300 ease-in-out',
          // Desktop: inline sidebar with width transition
          'md:relative md:top-auto md:bottom-auto md:z-auto md:flex-shrink-0 md:transition-all',
          open ? 'translate-x-0 md:w-64' : 'translate-x-full md:translate-x-0 md:w-0',
        )}
        style={{ minWidth: open ? undefined : '0px' }}
        aria-hidden={!open}
      >
        {/* Header with forecast toggle */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-ocean-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <span className="text-sm font-semibold text-slate-200">Weather</span>
          </div>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Forecast toggle */}
        <div className="px-3 py-2 border-b border-ocean-700 flex-shrink-0">
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all border',
              panelOpen
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                : 'border-ocean-600 bg-ocean-800 text-slate-400 hover:border-ocean-500',
            )}
          >
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Forecast Timeline</span>
            </div>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full',
              panelOpen ? 'bg-cyan-500/20 text-cyan-400' : 'bg-ocean-700 text-slate-500',
            )}>
              {panelOpen ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Weather overlay layers */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
            Weather Overlays
          </p>

          {WEATHER_LAYERS.map((layer) => {
            const overlay = overlays.find((o) => o.id === layer.id)
            if (!overlay) return null
            const active = overlay.visible

            return (
              <div
                key={layer.id}
                className={cn(
                  'rounded-lg border p-2.5 transition-all',
                  active
                    ? 'border-cyan-500/30 bg-cyan-500/8'
                    : 'border-ocean-700/50 bg-ocean-800/30 hover:border-ocean-600',
                )}
              >
                {/* Toggle row */}
                <button
                  onClick={() => toggleOverlay(layer.id)}
                  className="flex items-center gap-2 w-full text-left"
                >
                  <div className={cn(
                    'w-9 h-5 md:w-7 md:h-3.5 rounded-full relative transition-colors flex-shrink-0',
                    active ? 'bg-cyan-500' : 'bg-ocean-600',
                  )}>
                    <div className={cn(
                      'absolute top-0.5 w-4 h-4 md:w-2.5 md:h-2.5 rounded-full bg-white transition-transform',
                      active ? 'translate-x-4 md:translate-x-3.5' : 'translate-x-0.5',
                    )} />
                  </div>
                  <div className={cn('flex items-center gap-1.5', active ? 'text-slate-200' : 'text-slate-400')}>
                    {layer.icon}
                    <span className="text-xs font-medium">{layer.name}</span>
                  </div>
                </button>

                {/* Opacity slider (shown when active) */}
                {active && (
                  <div className="flex items-center gap-2 mt-2 pl-9">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={overlay.opacity}
                      onChange={(e) => setOverlayOpacity(layer.id, parseFloat(e.target.value))}
                      className="flex-1 h-1.5 md:h-1 bg-ocean-600 rounded-full appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:md:w-3
                        [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:md:h-3 [&::-webkit-slider-thumb]:rounded-full
                        [&::-webkit-slider-thumb]:bg-cyan-400"
                    />
                    <span className="text-[10px] text-slate-500 w-7 text-right">
                      {Math.round(overlay.opacity * 100)}%
                    </span>
                  </div>
                )}

                {/* Description */}
                {active && (
                  <p className="text-[10px] text-slate-600 mt-1 pl-9">{layer.description}</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Attribution */}
        <div className="flex-shrink-0 px-3 py-2 border-t border-ocean-700">
          <p className="text-[8px] text-slate-600 text-center">
            Open-Meteo | RainViewer | NOAA
          </p>
          <a href="#admin" className="block text-[8px] text-ocean-800 hover:text-ocean-600 text-center mt-1 transition-colors select-none">
            admin
          </a>
        </div>
      </aside>
    </>
  )
}
