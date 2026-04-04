import type { DailyEntry } from '../../lib/weatherTypes'
import { WMO_CODES, degreesToCardinal } from '../../lib/weatherTypes'

interface Props {
  entries: DailyEntry[]
}

export default function DailyForecast({ entries }: Props) {
  if (!entries.length) return null

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
        7-Day Forecast
      </h3>
      <div className="space-y-1">
        {entries.map((d) => {
          const wmo = WMO_CODES[d.weatherCode] ?? { label: 'Unknown', icon: '🌤️' }
          const isToday = d.date === today
          const dayName = isToday
            ? 'Today'
            : new Date(d.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'short' })

          // Temperature bar visualization
          const allHighs = entries.map((e) => e.tempHigh)
          const allLows = entries.map((e) => e.tempLow)
          const minT = Math.min(...allLows)
          const maxT = Math.max(...allHighs)
          const range = maxT - minT || 1
          const barLeft = ((d.tempLow - minT) / range) * 100
          const barWidth = ((d.tempHigh - d.tempLow) / range) * 100

          return (
            <div
              key={d.date}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                isToday ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-ocean-800/50'
              }`}
            >
              {/* Day name */}
              <span className="text-xs text-slate-300 w-9 flex-shrink-0 font-medium">
                {dayName}
              </span>

              {/* Weather icon */}
              <span className="text-sm w-6 text-center flex-shrink-0">{wmo.icon}</span>

              {/* Precip probability */}
              <span className={`text-[10px] font-mono w-7 flex-shrink-0 text-right ${
                d.precipProbabilityMax > 30 ? 'text-blue-400' : 'text-slate-600'
              }`}>
                {d.precipProbabilityMax > 0 ? `${d.precipProbabilityMax}%` : ''}
              </span>

              {/* Low temp */}
              <span className="text-xs text-slate-500 font-mono w-7 text-right flex-shrink-0">
                {Math.round(d.tempLow)}°
              </span>

              {/* Temperature bar */}
              <div className="flex-1 h-1.5 bg-ocean-700/50 rounded-full relative mx-1 min-w-[40px]">
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    left: `${barLeft}%`,
                    width: `${Math.max(barWidth, 4)}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #f59e0b)',
                  }}
                />
              </div>

              {/* High temp */}
              <span className="text-xs text-slate-200 font-mono w-7 flex-shrink-0">
                {Math.round(d.tempHigh)}°
              </span>

              {/* Wind */}
              <div className="flex items-center gap-0.5 w-12 flex-shrink-0 justify-end">
                <svg
                  width="8" height="8" viewBox="0 0 10 10"
                  style={{ transform: `rotate(${d.windDirectionDominant + 180}deg)` }}
                >
                  <polygon points="5,0 3,8 5,6 7,8" fill="#94a3b8" />
                </svg>
                <span className="text-[10px] text-slate-400 font-mono">
                  {Math.round(d.windSpeedMax)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
