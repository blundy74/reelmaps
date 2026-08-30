import { useState, useEffect } from 'react'
import { useMapStore } from '../../store/mapStore'
import { useWeatherStore } from '../../store/weatherStore'
import { useUserSpotsStore } from '../../store/userSpotsStore'
import { WMO_CODES, degreesToCardinal, windToBeaufort, waveHeightToSeaState, mphToKnots } from '../../lib/weatherTypes'
import {
  MISSING_DISPLAY,
  formatModelCurrentKt,
  formatModelFeet,
  formatModelTempF,
  isUnavailableZero,
} from '../../lib/marineDisplay'
import { fetchDepthFeet, formatDepthFeet } from '../../lib/oceanDepth'

/** Convert decimal degrees to degrees-minutes-seconds string */
function toDMS(decimal: number, isLat: boolean): string {
  const abs = Math.abs(decimal)
  const deg = Math.floor(abs)
  const minFloat = (abs - deg) * 60
  const min = Math.floor(minFloat)
  const sec = ((minFloat - min) * 60).toFixed(2)
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W')
  return `${deg}° ${String(min).padStart(2, '0')}' ${String(sec).padStart(5, '0')}" ${dir}`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={copy}
      className="ml-1.5 p-1 rounded hover:bg-ocean-600 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  )
}

/** Determine which weather features are currently active */
function useActiveWeatherContext() {
  const weatherOverlays = useWeatherStore((s) => s.overlays)
  const mapLayers = useMapStore((s) => s.layers)

  const windActive = weatherOverlays.find((o) => o.id === 'wind')?.visible ?? false
  const radarActive = weatherOverlays.find((o) => o.id === 'radar')?.visible ?? false
  const sstActive = mapLayers.some((l) => (l.id === 'sst-mur' || l.id === 'sst-goes') && l.visible)
  const currentsActive = mapLayers.find((l) => l.id === 'currents')?.visible ?? false
  const chlorophyllActive = mapLayers.find((l) => l.id === 'chlorophyll')?.visible ?? false
  const salinityActive = mapLayers.find((l) => l.id === 'salinity')?.visible ?? false

  return { windActive, radarActive, sstActive, currentsActive, chlorophyllActive, salinityActive }
}

export default function DroppedPinPanel() {
  const { droppedPin, setDroppedPin, setPinModeActive } = useMapStore()
  const { current, hourly, marine, fetchWeather, panelOpen, selectedForecastHour } = useWeatherStore()
  const addSpot = useUserSpotsStore((s) => s.addSpot)
  const ctx = useActiveWeatherContext()
  const [depthFt, setDepthFt] = useState<number | null>(null)
  const [depthLoading, setDepthLoading] = useState(false)

  // Fetch weather and depth when pin is dropped
  useEffect(() => {
    if (droppedPin) {
      fetchWeather(droppedPin.lat, droppedPin.lng)
      setDepthFt(null)
      setDepthLoading(true)
      fetchDepthFeet(droppedPin.lat, droppedPin.lng).then((ft) => {
        setDepthFt(ft)
        setDepthLoading(false)
      })
    }
  }, [droppedPin, fetchWeather])

  if (!droppedPin) return null

  const { lat, lng } = droppedPin
  const decimalStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  const dmsLat = toDMS(lat, true)
  const dmsLng = toDMS(lng, false)
  const dmsStr = `${dmsLat}, ${dmsLng}`
  const googleMapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`

  // Use forecast hour data when available, otherwise fall back to current
  const forecastIdx = Math.min(Math.floor(selectedForecastHour), (hourly?.length ?? 1) - 1)
  const forecastEntry = hourly?.[forecastIdx]

  // Build an effective "current" that tracks the forecast hour
  const effectiveCurrent = forecastEntry ? {
    temperature: forecastEntry.temperature,
    apparentTemperature: forecastEntry.temperature, // hourly doesn't have apparent
    humidity: 0,
    windSpeed: forecastEntry.windSpeed,
    windDirection: forecastEntry.windDirection,
    windGusts: forecastEntry.windGusts,
    pressure: current?.pressure ?? 0,
    cloudCover: forecastEntry.cloudCover,
    visibility: current?.visibility ?? 0,
    precipitation: forecastEntry.precipitation,
    weatherCode: forecastEntry.weatherCode,
    isDay: forecastEntry.isDay,
  } : current

  // Marine data also tracks forecast hour
  const marineIdx = Math.min(Math.floor(selectedForecastHour), (marine?.hourly?.length ?? 1) - 1)
  const marineNow = marine?.hourly[marineIdx]

  const wmo = effectiveCurrent ? (WMO_CODES[effectiveCurrent.weatherCode] ?? { label: 'Unknown', icon: '?' }) : null
  const beaufort = effectiveCurrent ? windToBeaufort(effectiveCurrent.windSpeed) : null
  const seaState = marineNow ? waveHeightToSeaState(marineNow.waveHeight) : null

  // Determine which context-specific data to show
  const showWind = ctx.windActive
  const showMarine = marineNow != null
  const showSST = ctx.sstActive
  const showCurrents = ctx.currentsActive
  const showGeneral = !showWind && !ctx.sstActive && !ctx.currentsActive

  return (
    <div className="absolute top-14 left-14 right-auto z-20 animate-fade-in max-w-[calc(100vw-8rem)]">
      <div className="glass rounded-2xl shadow-2xl overflow-hidden overflow-y-auto w-full md:w-72 max-h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ocean-700">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 flex-shrink-0">
              <svg viewBox="0 0 28 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="4" y1="2" x2="4" y2="46" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4 2 L24 8 L4 16 Z" fill="#06b6d4" stroke="#0891b2" strokeWidth="1"/>
                <circle cx="4" cy="46" r="2.5" fill="#06b6d4" stroke="#ffffff" strokeWidth="1"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-200">Dropped Flag</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPinModeActive(true)}
              className="p-1.5 rounded-lg hover:bg-ocean-600 text-slate-500 hover:text-cyan-400 transition-colors"
              title="Move pin"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
              </svg>
            </button>
            <button
              onClick={() => {
                const name = window.prompt('Name this spot:', `Spot ${lat.toFixed(4)}, ${lng.toFixed(4)}`)
                if (name) addSpot(name, lat, lng, 'flag', depthFt ?? undefined)
              }}
              className="p-1.5 rounded-lg hover:bg-ocean-600 text-slate-500 hover:text-cyan-400 transition-colors"
              title="Save to My Spots"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <button
              onClick={() => setDroppedPin(null)}
              className="p-1.5 rounded-lg hover:bg-ocean-600 text-slate-500 hover:text-red-400 transition-colors"
              title="Remove pin"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-4 py-3 space-y-2">
          {/* Forecast hour label */}
          {forecastEntry && selectedForecastHour > 0 && (
            <div className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded px-2 py-1 text-center">
              Forecast: {new Date(forecastEntry.time).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            </div>
          )}

          {/* Coordinates + Depth — always visible */}
          <div className="flex gap-1.5">
            <div className="flex-1 bg-ocean-800 rounded-lg px-3 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-cyan-300 tabular-nums">
                  {lat.toFixed(6)}°, {lng.toFixed(6)}°
                </span>
                <CopyButton text={decimalStr} />
              </div>
            </div>
            <div className="bg-ocean-800 rounded-lg px-2.5 py-1.5 flex-shrink-0">
              {depthLoading ? (
                <div className="w-3 h-3 border border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              ) : depthFt != null ? (
                <span className="text-[10px] font-semibold text-cyan-300 font-mono">{formatDepthFeet(depthFt)}</span>
              ) : (
                <span className="text-[10px] text-slate-600">—</span>
              )}
            </div>
          </div>

          {/* Weather summary */}
          {effectiveCurrent && (
            <div className="flex items-center justify-between bg-ocean-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{wmo?.icon}</span>
                <span className="text-sm font-bold text-slate-100 font-mono">{Math.round(effectiveCurrent.temperature)}°F</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 10 10" style={{ transform: `rotate(${effectiveCurrent.windDirection + 180}deg)` }}>
                  <polygon points="5,0 3,8 5,6 7,8" fill="#06b6d4" />
                </svg>
                <span className="text-xs font-semibold text-slate-200 font-mono">{Math.round(mphToKnots(effectiveCurrent.windSpeed))}</span>
                <span className="text-[10px] text-slate-500">kt</span>
                {effectiveCurrent.windGusts > effectiveCurrent.windSpeed + 5 && (
                  <span className="text-[10px] text-amber-400 font-mono">G{Math.round(mphToKnots(effectiveCurrent.windGusts))}</span>
                )}
              </div>
            </div>
          )}

          {/* Marine data — horizontal scroll strip on mobile, grid on desktop */}
          {showMarine && marineNow && (
            <>
              {/* Section label */}
              <div className="text-[9px] text-slate-500 uppercase tracking-wider px-1">Marine Conditions</div>

              {/* Mobile: horizontal scroll cards */}
              <div className="md:hidden overflow-x-auto -mx-4 px-4 pb-1">
                <div className="flex gap-2 min-w-max">
                  {/* Combined Waves */}
                  <div className="bg-ocean-800 rounded-lg px-3 py-2 min-w-[130px]">
                    <div className="text-[9px] text-slate-500 uppercase mb-0.5">Waves</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-slate-100 font-mono">{marineNow.waveHeight.toFixed(1)}</span>
                      <span className="text-[10px] text-slate-500">ft</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{marineNow.wavePeriod.toFixed(0)}s {degreesToCardinal(marineNow.waveDirection)}</div>
                    {seaState && (
                      <span className={`inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        seaState.state <= 2 ? 'bg-emerald-500/20 text-emerald-400' :
                        seaState.state <= 4 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{seaState.label}</span>
                    )}
                  </div>

                  {/* Swell */}
                  <div className="bg-ocean-800 rounded-lg px-3 py-2 min-w-[120px]">
                    <div className="text-[9px] text-slate-500 uppercase mb-0.5">Swell</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-slate-100 font-mono">{formatModelFeet(marineNow.swellHeight).replace(' ft', '')}</span>
                      <span className="text-[10px] text-slate-500">{isUnavailableZero(marineNow.swellHeight) ? '' : 'ft'}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isUnavailableZero(marineNow.swellHeight)
                        ? MISSING_DISPLAY
                        : `${marineNow.swellPeriod.toFixed(0)}s ${degreesToCardinal(marineNow.swellDirection ?? 0)}`}
                    </div>
                  </div>

                  {/* Wind Waves */}
                  <div className="bg-ocean-800 rounded-lg px-3 py-2 min-w-[120px]">
                    <div className="text-[9px] text-slate-500 uppercase mb-0.5">Wind Waves</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-slate-100 font-mono">{formatModelFeet(marineNow.windWaveHeight).replace(' ft', '')}</span>
                      <span className="text-[10px] text-slate-500">{isUnavailableZero(marineNow.windWaveHeight) ? '' : 'ft'}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isUnavailableZero(marineNow.windWaveHeight)
                        ? MISSING_DISPLAY
                        : `${(marineNow.windWavePeriod ?? 0).toFixed(0)}s ${degreesToCardinal(marineNow.windWaveDirection ?? 0)}`}
                    </div>
                  </div>

                  {/* Model water temp — Open-Meteo marine, not satellite SST */}
                  <div className="bg-ocean-800 rounded-lg px-3 py-2 min-w-[100px]">
                    <div className="text-[9px] text-slate-500 uppercase mb-0.5">Model water temp</div>
                    <span className="text-sm font-bold text-cyan-300 font-mono">{formatModelTempF(marineNow.seaSurfaceTemp)}</span>
                  </div>

                  {/* Current */}
                  <div className="bg-ocean-800 rounded-lg px-3 py-2 min-w-[120px]">
                    <div className="text-[9px] text-slate-500 uppercase mb-0.5">Current</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-slate-100 font-mono">{formatModelCurrentKt(marineNow.oceanCurrentSpeed).replace(' kt', '')}</span>
                      <span className="text-[10px] text-slate-500">{isUnavailableZero(marineNow.oceanCurrentSpeed) ? '' : 'kt'}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {isUnavailableZero(marineNow.oceanCurrentSpeed)
                        ? MISSING_DISPLAY
                        : degreesToCardinal(marineNow.oceanCurrentDirection ?? 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop: compact grid */}
              <div className="hidden md:block space-y-1.5">
                {/* Waves row */}
                <div className="bg-ocean-800 rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-slate-500 uppercase">Combined Waves</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-slate-100 font-mono">{marineNow.waveHeight.toFixed(1)} ft</span>
                        <span className="text-xs text-slate-400">{marineNow.wavePeriod.toFixed(0)}s from {degreesToCardinal(marineNow.waveDirection)}</span>
                      </div>
                    </div>
                    {seaState && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        seaState.state <= 2 ? 'bg-emerald-500/20 text-emerald-400' :
                        seaState.state <= 4 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{seaState.label}</span>
                    )}
                  </div>
                </div>

                {/* Swell + Wind Waves side by side */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-ocean-800 rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Swell</div>
                    <div className="text-xs font-semibold text-slate-200 font-mono">
                      {isUnavailableZero(marineNow.swellHeight)
                        ? MISSING_DISPLAY
                        : `${marineNow.swellHeight!.toFixed(1)} ft @ ${marineNow.swellPeriod.toFixed(0)}s`}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isUnavailableZero(marineNow.swellHeight)
                        ? ''
                        : degreesToCardinal(marineNow.swellDirection ?? 0)}
                    </div>
                  </div>
                  <div className="bg-ocean-800 rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Wind Waves</div>
                    <div className="text-xs font-semibold text-slate-200 font-mono">
                      {isUnavailableZero(marineNow.windWaveHeight)
                        ? MISSING_DISPLAY
                        : `${marineNow.windWaveHeight!.toFixed(1)} ft @ ${(marineNow.windWavePeriod ?? 0).toFixed(0)}s`}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {isUnavailableZero(marineNow.windWaveHeight)
                        ? ''
                        : degreesToCardinal(marineNow.windWaveDirection ?? 0)}
                    </div>
                  </div>
                </div>

                {/* SST + Current side by side */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="bg-ocean-800 rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Model water temp</div>
                    <span className="text-xs font-semibold text-cyan-300 font-mono">{formatModelTempF(marineNow.seaSurfaceTemp)}</span>
                  </div>
                  <div className="bg-ocean-800 rounded-lg px-2.5 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Current</div>
                    <div className="text-xs font-semibold text-slate-200 font-mono">
                      {isUnavailableZero(marineNow.oceanCurrentSpeed)
                        ? MISSING_DISPLAY
                        : `${formatModelCurrentKt(marineNow.oceanCurrentSpeed)} ${degreesToCardinal(marineNow.oceanCurrentDirection ?? 0)}`}
                    </div>
                  </div>
                </div>

                {/* Wind details */}
                {effectiveCurrent && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="bg-ocean-800 rounded-lg px-2.5 py-1.5">
                      <div className="text-[9px] text-slate-500 uppercase">Wind</div>
                      <div className="flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: `rotate(${effectiveCurrent.windDirection + 180}deg)` }}>
                          <polygon points="5,0 3,8 5,6 7,8" fill="#06b6d4" />
                        </svg>
                        <span className="text-xs font-semibold text-slate-200 font-mono">{Math.round(mphToKnots(effectiveCurrent.windSpeed))} kt</span>
                        <span className="text-[10px] text-slate-500">{degreesToCardinal(effectiveCurrent.windDirection)}</span>
                      </div>
                      {beaufort && <div className="text-[10px] text-slate-500">{beaufort.label}</div>}
                    </div>
                    <div className="bg-ocean-800 rounded-lg px-2.5 py-1.5">
                      <div className="text-[9px] text-slate-500 uppercase">Gusts</div>
                      <span className="text-xs font-semibold text-amber-400 font-mono">{Math.round(mphToKnots(effectiveCurrent.windGusts))} kt</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 pt-0.5">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-ocean-700 hover:bg-ocean-600 text-xs text-slate-300 hover:text-slate-100 transition-colors border border-ocean-600"
            >
              Google Maps
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(decimalStr)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-ocean-700 hover:bg-ocean-600 text-xs text-slate-300 hover:text-slate-100 transition-colors border border-ocean-600"
            >
              Copy Coords
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
