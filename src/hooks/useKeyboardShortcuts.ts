/**
 * Global keyboard shortcuts for ReelMaps.
 * Call this hook once in the App component.
 */

import { useEffect } from 'react'
import { useWeatherStore } from '../store/weatherStore'
import { useMapStore } from '../store/mapStore'

/** ID used to track whether the shortcuts modal is open (managed by caller) */
let _showShortcutsModal: (() => void) | null = null

export function registerShortcutsModalOpener(fn: () => void) {
  _showShortcutsModal = fn
}

export function unregisterShortcutsModalOpener() {
  _showShortcutsModal = null
}

export default function useKeyboardShortcuts() {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Skip when user is typing in an input or textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // Also skip if target is content-editable
      if ((e.target as HTMLElement)?.isContentEditable) return

      const key = e.key

      switch (key) {
        // --- Weather overlays ---
        case 'w':
        case 'W':
          e.preventDefault()
          useWeatherStore.getState().toggleOverlay('wind')
          break
        case 'r':
        case 'R':
          e.preventDefault()
          useWeatherStore.getState().toggleOverlay('radar')
          break
        case 'v':
        case 'V':
          e.preventDefault()
          useWeatherStore.getState().toggleOverlay('waves')
          break

        // --- Map layers ---
        case 't':
        case 'T':
          e.preventDefault()
          useMapStore.getState().toggleLayer('sst-mur')
          break
        case 'c':
        case 'C':
          e.preventDefault()
          useMapStore.getState().toggleLayer('currents')
          break
        case 'b':
        case 'B':
          e.preventDefault()
          useMapStore.getState().toggleLayer('bathymetry')
          break
        case 'f':
        case 'F':
          e.preventDefault()
          useMapStore.getState().toggleLayer('fishing-spots')
          break

        // --- Forecast playback ---
        case ' ':
          e.preventDefault()
          // Toggle play/pause — just step forward by 1 as a simple approach;
          // the real play/pause is on the BottomWeatherBar, but we can advance hours here
          {
            const { hourly, selectedForecastHour, setSelectedForecastHour } = useWeatherStore.getState()
            const max = Math.max(hourly.length - 1, 0)
            setSelectedForecastHour(selectedForecastHour >= max ? 0 : selectedForecastHour + 1)
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          {
            const { selectedForecastHour, setSelectedForecastHour } = useWeatherStore.getState()
            setSelectedForecastHour(Math.max(0, selectedForecastHour - 1))
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          {
            const { selectedForecastHour, setSelectedForecastHour, hourly } = useWeatherStore.getState()
            setSelectedForecastHour(Math.min(hourly.length - 1, selectedForecastHour + 1))
          }
          break

        // --- Escape: close modals, cancel pin/measure ---
        case 'Escape':
          useWeatherStore.getState().setPanelOpen(false)
          useMapStore.getState().setPinModeActive(false)
          useMapStore.getState().setMeasureMode(false)
          useMapStore.getState().setSelectedSpot(null)
          break

        // --- Modes ---
        case 'm':
        case 'M':
          e.preventDefault()
          {
            const ms = useMapStore.getState()
            ms.setMeasureMode(!ms.measureMode)
          }
          break
        case 'p':
        case 'P':
          e.preventDefault()
          {
            const ms = useMapStore.getState()
            ms.setPinModeActive(!ms.pinModeActive)
          }
          break

        // --- Shortcuts help ---
        case '?':
        case '/':
          e.preventDefault()
          _showShortcutsModal?.()
          break

        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
