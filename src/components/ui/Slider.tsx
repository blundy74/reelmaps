import { cn } from '../../lib/utils'

interface SliderProps {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  className?: string
  disabled?: boolean
}

export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  className,
  disabled,
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className={cn('relative flex items-center w-full', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${pct}%, #183050 ${pct}%, #183050 100%)`,
        }}
      />
    </div>
  )
}
