import { degreesToCardinal } from '../../lib/weatherTypes'

interface Props {
  direction: number   // degrees (where wind is coming FROM)
  speed: number       // mph
  gusts: number       // mph
  size?: number
}

export default function WindCompass({ direction, speed, gusts, size = 120 }: Props) {
  const r = size / 2
  const cardinal = degreesToCardinal(direction)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
        {/* Outer ring */}
        <circle cx={r} cy={r} r={r - 2} fill="none" stroke="rgba(100,116,139,0.3)" strokeWidth="1" />
        <circle cx={r} cy={r} r={r - 12} fill="rgba(7,17,31,0.8)" stroke="rgba(100,116,139,0.2)" strokeWidth="1" />

        {/* Cardinal labels */}
        {['N', 'E', 'S', 'W'].map((label, i) => {
          const angle = (i * 90 - 90) * (Math.PI / 180)
          const tx = r + (r - 7) * Math.cos(angle)
          const ty = r + (r - 7) * Math.sin(angle)
          return (
            <text
              key={label}
              x={tx}
              y={ty}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-slate-500 text-[9px] font-semibold"
            >
              {label}
            </text>
          )
        })}

        {/* Tick marks */}
        {Array.from({ length: 36 }, (_, i) => {
          const angle = (i * 10 - 90) * (Math.PI / 180)
          const major = i % 9 === 0
          const inner = r - (major ? 18 : 15)
          const outer = r - 12
          return (
            <line
              key={i}
              x1={r + inner * Math.cos(angle)}
              y1={r + inner * Math.sin(angle)}
              x2={r + outer * Math.cos(angle)}
              y2={r + outer * Math.sin(angle)}
              stroke={major ? 'rgba(148,163,184,0.5)' : 'rgba(148,163,184,0.2)'}
              strokeWidth={major ? 1.5 : 0.5}
            />
          )
        })}

        {/* Wind arrow (points in the direction wind is blowing TO) */}
        <g transform={`rotate(${direction + 180}, ${r}, ${r})`}>
          {/* Arrow shaft */}
          <line
            x1={r} y1={r + 20} x2={r} y2={r - 32}
            stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round"
          />
          {/* Arrow head */}
          <polygon
            points={`${r},${r - 38} ${r - 6},${r - 26} ${r + 6},${r - 26}`}
            fill="#06b6d4"
          />
        </g>

        {/* Center dot */}
        <circle cx={r} cy={r} r="3" fill="#06b6d4" />
      </svg>

      {/* Speed + direction label */}
      <div className="text-center">
        <div className="text-lg font-semibold text-slate-100 font-mono">
          {Math.round(speed)} <span className="text-xs text-slate-400">mph</span>
        </div>
        <div className="text-xs text-slate-400">
          {cardinal} ({Math.round(direction)}°)
          {gusts > speed + 5 && (
            <span className="text-amber-400"> gusts {Math.round(gusts)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
