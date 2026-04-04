import { useWeatherStore } from '../../store/weatherStore'
import { cn } from '../../lib/utils'

export default function WeatherOverlayControls() {
  const { overlays, toggleOverlay, setOverlayOpacity } = useWeatherStore()

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
        Weather Overlays
      </h3>
      <p className="text-[11px] text-slate-500 px-1">
        Toggle weather data layers on the map.
      </p>

      <div className="space-y-2">
        {overlays.map((overlay) => (
          <div
            key={overlay.id}
            className={cn(
              'rounded-lg border p-3 transition-all',
              overlay.visible
                ? 'border-cyan-500/40 bg-cyan-500/10'
                : 'border-ocean-700 bg-ocean-800/50 hover:border-ocean-600',
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <button
                onClick={() => toggleOverlay(overlay.id)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <div className={cn(
                  'w-8 h-4 rounded-full relative transition-colors',
                  overlay.visible ? 'bg-cyan-500' : 'bg-ocean-600',
                )}>
                  <div className={cn(
                    'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                    overlay.visible ? 'translate-x-4' : 'translate-x-0.5',
                  )} />
                </div>
                <span className={cn(
                  'text-sm font-medium',
                  overlay.visible ? 'text-slate-200' : 'text-slate-400',
                )}>
                  {overlay.name}
                </span>
              </button>
            </div>

            {overlay.visible && (
              <div className="flex items-center gap-2 mt-2 pl-10">
                <span className="text-[10px] text-slate-500 w-8">
                  {Math.round(overlay.opacity * 100)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={overlay.opacity}
                  onChange={(e) => setOverlayOpacity(overlay.id, parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-ocean-600 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                    [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-cyan-400"
                />
              </div>
            )}

            {overlay.id === 'radar' && overlay.visible && (
              <p className="text-[10px] text-slate-500 mt-1 pl-10">
                Live precipitation radar from RainViewer
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
