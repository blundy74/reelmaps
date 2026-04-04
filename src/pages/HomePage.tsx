/**
 * ReelMaps Landing Page
 * Premium offshore fishing intelligence platform homepage.
 * Inspired by warwickacoustics.com — full-bleed hero imagery, elegant typography,
 * feature showcases, and strong CTAs.
 */

import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import AuthModal from '../components/Auth/AuthModal'

// ── Hero background videos (looping MP4s from Pexels) ───────────────────────
const HERO_VIDEOS = [
  {
    src: 'https://videos.pexels.com/video-files/6348235/6348235-hd_1920_1080_30fps.mp4',
    label: 'Speed boat cutting through blue ocean',
  },
  {
    src: 'https://videos.pexels.com/video-files/2099332/2099332-hd_1920_1080_30fps.mp4',
    label: 'Aerial view of boat on turquoise sea',
  },
  {
    src: 'https://videos.pexels.com/video-files/8822474/8822474-hd_1920_1080_30fps.mp4',
    label: 'Fishing boat on the ocean',
  },
  {
    src: 'https://videos.pexels.com/video-files/8723147/8723147-hd_1920_1080_30fps.mp4',
    label: 'Boat in the middle of deep blue ocean',
  },
  {
    src: 'https://videos.pexels.com/video-files/1416529/1416529-hd_1920_1080_30fps.mp4',
    label: 'Deep blue open ocean drone footage',
  },
]

// ── Feature definitions ─────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
    ),
    title: 'AI Fishing Hotspots',
    description: 'Our proprietary algorithm analyzes SST temperature breaks, chlorophyll color breaks, bathymetric features, and ocean current edges to score every square mile of ocean. The heat map updates every 6 hours and shows you exactly where the fish are most likely to be — backed by the same satellite science that commercial fleets use.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M12 9V2M12 9a3 3 0 106 0M12 9a3 3 0 10-6 0" />
        <path d="M12 22a5 5 0 005-5V9h-10v8a5 5 0 005 5z" />
      </svg>
    ),
    title: 'Sea Surface Temperature',
    description: 'NASA MUR SST at 1km resolution — the gold standard. See temperature breaks in real-time, identify the warm side of the Gulf Stream edge, track Loop Current eddies, and find the exact water temp ranges your target species prefer. Updated daily from multiple satellite sensors for cloud-free coverage.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M12 22V8" />
        <path d="M5 12c0-5 7-10 7-10s7 5 7 10-3.13 7-7 7-7-2-7-7z" />
      </svg>
    ),
    title: 'Chlorophyll & Ocean Color',
    description: 'VIIRS satellite chlorophyll-a shows where the food chain starts. Find color breaks — the transition from clean blue to productive green water — where predators patrol. Includes single-day and 7-day composite views that fill in cloud gaps for a complete picture of ocean productivity.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
        <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
        <path d="M2 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0" strokeLinecap="round" />
      </svg>
    ),
    title: 'Ocean Currents & Altimetry',
    description: 'NOAA RTOFS surface currents overlaid with sea surface height anomaly contours. Identify warm-core and cold-core eddies, current convergence zones where bait concentrates, and the exact edges where predators hunt. Contour-banded altimetry makes eddy boundaries instantly visible.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
    title: 'HRRR Weather Radar',
    description: 'High-Resolution Rapid Refresh model at 3km resolution — the most detailed weather forecast available. See precipitation, wind speed, gusts, visibility/fog, cloud cover, and lightning threat overlaid on the map. 8 hours of past radar blended seamlessly into 18 hours of forecast, animated on a timeline.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
    title: 'Live Lightning Detection',
    description: 'Real-time GOES-East GLM satellite lightning flashes updated every 20 seconds, plus HRRR lightning threat forecasts. See active thunderstorms approaching your fishing grounds before they arrive. Animated flash markers and density tiles show exactly where electrical activity is occurring.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M2 20l4-4 4 2 4-6 4 4 4-8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 20h20" />
      </svg>
    ),
    title: 'Bathymetry & Depth Contours',
    description: 'Esri World Ocean Base bathymetry with GEBCO contour lines reveal the underwater landscape. See the continental shelf break, submarine canyons, seamounts, ledges, and drop-offs — the structure that concentrates bait and holds fish. Layer depth data with SST and currents to find the "triple threat" zones.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M9 3l6 3v15l-6-3V3z" />
        <path d="M3 6l6-3v15l-6 3V6z" />
        <path d="M15 6l6-3v15l-6 3V6z" />
      </svg>
    ),
    title: 'NOAA Nautical Charts',
    description: 'Official NOAA raster nautical charts with depth soundings, aids to navigation, hazards, and restricted areas. Plus OpenSeaMap community overlay with buoys, lights, wrecks, and marine facilities. Everything you need for safe navigation to your offshore spots.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Fishing Spot Management',
    description: 'Import your waypoints from CSV, GPX, or Garmin FIT files. All your secret spots displayed on the map with custom icons. Edit names, change icons, fly to any spot instantly. Plus a curated database of offshore hotspots — reefs, wrecks, canyons, ledges, oil rigs — with species info and seasonal ratings.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M9.59 4.59A2 2 0 1111 8H2" strokeLinecap="round" />
        <path d="M12.59 19.41A2 2 0 1014 16H2" strokeLinecap="round" />
        <path d="M17.73 7.73A2.5 2.5 0 1119.5 12H2" strokeLinecap="round" />
      </svg>
    ),
    title: 'Wind & Wave Forecasts',
    description: 'HRRR wind speed and gust forecasts at 3km resolution, plus animated wind particle visualization showing real-time flow patterns. Wave height and period data helps you plan for comfortable sea conditions. Barometric pressure trends overlay tells you when fish are about to feed.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
    title: 'True Color Satellite Imagery',
    description: 'VIIRS and MODIS true-color satellite passes at 250m resolution show cloud cover, water color changes, sediment plumes, and river outflows as they appear from space. See the actual color of the water to confirm what the chlorophyll data is telling you.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Forecast Timeline',
    description: 'Scrub through 26 hours of weather data — 8 hours of past conditions into 18 hours of forecast. Watch storms develop, fronts pass, and wind patterns shift. All weather overlays animate together on one synchronized timeline with adjustable playback speed.',
  },
]

// ── Components ──────────────────────────────────────────────────────────────

function Navbar({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled ? 'bg-ocean-950/95 backdrop-blur-xl border-b border-ocean-800/50 shadow-2xl' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-3 no-underline">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <ellipse cx="10" cy="12" rx="5" ry="3" />
              <path d="M15 12 l4-3 l0 6 z" />
              <circle cx="8" cy="11.5" r="0.8" fill="#040c18"/>
            </svg>
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">ReelMaps</span>
            <span className="text-xs text-cyan-400/70 ml-1.5 hidden sm:inline">AI-Powered Fishing Intelligence</span>
          </div>
        </a>

        <div className="flex items-center gap-3">
          <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors hidden md:block">Features</a>
          <a href="#preview" className="text-sm text-slate-400 hover:text-white transition-colors hidden md:block">Preview</a>
          <a href="#faq" className="text-sm text-slate-400 hover:text-white transition-colors hidden md:block">FAQ</a>
          <button
            onClick={onLogin}
            className="text-sm text-slate-300 hover:text-white transition-colors px-3 sm:px-4 py-2 whitespace-nowrap"
          >
            Sign In
          </button>
          <button
            onClick={onRegister}
            className="text-sm font-semibold bg-cyan-500 hover:bg-cyan-400 text-white px-4 sm:px-5 py-2 rounded-lg transition-all shadow-lg shadow-cyan-500/25 whitespace-nowrap"
          >
            Get Started
          </button>
        </div>
      </div>
    </nav>
  )
}

function HeroSection({ onRegister }: { onRegister: () => void }) {
  const [currentVid, setCurrentVid] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentVid((i) => (i + 1) % HERO_VIDEOS.length)
    }, 10000) // 10s per clip for video (longer than images)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background videos with crossfade */}
      {HERO_VIDEOS.map((vid, i) => (
        <video
          key={vid.src}
          src={vid.src}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[2000ms]"
          style={{ opacity: i === currentVid ? 1 : 0 }}
        />
      ))}
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-ocean-950/70 via-ocean-950/50 to-ocean-950" />

      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6 sm:mb-8 mt-8 sm:mt-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className="text-xs text-cyan-400 font-medium tracking-wide">Live satellite data updating now</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-white leading-[1.1] tracking-tight mb-6">
          Find Fish with
          <br />
          <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
            Satellite Intelligence
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Real-time SST, chlorophyll, ocean currents, HRRR weather radar, and AI-powered fishing hotspots — all on one map. The offshore advantage the pros use.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onRegister}
            className="group px-8 py-4 rounded-xl text-base font-bold bg-cyan-500 hover:bg-cyan-400 text-white transition-all shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-400/40 hover:scale-[1.02]"
          >
            Start Free Account
            <svg className="w-4 h-4 inline-block ml-2 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
          <a
            href="#features"
            className="px-8 py-4 rounded-xl text-base font-semibold text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 transition-all"
          >
            Explore Features
          </a>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-center gap-8 sm:gap-16 mt-16 pt-8 border-t border-white/10">
          {[
            ['20+', 'Data Layers'],
            ['1 km', 'SST Resolution'],
            ['6 hr', 'Hotspot Updates'],
            ['3 km', 'Weather Resolution'],
          ].map(([value, label]) => (
            <div key={label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  )
}

function VideoBanner({ src, quote, author }: { src: string; quote: string; author: string }) {
  return (
    <section className="relative h-[50vh] sm:h-[60vh] overflow-hidden flex items-center justify-center">
      <video
        src={src}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-ocean-950/60" />
      <div className="relative z-10 text-center px-6 max-w-3xl">
        <blockquote className="text-xl sm:text-2xl md:text-3xl font-light text-white italic leading-relaxed">
          &ldquo;{quote}&rdquo;
        </blockquote>
        <p className="text-sm text-cyan-400/80 mt-4 font-medium">&mdash; {author}</p>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section id="features" className="py-16 sm:py-24 md:py-32 bg-ocean-950">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Everything You Need Offshore
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Professional-grade satellite data, weather intelligence, and AI analysis — designed for serious offshore anglers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative bg-ocean-900/50 border border-ocean-700/50 rounded-2xl p-6 hover:border-cyan-500/30 hover:bg-ocean-900/80 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:bg-cyan-500/15 group-hover:border-cyan-500/30 transition-all">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PreviewSection() {
  return (
    <section id="preview" className="py-24 sm:py-32 bg-gradient-to-b from-ocean-950 via-ocean-900 to-ocean-950">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            See It in Action
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Layer satellite data, weather forecasts, and AI hotspots on a single interactive map.
          </p>
        </div>

        {/* App preview mockup — faithful recreation of the real UI */}
        <div className="relative mx-auto max-w-6xl">
          <div className="rounded-2xl overflow-hidden border border-ocean-600/50 shadow-2xl shadow-black/50">
            {/* Browser chrome */}
            <div className="bg-ocean-900 px-4 py-2.5 flex items-center gap-3 border-b border-ocean-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
              </div>
              <div className="flex-1 bg-ocean-800 rounded-lg px-4 py-1.5 flex items-center gap-2">
                <svg className="w-3 h-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                <span className="text-xs text-slate-500 font-mono">reelmaps.ai/app</span>
              </div>
            </div>

            {/* App UI mockup */}
            <div className="relative aspect-[16/9] overflow-hidden flex" style={{ background: '#040c18' }}>
              {/* Left sidebar */}
              <div className="w-56 lg:w-64 bg-[#0a1628] border-r border-[#1a2d4a] flex-shrink-0 hidden sm:flex flex-col overflow-hidden">
                {/* Header bar */}
                <div className="px-3 py-2 border-b border-[#1a2d4a] flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor"><ellipse cx="10" cy="12" rx="5" ry="3"/><path d="M15 12l4-3v6z"/></svg>
                  </div>
                  <span className="text-xs font-bold text-slate-200">ReelMaps</span>
                </div>
                {/* Tabs */}
                <div className="flex border-b border-[#1a2d4a]">
                  {['Layers', 'Spots', 'My Spots'].map((t, i) => (
                    <div key={t} className={`flex-1 py-2 text-center text-[9px] font-medium border-b-2 ${i === 0 ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-600'}`}>{t}</div>
                  ))}
                </div>
                {/* Basemap */}
                <div className="px-3 pt-3">
                  <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1.5">Basemap</div>
                  <div className="grid grid-cols-2 gap-1">
                    {[['Dark Ocean', '#0a1628'], ['Satellite', '#2d6a2d'], ['Nautical', '#0a3060'], ['Light', '#d0e8f8']].map(([label, color], i) => (
                      <div key={label} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[8px] border ${i === 1 ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' : 'border-[#1a2d4a] text-slate-500'}`}>
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color as string }} />{label}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Data layers */}
                <div className="px-3 pt-3 flex-1">
                  <div className="text-[8px] text-slate-600 uppercase tracking-wider mb-1.5">Data Layers</div>
                  <div className="text-[9px] text-cyan-400 font-bold mb-1">FISHING</div>
                  {['Fishing Hotspots (AI)', 'Inshore Hotspots', 'Offshore Hotspots', 'Sargassum / Weedlines'].map((l) => (
                    <div key={l} className="flex items-center gap-1.5 py-1">
                      <div className="w-6 h-3 rounded-full bg-[#1a2d4a]"><div className="w-2 h-2 rounded-full bg-slate-600 mt-0.5 ml-0.5" /></div>
                      <span className="text-[9px] text-slate-500">{l}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 py-1">
                    <div className="w-6 h-3 rounded-full bg-cyan-500"><div className="w-2 h-2 rounded-full bg-white mt-0.5 ml-3" /></div>
                    <span className="text-[9px] text-slate-200 font-medium">Fishing Spots</span>
                  </div>
                  <div className="text-[9px] text-cyan-400 font-bold mt-2 mb-1">SATELLITE &amp; OCEAN COLOR</div>
                  <div className="flex items-center gap-1.5 py-1">
                    <div className="w-6 h-3 rounded-full bg-cyan-500"><div className="w-2 h-2 rounded-full bg-white mt-0.5 ml-3" /></div>
                    <span className="text-[9px] text-slate-200 font-medium">Sea Surface Temp (SST)</span>
                  </div>
                  {['SST Anomaly', 'True Color (VIIRS)', 'Chlorophyll-a', 'Chlorophyll 7-Day Avg'].map((l) => (
                    <div key={l} className="flex items-center gap-1.5 py-1">
                      <div className="w-6 h-3 rounded-full bg-[#1a2d4a]"><div className="w-2 h-2 rounded-full bg-slate-600 mt-0.5 ml-0.5" /></div>
                      <span className="text-[9px] text-slate-500">{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Map area — colorful SST-like gradient with satellite texture */}
              <div className="flex-1 relative overflow-hidden">
                {/* Multi-layer SST color gradient mimicking real thermal data */}
                <div className="absolute inset-0">
                  {/* Ocean SST gradient — warm (orange/yellow) in Gulf, cool (purple/blue) in north */}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #6b21a8 0%, #1d4ed8 15%, #0891b2 30%, #059669 42%, #84cc16 50%, #eab308 58%, #f97316 65%, #ef4444 75%, #a855f7 90%)' , opacity: 0.7 }} />
                  {/* Gulf warm pocket */}
                  <div className="absolute bottom-[10%] right-[20%] w-[35%] h-[30%] rounded-full bg-[#f59e0b] opacity-25 blur-xl" />
                  {/* Gulf Stream warm ribbon */}
                  <div className="absolute top-[25%] right-[5%] w-[15%] h-[60%] bg-[#ef4444] opacity-20 blur-lg" style={{ transform: 'rotate(-20deg)' }} />
                  {/* Cool NE water */}
                  <div className="absolute top-[5%] right-[10%] w-[30%] h-[25%] rounded-full bg-[#7c3aed] opacity-30 blur-xl" />
                </div>

                {/* Fishing spot dots */}
                {[
                  { top: '42%', left: '72%', color: '#f97316', size: 'w-2 h-2' },
                  { top: '45%', left: '75%', color: '#3b82f6', size: 'w-1.5 h-1.5' },
                  { top: '48%', left: '71%', color: '#06b6d4', size: 'w-1.5 h-1.5' },
                  { top: '55%', left: '68%', color: '#f97316', size: 'w-2 h-2' },
                  { top: '58%', left: '65%', color: '#eab308', size: 'w-1.5 h-1.5' },
                  { top: '60%', left: '63%', color: '#06b6d4', size: 'w-2 h-2' },
                  { top: '62%', left: '60%', color: '#ef4444', size: 'w-1.5 h-1.5' },
                  { top: '65%', left: '62%', color: '#f97316', size: 'w-1.5 h-1.5' },
                  { top: '70%', left: '58%', color: '#3b82f6', size: 'w-2 h-2' },
                  { top: '72%', left: '55%', color: '#eab308', size: 'w-1.5 h-1.5' },
                  { top: '75%', left: '70%', color: '#06b6d4', size: 'w-2 h-2' },
                  { top: '68%', left: '75%', color: '#ef4444', size: 'w-1.5 h-1.5' },
                  { top: '50%', left: '78%', color: '#8b5cf6', size: 'w-1.5 h-1.5' },
                  { top: '35%', left: '80%', color: '#f97316', size: 'w-2 h-2' },
                  { top: '32%', left: '82%', color: '#3b82f6', size: 'w-1.5 h-1.5' },
                  { top: '85%', left: '80%', color: '#eab308', size: 'w-2 h-2' },
                  { top: '88%', left: '78%', color: '#eab308', size: 'w-1.5 h-1.5' },
                ].map((dot, i) => (
                  <div key={i} className={`absolute ${dot.size} rounded-full shadow-lg`} style={{ top: dot.top, left: dot.left, backgroundColor: dot.color, boxShadow: `0 0 6px ${dot.color}60` }} />
                ))}

                {/* Toolbar buttons */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                  {['Share', 'Measure', 'Drop Flag'].map((label) => (
                    <div key={label} className="bg-[#0a1628]/80 border border-[#1a2d4a] rounded-lg px-2.5 py-1 text-[8px] text-slate-400 backdrop-blur-sm">{label}</div>
                  ))}
                </div>
              </div>

              {/* Right weather sidebar */}
              <div className="w-40 lg:w-48 bg-[#0a1628] border-l border-[#1a2d4a] flex-shrink-0 hidden md:flex flex-col p-2.5">
                <div className="text-[9px] font-bold text-slate-300 mb-2">Weather</div>
                <div className="bg-[#0f1d30] border border-[#1a2d4a] rounded-lg px-2 py-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" strokeLinecap="round"/></svg>
                    <span className="text-[8px] text-slate-400">Forecast Timeline</span>
                  </div>
                </div>
                <div className="text-[7px] text-slate-600 uppercase tracking-wider mb-1.5">Weather Overlays</div>
                {['Wind', 'Waves', 'Pressure', 'Rain Radar', 'Clouds'].map((w) => (
                  <div key={w} className="flex items-center gap-1.5 py-0.5">
                    <div className="w-5 h-2.5 rounded-full bg-[#1a2d4a]"><div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-[1px] ml-[2px]" /></div>
                    <span className="text-[8px] text-slate-500">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Glow effects */}
          <div className="absolute -inset-6 bg-cyan-500/8 rounded-3xl blur-3xl -z-10" />
          <div className="absolute -inset-12 bg-blue-500/5 rounded-3xl blur-[60px] -z-20" />
        </div>
      </div>
    </section>
  )
}

function CTASection({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="py-24 sm:py-32 bg-ocean-950 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#06b6d4_0%,_transparent_50%)] opacity-5" />

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-6">
          Ready to Find More Fish?
        </h2>
        <p className="text-lg text-slate-400 mb-10 leading-relaxed">
          Join thousands of offshore anglers using satellite intelligence to find the bite.
          Free to start. No credit card required.
        </p>
        <button
          onClick={onRegister}
          className="group px-10 py-5 rounded-xl text-lg font-bold bg-cyan-500 hover:bg-cyan-400 text-white transition-all shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-400/40 hover:scale-[1.02]"
        >
          Create Free Account
          <svg className="w-5 h-5 inline-block ml-2 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </section>
  )
}

// ── FAQ Data ────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    category: 'Getting Started',
    questions: [
      {
        q: 'What is ReelMaps?',
        a: 'ReelMaps is a professional offshore fishing intelligence platform that combines real-time satellite data, NOAA weather forecasts, AI-powered hotspot analysis, and fishing spot management into a single interactive map. It gives you the same satellite tools that commercial fishing fleets and marine biologists use — SST, chlorophyll, ocean currents, altimetry — plus a proprietary AI algorithm that scores every square mile of ocean for fishing probability.',
      },
      {
        q: 'Is ReelMaps free?',
        a: 'Yes, you can create a free account and access the full map with all satellite data layers, weather overlays, fishing spots, and AI hotspots. Premium features like unlimited spot imports, trip logging, and priority data are available with a ReelMaps Premium subscription.',
      },
      {
        q: 'What areas does ReelMaps cover?',
        a: 'ReelMaps covers the entire US coastline — Atlantic, Gulf of Mexico, and Pacific — from 20°N to 55°N latitude and 130°W to 60°W longitude. This includes all major offshore fishing grounds: the Gulf Stream, Loop Current, California Current, Mid-Atlantic canyons, Florida Keys, and the entire Gulf shelf.',
      },
      {
        q: 'Do I need to install anything?',
        a: 'No. ReelMaps runs entirely in your web browser — desktop, tablet, or phone. No app download, no plugins. Just sign in at reelmaps.ai and you\'re on the water.',
      },
    ],
  },
  {
    category: 'AI Fishing Hotspots',
    questions: [
      {
        q: 'How does the AI hotspot algorithm work?',
        a: 'The hotspot algorithm composites multiple satellite data sources using edge detection (Sobel operator) to find temperature breaks in SST, color breaks in chlorophyll, steep gradients in bathymetry, and eddy edges in sea surface height. Each pixel is scored: SST edges (35% weight), chlorophyll edges (25%), bathymetric features (18%), current/eddy edges (12%), and species temperature match (10%). Co-located features get non-linear bonuses — an SST break on the shelf edge with a color change is scored much higher than any single factor alone.',
      },
      {
        q: 'How often are hotspots updated?',
        a: 'The hotspot grid is recomputed every 6 hours (00:15, 06:15, 12:15, 18:15 UTC). Each run pulls the latest SST, chlorophyll, and SSH data from NOAA satellites. You can also browse historical hotspots — use the date picker to see how conditions changed day by day.',
      },
      {
        q: 'What is the "Triple Threat"?',
        a: 'When an SST temperature break, a chlorophyll color break, and a bathymetric feature (like the shelf edge or a canyon) all align in the same location, we call it a "Triple Threat." These are the highest-probability fishing zones on the map. The algorithm gives these areas a significant non-linear bonus because historically, multiple converging features produce the best fishing.',
      },
      {
        q: 'Can I browse past hotspot data?',
        a: 'Yes. Use the satellite date picker in the header to select any past date. For historical days, the hotspot overlay shows a daily average computed from all 6-hour runs that day. For today, it shows the most recent run. Data is currently available from March 1, 2026 onward.',
      },
    ],
  },
  {
    category: 'Satellite Data',
    questions: [
      {
        q: 'What SST data do you use?',
        a: 'We use NASA\'s GHRSST MUR (Multi-scale Ultra-high Resolution) SST product at 1km resolution — the gold standard for fishing. It\'s a foundation SST dataset that merges data from multiple satellite sensors (MODIS, VIIRS, AMSR2, and others) to produce a cloud-free daily global map. The VIIRS SNPP daily SST layer is also available for a single-pass view.',
      },
      {
        q: 'What does the chlorophyll layer show?',
        a: 'Chlorophyll-a concentration in mg/m³, measured by the VIIRS satellite sensor. Chlorophyll is a proxy for phytoplankton — the base of the marine food chain. High chlorophyll (green water) means productive water with baitfish. The key for fishing is finding the EDGE between clean blue water and green productive water — that\'s where predators hunt. We offer both daily and 7-day composite views.',
      },
      {
        q: 'How do ocean currents and altimetry help fishing?',
        a: 'Ocean currents physically concentrate bait at convergence zones. Our current overlay shows NOAA RTOFS surface current speed and direction. The altimetry (sea surface height) layer reveals eddies — raised water = warm-core eddy (clockwise, traps warm-water pelagics), depressed water = cold-core eddy (counter-clockwise, upwells nutrients). Fish concentrate at eddy EDGES, not centers. The contour-banded altimetry view makes these boundaries instantly visible.',
      },
      {
        q: 'What is sea surface height (SSH) anomaly?',
        a: 'SSH anomaly measures tiny height differences in the ocean surface (centimeters) detected by satellite altimeters. Warm water expands and stands higher; cold water contracts and sits lower. Positive anomalies (+10 to +50 cm) indicate warm-core eddies. Negative anomalies indicate cold-core eddies. Tight SSH gradients (closely spaced contour lines) mark strong current edges — prime fishing territory.',
      },
    ],
  },
  {
    category: 'Weather & Forecasts',
    questions: [
      {
        q: 'What weather model powers the forecasts?',
        a: 'NOAA\'s HRRR (High-Resolution Rapid Refresh) model at 3km resolution — the most detailed operational weather model available. It updates hourly and provides precipitation, wind speed, gusts, visibility/fog, cloud cover, and lightning threat. Our pipeline decodes the raw GRIB2 data and renders it as colored tile overlays on the map.',
      },
      {
        q: 'How does the forecast timeline work?',
        a: 'The bottom forecast bar shows 26 hours of data: 8 hours of past conditions (using actual radar/model analysis) blending into 18 hours of forecast. Drag the slider or hit play to animate. All weather overlays — radar, wind, gusts, visibility, lightning, clouds — animate together on the same timeline.',
      },
      {
        q: 'How does lightning detection work?',
        a: 'We use two sources: (1) GOES-East GLM (Geostationary Lightning Mapper) satellite data providing real-time flash detection updated every 20 seconds, displayed as animated flash markers and density tiles. (2) HRRR lightning threat forecast showing predicted electrical activity for the next 18 hours. Together, they show where storms are now and where they\'re headed.',
      },
      {
        q: 'What about wave and wind data?',
        a: 'HRRR provides wind speed and gust forecasts at 3km resolution. We also render animated wind particles showing real-time flow patterns. Wave data comes from the GFS-Wave model (3-hourly, global). The wave overlay shows significant wave height with an aggressive blue color ramp — light blue at 1ft, dark navy at 5ft.',
      },
    ],
  },
  {
    category: 'Fishing Spots & Import',
    questions: [
      {
        q: 'Can I import my own fishing spots?',
        a: 'Yes. Go to the "My Spots" tab in the left sidebar and click "Import Spots." We support CSV, GPX (Garmin/GPS), and FIT (Garmin device) files. The parser auto-detects coordinate columns, names, and depth data. You pick an icon during import, and all spots appear on the map immediately.',
      },
      {
        q: 'Can I edit or delete imported spots?',
        a: 'Yes. Each spot in the "My Spots" panel has a three-dot menu with Edit and Delete options. Edit lets you rename the spot and change its icon. Changes update on the map instantly. You can also click any spot on the map to see all its imported attributes in a read-only popup.',
      },
      {
        q: 'What are the curated fishing spots?',
        a: 'The "Fishing Spots" tab contains a database of known offshore hotspots — reefs, wrecks, canyons, ledges, artificial reefs, and oil/gas platforms. Each spot includes type, depth, region, species list, star rating, and best months. Spots are filterable by type and sortable by distance, rating, or depth. They\'re shown on the map as colored circles with clustering at lower zoom levels.',
      },
    ],
  },
  {
    category: 'Map & Navigation',
    questions: [
      {
        q: 'What basemaps are available?',
        a: 'Four options: Dark Ocean (default, optimized for data overlays), Satellite (Esri World Imagery), Nautical (NOAA charts auto-enabled), and Light. Switch basemaps in the Layers panel under "Basemap."',
      },
      {
        q: 'Can I measure distances on the map?',
        a: 'Yes. Click the ruler/measure tool in the toolbar on the right side of the map. Click points to create a measurement line — distance is shown in nautical miles. Click the tool again to cancel.',
      },
      {
        q: 'What is the "Drop Flag" tool?',
        a: 'Drop Flag lets you place a marker anywhere on the map to see coordinates, depth, and nearby information. Click the flag icon in the toolbar, then click the map. A detailed panel shows the pin\'s coordinates which you can copy. Useful for marking prospective waypoints.',
      },
      {
        q: 'Can I share my map view?',
        a: 'Yes. Click the share button in the toolbar to copy a URL that captures your current map position, zoom level, and active layers. Send it to your fishing buddy and they\'ll see exactly what you see.',
      },
    ],
  },
  {
    category: 'Account & Data',
    questions: [
      {
        q: 'Is my data private?',
        a: 'Yes. Your imported fishing spots, settings, and account data are stored securely and never shared. Spots you import are visible only to you.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes. Click your name in the header to open your account panel, then select "Delete Account." Your account will be deactivated (not permanently deleted) and you\'ll receive a confirmation email. If you change your mind, simply sign up again with the same email — your data will be restored.',
      },
      {
        q: 'Where does the data come from?',
        a: 'All satellite data comes from NASA GIBS (Global Imagery Browse Services) and NOAA CoastWatch ERDDAP. Weather data comes from NOAA\'s HRRR model. Ocean currents from NOAA RTOFS/HYCOM. Bathymetry from GEBCO and Esri. Lightning from GOES-East GLM. Nautical charts from NOAA. All data is publicly available — we just make it beautiful, fast, and useful for fishing.',
      },
    ],
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-ocean-700/50 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left group"
      >
        <span className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">{q}</span>
        <svg
          className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-cyan-400' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[500px] pb-5' : 'max-h-0'}`}
      >
        <p className="text-sm text-slate-400 leading-relaxed pr-8">{a}</p>
      </div>
    </div>
  )
}

function FAQSection() {
  const [activeCategory, setActiveCategory] = useState(FAQ_ITEMS[0].category)

  return (
    <section id="faq" className="py-16 sm:py-24 md:py-32 bg-ocean-950">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Everything you need to know about ReelMaps&apos;s satellite data, AI hotspots, and offshore fishing tools.
          </p>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {FAQ_ITEMS.map((cat) => (
            <button
              key={cat.category}
              onClick={() => setActiveCategory(cat.category)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                activeCategory === cat.category
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                  : 'bg-ocean-900/50 border-ocean-700/50 text-slate-500 hover:text-slate-300 hover:border-ocean-600'
              }`}
            >
              {cat.category}
            </button>
          ))}
        </div>

        {/* Questions */}
        <div className="bg-ocean-900/30 border border-ocean-700/40 rounded-2xl px-6 sm:px-8">
          {FAQ_ITEMS.filter((c) => c.category === activeCategory).map((cat) =>
            cat.questions.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))
          )}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="bg-ocean-950 border-t border-ocean-800 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                <ellipse cx="10" cy="12" rx="5" ry="3" />
                <path d="M15 12 l4-3 l0 6 z" />
                <circle cx="8" cy="11.5" r="0.8" fill="#040c18"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-400">ReelMaps</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-600">
            <span>Satellite data: NASA GIBS, NOAA CoastWatch</span>
            <span className="hidden sm:inline">Weather: NOAA HRRR</span>
          </div>

          <div className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} ReelMaps. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const { setShowAuthModal, setAuthMode, user } = useAuthStore()
  const navigate = useNavigate()

  // If user becomes authenticated, redirect to app
  useEffect(() => {
    if (user) navigate('/app', { replace: true })
  }, [user, navigate])

  // Enable scrolling on homepage (global CSS sets overflow:hidden for map app)
  useEffect(() => {
    const root = document.getElementById('root')
    document.documentElement.style.overflow = 'auto'
    document.documentElement.style.height = 'auto'
    document.body.style.overflow = 'auto'
    document.body.style.height = 'auto'
    if (root) { root.style.overflow = 'auto'; root.style.height = 'auto' }
    return () => {
      document.documentElement.style.overflow = ''
      document.documentElement.style.height = ''
      document.body.style.overflow = ''
      document.body.style.height = ''
      if (root) { root.style.overflow = ''; root.style.height = '' }
    }
  }, [])

  const handleLogin = () => {
    setAuthMode('login')
    setShowAuthModal(true)
  }

  const handleRegister = () => {
    setAuthMode('register')
    setShowAuthModal(true)
  }

  return (
    <div className="min-h-screen bg-ocean-950 text-white">
      <Navbar onLogin={handleLogin} onRegister={handleRegister} />
      <HeroSection onRegister={handleRegister} />
      <VideoBanner
        src="https://videos.pexels.com/video-files/4129647/4129647-hd_1920_1080_25fps.mp4"
        quote="The sea, once it casts its spell, holds one in its net of wonder forever."
        author="Jacques Cousteau"
      />
      <FeaturesSection />
      <VideoBanner
        src="https://videos.pexels.com/video-files/2257010/2257010-hd_1920_1080_24fps.mp4"
        quote="Give a man a fish and he eats for a day. Give him satellite data and he eats for a lifetime."
        author="ReelMaps"
      />
      <PreviewSection />
      <FAQSection />
      <CTASection onRegister={handleRegister} />
      <Footer />
      <AuthModal />
    </div>
  )
}
