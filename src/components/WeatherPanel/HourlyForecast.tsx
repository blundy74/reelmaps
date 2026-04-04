import type { HourlyEntry } from '../../lib/weatherTypes'
import { WMO_CODES, degreesToCardinal, getWeatherIcon } from '../../lib/weatherTypes'

interface Props {
  entries: HourlyEntry[]
}

export default function HourlyForecast({ entries }: Props) {
  if (!entries.length) return null

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
        48-Hour Forecast
      </h3>
      <div className="overflow-x-auto -mx-3 px-3">
        <div className="flex gap-1 pb-2" style={{ minWidth: entries.length * 56 }}>
          {entries.map((h, i) => {
            const date = new Date(h.time)
            const hour = date.getHours()
            const isNow = i === 0
            const isMidnight = hour === 0
            return (
              <div
                key={h.time}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg min-w-[52px] transition-colors ${
                  isNow
                    ? 'bg-cyan-500/15 border border-cyan-500/30'
                    : isMidnight
                    ? 'bg-ocean-800/80 border border-ocean-600/30'
                    : 'hover:bg-ocean-800/50'
                }`}
              >
                <span className="text-[10px] text-slate-500 font-medium">
                  {isNow ? 'Now' : date.toLocaleTimeString('en-US', { hour: 'numeric' }).replace(' ', '')}
                </span>
                {isMidnight && !isNow && (
                  <span className="text-[9px] text-cyan-500 font-semibold -mt-0.5">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                )}
                <span className="text-sm">{getWeatherIcon(h.weatherCode, h.isDay)}</span>
                <span className="text-xs font-semibold text-slate-200 font-mono">
                  {Math.round(h.temperature)}°
                </span>
                {/* Wind */}
                <div className="flex items-center gap-0.5">
                  <svg
                    width="8" height="8" viewBox="0 0 10 10"
                    style={{ transform: `rotate(${h.windDirection + 180}deg)` }}
                  >
                    <polygon points="5,0 3,8 5,6 7,8" fill="#94a3b8" />
                  </svg>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {Math.round(h.windSpeed)}
                  </span>
                </div>
                {/* Rain probability */}
                {h.precipProbability > 0 && (
                  <span className="text-[10px] text-blue-400 font-mono">
                    {h.precipProbability}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
