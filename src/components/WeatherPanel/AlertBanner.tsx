/**
 * AlertBanner — shows active marine weather alerts as a banner overlay on the map.
 * Dismissed alerts persist in localStorage until the user logs in again and they still exist.
 */

import { useEffect, useState } from 'react'
import { useWeatherStore } from '../../store/weatherStore'
import { fetchMarineAlerts } from '../../lib/alertsApi'
import type { MarineAlert } from '../../lib/alertsApi'
import { cn } from '../../lib/utils'

const DISMISSED_KEY = 'reelmaps-dismissed-alerts'

function getDismissed(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch { return new Set() }
}

function saveDismissed(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
}

export default function AlertBanner() {
  const location = useWeatherStore((s) => s.location)
  const [alerts, setAlerts] = useState<MarineAlert[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed)

  useEffect(() => {
    if (!location) {
      setAlerts([])
      return
    }

    let cancelled = false

    async function load() {
      try {
        const result = await fetchMarineAlerts(location!.lat, location!.lng)
        if (!cancelled) {
          setAlerts(result)
          // Clean up dismissed alerts that no longer exist
          const activeIds = new Set(result.map(a => a.id))
          setDismissed(prev => {
            const cleaned = new Set([...prev].filter(id => activeIds.has(id)))
            saveDismissed(cleaned)
            return cleaned
          })
        }
      } catch {
        // Silently fail — alerts are informational
      }
    }

    load()
    return () => { cancelled = true }
  }, [location])

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id))

  if (visibleAlerts.length === 0) return null

  function severityColors(severity: string) {
    switch (severity) {
      case 'Extreme':
      case 'Severe':
        return 'bg-red-600/90 border-red-500/80 text-red-50'
      case 'Moderate':
        return 'bg-orange-600/90 border-orange-500/80 text-orange-50'
      default:
        return 'bg-yellow-600/90 border-yellow-500/80 text-yellow-50'
    }
  }

  function severityByEvent(event: string): string {
    if (event.includes('Warning')) return 'Severe'
    if (event.includes('Watch')) return 'Moderate'
    return 'Minor'
  }

  const handleDismiss = (alertId: string) => {
    setDismissed(prev => {
      const next = new Set(prev).add(alertId)
      saveDismissed(next)
      return next
    })
  }

  return (
    <div className="absolute top-16 left-14 right-14 z-25 flex flex-col gap-1.5 pointer-events-none">
      {visibleAlerts.map((alert) => {
        const sev = alert.severity === 'Unknown' ? severityByEvent(alert.event) : alert.severity
        const isExpanded = expandedId === alert.id

        return (
          <div
            key={alert.id}
            className={cn(
              'pointer-events-auto rounded-xl border shadow-lg backdrop-blur-sm transition-all animate-fade-in',
              severityColors(sev),
            )}
          >
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : alert.id)}
            >
              {/* Warning icon */}
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>

              <span className="flex-1 text-xs font-semibold truncate">
                {alert.headline}
              </span>

              {/* Expand/collapse arrow */}
              <svg
                className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform', isExpanded && 'rotate-180')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>

              {/* Dismiss button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDismiss(alert.id)
                }}
                className="p-0.5 rounded hover:bg-white/20 flex-shrink-0"
                title="Dismiss until next login"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Expanded description */}
            {isExpanded && (
              <div className="px-3 pb-2.5 max-h-40 overflow-y-auto">
                <p className="text-[11px] leading-relaxed opacity-90 whitespace-pre-line">
                  {alert.description}
                </p>
                {alert.expires && (
                  <p className="text-[10px] opacity-70 mt-1.5">
                    Expires: {new Date(alert.expires).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
