/**
 * Compact point-forecast table in the right rail.
 * Steals Windy's BOTTOM table IA (not the right-edge layer pills):
 * 3-hour columns, color wind/gust, rain amounts, red now-tick, map-time
 * selection. Fishing extras: Waves (ft) + swell period (s) only.
 * No feels-like, pollen, airgram, 6 display modes, or ECMWF WAM chips.
 */

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { useWeatherStore } from '../../store/weatherStore'
import {
  getWeatherIcon,
  mphToKnots,
  windHeatColor,
  seasHeatColor,
} from '../../lib/weatherTypes'
import { cn } from '../../lib/utils'
import type { HourlyEntry, MarineHourlyEntry } from '../../lib/weatherTypes'

const COL_W = 36
const LABEL_W = 52

interface Col {
  entry: HourlyEntry
  hourlyIndex: number
  marine?: MarineHourlyEntry
  precipIn: number
}

function hourKey(iso: string) {
  return iso.slice(0, 13) // YYYY-MM-DDTHH
}

function fmtHour(iso: string) {
  const d = new Date(iso)
  const h = d.getHours()
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
}

function windArrowDeg(fromDeg: number) {
  // Meteorological "from" → arrow pointing the way the wind is going
  return fromDeg + 180
}

function buildColumns(hourly: HourlyEntry[], marineHourly: MarineHourlyEntry[]): Col[] {
  const marineByHour = new Map<string, MarineHourlyEntry>()
  for (const m of marineHourly) marineByHour.set(hourKey(m.time), m)

  const cols: Col[] = []
  for (let i = 0; i < hourly.length; i++) {
    const h = new Date(hourly[i].time).getHours()
    if (h % 3 !== 0) continue
    let precipIn = 0
    for (let k = 0; k < 3 && i + k < hourly.length; k++) {
      precipIn += hourly[i + k].precipitation ?? 0
    }
    cols.push({
      entry: hourly[i],
      hourlyIndex: i,
      marine: marineByHour.get(hourKey(hourly[i].time)),
      precipIn,
    })
  }
  return cols
}

function nowTickOffset(cols: Col[]): number | null {
  if (cols.length < 2) return null
  const now = Date.now()
  const t0 = new Date(cols[0].entry.time).getTime()
  const tN = new Date(cols[cols.length - 1].entry.time).getTime()
  if (now < t0 - 30 * 60 * 1000 || now > tN + 3 * 60 * 60 * 1000) return null

  for (let i = 0; i < cols.length - 1; i++) {
    const a = new Date(cols[i].entry.time).getTime()
    const b = new Date(cols[i + 1].entry.time).getTime()
    if (now >= a && now <= b) {
      const t = (now - a) / (b - a || 1)
      return LABEL_W + (i + t) * COL_W + COL_W / 2
    }
  }
  if (now < t0) return LABEL_W + COL_W / 2
  return LABEL_W + (cols.length - 1) * COL_W + COL_W / 2
}

function Cell({
  children,
  night,
  onClick,
  className,
  style,
}: {
  children: ReactNode
  night?: boolean
  onClick: () => void
  className?: string
  style?: CSSProperties
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: COL_W, ...style }}
      className={cn(
        'flex items-center justify-center h-full text-[10px] font-mono leading-none flex-shrink-0',
        night && 'bg-slate-500/10',
        className,
      )}
    >
      {children}
    </button>
  )
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div
      className="sticky left-0 z-10 flex items-center text-[9px] text-slate-500 uppercase tracking-wide px-1 bg-ocean-900/95 border-r border-white/5 flex-shrink-0"
      style={{ width: LABEL_W }}
    >
      {children}
    </div>
  )
}

export default function WeatherRows() {
  const hourly = useWeatherStore((s) => s.hourly)
  const marine = useWeatherStore((s) => s.marine)
  const loading = useWeatherStore((s) => s.loading)
  const selectedForecastHour = useWeatherStore((s) => Math.floor(s.selectedForecastHour))
  const setSelectedForecastHour = useWeatherStore((s) => s.setSelectedForecastHour)
  const scrollRef = useRef<HTMLDivElement>(null)

  const cols = useMemo(
    () => buildColumns(hourly, marine?.hourly ?? []),
    [hourly, marine],
  )

  const selectedHourly = selectedForecastHour
  const selectedCol = useMemo(() => {
    if (!cols.length) return -1
    const exact = cols.findIndex((c) => c.hourlyIndex === selectedHourly)
    if (exact >= 0) return exact
    let best = 0
    let dist = Infinity
    cols.forEach((c, i) => {
      const d = Math.abs(c.hourlyIndex - selectedHourly)
      if (d < dist) {
        dist = d
        best = i
      }
    })
    return best
  }, [cols, selectedHourly])
  const tickLeft = useMemo(() => nowTickOffset(cols), [cols])

  const daySpans = useMemo(() => {
    const spans: { label: string; start: number; count: number }[] = []
    for (let i = 0; i < cols.length; i++) {
      const label = fmtDay(cols[i].entry.time)
      const last = spans[spans.length - 1]
      if (last && last.label === label) last.count += 1
      else spans.push({ label, start: i, count: 1 })
    }
    return spans
  }, [cols])

  useEffect(() => {
    if (selectedCol < 0 || !scrollRef.current) return
    const x = LABEL_W + selectedCol * COL_W - 40
    scrollRef.current.scrollTo({ left: Math.max(0, x), behavior: 'smooth' })
  }, [selectedCol])

  if (loading && !hourly.length) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (!cols.length) {
    return (
      <p className="text-[10px] text-slate-500 px-1 py-3">
        Click the map to load a forecast for this spot.
      </p>
    )
  }

  const selected = selectedCol >= 0 ? cols[selectedCol] : cols[0]
  const mapTime = selected
    ? `${fmtDay(selected.entry.time)} ${fmtHour(selected.entry.time)}`
    : ''

  const pick = (hourlyIndex: number) => () => setSelectedForecastHour(hourlyIndex)

  const rows: { key: string; label: string; render: (c: Col) => ReactNode }[] = [
    {
      key: 'hours',
      label: 'Hours',
      render: (c) => (
        <span className={cn(
          'text-[9px] font-semibold',
          !c.entry.isDay && 'text-slate-400',
        )}>
          {fmtHour(c.entry.time)}
        </span>
      ),
    },
    {
      key: 'sky',
      label: '',
      render: (c) => (
        <span className="text-sm leading-none">{getWeatherIcon(c.entry.weatherCode, c.entry.isDay)}</span>
      ),
    },
    {
      key: 'temp',
      label: 'Temp °F',
      render: (c) => (
        <span className="text-slate-200 font-semibold">{Math.round(c.entry.temperature)}</span>
      ),
    },
    {
      key: 'rain',
      label: 'Rain in',
      render: (c) => (
        <span className={c.precipIn > 0.004 ? 'text-sky-300' : 'text-slate-600'}>
          {c.precipIn > 0.004 ? c.precipIn.toFixed(2).replace(/^0/, '') : ''}
        </span>
      ),
    },
    {
      key: 'wind',
      label: 'Wind kt',
      render: (c) => {
        const kt = mphToKnots(c.entry.windSpeed)
        const { bg, fg } = windHeatColor(kt)
        return (
          <span
            className="w-full h-full flex items-center justify-center font-semibold"
            style={{ background: bg, color: fg }}
          >
            {Math.round(kt)}
          </span>
        )
      },
    },
    {
      key: 'gust',
      label: 'Gusts kt',
      render: (c) => {
        const kt = mphToKnots(c.entry.windGusts)
        const { bg, fg } = windHeatColor(kt)
        return (
          <span
            className="w-full h-full flex items-center justify-center font-semibold"
            style={{ background: bg, color: fg }}
          >
            {Math.round(kt)}
          </span>
        )
      },
    },
    {
      key: 'dir',
      label: 'Wind dir',
      render: (c) => (
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: `rotate(${windArrowDeg(c.entry.windDirection)}deg)` }}>
          <polygon points="5,0 3,8 5,6 7,8" fill="#7dd3fc" />
        </svg>
      ),
    },
    {
      key: 'waves',
      label: 'Waves ft',
      render: (c) => {
        const ft = c.marine?.waveHeight
        if (ft == null) return <span className="text-slate-600">–</span>
        const { bg, fg } = seasHeatColor(ft)
        return (
          <span
            className="w-full h-full flex items-center justify-center font-semibold"
            style={{ background: bg, color: fg }}
          >
            {ft.toFixed(1)}
          </span>
        )
      },
    },
    {
      key: 'period',
      label: 'Swell s',
      render: (c) => (
        <span className="text-slate-300">
          {c.marine?.swellPeriod ? Math.round(c.marine.swellPeriod) : '–'}
        </span>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-1.5 px-0.5 mb-1.5">
        <span className="w-1.5 h-3 rounded-sm bg-red-500 flex-shrink-0 shadow-[0_0_6px_#ef4444]" />
        <span className="text-[10px] font-bold text-red-400 tracking-wide">
          Time of forecast on map
        </span>
        <span className="text-[10px] font-mono text-cyan-200 ml-auto">{mapTime}</span>
      </div>

      <div ref={scrollRef} className="relative overflow-x-auto -mx-1 px-1">
        <div className="relative" style={{ minWidth: LABEL_W + cols.length * COL_W }}>
          {/* Day headers */}
          <div className="flex h-4 mb-0.5">
            <div className="sticky left-0 z-10 bg-ocean-900/95 flex-shrink-0" style={{ width: LABEL_W }} />
            {daySpans.map((d) => (
              <div
                key={`${d.label}-${d.start}`}
                className="flex items-center gap-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider px-0.5"
                style={{ width: d.count * COL_W }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 flex-shrink-0" />
                <span className="truncate">{d.label}</span>
              </div>
            ))}
          </div>

          {rows.map((row) => (
            <div
              key={row.key}
              className={cn(
                'flex border-t border-white/5',
                row.key === 'wind' || row.key === 'gust' || row.key === 'waves' ? 'h-6' : 'h-5',
              )}
            >
              <Label>{row.label}</Label>
              {cols.map((c) => (
                <Cell
                  key={c.entry.time + row.key}
                  night={!c.entry.isDay}
                  onClick={pick(c.hourlyIndex)}
                  className={row.key === 'wind' || row.key === 'gust' || row.key === 'waves' ? 'p-0 overflow-hidden' : ''}
                >
                  {row.render(c)}
                </Cell>
              ))}
            </div>
          ))}

          {selectedCol >= 0 && (
            <div
              className="pointer-events-none absolute top-3 bottom-0 z-[15] bg-cyan-400/22 border-x-2 border-cyan-300 shadow-[inset_0_0_12px_rgba(34,211,238,0.25)]"
              style={{ left: LABEL_W + selectedCol * COL_W, width: COL_W }}
            />
          )}

          {/* Now-tick — solid red playhead, not a faint dashed grey */}
          {tickLeft != null && (
            <div
              className="pointer-events-none absolute top-2 bottom-0 z-20"
              style={{ left: tickLeft, width: 0 }}
            >
              <div
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '7px solid #ef4444',
                }}
              />
              <div
                className="h-full"
                style={{
                  borderLeft: '2px solid #ef4444',
                  marginLeft: -1,
                  boxShadow: '0 0 8px 1px rgba(239,68,68,0.85)',
                }}
              />
            </div>
          )}
        </div>
      </div>
      <p className="text-[9px] text-slate-500 mt-1.5 px-0.5">
        3h · Source: Open-Meteo
      </p>
    </div>
  )
}
