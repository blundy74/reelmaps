import { useMapStore } from '../../store/mapStore'
import { useWeatherStore } from '../../store/weatherStore'
import { SST_GRADIENT_CSS, sstLegendLabels } from '../../lib/sstPalette'
import { OSCAR_AGE_STAMP } from '../../lib/oscarCurrents'

interface LegendDef {
  layerId: string
  title: string
  unit: string
  gradient: string
  labels: { value: string; position: string }[]
  /** Captain-visible age stamp — never ISO in a tooltip. */
  stamp?: string
  /** If set, check weatherStore overlays instead of mapStore layers */
  isWeatherOverlay?: boolean
}

export const LEGENDS: LegendDef[] = [
  {
    layerId: 'sst-mur',
    title: 'Cloud-free SST (MUR L4)',
    unit: '°F',
    gradient: SST_GRADIENT_CSS,
    labels: [
      { value: '50°F', position: '0%' },
      { value: '70°F', position: '50%' },
      { value: '90°F', position: '100%' },
    ],
  },
  {
    layerId: 'sst-anomaly',
    title: 'SST Anomaly',
    unit: '°C deviation',
    gradient: 'linear-gradient(to right, #0000ff, #4444ff, #8888ff, #ffffff, #ff8888, #ff4444, #ff0000)',
    labels: [
      { value: '-5°C', position: '0%' },
      { value: '0°C', position: '50%' },
      { value: '+5°C', position: '100%' },
    ],
  },
  {
    layerId: 'sst-goes',
    title: 'VIIRS S-NPP SST (daily pass)',
    unit: '°F',
    gradient: SST_GRADIENT_CSS,
    labels: [
      { value: '50°F', position: '0%' },
      { value: '70°F', position: '50%' },
      { value: '90°F', position: '100%' },
    ],
  },
  {
    layerId: 'chlorophyll',
    title: 'Chlorophyll-a',
    unit: 'mg/m³',
    gradient: 'linear-gradient(to right, #4b0082, #0000cd, #006400, #adff2f, #ffff00, #ff8c00)',
    labels: [
      { value: '0.01', position: '0%' },
      { value: '0.1', position: '33%' },
      { value: '1.0', position: '66%' },
      { value: '10+', position: '100%' },
    ],
  },
  {
    layerId: 'salinity',
    title: 'Sea Salinity',
    unit: 'PSU',
    gradient: 'linear-gradient(to right, #0000cd, #00bfff, #00fa9a, #ffff00, #ff8c00, #8b0000)',
    labels: [
      { value: '30', position: '0%' },
      { value: '33', position: '37%' },
      { value: '36', position: '75%' },
      { value: '38+', position: '100%' },
    ],
  },
  {
    layerId: 'current-arrows',
    title: 'Current speed',
    unit: 'kt',
    stamp: OSCAR_AGE_STAMP,
    gradient: 'linear-gradient(to right, #7dd3fc, #eab308, #f97316, #ef4444)',
    labels: [
      { value: '0', position: '0%' },
      { value: '2', position: '50%' },
      { value: '4 kt', position: '100%' },
    ],
  },
  {
    layerId: 'altimetry',
    title: 'SSH contours',
    unit: 'fat 0 anomaly',
    gradient: 'linear-gradient(to right, transparent, #e2e8f0 50%, transparent)',
    labels: [
      { value: '10 cm', position: '0%' },
      { value: '0 fat', position: '50%' },
      { value: 'SLA', position: '100%' },
    ],
  },
  {
    layerId: 'currents',
    title: 'Ocean Currents (raster)',
    unit: 'm/s (zonal)',
    gradient: 'linear-gradient(to right, #0000cd, #ffffff, #ff0000)',
    labels: [
      { value: '-1 (W)', position: '0%' },
      { value: '0', position: '50%' },
      { value: '+1 (E)', position: '100%' },
    ],
  },
  {
    layerId: 'ssh-anomaly',
    title: 'SSH Fill',
    unit: 'cm',
    gradient: 'linear-gradient(to right, #0000cd, #ffffff, #ff0000)',
    labels: [
      { value: '-20 cm', position: '0%' },
      { value: '0', position: '50%' },
      { value: '+20 cm', position: '100%' },
    ],
  },
  // ── Fishing hotspot overlay ────────────────────────────────────────────
  {
    layerId: 'hotspot',
    title: 'Fishing Hotspot Score',
    unit: 'probability',
    isWeatherOverlay: false,
    gradient: 'linear-gradient(to right, #1e5090, #14a0a0, #80d030, #f0c000, #ff6020, #ff2040, #ff50e0)',
    labels: [
      { value: 'Low', position: '0%' },
      { value: 'Moderate', position: '35%' },
      { value: 'High', position: '65%' },
      { value: 'Extreme', position: '100%' },
    ],
  },
  {
    layerId: 'hotspot-inshore',
    title: 'Inshore Hotspot (<9 NM)',
    unit: 'probability',
    isWeatherOverlay: false,
    gradient: 'linear-gradient(to right, #1e5090, #14a0a0, #80d030, #f0c000, #ff6020, #ff2040, #ff50e0)',
    labels: [
      { value: 'Low', position: '0%' },
      { value: 'Moderate', position: '35%' },
      { value: 'High', position: '65%' },
      { value: 'Extreme', position: '100%' },
    ],
  },
  {
    layerId: 'hotspot-offshore',
    title: 'Offshore Hotspot (>9 NM)',
    unit: 'probability',
    isWeatherOverlay: false,
    gradient: 'linear-gradient(to right, #1e5090, #14a0a0, #80d030, #f0c000, #ff6020, #ff2040, #ff50e0)',
    labels: [
      { value: 'Low', position: '0%' },
      { value: 'Moderate', position: '35%' },
      { value: 'High', position: '65%' },
      { value: 'Extreme', position: '100%' },
    ],
  },
  // ── Sargassum / Weedline overlay ────────────────────────────────────────
  {
    layerId: 'sargassum',
    title: 'Weedlines (7-day)',
    unit: 'AFAI',
    isWeatherOverlay: false,
    gradient: 'linear-gradient(to right, #6600ff 0%, #0050ff 20%, #00dcc8 40%, #32dc32 60%, #f0c800 80%, #ff3c00 100%)',
    labels: [
      { value: 'None', position: '0%' },
      { value: 'Low', position: '30%' },
      { value: 'Moderate', position: '60%' },
      { value: 'Dense', position: '100%' },
    ],
  },
  {
    layerId: 'sargassum-daily',
    title: 'Weedlines (Daily)',
    unit: 'AFAI',
    isWeatherOverlay: false,
    gradient: 'linear-gradient(to right, #6600ff 0%, #0050ff 20%, #00dcc8 40%, #32dc32 60%, #f0c800 80%, #ff3c00 100%)',
    labels: [
      { value: 'None', position: '0%' },
      { value: 'Low', position: '30%' },
      { value: 'Moderate', position: '60%' },
      { value: 'Dense', position: '100%' },
    ],
  },
  // ── Radar / Precipitation ──────────────────────────────────────────────
  {
    layerId: 'radar',
    title: 'Rain Radar',
    unit: 'mm/h',
    isWeatherOverlay: true,
    gradient: 'linear-gradient(to right, #005000, #00a000, #00ff00, #ffff00, #ff8000, #ff0000, #cc0000, #cc00cc, #ff80ff)',
    labels: [
      { value: '0.5', position: '0%' },
      { value: '2', position: '22%' },
      { value: '5', position: '40%' },
      { value: '15', position: '58%' },
      { value: '30', position: '72%' },
      { value: '50+', position: '100%' },
    ],
  },
  // ── HRRR weather overlays ──────────────────────────────────────────────
  {
    layerId: 'hrrr-wind',
    title: 'Wind Speed (HRRR)',
    unit: 'knots',
    isWeatherOverlay: true,
    gradient: 'linear-gradient(to right, #64b4e6, #4caf50, #ffc107, #ff9800, #f44336, #9c27b0)',
    labels: [
      { value: '0', position: '0%' },
      { value: '10', position: '25%' },
      { value: '20', position: '50%' },
      { value: '30', position: '75%' },
      { value: '40+', position: '100%' },
    ],
  },
  {
    layerId: 'hrrr-gust',
    title: 'Wind Gusts (HRRR)',
    unit: 'knots',
    isWeatherOverlay: true,
    gradient: 'linear-gradient(to right, #00b400, #ffc107, #ff9800, #ff0000, #dc0078)',
    labels: [
      { value: '0', position: '0%' },
      { value: '15', position: '25%' },
      { value: '25', position: '50%' },
      { value: '35', position: '75%' },
      { value: '50+', position: '100%' },
    ],
  },
  {
    layerId: 'hrrr-lightning',
    title: 'Lightning Threat (HRRR)',
    unit: 'probability',
    isWeatherOverlay: true,
    gradient: 'linear-gradient(to right, transparent, #ffff64, #ff8800, #ff0000, #ff00c8)',
    labels: [
      { value: 'None', position: '0%' },
      { value: 'Low', position: '25%' },
      { value: 'Moderate', position: '50%' },
      { value: 'High', position: '75%' },
      { value: 'Extreme', position: '100%' },
    ],
  },
  {
    layerId: 'hrrr-vis',
    title: 'Visibility',
    unit: 'miles',
    isWeatherOverlay: true,
    gradient: 'linear-gradient(to right, #8b0000, #ff0000, #ff8800, #c8c896, transparent)',
    labels: [
      { value: '0 (fog)', position: '0%' },
      { value: '1', position: '15%' },
      { value: '3', position: '35%' },
      { value: '5', position: '55%' },
      { value: '10+', position: '100%' },
    ],
  },
  // ── Wind & Wave overlays (from weather sidebar) ──────────────────────
  {
    layerId: 'wind',
    title: 'Wind Speed',
    unit: 'mph',
    isWeatherOverlay: true,
    gradient: 'linear-gradient(to right, #1e3c8e, #0097a7, #43a047, #b4d234, #fdd835, #fb8c00, #d32f2f, #ad1457)',
    labels: [
      { value: '0', position: '0%' },
      { value: '5', position: '14%' },
      { value: '10', position: '28%' },
      { value: '15', position: '42%' },
      { value: '20', position: '57%' },
      { value: '30', position: '71%' },
      { value: '40', position: '85%' },
      { value: '50+', position: '100%' },
    ],
  },
  {
    layerId: 'waves',
    title: 'Wave Height',
    unit: 'ft',
    isWeatherOverlay: true,
    gradient: 'linear-gradient(to right, #e8f0fe, #b8d4f0, #7ab0e0, #4090cc, #1a70b8, #0c4a8e, #082e5c)',
    labels: [
      { value: '1', position: '0%' },
      { value: '2', position: '20%' },
      { value: '3', position: '40%' },
      { value: '4', position: '60%' },
      { value: '5+', position: '100%' },
    ],
  },
]

function withSstRange(def: LegendDef, minF: number, maxF: number): LegendDef {
  if (def.layerId !== 'sst-mur' && def.layerId !== 'sst-goes') return def
  return { ...def, labels: sstLegendLabels(minF, maxF) }
}

function withSshStamp(def: LegendDef, sshStamp: string | null): LegendDef {
  if (def.layerId !== 'altimetry' || !sshStamp) return def
  return { ...def, stamp: sshStamp }
}

export function ColorLegend({ forecastBarOpen = false, hidden = false }: { forecastBarOpen?: boolean; hidden?: boolean }) {
  const { layers, sstRange, sshStamp } = useMapStore()
  const weatherOverlays = useWeatherStore((s) => s.overlays)

  const activeLegends = LEGENDS.filter((def) => {
    if (def.isWeatherOverlay) {
      return weatherOverlays.find((o) => o.id === def.layerId)?.visible
    }
    return layers.find((l) => l.id === def.layerId)?.visible
  }).map((def) => withSshStamp(withSstRange(def, sstRange.minF, sstRange.maxF), sshStamp))

  if (hidden || !activeLegends.length) return null

  return (
    <div className={`absolute left-3 md:left-1/2 md:-translate-x-1/2 flex flex-col gap-2 pointer-events-none z-10 transition-all duration-300 ${forecastBarOpen ? 'bottom-[160px]' : 'bottom-10'}`}>
      {activeLegends.slice(0, typeof window !== 'undefined' && window.innerWidth < 768 ? 1 : 2).map((def) => (
        <div
          key={def.layerId}
          className="glass rounded-xl px-3 md:px-4 py-2 md:py-2.5 min-w-0 md:min-w-60 max-w-[calc(100vw-6rem)] md:max-w-xs"
        >
          <div className="flex items-center justify-between mb-1.5 gap-4">
            <span className="text-xs font-semibold text-slate-300">{def.title}</span>
            <span className="text-xs text-slate-500 font-mono">{def.unit}</span>
          </div>
          {def.stamp && (
            <p className="text-[11px] font-semibold text-cyan-200 mb-1.5 tracking-wide">{def.stamp}</p>
          )}
          <div
            className="h-2.5 w-full rounded-full"
            style={{ background: def.gradient }}
          />
          <div className="relative mt-1 h-4 mb-0.5">
            {def.labels.map((label) => (
              <span
                key={label.value}
                className="absolute text-xs text-slate-400 font-mono whitespace-nowrap -translate-x-1/2"
                style={{ left: label.position, fontSize: '9px' }}
              >
                {label.value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Compact legend pinned inside the right rail (Windy-class, not a map HUD). */
export function PinnedLegend() {
  const { layers, sstRange, sshStamp } = useMapStore()
  const weatherOverlays = useWeatherStore((s) => s.overlays)

  const activeLegends = LEGENDS.filter((def) => {
    if (def.isWeatherOverlay) {
      return weatherOverlays.find((o) => o.id === def.layerId)?.visible
    }
    return layers.find((l) => l.id === def.layerId)?.visible
  }).map((def) => withSshStamp(withSstRange(def, sstRange.minF, sstRange.maxF), sshStamp))

  if (!activeLegends.length) return null

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider px-0.5">
        Legend
      </p>
      {activeLegends.slice(0, 3).map((def) => (
        <div key={def.layerId} className="rounded-lg bg-black/25 border border-white/8 px-2 py-1.5">
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-[10px] font-medium text-slate-300 truncate">{def.title}</span>
            <span className="text-[9px] text-slate-500 font-mono flex-shrink-0">{def.unit}</span>
          </div>
          {def.stamp && (
            <p className="text-[10px] font-semibold text-cyan-200 mb-1 tracking-wide">{def.stamp}</p>
          )}
          <div className="h-1.5 w-full rounded-full" style={{ background: def.gradient }} />
          <div className="relative mt-0.5 h-3">
            {def.labels.filter((_, i) => i === 0 || i === def.labels.length - 1 || i === Math.floor(def.labels.length / 2)).map((label) => (
              <span
                key={label.value}
                className="absolute text-[8px] text-slate-500 font-mono whitespace-nowrap -translate-x-1/2"
                style={{ left: label.position }}
              >
                {label.value}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
