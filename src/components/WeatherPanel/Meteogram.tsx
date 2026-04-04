/**
 * Meteogram — a stacked 48-hour weather chart rendered with SVG.
 * Reads hourly forecast data from the weather store and displays
 * temperature, wind, precipitation probability, and cloud cover
 * as layered bands with an interactive time cursor.
 */

import { useRef, useState, useMemo, useCallback } from 'react'
import { useWeatherStore } from '../../store/weatherStore'
import { WMO_CODES } from '../../lib/weatherTypes'

// Layout constants
const MARGIN = { top: 28, right: 42, bottom: 24, left: 8 }
const CHART_W = 900
const CHART_H = 200
const INNER_W = CHART_W - MARGIN.left - MARGIN.right
const INNER_H = CHART_H - MARGIN.top - MARGIN.bottom

// Band heights (fraction of INNER_H)
const TEMP_H = 0.35
const WIND_H = 0.25
const PRECIP_H = 0.2
const CLOUD_H = 0.2

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Format hour from ISO string */
function fmtHour(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Wind direction to short arrow character */
function windArrow(deg: number) {
  const arrows = ['\u2193', '\u2199', '\u2190', '\u2196', '\u2191', '\u2197', '\u2192', '\u2198']
  const idx = Math.round(deg / 45) % 8
  return arrows[idx]
}

export default function Meteogram() {
  const hourly = useWeatherStore((s) => s.hourly)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  // Limit to 48 hours
  const data = useMemo(() => hourly.slice(0, 48), [hourly])

  // Derived ranges
  const { tempMin, tempMax, windMax } = useMemo(() => {
    if (data.length === 0) return { tempMin: 0, tempMax: 100, windMax: 30 }
    let tMin = Infinity, tMax = -Infinity, wMax = 0
    for (const d of data) {
      if (d.temperature < tMin) tMin = d.temperature
      if (d.temperature > tMax) tMax = d.temperature
      if (d.windSpeed > wMax) wMax = d.windSpeed
    }
    // Add padding
    tMin = Math.floor(tMin - 2)
    tMax = Math.ceil(tMax + 2)
    wMax = Math.ceil(wMax * 1.2) || 20
    return { tempMin: tMin, tempMax: tMax, windMax: wMax }
  }, [data])

  // X scale: index -> x position
  const xScale = useCallback(
    (i: number) => MARGIN.left + (i / Math.max(data.length - 1, 1)) * INNER_W,
    [data.length],
  )

  // Band Y offsets
  const bandY = {
    temp: MARGIN.top,
    wind: MARGIN.top + INNER_H * TEMP_H,
    precip: MARGIN.top + INNER_H * (TEMP_H + WIND_H),
    cloud: MARGIN.top + INNER_H * (TEMP_H + WIND_H + PRECIP_H),
  }

  const bandH = {
    temp: INNER_H * TEMP_H,
    wind: INNER_H * WIND_H,
    precip: INNER_H * PRECIP_H,
    cloud: INNER_H * CLOUD_H,
  }

  // Handle mouse move over chart
  const handleMouse = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || data.length === 0) return
      const rect = svgRef.current.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const svgX = (mx / rect.width) * CHART_W
      const dataX = svgX - MARGIN.left
      const idx = Math.round((dataX / INNER_W) * (data.length - 1))
      setHoverIdx(clamp(idx, 0, data.length - 1))
    },
    [data.length],
  )

  if (data.length === 0) {
    return (
      <div className="text-xs text-slate-500 text-center py-4">
        No hourly forecast data available
      </div>
    )
  }

  // Build paths
  const tempPoints = data.map((d, i) => {
    const x = xScale(i)
    const t = (d.temperature - tempMin) / (tempMax - tempMin || 1)
    const y = bandY.temp + bandH.temp * (1 - t)
    return { x, y }
  })
  const tempLine = tempPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  // Wind filled area
  const windPoints = data.map((d, i) => {
    const x = xScale(i)
    const t = d.windSpeed / windMax
    const y = bandY.wind + bandH.wind * (1 - t)
    return { x, y }
  })
  const windArea =
    `M${windPoints[0].x},${bandY.wind + bandH.wind} ` +
    windPoints.map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${windPoints[windPoints.length - 1].x},${bandY.wind + bandH.wind} Z`

  // Cloud cover area
  const cloudPoints = data.map((d, i) => {
    const x = xScale(i)
    const t = d.cloudCover / 100
    const y = bandY.cloud + bandH.cloud * (1 - t)
    return { x, y }
  })
  const cloudArea =
    `M${cloudPoints[0].x},${bandY.cloud + bandH.cloud} ` +
    cloudPoints.map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${cloudPoints[cloudPoints.length - 1].x},${bandY.cloud + bandH.cloud} Z`

  // Find peaks and troughs for temperature labels
  const labelIndices: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (i === 0 || i === data.length - 1) { labelIndices.push(i); continue }
    const prev = data[i - 1].temperature
    const curr = data[i].temperature
    const next = data[i + 1].temperature
    if ((curr >= prev && curr >= next) || (curr <= prev && curr <= next)) {
      // Only add if far enough from last label
      if (labelIndices.length === 0 || i - labelIndices[labelIndices.length - 1] >= 4) {
        labelIndices.push(i)
      }
    }
  }

  // Midnight boundaries for day labels
  const midnights: { idx: number; label: string }[] = []
  for (let i = 1; i < data.length; i++) {
    const h = new Date(data[i].time).getHours()
    if (h === 0) midnights.push({ idx: i, label: fmtDay(data[i].time) })
  }

  // Weather icons every 6 hours
  const iconBlocks: { idx: number; icon: string }[] = []
  for (let i = 0; i < data.length; i += 6) {
    const wmo = WMO_CODES[data[i].weatherCode]
    iconBlocks.push({ idx: i, icon: wmo?.icon ?? '?' })
  }

  // Wind direction arrows every 4 hours
  const windArrows: { idx: number; arrow: string; speed: number }[] = []
  for (let i = 0; i < data.length; i += 4) {
    windArrows.push({ idx: i, arrow: windArrow(data[i].windDirection), speed: data[i].windSpeed })
  }

  const hoverX = hoverIdx !== null ? xScale(hoverIdx) : null
  const hd = hoverIdx !== null ? data[hoverIdx] : null

  return (
    <div className="w-full">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        48-Hour Meteogram
      </h3>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full"
        style={{ height: 200 }}
        onMouseMove={handleMouse}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="mg-wind-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="mg-cloud-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#64748b" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#334155" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Background bands (subtle separators) */}
        <rect x={MARGIN.left} y={bandY.temp} width={INNER_W} height={bandH.temp} fill="rgba(0,0,0,0.15)" rx="2" />
        <rect x={MARGIN.left} y={bandY.wind} width={INNER_W} height={bandH.wind} fill="rgba(0,0,0,0.1)" rx="2" />
        <rect x={MARGIN.left} y={bandY.precip} width={INNER_W} height={bandH.precip} fill="rgba(0,0,0,0.15)" rx="2" />
        <rect x={MARGIN.left} y={bandY.cloud} width={INNER_W} height={bandH.cloud} fill="rgba(0,0,0,0.1)" rx="2" />

        {/* Midnight vertical lines */}
        {midnights.map((m) => (
          <line
            key={m.idx}
            x1={xScale(m.idx)}
            y1={MARGIN.top}
            x2={xScale(m.idx)}
            y2={CHART_H - MARGIN.bottom}
            stroke="#475569"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        ))}

        {/* Cloud cover area */}
        <path d={cloudArea} fill="url(#mg-cloud-grad)" />

        {/* Precipitation probability bars */}
        {data.map((d, i) => {
          if (d.precipProbability <= 0) return null
          const barW = Math.max((INNER_W / data.length) * 0.6, 2)
          const barH = (d.precipProbability / 100) * bandH.precip
          const x = xScale(i) - barW / 2
          const y = bandY.precip + bandH.precip - barH
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill="#3b82f6"
              opacity={0.2 + (d.precipProbability / 100) * 0.6}
              rx="1"
            />
          )
        })}

        {/* Wind filled area */}
        <path d={windArea} fill="url(#mg-wind-grad)" />

        {/* Wind direction arrows */}
        {windArrows.map((wa) => (
          <text
            key={wa.idx}
            x={xScale(wa.idx)}
            y={bandY.wind + bandH.wind - 4}
            textAnchor="middle"
            fontSize="9"
            fill="#93c5fd"
            opacity="0.8"
          >
            {wa.arrow}
          </text>
        ))}

        {/* Temperature line */}
        <path d={tempLine} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" />

        {/* Temperature dots and labels */}
        {labelIndices.map((i) => (
          <g key={i}>
            <circle cx={tempPoints[i].x} cy={tempPoints[i].y} r="3" fill="#22d3ee" />
            <text
              x={tempPoints[i].x}
              y={tempPoints[i].y - 7}
              textAnchor="middle"
              fontSize="9"
              fontWeight="bold"
              fill="#a5f3fc"
            >
              {Math.round(data[i].temperature)}°
            </text>
          </g>
        ))}

        {/* Weather icons at top */}
        {iconBlocks.map((ib) => (
          <text
            key={ib.idx}
            x={xScale(ib.idx)}
            y={MARGIN.top - 6}
            textAnchor="middle"
            fontSize="13"
          >
            {ib.icon}
          </text>
        ))}

        {/* X-axis hour labels */}
        {data.map((d, i) => {
          // Show label every 3 hours
          if (i % 3 !== 0) return null
          return (
            <text
              key={i}
              x={xScale(i)}
              y={CHART_H - MARGIN.bottom + 12}
              textAnchor="middle"
              fontSize="8"
              fill="#64748b"
            >
              {fmtHour(d.time)}
            </text>
          )
        })}

        {/* Day labels at midnight */}
        {midnights.map((m) => (
          <text
            key={m.idx}
            x={xScale(m.idx)}
            y={CHART_H - 2}
            textAnchor="middle"
            fontSize="8"
            fontWeight="bold"
            fill="#94a3b8"
          >
            {m.label}
          </text>
        ))}

        {/* Right Y-axis labels for temperature */}
        {[tempMin, Math.round((tempMin + tempMax) / 2), tempMax].map((v, i) => {
          const t = (v - tempMin) / (tempMax - tempMin || 1)
          const y = bandY.temp + bandH.temp * (1 - t)
          return (
            <text
              key={i}
              x={CHART_W - MARGIN.right + 6}
              y={y + 3}
              fontSize="8"
              fill="#67e8f9"
              opacity="0.7"
            >
              {v}°
            </text>
          )
        })}

        {/* Band labels on right side */}
        <text x={CHART_W - MARGIN.right + 6} y={bandY.wind + 10} fontSize="7" fill="#60a5fa" opacity="0.6">Wind</text>
        <text x={CHART_W - MARGIN.right + 6} y={bandY.precip + 10} fontSize="7" fill="#3b82f6" opacity="0.6">Rain%</text>
        <text x={CHART_W - MARGIN.right + 6} y={bandY.cloud + 10} fontSize="7" fill="#64748b" opacity="0.6">Cloud</text>

        {/* Hover cursor */}
        {hoverX !== null && (
          <line
            x1={hoverX}
            y1={MARGIN.top}
            x2={hoverX}
            y2={CHART_H - MARGIN.bottom}
            stroke="#22d3ee"
            strokeWidth="1"
            opacity="0.6"
            strokeDasharray="3 2"
          />
        )}

        {/* Hover tooltip */}
        {hoverX !== null && hd && (() => {
          const tooltipW = 120
          const tooltipH = 80
          // Flip tooltip to left side if too close to right edge
          const tx = hoverX + tooltipW + 10 > CHART_W ? hoverX - tooltipW - 8 : hoverX + 8
          const ty = MARGIN.top + 4
          const time = new Date(hd.time)
          const timeStr = time.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', weekday: 'short' })

          return (
            <g>
              <rect
                x={tx}
                y={ty}
                width={tooltipW}
                height={tooltipH}
                rx="6"
                fill="#0f172a"
                fillOpacity="0.92"
                stroke="#334155"
                strokeWidth="1"
              />
              <text x={tx + 6} y={ty + 13} fontSize="8" fontWeight="bold" fill="#e2e8f0">{timeStr}</text>
              <text x={tx + 6} y={ty + 26} fontSize="8" fill="#67e8f9">Temp: {Math.round(hd.temperature)}°F</text>
              <text x={tx + 6} y={ty + 38} fontSize="8" fill="#93c5fd">Wind: {Math.round(hd.windSpeed)} mph {windArrow(hd.windDirection)}</text>
              <text x={tx + 6} y={ty + 50} fontSize="8" fill="#93c5fd">Gusts: {Math.round(hd.windGusts)} mph</text>
              <text x={tx + 6} y={ty + 62} fontSize="8" fill="#60a5fa">Rain: {hd.precipProbability}%</text>
              <text x={tx + 6} y={ty + 74} fontSize="8" fill="#94a3b8">Cloud: {hd.cloudCover}%</text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
