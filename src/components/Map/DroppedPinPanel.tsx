import { useState, useEffect } from 'react'
import { useMapStore } from '../../store/mapStore'
import { useWeatherStore } from '../../store/weatherStore'
import { useUserSpotsStore } from '../../store/userSpotsStore'
import { WMO_CODES, degreesToCardinal, windToBeaufort, waveHeightToSeaState } from '../../lib/weatherTypes'

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
  const sstActive = mapLayers.find((l) => l.id === 'sst-mur')?.visible ?? false
  const currentsActive = mapLayers.find((l) => l.id === 'currents')?.visible ?? false
  const chlorophyllActive = mapLayers.find((l) => l.id === 'chlorophyll')?.visible ?? false
  const salinityActive = mapLayers.find((l) => l.id === 'salinity')?.visible ?? false

  return { windActive, radarActive, sstActive, currentsActive, chlorophyllActive, salinityActive }
}

/** Fetch ocean depth (meters) from ETOPO 2022 via ERDDAP for a single point.
 *  Proxied through the tile Lambda to avoid CORS issues with ERDDAP. */
const TILE_BASE = import.meta.env.VITE_HRRR_TILE_URL || 'https://xhac6pdww5.execute-api.us-east-2.amazonaws.com'

async function fetchDepth(lat: number, lng: number): Promise<number | null> {
  try {
    const url = `${TILE_BASE}/tiles/depth?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null)
    if (!res || !res.ok) return null
    const data = await res.json()
    return data?.depth ?? null
  } catch {
    return null
  }
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
      fetchDepth(droppedPin.lat, droppedPin.lng).then((alt) => {
        if (alt != null && alt < 0) {
          // Convert meters to feet (negative altitude = ocean depth)
          setDepthFt(Math.round(Math.abs(alt) * 3.28084))
        } else {
          setDepthFt(null) // on land or no data
        }
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
    <div className="absolute top-14 left-3 right-3 md:left-auto md:right-14 z-20 animate-fade-in">
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

        <div className="px-4 py-3 space-y-2.5">
          {/* Context-aware weather measurements */}
          {effectiveCurrent && (
            <div className="space-y-2">
              {/* Forecast hour label */}
              {forecastEntry && selectedForecastHour > 0 && (
                <div className="text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded px-2 py-1 text-center">
                  Forecast: {new Date(forecastEntry.time).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                </div>
              )}
              {/* Conditions summary — hidden on mobile */}
              <div className="hidden md:flex items-center justify-between bg-ocean-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{wmo?.icon}</span>
                  <div>
                    <span className="text-lg font-bold text-slate-100 font-mono">{Math.round(effectiveCurrent.temperature)}°F</span>
                    <span className="text-xs text-slate-500 ml-1">{wmo?.label}</span>
                  </div>
                </div>
              </div>

              {/* Mobile compact view — wave height, wind, gusts only */}
              <div className="md:hidden space-y-1.5">
                {showMarine && (
                  <div className="flex items-center justify-between bg-ocean-800 rounded-lg px-3 py-2">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase">Waves</div>
                      <span className="text-sm font-semibold text-slate-200 font-mono">{marineNow.waveHeight.toFixed(1)} ft</span>
                      <span className="text-xs text-slate-500 ml-1">{marineNow.wavePeriod.toFixed(0)}s</span>
                    </div>
                    {seaState && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        seaState.state <= 2 ? 'bg-emerald-500/20 text-emerald-400' :
                        seaState.state <= 4 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>{seaState.label}</span>
                    )}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <div className="flex-1 bg-ocean-800 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 uppercase">Wind</div>
                    <div className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 10 10" style={{ transform: `rotate(${effectiveCurrent.windDirection + 180}deg)` }}>
                        <polygon points="5,0 3,8 5,6 7,8" fill="#06b6d4" />
                      </svg>
                      <span className="text-sm font-semibold text-slate-200 font-mono">{Math.round(effectiveCurrent.windSpeed)}</span>
                      <span className="text-[10px] text-slate-500">mph {degreesToCardinal(effectiveCurrent.windDirection)}</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-ocean-800 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-slate-500 uppercase">Gusts</div>
                    <span className="text-sm font-semibold text-amber-400 font-mono">{Math.round(effectiveCurrent.windGusts)} mph</span>
                  </div>
                </div>
              </div>

              {/* Desktop full view — Wind data */}
              {(showWind || showGeneral) && (
                <div className="hidden md:block bg-ocean-800 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Wind</div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 10 10" style={{ transform: `rotate(${effectiveCurrent.windDirection + 180}deg)` }}>
                        <polygon points="5,0 3,8 5,6 7,8" fill="#06b6d4" />
                      </svg>
                      <span className="text-sm font-semibold text-slate-200 font-mono">
                        {Math.round(effectiveCurrent.windSpeed)} mph
                      </span>
                      <span className="text-xs text-slate-500">{degreesToCardinal(effectiveCurrent.windDirection)}</span>
                    </div>
                    {beaufort && (
                      <span className="text-[10px] text-slate-400">
                        {beaufort.label} (F{beaufort.force})
                      </span>
                    )}
                  </div>
                  {effectiveCurrent.windGusts > effectiveCurrent.windSpeed + 5 && (
                    <div className="text-xs text-amber-400 mt-0.5">
                      Gusts: {Math.round(effectiveCurrent.windGusts)} mph
                    </div>
                  )}
                </div>
              )}

              {/* Desktop: Marine / Wave data */}
              {showMarine && (
                <div className="hidden md:block bg-ocean-800 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Waves</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-200 font-mono">
                      {marineNow.waveHeight.toFixed(1)} ft
                    </span>
                    {seaState && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        seaState.state <= 2 ? 'bg-emerald-500/20 text-emerald-400' :
                        seaState.state <= 4 ? 'bg-amber-500/20 text-amber-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {seaState.label}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {marineNow.wavePeriod.toFixed(0)}s period from {degreesToCardinal(marineNow.waveDirection)}
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
                    <span>Swell: {marineNow.swellHeight.toFixed(1)} ft @ {marineNow.swellPeriod.toFixed(0)}s</span>
                  </div>
                </div>
              )}

              {/* Desktop: SST */}
              {showSST && marineNow && (
                <div className="hidden md:block bg-ocean-800 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Sea Surface Temp</div>
                  <span className="text-sm font-semibold text-slate-200 font-mono">
                    {Math.round(marineNow.seaSurfaceTemp)}°F
                  </span>
                </div>
              )}

              {/* Desktop: Ocean currents */}
              {showCurrents && marineNow && (
                <div className="hidden md:block bg-ocean-800 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ocean Current</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200 font-mono">
                      {marineNow.oceanCurrentSpeed.toFixed(1)} kt
                    </span>
                    <span className="text-xs text-slate-400">
                      toward {degreesToCardinal(marineNow.oceanCurrentDirection)}
                    </span>
                  </div>
                </div>
              )}

              {/* Desktop: General extras */}
              {showGeneral && (
                <div className="hidden md:grid grid-cols-2 gap-1.5">
                  <div className="bg-ocean-800 rounded-lg px-2 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Pressure</div>
                    <div className="text-xs font-semibold text-slate-300 font-mono">{effectiveCurrent.pressure.toFixed(0)} mb</div>
                  </div>
                  <div className="bg-ocean-800 rounded-lg px-2 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Humidity</div>
                    <div className="text-xs font-semibold text-slate-300 font-mono">{effectiveCurrent.humidity}%</div>
                  </div>
                  <div className="bg-ocean-800 rounded-lg px-2 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Visibility</div>
                    <div className="text-xs font-semibold text-slate-300 font-mono">{effectiveCurrent.visibility.toFixed(1)} mi</div>
                  </div>
                  <div className="bg-ocean-800 rounded-lg px-2 py-1.5">
                    <div className="text-[9px] text-slate-500 uppercase">Clouds</div>
                    <div className="text-xs font-semibold text-slate-300 font-mono">{effectiveCurrent.cloudCover}%</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ocean Depth */}
          <div className="bg-ocean-800 rounded-lg px-3 py-2">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Ocean Depth</div>
            {depthLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                <span className="text-xs text-slate-500">Fetching...</span>
              </div>
            ) : depthFt != null ? (
              <span className="text-sm font-semibold text-cyan-300 font-mono">{depthFt.toLocaleString()} ft</span>
            ) : (
              <span className="text-xs text-slate-600">Land / no data</span>
            )}
          </div>

          {/* Coordinates */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Coordinates</p>
            <div className="flex items-center justify-between bg-ocean-800 rounded-lg px-3 py-1.5">
              <span className="text-xs font-mono text-cyan-300 tabular-nums">
                {lat.toFixed(6)}°, {lng.toFixed(6)}°
              </span>
              <CopyButton text={decimalStr} />
            </div>
          </div>

          <div>
            <div className="bg-ocean-800 rounded-lg px-3 py-1.5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-mono text-slate-400 tabular-nums">{dmsLat}</p>
                  <p className="text-[10px] font-mono text-slate-400 tabular-nums">{dmsLng}</p>
                </div>
                <CopyButton text={dmsStr} />
              </div>
            </div>
          </div>

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
              onClick={() => navigator.clipboard.writeText(`${decimalStr}\n${dmsStr}`)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-ocean-700 hover:bg-ocean-600 text-xs text-slate-300 hover:text-slate-100 transition-colors border border-ocean-600"
            >
              Copy All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
