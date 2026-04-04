/**
 * Bottom forecast bar — compact hourly timeline with play button.
 * Shows date label at top, scrollable hourly forecast, and play controls.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWeatherStore } from '../../store/weatherStore'
import { useMapStore } from '../../store/mapStore'
import { WMO_CODES, degreesToCardinal, getWeatherIcon } from '../../lib/weatherTypes'
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
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

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
    // Wait for map to render before fetching weather
    const timer = setTimeout(() => {
      const { viewState } = useMapStore.getState()
      fetchWeather(viewState.latitude, viewState.longitude)
    }, 3000)
    return () => clearTimeout(timer)
  }, [panelOpen, current, loading, location, fetchWeather])

  // Smooth play animation — updates fractional forecast hour for smooth overlay transitions
  // playbackSpeed: 1.0 = 1 second per hour, 0.5 = half second, 2.0 = 2 seconds
  const TICK_MS = 50
  const tickRef = useRef(0)

  useEffect(() => {
    if (playing && hourly.length > 0) {
      const ticksPerHour = Math.max(4, Math.round((playbackSpeed * 1000) / TICK_MS))
      tickRef.current = selectedIndex * ticksPerHour
      playRef.current = setInterval(() => {
        tickRef.current += 1
        const fractionalHour = tickRef.current / ticksPerHour
        const wholeHour = Math.floor(fractionalHour)

        if (wholeHour >= hourly.length) {
          // Loop back to the beginning
          tickRef.current = 0
          setSelectedIndex(0)
          setSelectedForecastHour(0)
          return
        }

        // Update the overlay forecast hour (fractional for smooth blending)
        setSelectedForecastHour(fractionalHour)

        // Update the selected index only on whole hour boundaries
        if (wholeHour !== selectedIndex) {
          setSelectedIndex(wholeHour)
        }
      }, TICK_MS)
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current)
    }
  }, [playing, hourly.length, playbackSpeed, setSelectedForecastHour])

  // Auto-scroll to selected index — buttons are inside a nested wrapper div
  useEffect(() => {
    if (scrollRef.current && selectedIndex >= 0) {
      const wrapper = scrollRef.current.firstElementChild
      const child = wrapper?.children[selectedIndex] as HTMLElement
      if (child) {
        child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [selectedIndex])

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false)
    } else {
      if (selectedIndex >= hourly.length - 1) {
        setSelectedIndex(0)
        setSelectedForecastHour(0)
      }
      setPlaying(true)
    }
  }, [playing, selectedIndex, hourly.length, setSelectedForecastHour])

  if (!panelOpen || loading || !hourly.length) return null

  const selected = hourly[selectedIndex]
  const selectedDate = new Date(selected.time)
  const wmo = WMO_CODES[selected.weatherCode] ?? { icon: '?', label: 'Unknown' }

  // Build day boundaries for labels
  const dayBoundaries: { index: number; label: string }[] = []
  let lastDay = ''
  hourly.forEach((h, i) => {
    const d = new Date(h.time)
    const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (dayStr !== lastDay) {
      dayBoundaries.push({ index: i, label: dayStr })
      lastDay = dayStr
    }
  })

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-ocean-900/95 backdrop-blur-md border-t border-ocean-700">
      {/* Date label + selected stats */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Play button */}
        <button
          onClick={togglePlay}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full transition-all flex-shrink-0',
            playing ? 'bg-cyan-500 text-white' : 'bg-ocean-700 text-slate-300 hover:bg-ocean-600',
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

        {/* Date/time label */}
        <div className="bg-cyan-500/15 border border-cyan-500/30 rounded-lg px-3 py-1 flex-shrink-0">
          <span className="text-xs font-bold text-cyan-300">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' '}
            {selectedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        {/* Selected hour quick stats */}
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-300 overflow-hidden">
          <span>{getWeatherIcon(selected.weatherCode, selected.isDay)} {Math.round(selected.temperature)}°F</span>
          <div className="flex items-center gap-0.5">
            <svg width="8" height="8" viewBox="0 0 10 10" style={{ transform: `rotate(${selected.windDirection + 180}deg)` }}>
              <polygon points="5,0 3,8 5,6 7,8" fill="#06b6d4" />
            </svg>
            <span className="font-mono">{Math.round(selected.windSpeed)} mph {degreesToCardinal(selected.windDirection)}</span>
          </div>
          {selected.precipProbability > 0 && (
            <span className="text-blue-400 font-mono">{selected.precipProbability}% rain</span>
          )}
        </div>

        {/* Location */}
        {location && (
          <div className="ml-auto text-xs text-slate-600 flex-shrink-0 hidden sm:block">
            {Math.abs(location.lat).toFixed(2)}°{location.lat >= 0 ? 'N' : 'S'}, {Math.abs(location.lng).toFixed(2)}°{location.lng >= 0 ? 'E' : 'W'}
          </div>
        )}
      </div>

      {/* Hourly scroll timeline */}
      <div className="overflow-x-auto px-4 pb-2" ref={scrollRef}>
        <div className="flex gap-0.5" style={{ minWidth: hourly.length * 44 }}>
          {hourly.map((h, i) => {
            const date = new Date(h.time)
            const hour = date.getHours()
            const isSelected = i === selectedIndex
            const isMidnight = hour === 0
            const nowDate = new Date()
            const isNowHour = date.getFullYear() === nowDate.getFullYear() &&
              date.getMonth() === nowDate.getMonth() &&
              date.getDate() === nowDate.getDate() &&
              date.getHours() === nowDate.getHours()
            const isPast = date.getTime() < nowDate.getTime() - 30 * 60 * 1000 // >30 min ago
            const hIcon = getWeatherIcon(h.weatherCode, h.isDay)

            // Calculate progress line position within this cell (0-100%)
            const isPlayingThisHour = playing && Math.floor(selectedForecastHour) === i
            const progressPct = isPlayingThisHour
              ? (selectedForecastHour - Math.floor(selectedForecastHour)) * 100
              : 0

            return (
              <button
                key={h.time}
                onClick={() => { setSelectedIndex(i); setSelectedForecastHour(i); setPlaying(false) }}
                className={cn(
                  'relative flex flex-col items-center gap-0 px-1 py-1 rounded min-w-[42px] text-center transition-all overflow-hidden',
                  isSelected ? 'bg-cyan-500/20 border border-cyan-500/40 scale-105' :
                  isNowHour ? 'bg-cyan-500/10 border border-cyan-500/20' :
                  isMidnight ? 'bg-ocean-800/80 hover:bg-ocean-700/60' :
                  isPast ? 'opacity-60 hover:opacity-80 hover:bg-ocean-800/40' :
                  'hover:bg-ocean-800/40',
                )}
              >
                {/* Progress sweep line during playback */}
                {isPlayingThisHour && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-10 transition-none"
                    style={{ left: `${progressPct}%` }}
                  />
                )}
                {/* Filled progress background */}
                {isPlayingThisHour && (
                  <div
                    className="absolute inset-0 bg-cyan-500/10 z-0 transition-none"
                    style={{ width: `${progressPct}%` }}
                  />
                )}
                <span className="text-[9px] text-slate-500">
                  {isNowHour ? 'Now' : isMidnight
                    ? date.toLocaleDateString('en-US', { weekday: 'short' })
                    : date.toLocaleTimeString('en-US', { hour: 'numeric' }).replace(' ', '')}
                </span>
                <span className="text-xs">{hIcon}</span>
                <span className="text-[10px] font-semibold text-slate-200 font-mono">{Math.round(h.temperature)}°</span>
                <div className="flex items-center gap-0.5">
                  <svg width="7" height="7" viewBox="0 0 10 10" style={{ transform: `rotate(${h.windDirection + 180}deg)` }}>
                    <polygon points="5,0 3,8 5,6 7,8" fill="#94a3b8" />
                  </svg>
                  <span className="text-[9px] text-slate-400 font-mono">{Math.round(h.windSpeed)}</span>
                </div>
                {h.precipProbability > 0 && (
                  <span className="text-[10px] text-blue-400 font-mono">{h.precipProbability}%</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Wind speed color legend */}
      <div className="hidden sm:flex items-center justify-center gap-0.5 px-4 pb-1.5">
        <span className="text-[10px] text-slate-600 mr-1">mph</span>
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
