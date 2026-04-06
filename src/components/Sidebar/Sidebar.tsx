import { useRef } from 'react'
import { useMapStore } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'
import LayerPanel from './LayerPanel'
import SpotsList from './SpotsList'
import MySpotsPanel from './MySpotsPanel'
import { cn } from '../../lib/utils'

type Tab = 'layers' | 'spots' | 'my-spots'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'layers',
    label: 'Layers',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'spots',
    label: 'Fishing Spots',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    id: 'my-spots',
    label: 'My Spots',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
  },
]

export default function Sidebar({ onImportClick }: { onImportClick?: () => void }) {
  const { sidebarOpen, setSidebarOpen, activeTab, setActiveTab, selectedDate, setSelectedDate } = useMapStore()
  const user = useAuthStore((s) => s.user)
  const isPremium = user?.isPremium ?? false
  const dateRef = useRef<HTMLInputElement>(null!)

  const today = new Date()
  const maxDate = today.toISOString().split('T')[0]
  const minDate = '2012-01-01'

  return (
    <>
      {/* Mobile overlay backdrop — fades in/out */}
      <div
        className={cn(
          'md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity duration-300',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar panel */}
      <aside
        className={cn(
          'flex flex-col bg-ocean-900 border-r border-ocean-700 overflow-hidden flex-shrink-0',
          // Mobile: fixed drawer with transform transition only
          'fixed top-14 bottom-0 left-0 z-40 w-72 transition-transform duration-300 ease-in-out',
          // Desktop: inline sidebar with width transition
          'md:relative md:top-auto md:bottom-auto md:z-10 md:transition-all',
          sidebarOpen ? 'translate-x-0 md:w-72' : '-translate-x-full md:translate-x-0 md:w-0',
        )}
        style={{ minWidth: sidebarOpen ? undefined : '0px' }}
        aria-hidden={!sidebarOpen}
      >
        {/* Header with close button on mobile */}
        <div className="flex items-center justify-between border-b border-ocean-700 flex-shrink-0 md:hidden px-3 py-2">
          <span className="text-sm font-semibold text-slate-200">Fishing</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Satellite date picker — visible to all, disabled for free users */}
        <div className={cn('flex items-center gap-2 px-3 py-2 border-b border-ocean-700 flex-shrink-0', !isPremium && 'opacity-50 pointer-events-none')}>
          <svg className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider flex-shrink-0">Satellite Date</span>
          <input
            ref={dateRef}
            type="date"
            value={selectedDate}
            min={minDate}
            max={maxDate}
            onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value) }}
            className="flex-1 bg-transparent text-xs font-mono text-cyan-300 focus:outline-none cursor-pointer min-w-0"
            style={{ colorScheme: 'dark' }}
          />
          <div className="flex gap-0.5">
            <button
              onClick={() => {
                const d = new Date(selectedDate)
                d.setDate(d.getDate() - 1)
                const s = d.toISOString().split('T')[0]
                if (s >= minDate) setSelectedDate(s)
              }}
              className="p-1 rounded hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors"
              title="Previous day"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => {
                const d = new Date(selectedDate)
                d.setDate(d.getDate() + 1)
                const s = d.toISOString().split('T')[0]
                if (s <= maxDate) setSelectedDate(s)
              }}
              className="p-1 rounded hover:bg-ocean-700 text-slate-500 hover:text-slate-300 transition-colors"
              title="Next day"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-ocean-700 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-all border-b-2',
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-ocean-800/50',
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Spots tab is always accessible (free) */}
          {activeTab === 'spots' && <SpotsList />}

          {/* Layers and My Spots are premium-gated */}
          {activeTab !== 'spots' && (
            <>
              <div className={cn(!isPremium && 'opacity-50 pointer-events-none select-none')}>
                {activeTab === 'layers' && <LayerPanel />}
                {activeTab === 'my-spots' && <MySpotsPanel onImportClick={onImportClick} />}
              </div>
              {!isPremium && (
                <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
                  <div className="pointer-events-auto relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-ocean-900/95 to-cyan-500/10 p-4 mx-4 backdrop-blur-sm shadow-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-400 mb-0.5">Upgrade to Premium</p>
                        <p className="text-[10px] text-slate-500">Unlock satellite layers, AI hotspots, spot imports, and more.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
