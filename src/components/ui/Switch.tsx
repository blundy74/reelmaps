import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  size?: 'sm' | 'md'
}

export function Switch({ checked, onCheckedChange, disabled, className, size = 'md', onClick, ...rest }: SwitchProps) {
  const isSmall = size === 'sm'

  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => { onCheckedChange(!checked); onClick?.(e) }}
      {...rest}
      className={cn(
        'relative inline-flex flex-shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1 focus-visible:ring-offset-ocean-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
        isSmall ? 'h-4 w-7' : 'h-5 w-9',
        checked
          ? 'bg-cyan-500'
          : 'bg-ocean-600 hover:bg-ocean-500',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-lg transform transition-transform duration-200',
          isSmall ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5',
          checked
            ? isSmall ? 'translate-x-3.5' : 'translate-x-4'
            : isSmall ? 'translate-x-0.5' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}
