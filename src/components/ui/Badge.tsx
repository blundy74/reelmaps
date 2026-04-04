import { cn } from '../../lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'cyan' | 'amber' | 'green' | 'purple' | 'red'
  className?: string
}

const variants = {
  default: 'bg-ocean-700 text-slate-300 border-ocean-600',
  cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  purple: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
