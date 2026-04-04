import type { MarineData } from '../../lib/weatherTypes'
import { degreesToCardinal, waveHeightToSeaState } from '../../lib/weatherTypes'

interface Props {
  marine: MarineData
}

export default function MarineConditions({ marine }: Props) {
  // Use the current/first hourly entry
  const now = marine.hourly[0]
  if (!now) return null

  const seaState = waveHeightToSeaState(now.waveHeight)

  return (
    <div className="space-y-4">
      {/* Sea state summary */}
      <div className="bg-ocean-800/60 rounded-xl p-3 border border-ocean-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sea State</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            seaState.state <= 2 ? 'bg-emerald-500/20 text-emerald-400' :
            seaState.state <= 4 ? 'bg-amber-500/20 text-amber-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {seaState.label} (SS{seaState.state})
          </span>
        </div>
        <div className="text-2xl font-bold text-slate-100 font-mono">
          {now.waveHeight.toFixed(1)} <span className="text-sm text-slate-400">ft</span>
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          {now.wavePeriod.toFixed(0)}s period from {degreesToCardinal(now.waveDirection)} ({Math.round(now.waveDirection)}°)
        </div>
      </div>

      {/* Detailed breakdown */}
      <div className="grid grid-cols-2 gap-2">
        {/* Wind Waves */}
        <div className="bg-ocean-800/60 rounded-lg p-2.5 border border-ocean-700/50">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Wind Waves</div>
          <div className="text-sm font-semibold text-slate-200 font-mono">
            {now.windWaveHeight.toFixed(1)} ft
          </div>
          <div className="text-[10px] text-slate-500">
            {now.windWavePeriod.toFixed(0)}s {degreesToCardinal(now.windWaveDirection)}
          </div>
        </div>

        {/* Swell */}
        <div className="bg-ocean-800/60 rounded-lg p-2.5 border border-ocean-700/50">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Swell</div>
          <div className="text-sm font-semibold text-slate-200 font-mono">
            {now.swellHeight.toFixed(1)} ft
          </div>
          <div className="text-[10px] text-slate-500">
            {now.swellPeriod.toFixed(0)}s {degreesToCardinal(now.swellDirection)}
          </div>
        </div>

        {/* Ocean Current */}
        <div className="bg-ocean-800/60 rounded-lg p-2.5 border border-ocean-700/50">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Current</div>
          <div className="text-sm font-semibold text-slate-200 font-mono">
            {now.oceanCurrentSpeed.toFixed(1)} kt
          </div>
          <div className="text-[10px] text-slate-500">
            toward {degreesToCardinal(now.oceanCurrentDirection)}
          </div>
        </div>

        {/* SST */}
        <div className="bg-ocean-800/60 rounded-lg p-2.5 border border-ocean-700/50">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Sea Temp</div>
          <div className="text-sm font-semibold text-slate-200 font-mono">
            {Math.round(now.seaSurfaceTemp)}°F
          </div>
        </div>
      </div>

      {/* Marine hourly timeline */}
      <div className="space-y-1.5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
          Marine Forecast (72h)
        </h3>
        <div className="overflow-x-auto -mx-3 px-3">
          <div className="flex gap-1 pb-2" style={{ minWidth: Math.min(marine.hourly.length, 72) * 56 }}>
            {marine.hourly.slice(0, 72).map((h, i) => {
              const date = new Date(h.time)
              const hour = date.getHours()
              const isNow = i === 0
              const isMidnight = hour === 0
              const ss = waveHeightToSeaState(h.waveHeight)

              return (
                <div
                  key={h.time}
                  className={`flex flex-col items-center gap-0.5 px-1.5 py-2 rounded-lg min-w-[52px] ${
                    isNow ? 'bg-cyan-500/15 border border-cyan-500/30' :
                    isMidnight ? 'bg-ocean-800/80 border border-ocean-600/30' :
                    'hover:bg-ocean-800/50'
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

                  {/* Wave height with color indicator */}
                  <div className={`text-xs font-semibold font-mono ${
                    ss.state <= 2 ? 'text-emerald-400' :
                    ss.state <= 4 ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {h.waveHeight.toFixed(1)}
                  </div>
                  <span className="text-[9px] text-slate-500">{h.wavePeriod.toFixed(0)}s</span>

                  {/* Swell arrow */}
                  <svg
                    width="10" height="10" viewBox="0 0 10 10"
                    style={{ transform: `rotate(${h.swellDirection + 180}deg)` }}
                  >
                    <polygon points="5,0 3,8 5,6 7,8" fill="#06b6d4" />
                  </svg>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {h.swellHeight.toFixed(1)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
