import { useState } from 'react'
import { useMapStore } from '../../store/mapStore'
import { Switch } from '../ui/Switch'
import { Slider } from '../ui/Slider'
import { Tooltip } from '../ui/Tooltip'
import type { MapLayer } from '../../types'
import { cn } from '../../lib/utils'

type LayerGroup = MapLayer['group']

const GROUP_CONFIG: Record<LayerGroup, { label: string; icon: string; accent: string }> = {
  satellite: {
    label: 'Satellite & Ocean Color',
    icon: '🛰️',
    accent: 'text-cyan-400',
  },
  oceanography: {
    label: 'Oceanography',
    icon: '🌊',
    accent: 'text-blue-400',
  },
  charts: {
    label: 'Charts & Bathymetry',
    icon: '⚓',
    accent: 'text-slate-300',
  },
  fishing: {
    label: 'Fishing',
    icon: '🎣',
    accent: 'text-amber-400',
  },
}

const GROUP_ORDER: LayerGroup[] = ['fishing', 'satellite', 'oceanography', 'charts']

interface LayerRowProps {
  layer: MapLayer
  onToggle: (id: string) => void
  onOpacity: (id: string, v: number) => void
}

function LayerRow({ layer, onToggle, onOpacity }: LayerRowProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn('rounded-lg overflow-hidden transition-colors', layer.visible ? 'bg-ocean-750/80' : 'bg-transparent')}>
      <div
        className="layer-row flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Toggle switch */}
        <Switch
          checked={layer.visible}
          onCheckedChange={() => onToggle(layer.id)}
          size="sm"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        />

        {/* Name */}
        <span
          className={cn(
            'flex-1 text-sm leading-tight',
            layer.visible ? 'text-slate-200' : 'text-slate-500',
          )}
        >
          {layer.name}
        </span>

        {/* Date indicator */}
        {layer.hasDateControl && (
          <Tooltip content="Layer updates with selected date" side="left">
            <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </Tooltip>
        )}

        {/* Expand chevron */}
        <svg
          className={cn('w-3.5 h-3.5 text-slate-600 transition-transform', expanded ? 'rotate-180' : '')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded: opacity + description */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 animate-fade-in">
          {layer.visible && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-12 flex-shrink-0">Opacity</span>
              <Slider
                value={layer.opacity}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(v) => onOpacity(layer.id, v)}
                className="flex-1"
              />
              <span className="text-xs font-mono text-slate-400 w-8 text-right">
                {Math.round(layer.opacity * 100)}%
              </span>
            </div>
          )}
          <p className="text-xs text-slate-500 leading-relaxed">{layer.description}</p>
          {layer.attribution && (
            <p className="text-xs text-slate-600 italic">Source: {layer.attribution}</p>
          )}
        </div>
      )}
    </div>
  )
}

interface GroupSectionProps {
  group: LayerGroup
  layers: MapLayer[]
  onToggle: (id: string) => void
  onOpacity: (id: string, v: number) => void
}

function GroupSection({ group, layers, onToggle, onOpacity }: GroupSectionProps) {
  const [open, setOpen] = useState(true)
  const config = GROUP_CONFIG[group]
  const activeCount = layers.filter((l) => l.visible).length

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ocean-750 transition-colors text-left"
      >
        <span className="text-sm">{config.icon}</span>
        <span className={cn('text-xs font-semibold uppercase tracking-wider flex-1', config.accent)}>
          {config.label}
        </span>
        {activeCount > 0 && (
          <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full px-1.5 py-0.5 font-mono">
            {activeCount}
          </span>
        )}
        <svg
          className={cn('w-3.5 h-3.5 text-slate-600 transition-transform', !open ? '-rotate-90' : '')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="pl-1 space-y-0.5 mt-0.5">
          {layers.map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              onToggle={onToggle}
              onOpacity={onOpacity}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Basemap selector ─────────────────────────────────────────────────────────

const BASEMAPS = [
  { id: 'dark', label: 'Dark Ocean', color: '#040c18' },
  { id: 'satellite', label: 'Satellite', color: '#2d6a2d' },
  { id: 'nautical', label: 'Nautical', color: '#0a3060' },
  { id: 'light', label: 'Light', color: '#d0e8f8' },
] as const

function BasemapSelector() {
  const { basemap, setBasemap, toggleLayer, layers } = useMapStore()

  const handleBasemapSelect = (id: typeof BASEMAPS[number]['id']) => {
    setBasemap(id)

    // Auto-toggle satellite imagery layer
    const satLayer = layers.find((l) => l.id === 'satellite-imagery')
    if (id === 'satellite' && satLayer && !satLayer.visible) {
      toggleLayer('satellite-imagery')
    } else if (id !== 'satellite' && satLayer?.visible) {
      toggleLayer('satellite-imagery')
    }

    // Auto-toggle NOAA charts
    const chartLayer = layers.find((l) => l.id === 'noaa-charts')
    if (id === 'nautical' && chartLayer && !chartLayer.visible) {
      toggleLayer('noaa-charts')
    } else if (id !== 'nautical' && chartLayer?.visible) {
      toggleLayer('noaa-charts')
    }
  }

  return (
    <div className="px-2 mb-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Basemap</p>
      <div className="grid grid-cols-2 gap-1.5">
        {BASEMAPS.map((bm) => (
          <button
            key={bm.id}
            onClick={() => handleBasemapSelect(bm.id)}
            className={cn(
              'flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all border',
              basemap === bm.id
                ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
                : 'border-ocean-600 bg-ocean-800 text-slate-400 hover:border-ocean-500 hover:text-slate-300',
            )}
          >
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0 border border-white/20"
              style={{ background: bm.color }}
            />
            {bm.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main LayerPanel ───────────────────────────────────────────────────────────

export default function LayerPanel() {
  const { layers, toggleLayer, setLayerOpacity, setSelectedDate } = useMapStore()

  const handleToggle = (id: string) => {
    toggleLayer(id)
    if (id === 'hotspot') {
      const hotspot = layers.find((l) => l.id === 'hotspot')
      // hotspot.visible is the CURRENT state before toggle, so !visible = new state
      const turningOn = !hotspot?.visible
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      setSelectedDate(turningOn ? today : yesterday)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        <BasemapSelector />

        <div className="px-2 mb-2">
          <div className="h-px bg-ocean-700" />
        </div>

        <div className="px-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Data Layers</p>
          {GROUP_ORDER.map((group) => {
            const groupLayers = layers.filter((l) => l.group === group)
            if (!groupLayers.length) return null
            return (
              <GroupSection
                key={group}
                group={group}
                layers={groupLayers}
                onToggle={handleToggle}
                onOpacity={setLayerOpacity}
              />
            )
          })}
        </div>
      </div>

      {/* Footer note */}
      <div className="px-4 py-3 border-t border-ocean-700">
        <p className="text-xs text-slate-600 leading-relaxed">
          Satellite data provided by{' '}
          <a href="https://gibs.earthdata.nasa.gov" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline">
            NASA GIBS
          </a>{' '}
          &amp;{' '}
          <a href="https://coastwatch.noaa.gov" target="_blank" rel="noreferrer" className="text-slate-500 hover:text-slate-300 underline-offset-2 hover:underline">
            NOAA CoastWatch
          </a>
        </p>
      </div>
    </div>
  )
}
