/**
 * Bottom forecast bar — compact hourly timeline with play button.
 * Shows date label at top, scrollable hourly forecast, and play controls.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWeatherStore } from '../../store/weatherStore'
import { useMapStore } from '../../store/mapStore'
import { degreesToCardinal, getWeatherIcon } from '../../lib/weatherTypes'
import { cn } from '../../lib/utils'

export default function BottomWeatherBar() {
  const {
    panelOpen,
    location,
    current,
    hourly,
    loading,
    fetchWeather,
    setSelectedForecastHour,
    selectedForecastHour,
    playbackSpeed,
  } = useWeatherStore()

  const droppedPin = useMapStore((s) => s.droppedPin)
  const clickedPoint = useMapStore((s) => s.clickedPoint)

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const playingRef = useRef(false)
  playingRef.current = playing
  const hourRef = useRef(0)
  const selectedIndexRef = useRef(0)
  selectedIndexRef.current = selectedIndex
  const scrollRef = useRef<HTMLDivElement>(null)
  const playheadLineRef = useRef<HTMLDivElement>(null)
  const progressFillRef = useRef<HTMLDivElement>(null)

  // Auto-fetch weather when pin/click changes
  useEffect(() => {
    if (!panelOpen) return
    const loc = droppedPin ?? clickedPoint
    if (loc) fetchWeather(loc.lat, loc.lng)
  }, [panelOpen, droppedPin, clickedPoint, fetchWeather])

  // Default fetch — deferred so it doesn't block page load
  const initialFetchDone = useRef(false)
  useEffect(() => {
    if (!panelOpen || current || loading || location || initialFetchDone.current) return
    initialFetchDone.current = true
    const timer = setTimeout(() => {
      const { viewState } = useMapStore.getState()
      fetchWeather(viewState.latitude, viewState.longitude)
    }, 3000)
    return () => clearTimeout(timer)
  }, [panelOpen, current, loading, location, fetchWeather])

  // Keep the playhead in sync when the user picks a column (or the rail table)
  useEffect(() => {
    if (playing) return
    const i = Math.max(0, Math.min(Math.round(selectedForecastHour), Math.min(hourly.length, 26) - 1))
    if (Number.isFinite(i) && i >= 0) {
      setSelectedIndex(i)
      hourRef.current = i
    }
  }, [selectedForecastHour, playing, hourly.length])

  // rAF playback — seconds-per-hour from settings (default 0.25s ≈ Windy)
  useEffect(() => {
    if (!playing) return
    const barLen = Math.min(hourly.length, 26)
    if (barLen <= 0) return

    let raf = 0
    let last = performance.now()
    hourRef.current = selectedIndexRef.current

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const secPerHour = Math.max(0.12, playbackSpeed)
      hourRef.current += dt / secPerHour
      if (hourRef.current >= barLen) hourRef.current = 0

      const whole = Math.min(barLen - 1, Math.floor(hourRef.current))
      const frac = hourRef.current - whole

      if (playheadLineRef.current) playheadLineRef.current.style.left = `${frac * 100}%`
      if (progressFillRef.current) progressFillRef.current.style.width = `${frac * 100}%`

      // Push whole hours to the store so map overlays don't rebuild mid-hour
      const storeHour = Math.floor(useWeatherStore.getState().selectedForecastHour)
      if (whole !== storeHour) {
        setSelectedForecastHour(whole)
        setSelectedIndex(whole)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, hourly.length, playbackSpeed, setSelectedForecastHour])

  // Auto-scroll to selected index — skip smooth scrolling while playing
  useEffect(() => {
    if (!scrollRef.current || selectedIndex < 0) return
    const wrapper = scrollRef.current.firstElementChild
    const child = wrapper?.children[selectedIndex] as HTMLElement | undefined
    if (!child) return
    child.scrollIntoView({
      behavior: playingRef.current ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [selectedIndex])

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false)
      setSelectedForecastHour(Math.floor(hourRef.current))
    } else {
      const barLen = Math.min(hourly.length, 26)
      if (selectedIndex >= barLen - 1) {
        setSelectedIndex(0)
        setSelectedForecastHour(0)
        hourRef.current = 0
      }
      setPlaying(true)
    }
  }, [playing, selectedIndex, hourly.length, setSelectedForecastHour])

  if (!panelOpen || loading || !hourly.length) return null

  const timeline = hourly.slice(0, 26)
  const selected = timeline[Math.min(selectedIndex, timeline.length - 1)]
  if (!selected) return null
  const selectedDate = new Date(selected.time)

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-ocean-900/95 backdrop-blur-md border-t border-ocean-700">
      <div className="flex items-center gap-3 px-4 py-2">
        <button
          onClick={togglePlay}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full transition-all flex-shrink-0',
            playing ? 'bg-cyan-400 text-ocean-950' : 'bg-ocean-700 text-slate-300 hover:bg-ocean-600',
          )}
        >
          {playing ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        <div className="bg-cyan-400 border border-cyan-200 rounded-lg px-3 py-1 flex-shrink-0">
          <span className="text-xs font-bold text-ocean-950">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' '}
            {selectedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-200 overflow-hidden">
          <span>{getWeatherIcon(selected.weatherCode, selected.isDay)} {Math.round(selected.temperature)}°F</span>
          <div className="flex items-center gap-0.5">
            <svg width="8" height="8" viewBox="0 0 10 10" style={{ transform: `rotate(${selected.windDirection + 180}deg)` }}>
              <polygon points="5,0 3,8 5,6 7,8" fill="#22d3ee" />
            </svg>
            <span className="font-mono">{Math.round(selected.windSpeed)} mph {degreesToCardinal(selected.windDirection)}</span>
          </div>
          {selected.precipProbability > 0 && (
            <span className="text-blue-300 font-mono">{selected.precipProbability}% rain</span>
          )}
        </div>

        {location && (
          <div className="ml-auto text-xs text-slate-500 flex-shrink-0 hidden sm:block">
            {Math.abs(location.lat).toFixed(2)}°{location.lat >= 0 ? 'N' : 'S'}, {Math.abs(location.lng).toFixed(2)}°{location.lng >= 0 ? 'E' : 'W'}
          </div>
        )}
      </div>

      <div className="overflow-x-auto px-4 pb-2" ref={scrollRef}>
        <div className="flex gap-0.5" style={{ minWidth: timeline.length * 44 }}>
          {timeline.map((h, i) => {
            const date = new Date(h.time)
            const hour = date.getHours()
            const isSelected = i === selectedIndex
            const isMidnight = hour === 0
            const nowDate = new Date()
            const isNowHour = date.getFullYear() === nowDate.getFullYear() &&
              date.getMonth() === nowDate.getMonth() &&
              date.getDate() === nowDate.getDate() &&
              date.getHours() === nowDate.getHours()
            const isPast = date.getTime() < nowDate.getTime() - 30 * 60 * 1000
            const hIcon = getWeatherIcon(h.weatherCode, h.isDay)
            const isPlayingThisHour = playing && isSelected

            return (
              <button
                key={h.time}
                onClick={() => {
                  setSelectedIndex(i)
                  setSelectedForecastHour(i)
                  hourRef.current = i
                  setPlaying(false)
                }}
                className={cn(
                  'relative flex flex-col items-center gap-0 px-1 py-1 rounded min-w-[42px] text-center overflow-hidden',
                  isSelected
                    ? 'bg-cyan-400 text-ocean-950 border-2 border-white shadow-[0_0_12px_rgba(34,211,238,0.65)] scale-105 z-[1]'
                    : isNowHour
                    ? 'bg-red-500/20 border-2 border-red-500 text-slate-100'
                    : isMidnight
                    ? 'bg-ocean-800/80 hover:bg-ocean-700/60 border border-transparent'
                    : isPast
                    ? 'opacity-70 hover:opacity-100 hover:bg-ocean-800/40 border border-transparent'
                    : 'hover:bg-ocean-800/40 border border-transparent',
                )}
              >
                {isPlayingThisHour && (
                  <div
                    ref={progressFillRef}
                    className="absolute inset-y-0 left-0 bg-white/35 z-0"
                    style={{ width: '0%' }}
                  />
                )}
                {isPlayingThisHour && (
                  <div
                    ref={playheadLineRef}
                    className="absolute top-0 bottom-0 z-10 w-[3px] bg-white shadow-[0_0_8px_#fff]"
                    style={{ left: '0%' }}
                  />
                )}
                {isNowHour && !isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500 z-10" />
                )}
                <span className={cn(
                  'relative z-[1] text-[9px] font-semibold',
                  isSelected ? 'text-ocean-950' : isNowHour ? 'text-red-400' : 'text-slate-400',
                )}>
                  {isNowHour ? 'Now' : isMidnight
                    ? date.toLocaleDateString('en-US', { weekday: 'short' })
                    : date.toLocaleTimeString('en-US', { hour: 'numeric' }).replace(' ', '')}
                </span>
                <span className="relative z-[1] text-xs">{hIcon}</span>
                <span className={cn(
                  'relative z-[1] text-[10px] font-bold font-mono',
                  isSelected ? 'text-ocean-950' : 'text-slate-100',
                )}>{Math.round(h.temperature)}°</span>
                <div className="relative z-[1] flex items-center gap-0.5">
                  <svg width="7" height="7" viewBox="0 0 10 10" style={{ transform: `rotate(${h.windDirection + 180}deg)` }}>
                    <polygon points="5,0 3,8 5,6 7,8" fill={isSelected ? '#083344' : '#94a3b8'} />
                  </svg>
                  <span className={cn('text-[9px] font-mono', isSelected ? 'text-ocean-950' : 'text-slate-400')}>
                    {Math.round(h.windSpeed)}
                  </span>
                </div>
                {h.precipProbability > 0 && (
                  <span className={cn(
                    'relative z-[1] text-[10px] font-mono',
                    isSelected ? 'text-sky-900' : 'text-blue-400',
                  )}>{h.precipProbability}%</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="hidden sm:flex items-center justify-center gap-0.5 px-4 pb-1.5">
        <span className="text-[10px] text-slate-500 mr-1">mph</span>
        {[
          { color: '#1e3c8e', label: '0' },
          { color: '#0097a7', label: '5' },
          { color: '#43a047', label: '10' },
          { color: '#b4d234', label: '15' },
          { color: '#fdd835', label: '20' },
          { color: '#fb8c00', label: '30' },
          { color: '#d32f2f', label: '40' },
          { color: '#ad1457', label: '50' },
        ].map((stop) => (
          <div key={stop.label} className="flex flex-col items-center">
            <div className="w-5 h-1 rounded-sm" style={{ background: stop.color }} />
            <span className="text-[10px] text-slate-600">{stop.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
