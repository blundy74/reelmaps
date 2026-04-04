/**
 * MapApp — the main fishing map application.
 * Extracted from App.tsx so it can be rendered behind an auth guard.
 */

import Header from './components/Header/Header'
import Sidebar from './components/Sidebar/Sidebar'
import FishingMap from './components/Map/FishingMap'
import { ColorLegend } from './components/ui/ColorLegend'
import DroppedPinPanel from './components/Map/DroppedPinPanel'
import BottomWeatherBar from './components/WeatherPanel/BottomWeatherBar'
import WeatherSidebar from './components/WeatherPanel/WeatherSidebar'
import SettingsModal from './components/WeatherPanel/SettingsModal'
import AuthModal from './components/Auth/AuthModal'
import EmailVerificationBanner from './components/Auth/EmailVerificationBanner'
import AlertBanner from './components/WeatherPanel/AlertBanner'
import ShareButton from './components/ui/ShareButton'
import ShortcutsModal from './components/ui/ShortcutsModal'
import ImportModal from './components/Import/ImportModal'
import { useMapStore } from './store/mapStore'
import { useWeatherStore } from './store/weatherStore'
import { useAuthStore } from './store/authStore'
import { useUserSpotsStore } from './store/userSpotsStore'
import useKeyboardShortcuts, { registerShortcutsModalOpener, unregisterShortcutsModalOpener } from './hooks/useKeyboardShortcuts'
import { useEffect, useState, useCallback } from 'react'

export default function MapApp() {
  const { selectedSpot, pinModeActive, setPinModeActive, measureMode, setMeasureMode, sidebarOpen, setSidebarOpen } = useMapStore()
  const forecastBarOpen = useWeatherStore((s) => s.panelOpen)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [weatherRightOpen, setWeatherRightOpen] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768
  )

  useKeyboardShortcuts()

  const openShortcuts = useCallback(() => setShortcutsOpen(true), [])
  useEffect(() => {
    registerShortcutsModalOpener(openShortcuts)
    return () => unregisterShortcutsModalOpener()
  }, [openShortcuts])

  const user = useAuthStore((s) => s.user)
  const fetchUserSpots = useUserSpotsStore((s) => s.fetchSpots)

  // Fetch user spots when logged in
  useEffect(() => {
    if (user) fetchUserSpots()
  }, [user, fetchUserSpots])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-ocean-950">
      <Header onSettingsClick={() => setSettingsOpen(true)} />
      <EmailVerificationBanner />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — fishing/map layers */}
        <Sidebar onImportClick={() => setImportOpen(true)} />

        {/* Map area */}
        <main className={`relative flex-1 overflow-hidden ${forecastBarOpen ? 'forecast-bar-open' : ''}`}>
          <FishingMap />
          <AlertBanner />
          <ColorLegend forecastBarOpen={forecastBarOpen} />

          {/* Floating fish icon — toggle left sidebar */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`absolute top-3 left-3 z-20 w-11 h-11 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all shadow-lg border ${
              sidebarOpen
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 hidden md:flex'
                : 'glass border-ocean-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40'
            }`}
            title={sidebarOpen ? 'Close fishing panel' : 'Open fishing panel'}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <ellipse cx="10" cy="12" rx="5" ry="3" />
              <path d="M15 12 l4-3 l0 6 z" />
              <circle cx="8" cy="11.5" r="0.8" fill="#040c18"/>
            </svg>
          </button>

          {/* Floating weather icon — toggle right sidebar */}
          <button
            onClick={() => setWeatherRightOpen(!weatherRightOpen)}
            className={`absolute top-3 right-3 z-20 w-11 h-11 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all shadow-lg border ${
              weatherRightOpen
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 hidden md:flex'
                : 'glass border-ocean-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40'
            }`}
            title={weatherRightOpen ? 'Close weather panel' : 'Open weather panel'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </button>

          {/* Tool buttons — below the floating icons */}
          <div className="absolute top-[60px] md:top-16 right-3 z-20 flex flex-col gap-2">
            <ShareButton />

            <button
              onClick={() => {
                setMeasureMode(!measureMode)
                if (!measureMode) setPinModeActive(false)
              }}
              title={measureMode ? 'Cancel measure' : 'Measure distance'}
              className={`flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-xl text-xs font-medium transition-all shadow-lg border ${
                measureMode
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 animate-pulse'
                  : 'glass border-ocean-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40'
              }`}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {/* Pin A */}
                <path d="M5 10c0-1.7 1.3-3 3-3s3 1.3 3 3c0 2.5-3 5-3 5S5 12.5 5 10z" />
                <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
                {/* Dotted line connecting pins */}
                <line x1="10" y1="13" x2="14" y2="9" strokeDasharray="1.5 2" />
                {/* Pin B */}
                <path d="M13 7c0-1.7 1.3-3 3-3s3 1.3 3 3c0 2.5-3 5-3 5s-3-2.5-3-5z" />
                <circle cx="16" cy="7" r="1" fill="currentColor" stroke="none" />
              </svg>
              <span className="hidden sm:inline">{measureMode ? 'Measuring...' : 'Measure'}</span>
            </button>

            <button
              onClick={() => {
                setPinModeActive(!pinModeActive)
                if (!pinModeActive) setMeasureMode(false)
              }}
              title={pinModeActive ? 'Cancel flag drop' : 'Drop a flag'}
              className={`flex items-center gap-2 px-3 py-2.5 md:py-2 rounded-xl text-xs font-medium transition-all shadow-lg border ${
                pinModeActive
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 animate-pulse'
                  : 'glass border-ocean-600 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40'
              }`}
            >
              <svg className="w-3.5 h-4" viewBox="0 0 28 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="4" y1="2" x2="4" y2="46" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M4 2 L24 8 L4 16 Z" fill="currentColor" opacity="0.8"/>
              </svg>
              <span className="sm:hidden">{pinModeActive ? 'Tap map' : 'Point'}</span>
              <span className="hidden sm:inline">{pinModeActive ? 'Click map to place' : 'Drop Flag'}</span>
            </button>
          </div>

          {/* Dropped pin info panel */}
          <DroppedPinPanel />

          {/* Selected spot info banner (mobile) */}
          {selectedSpot && (
            <div className={`absolute left-4 right-4 md:hidden glass rounded-2xl p-3 animate-fade-in z-10 ${forecastBarOpen ? 'bottom-36' : 'bottom-16'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{selectedSpot.name}</p>
                  <p className="text-xs text-slate-400">{selectedSpot.region} · {selectedSpot.depth.toLocaleString()} ft</p>
                </div>
                <button
                  onClick={() => useMapStore.getState().setSelectedSpot(null)}
                  className="p-2.5 rounded-lg hover:bg-ocean-700 text-slate-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Bottom forecast bar */}
          {forecastBarOpen && <BottomWeatherBar />}
        </main>

        {/* Right sidebar — weather overlays (independent of forecast bar) */}
        <WeatherSidebar open={weatherRightOpen} onClose={() => setWeatherRightOpen(false)} />
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AuthModal />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
