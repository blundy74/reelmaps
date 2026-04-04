/**
 * Bottom timeline bar with play/pause button to animate through forecast hours.
 * Styled like Windy.com's bottom scrubber.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWeatherStore } from '../../store/weatherStore'
import { WMO_CODES, getWeatherIcon } from '../../lib/weatherTypes'
import { cn } from '../../lib/utils'

export default function ForecastTimeline() {
  const { panelOpen, hourly, current, loading } = useWeatherStore()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-advance when playing
  useEffect(() => {
    if (playing && hourly.length > 0) {
      playRef.current = setInterval(() => {
        setSelectedIndex((prev) => {
          const next = prev + 1
          if (next >= hourly.length) {
            setPlaying(false)
            return 0
          }
          return next
        })
      }, 500) // 500ms per frame
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current)
    }
  }, [playing, hourly.length])

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false)
    } else {
      if (selectedIndex >= hourly.length - 1) setSelectedIndex(0)
      setPlaying(true)
    }
  }, [playing, selectedIndex, hourly.length])

  if (!panelOpen || !hourly.length || loading) return null

  const selected = hourly[selectedIndex]
  const date = new Date(selected.time)
  const wmo = WMO_CODES[selected.weatherCode] ?? { icon: '?', label: 'Unknown' }

  // Build day labels for the timeline
  const dayLabels: { index: number; label: string }[] = []
  let lastDay = ''
  hourly.forEach((h, i) => {
    const d = new Date(h.time)
    const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (dayStr !== lastDay) {
      dayLabels.push({ index: i, label: dayStr })
      lastDay = dayStr
    }
  })

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-ocean-900/95 backdrop-blur-md border-t border-ocean-700">
      {/* Selected hour info bar */}
      <div className="flex items-center gap-4 px-4 py-2">
        {/* Play button */}
        <button
          onClick={togglePlay}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full transition-all flex-shrink-0',
            playing
              ? 'bg-cyan-500 text-white'
              : 'bg-ocean-700 text-slate-300 hover:bg-ocean-600',
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

        {/* Current timestamp */}
        <div className="bg-cyan-500/20 border border-cyan-500/40 rounded-lg px-3 py-1 flex-shrink-0">
          <span className="text-xs font-bold text-cyan-300">
            {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            {' - '}
            {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>

        {/* Quick stats for selected hour */}
        <div className="flex items-center gap-3 text-xs text-slate-300 overflow-hidden">
          <span>{getWeatherIcon(selected.weatherCode, selected.isDay)} {wmo.label}</span>
          <span className="font-mono">{Math.round(selected.temperature)}°F</span>
          <div className="flex items-center gap-0.5">
            <svg width="8" height="8" viewBox="0 0 10 10" style={{ transform: `rotate(${selected.windDirection + 180}deg)` }}>
              <polygon points="5,0 3,8 5,6 7,8" fill="#06b6d4" />
            </svg>
            <span className="font-mono">{Math.round(selected.windSpeed)} mph</span>
          </div>
          {selected.precipProbability > 0 && (
            <span className="text-blue-400 font-mono">{selected.precipProbability}% rain</span>
          )}
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="relative px-4 pb-2">
        {/* Day labels */}
        <div className="relative h-4 mb-1">
          {dayLabels.map((dl) => (
            <span
              key={dl.index}
              className="absolute text-[9px] text-slate-500 font-semibold whitespace-nowrap"
              style={{ left: `${(dl.index / (hourly.length - 1)) * 100}%` }}
            >
              {dl.label}
            </span>
          ))}
        </div>

        {/* Slider track */}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={hourly.length - 1}
            value={selectedIndex}
            onChange={(e) => {
              setSelectedIndex(parseInt(e.target.value))
              setPlaying(false)
            }}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-ocean-700
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
              [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer"
          />

          {/* Hour tick marks */}
          <div className="flex justify-between mt-1 px-0.5">
            {hourly.filter((_, i) => i % 6 === 0).map((h, i) => {
              const d = new Date(h.time)
              return (
                <span key={i} className="text-[8px] text-slate-600 font-mono">
                  {d.toLocaleTimeString('en-US', { hour: 'numeric' }).replace(' ', '')}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* Wind speed color legend */}
      <div className="flex items-center justify-center gap-1 px-4 pb-1.5">
        <span className="text-[8px] text-slate-600">kt</span>
        {[
          { color: '#1565c0', label: '0' },
          { color: '#0097a7', label: '5' },
          { color: '#43a047', label: '10' },
          { color: '#7cb342', label: '15' },
          { color: '#fdd835', label: '20' },
          { color: '#fb8c00', label: '25' },
          { color: '#f4511e', label: '30' },
          { color: '#d32f2f', label: '40' },
          { color: '#ad1457', label: '50' },
        ].map((stop) => (
          <div key={stop.label} className="flex flex-col items-center">
            <div className="w-6 h-1.5 rounded-sm" style={{ background: stop.color }} />
            <span className="text-[7px] text-slate-600">{stop.label}</span>
          </div>
        ))}
        <span className="text-[8px] text-slate-600">60</span>
      </div>
    </div>
  )
}
