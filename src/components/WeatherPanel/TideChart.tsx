/**
 * TideChart — SVG chart with continuous 6-min tide curve, high/low markers,
 * current water level indicator, and tide direction (rising/falling).
 */

import { useEffect, useState } from 'react'
import {
  fetchNearestTideStation,
  fetchTidePredictions,
  fetchTideContinuous,
} from '../../lib/tidesApi'
import type { TideStation, TidePrediction, TideContinuous } from '../../lib/tidesApi'

interface Props {
  lat: number
  lng: number
}

export default function TideChart({ lat, lng }: Props) {
  const [station, setStation] = useState<TideStation | null>(null)
  const [predictions, setPredictions] = useState<TidePrediction[]>([])
  const [continuous, setContinuous] = useState<TideContinuous[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const st = await fetchNearestTideStation(lat, lng)
        if (cancelled) return
        setStation(st)

        const [preds, cont] = await Promise.all([
          fetchTidePredictions(st.id),
          fetchTideContinuous(st.id),
        ])
        if (cancelled) return
        setPredictions(preds)
        setContinuous(cont)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load tides')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [lat, lng])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        <span className="text-xs text-slate-500 ml-2">Loading tides...</span>
      </div>
    )
  }

  if (error) {
    return <p className="text-xs text-red-400 text-center py-4">{error}</p>
  }

  if (!station || predictions.length === 0) return null

  // Find next high and low from now
  const now = new Date()
  const nextHigh = predictions.find((p) => p.type === 'H' && new Date(p.time) > now)
  const nextLow = predictions.find((p) => p.type === 'L' && new Date(p.time) > now)

  // Determine current tide level & direction from continuous data
  const nowMs = now.getTime()
  let currentHeight: number | null = null
  let tideDirection: 'rising' | 'falling' | null = null

  if (continuous.length > 1) {
    // Find the two bracketing points
    for (let i = 0; i < continuous.length - 1; i++) {
      const t1 = new Date(continuous[i].time).getTime()
      const t2 = new Date(continuous[i + 1].time).getTime()
      if (nowMs >= t1 && nowMs <= t2) {
        const frac = (nowMs - t1) / (t2 - t1)
        currentHeight = continuous[i].height + frac * (continuous[i + 1].height - continuous[i].height)
        tideDirection = continuous[i + 1].height > continuous[i].height ? 'rising' : 'falling'
        break
      }
    }
  }

  // Chart dimensions
  const W = 440
  const H = 160
  const PAD_X = 36
  const PAD_Y = 24
  const PAD_BOTTOM = 28

  // Use continuous data for the curve if available, otherwise fall back to predictions
  const curveData = continuous.length > 0 ? continuous : predictions.map(p => ({ time: p.time, height: p.height }))

  // Time and height ranges from continuous data
  const curveTimes = curveData.map((p) => new Date(p.time).getTime())
  const minT = curveTimes[0]
  const maxT = curveTimes[curveTimes.length - 1]
  const allHeights = curveData.map((p) => p.height)
  const minH = Math.min(...allHeights) - 0.3
  const maxH = Math.max(...allHeights) + 0.3

  const xScale = (t: number) => PAD_X + ((t - minT) / (maxT - minT)) * (W - PAD_X * 2)
  const yScale = (h: number) => PAD_Y + (1 - (h - minH) / (maxH - minH)) * (H - PAD_Y - PAD_BOTTOM)

  // Build continuous polyline path (no bezier needed — 6-min data is smooth enough)
  const curvePath = curveData
    .map((p, i) => {
      const x = xScale(new Date(p.time).getTime())
      const y = yScale(p.height)
      return `${i === 0 ? 'M' : 'L'} ${x},${y}`
    })
    .join(' ')

  // Area fill path
  const firstX = xScale(curveTimes[0])
  const lastX = xScale(curveTimes[curveTimes.length - 1])
  const areaPath = `${curvePath} L ${lastX},${H - PAD_BOTTOM} L ${firstX},${H - PAD_BOTTOM} Z`

  // High/low marker positions
  const hiloPoints = predictions.map((p) => ({
    x: xScale(new Date(p.time).getTime()),
    y: yScale(p.height),
    prediction: p,
  }))

  // "Now" marker position
  const nowX = xScale(nowMs)
  const nowY = currentHeight !== null ? yScale(currentHeight) : null
  const nowInRange = nowMs >= minT && nowMs <= maxT

  // Day boundary lines
  const dayBoundaries: { x: number; label: string }[] = []
  const startDate = new Date(minT)
  for (let d = 0; d < 4; d++) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + d)
    const t = date.getTime()
    if (t > minT && t < maxT) {
      dayBoundaries.push({
        x: xScale(t),
        label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      })
    }
  }

  function formatTime(timeStr: string): string {
    const d = new Date(timeStr)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="space-y-3">
      {/* Station info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tide Predictions</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {station.name} ({station.distance.toFixed(1)} mi)
          </p>
        </div>
        {/* Current tide direction badge */}
        {tideDirection && currentHeight !== null && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            tideDirection === 'rising'
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-amber-500/15 text-amber-400'
          }`}>
            <svg width="8" height="8" viewBox="0 0 8 8" className={tideDirection === 'falling' ? 'rotate-180' : ''}>
              <polygon points="4,0 1,6 7,6" fill="currentColor" />
            </svg>
            {tideDirection === 'rising' ? 'Rising' : 'Falling'} — {currentHeight.toFixed(1)} ft
          </div>
        )}
      </div>

      {/* Next high / low summary */}
      <div className="flex gap-3">
        {nextHigh && (
          <div className="flex-1 bg-ocean-800/60 rounded-lg p-2 border border-ocean-700/50">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Next High</div>
            <div className="text-sm font-semibold text-cyan-400 font-mono">
              {formatTime(nextHigh.time)}
            </div>
            <div className="text-[10px] text-slate-400">{nextHigh.height.toFixed(1)} ft</div>
          </div>
        )}
        {nextLow && (
          <div className="flex-1 bg-ocean-800/60 rounded-lg p-2 border border-ocean-700/50">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Next Low</div>
            <div className="text-sm font-semibold text-cyan-400 font-mono">
              {formatTime(nextLow.time)}
            </div>
            <div className="text-[10px] text-slate-400">{nextLow.height.toFixed(1)} ft</div>
          </div>
        )}
      </div>

      {/* SVG Chart */}
      <div className="bg-ocean-800/60 rounded-xl p-2 border border-ocean-700/50 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Day boundary lines */}
          {dayBoundaries.map((b, i) => (
            <g key={i}>
              <line x1={b.x} y1={PAD_Y} x2={b.x} y2={H - PAD_BOTTOM} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,3" />
              <text x={b.x + 3} y={H - PAD_BOTTOM + 12} fill="#64748b" fontSize="7" fontFamily="monospace">
                {b.label}
              </text>
            </g>
          ))}

          {/* Y-axis labels */}
          {[minH, (minH + maxH) / 2, maxH].map((h, i) => (
            <text key={i} x={2} y={yScale(h) + 3} fill="#64748b" fontSize="7" fontFamily="monospace">
              {h.toFixed(1)}
            </text>
          ))}

          {/* Filled area */}
          <path d={areaPath} fill="url(#tideFill)" />

          {/* Continuous curve */}
          <path d={curvePath} fill="none" stroke="#06b6d4" strokeWidth="1.5" strokeLinejoin="round" />

          {/* "Now" vertical line + dot */}
          {nowInRange && (
            <>
              <line x1={nowX} y1={PAD_Y} x2={nowX} y2={H - PAD_BOTTOM} stroke="#f59e0b" strokeWidth="0.7" strokeDasharray="2,2" />
              {nowY !== null && (
                <>
                  <circle cx={nowX} cy={nowY} r="4" fill="#f59e0b" fillOpacity="0.3" />
                  <circle cx={nowX} cy={nowY} r="2.5" fill="#f59e0b" />
                </>
              )}
              <text x={nowX} y={PAD_Y - 4} textAnchor="middle" fill="#f59e0b" fontSize="7" fontWeight="bold" fontFamily="monospace">
                NOW
              </text>
            </>
          )}

          {/* High/low markers */}
          {hiloPoints.map((pt, i) => {
            const isHigh = pt.prediction.type === 'H'
            return (
              <g key={i}>
                {/* Arrow */}
                {isHigh ? (
                  <polygon
                    points={`${pt.x},${pt.y - 8} ${pt.x - 3.5},${pt.y - 2} ${pt.x + 3.5},${pt.y - 2}`}
                    fill="#06b6d4"
                  />
                ) : (
                  <polygon
                    points={`${pt.x},${pt.y + 8} ${pt.x - 3.5},${pt.y + 2} ${pt.x + 3.5},${pt.y + 2}`}
                    fill="#94a3b8"
                  />
                )}
                {/* Dot */}
                <circle cx={pt.x} cy={pt.y} r="2" fill={isHigh ? '#06b6d4' : '#94a3b8'} />
                {/* Time label */}
                <text
                  x={pt.x}
                  y={isHigh ? pt.y - 12 : pt.y + 16}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="6"
                  fontFamily="monospace"
                >
                  {formatTime(pt.prediction.time)}
                </text>
                {/* Height label */}
                <text
                  x={pt.x}
                  y={isHigh ? pt.y - 19 : pt.y + 23}
                  textAnchor="middle"
                  fill={isHigh ? '#06b6d4' : '#94a3b8'}
                  fontSize="6.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {pt.prediction.height.toFixed(1)}ft
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
