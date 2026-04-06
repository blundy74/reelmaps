import { useMapStore } from '../../store/mapStore'
import { useWeatherStore } from '../../store/weatherStore'

interface LegendDef {
  layerId: string
  title: string
  unit: string
  gradient: string
  labels: { value: string; position: string }[]
  /** If set, check weatherStore overlays instead of mapStore layers */
  isWeatherOverlay?: boolean
}

const LEGENDS: LegendDef[] = [
  {
    layerId: 'sst-mur',
    title: 'Sea Surface Temp',
    unit: '°F / °C',
    gradient: 'linear-gradient(to right, #050080, #0000ff, #00b0ff, #00ffff, #00ff80, #80ff00, #ffff00, #ff8000, #ff0000, #800000)',
    labels: [
      { value: '50°F / 10°C', position: '0%' },
      { value: '68°F / 20°C', position: '38%' },
      { value: '82°F / 28°C', position: '75%' },
      { value: '95°F / 35°C', position: '100%' },
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
    title: 'GOES SST (NRT)',
    unit: '°F',
    gradient: 'linear-gradient(to right, #050080, #0000ff, #00b0ff, #00ffff, #00ff80, #80ff00, #ffff00, #ff8000, #ff0000)',
    labels: [
      { value: '50°F', position: '0%' },
      { value: '70°F', position: '45%' },
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
    layerId: 'currents',
    title: 'Ocean Currents',
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
    title: 'Sea Height Anomaly',
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
    title: 'Sargassum / Weedlines (7-day Avg)',
    unit: 'AFAI',
    isWeatherOverlay: false,
    gradient: 'linear-gradient(to right, rgba(0,0,0,0) 0%, #264653 15%, #2a9d8f 35%, #e9c46a 60%, #f4a261 80%, #e76f51 100%)',
    labels: [
      { value: 'None', position: '0%' },
      { value: 'Low', position: '30%' },
      { value: 'Moderate', position: '60%' },
      { value: 'Dense', position: '100%' },
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
]

export function ColorLegend({ forecastBarOpen = false }: { forecastBarOpen?: boolean }) {
  const { layers } = useMapStore()
  const weatherOverlays = useWeatherStore((s) => s.overlays)

  const activeLegends = LEGENDS.filter((def) => {
    if (def.isWeatherOverlay) {
      return weatherOverlays.find((o) => o.id === def.layerId)?.visible
    }
    return layers.find((l) => l.id === def.layerId)?.visible
  })

  if (!activeLegends.length) return null

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
