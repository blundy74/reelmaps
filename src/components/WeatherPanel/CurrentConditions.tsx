import type { CurrentWeather } from '../../lib/weatherTypes'
import { WMO_CODES, degreesToCardinal, windToBeaufort } from '../../lib/weatherTypes'
import WindCompass from './WindCompass'

interface Props {
  weather: CurrentWeather
}

export default function CurrentConditions({ weather }: Props) {
  const wmo = WMO_CODES[weather.weatherCode] ?? { label: 'Unknown', icon: '🌤️' }
  const beaufort = windToBeaufort(weather.windSpeed)

  return (
    <div className="space-y-4">
      {/* Main weather summary */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold text-slate-100 font-mono">
            {Math.round(weather.temperature)}°F
          </div>
          <div className="text-sm text-slate-400">
            Feels like {Math.round(weather.apparentTemperature)}°F
          </div>
          <div className="text-sm text-cyan-400 mt-1">
            {wmo.icon} {wmo.label}
          </div>
        </div>
        <WindCompass
          direction={weather.windDirection}
          speed={weather.windSpeed}
          gusts={weather.windGusts}
          size={100}
        />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Wind" value={`${Math.round(weather.windSpeed)} mph`} sub={`${beaufort.label} (F${beaufort.force})`} />
        <StatCard label="Gusts" value={`${Math.round(weather.windGusts)} mph`} sub={`from ${degreesToCardinal(weather.windDirection)}`} />
        <StatCard label="Pressure" value={`${weather.pressure.toFixed(0)} mb`} />
        <StatCard label="Humidity" value={`${weather.humidity}%`} />
        <StatCard label="Cloud Cover" value={`${weather.cloudCover}%`} />
        <StatCard label="Visibility" value={`${weather.visibility.toFixed(1)} mi`} />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-ocean-800/60 rounded-lg px-3 py-2 border border-ocean-700/50">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-slate-200 font-mono">{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  )
}
