/**
 * Right rail — Windy-class chrome: overlay cards, pinned legend, and
 * weather rows (3-hour Windy Basic set + seas/period) in ONE rail.
 */

import { useEffect, useRef } from 'react'
import { useWeatherStore } from '../../store/weatherStore'
import { useMapStore } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'
import {
  degreesToCardinal,
  mphToKnots,
  windToBeaufort,
  waveHeightToSeaState,
} from '../../lib/weatherTypes'
import { PinnedLegend } from '../ui/ColorLegend'
import WeatherRows from './WeatherRows'

interface CardDef {
  id: string
  name: string
  kind: 'imagery' | 'overlay'
}

const IMAGERY: CardDef[] = [
  { id: 'sst-mur', name: 'SST MUR', kind: 'imagery' },
  { id: 'sst-goes', name: 'SST Daily', kind: 'imagery' },
  { id: 'chlorophyll', name: 'Chl-a', kind: 'imagery' },
  { id: 'true-color-viirs', name: 'True Color', kind: 'imagery' },
  { id: 'currents', name: 'Currents', kind: 'imagery' },
  { id: 'sargassum', name: 'Weedlines', kind: 'imagery' },
]

const OVERLAYS: CardDef[] = [
  { id: 'wind', name: 'Wind', kind: 'overlay' },
  { id: 'waves', name: 'Waves', kind: 'overlay' },
  { id: 'radar', name: 'Radar', kind: 'overlay' },
  { id: 'pressure', name: 'Pressure', kind: 'overlay' },
  { id: 'cloud-cover', name: 'Clouds', kind: 'overlay' },
  { id: 'lightning', name: 'Lightning', kind: 'overlay' },
]

function OverlayCard({
  def,
  active,
  opacity,
  locked,
  onToggle,
  onOpacity,
}: {
  def: CardDef
  active: boolean
  opacity?: number
  locked?: boolean
  onToggle: () => void
  onOpacity?: (v: number) => void
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-2 py-1.5 transition-all',
        active
          ? 'border-cyan-400/40 bg-cyan-500/12'
          : 'border-white/8 bg-black/20 hover:border-white/16',
        locked && 'opacity-60',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full text-left"
      >
        <span
          className={cn(
            'w-6 h-3.5 rounded-full relative flex-shrink-0 transition-colors',
            active ? 'bg-cyan-500' : 'bg-ocean-600',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform',
              active ? 'translate-x-3' : 'translate-x-0.5',
            )}
          />
        </span>
        <span className={cn('text-[11px] font-medium truncate', active ? 'text-slate-100' : 'text-slate-400')}>
          {def.name}
        </span>
        {locked && <span className="ml-auto text-[8px] text-amber-400/80">PRO</span>}
      </button>
      {active && onOpacity && opacity != null && (
        <div className="flex items-center gap-1.5 mt-1 pl-7">
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => onOpacity(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-[9px] text-slate-500 w-6 text-right font-mono">
            {Math.round(opacity * 100)}
          </span>
        </div>
      )}
    </div>
  )
}

function CaptainsBrief() {
  const current = useWeatherStore((s) => s.current)
  const marine = useWeatherStore((s) => s.marine)
  const hourly = useWeatherStore((s) => s.hourly)

  if (!current) return null

  const rain = hourly[0]?.precipProbability ?? 0
  const seas = marine?.hourly[0]
  const kt = Math.round(mphToKnots(current.windSpeed))
  const gustKt = Math.round(mphToKnots(current.windGusts))
  const dir = degreesToCardinal(current.windDirection)
  const beaufort = windToBeaufort(current.windSpeed)
  const sea = seas ? waveHeightToSeaState(seas.waveHeight) : null

  let call = 'Fishable.'
  if ((seas && seas.waveHeight >= 6) || current.windSpeed >= 28) call = 'Sit it out. Small-craft caution.'
  else if ((seas && seas.waveHeight >= 4) || current.windSpeed >= 20) call = 'Marginal. Watch the gusts and seas.'
  else if (current.weatherCode >= 95) call = 'Storms in the area. Keep an exit.'
  else call = `Fishable. ${beaufort.label.toLowerCase()}${sea ? `, ${sea.label.toLowerCase()} seas` : ''}.`

  return (
    <div className="rounded-xl bg-black/30 border border-white/8 px-2.5 py-2 space-y-0.5">
      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Captain's Brief</p>
      <p className="text-[11px] text-slate-200 leading-snug">
        {dir} {kt} G{gustKt} kt · {Math.round(current.temperature)}°
      </p>
      <p className="text-[11px] text-slate-300 leading-snug">
        {seas
          ? `Waves ${seas.waveHeight.toFixed(1)} ft · swell ${Math.round(seas.swellPeriod)}s`
          : `${current.cloudCover}% cloud`}
        {rain > 0 ? ` · rain ${rain}%` : ''}
      </p>
      <p className="text-[11px] text-cyan-300/90 leading-snug">{call}</p>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
}

export default function WeatherSidebar({ open, onClose }: Props) {
  const {
    panelOpen,
    setPanelOpen,
    overlays,
    toggleOverlay,
    setOverlayOpacity,
    current,
    loading,
    location,
    fetchWeather,
  } = useWeatherStore()

  const layers = useMapStore((s) => s.layers)
  const toggleLayer = useMapStore((s) => s.toggleLayer)
  const setLayerOpacity = useMapStore((s) => s.setLayerOpacity)
  const droppedPin = useMapStore((s) => s.droppedPin)
  const clickedPoint = useMapStore((s) => s.clickedPoint)
  const viewState = useMapStore((s) => s.viewState)

  const user = useAuthStore((s) => s.user)
  const setShowAuthModal = useAuthStore((s) => s.setShowAuthModal)
  const isPremium = user?.isPremium ?? false

  const initialFetchDone = useRef(false)

  useEffect(() => {
    if (!open) return
    const loc = droppedPin ?? clickedPoint
    if (loc) fetchWeather(loc.lat, loc.lng)
  }, [open, droppedPin, clickedPoint, fetchWeather])

  useEffect(() => {
    if (!open || current || loading || location || initialFetchDone.current) return
    initialFetchDone.current = true
    const timer = setTimeout(() => {
      fetchWeather(viewState.latitude, viewState.longitude)
    }, 800)
    return () => clearTimeout(timer)
  }, [open, current, loading, location, fetchWeather, viewState.latitude, viewState.longitude])

  const overlayById = (id: string) => overlays.find((o) => o.id === id)
  const layerById = (id: string) => layers.find((l) => l.id === id)

  const handleImagery = (id: string) => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    if (!isPremium) return
    toggleLayer(id)
  }

  return (
    <>
      <div
        className={cn(
          'md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'flex flex-col overflow-hidden border-l border-white/10',
          'bg-ocean-900/80 backdrop-blur-xl',
          'fixed top-14 bottom-0 right-0 z-40 w-[300px] transition-transform duration-300 ease-in-out',
          'md:relative md:top-auto md:bottom-auto md:z-auto md:flex-shrink-0 md:transition-all',
          open ? 'translate-x-0 md:w-[300px]' : 'translate-x-full md:translate-x-0 md:w-0',
        )}
        style={{ minWidth: open ? undefined : '0px' }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-200 tracking-wide">Weather</span>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-white/8 text-slate-500 hover:text-slate-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-2.5 space-y-3">
          <section>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Imagery
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {IMAGERY.map((def) => {
                const layer = layerById(def.id)
                return (
                  <OverlayCard
                    key={def.id}
                    def={def}
                    active={layer?.visible ?? false}
                    opacity={layer?.opacity}
                    locked={!isPremium}
                    onToggle={() => handleImagery(def.id)}
                    onOpacity={isPremium ? (v) => setLayerOpacity(def.id, v) : undefined}
                  />
                )
              })}
            </div>
          </section>

          <section>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Overlays
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {OVERLAYS.map((def) => {
                const overlay = overlayById(def.id)
                return (
                  <OverlayCard
                    key={def.id}
                    def={def}
                    active={overlay?.visible ?? false}
                    opacity={overlay?.opacity}
                    onToggle={() => toggleOverlay(def.id)}
                    onOpacity={(v) => setOverlayOpacity(def.id, v)}
                  />
                )
              })}
            </div>
          </section>

          <PinnedLegend />

          <CaptainsBrief />

          <section>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-0.5">
              Forecast
            </p>
            <WeatherRows />
          </section>
        </div>

        <div className="flex-shrink-0 px-2.5 py-2 border-t border-white/8 space-y-1.5">
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-medium border',
              panelOpen
                ? 'border-cyan-500/40 bg-cyan-500/12 text-cyan-300'
                : 'border-white/10 bg-black/20 text-slate-400 hover:border-white/20',
            )}
          >
            <span>Playback timeline</span>
            <span className={panelOpen ? 'text-cyan-400' : 'text-slate-600'}>{panelOpen ? 'ON' : 'OFF'}</span>
          </button>
          <p className="text-[8px] text-slate-600 text-center">Open-Meteo · RainViewer · NOAA · NASA GIBS</p>
        </div>
      </aside>
    </>
  )
}
