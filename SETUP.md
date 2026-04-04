# ReelMaps — Setup Guide

## Prerequisites

Install **Node.js** (LTS version) from https://nodejs.org/en/download

After installing, restart your terminal/VS Code.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Then open http://localhost:5173 in your browser.

## Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
reelmaps/
├── src/
│   ├── components/
│   │   ├── Map/
│   │   │   ├── FishingMap.tsx      ← Main MapLibre GL map
│   │   │   └── SpotPopup.tsx       ← Fishing spot popup card
│   │   ├── Header/
│   │   │   └── Header.tsx          ← Top bar: logo, date picker, coords
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx         ← Collapsible layer/spots panel
│   │   │   ├── LayerPanel.tsx      ← Layer toggles + opacity sliders
│   │   │   └── SpotsList.tsx       ← Searchable fishing spots list
│   │   └── ui/
│   │       ├── Switch.tsx
│   │       ├── Slider.tsx
│   │       ├── Badge.tsx
│   │       ├── Tooltip.tsx
│   │       └── ColorLegend.tsx     ← SST/Chlorophyll color scale
│   ├── lib/
│   │   ├── layerUrls.ts            ← NOAA/NASA WMS URL builders
│   │   ├── fishingSpots.ts         ← 20+ curated offshore spots
│   │   └── utils.ts
│   ├── store/
│   │   └── mapStore.ts             ← Zustand global state
│   └── types/
│       └── index.ts
```

## Data Sources (All Free, No API Key Required)

| Layer | Source | URL |
|-------|--------|-----|
| Sea Surface Temp (SST) | NASA GIBS WMS | gibs.earthdata.nasa.gov |
| SST Anomaly | NASA GIBS WMS | gibs.earthdata.nasa.gov |
| True Color (VIIRS) | NASA GIBS WMS | gibs.earthdata.nasa.gov |
| True Color (MODIS) | NASA GIBS WMS | gibs.earthdata.nasa.gov |
| Chlorophyll-a | NASA GIBS WMS | gibs.earthdata.nasa.gov |
| Salinity (SMAP) | NASA GIBS WMS | gibs.earthdata.nasa.gov |
| Ocean Currents (OSCAR) | NASA GIBS WMS | gibs.earthdata.nasa.gov |
| Sea Height / Eddies | NASA GIBS WMS | gibs.earthdata.nasa.gov |
| GOES SST (Near Real-Time) | NOAA ERDDAP WMS | cwcgom.aoml.noaa.gov |
| Bathymetry | GEBCO WMS | gebco.net |
| Nautical Charts | NOAA Chart Display | gis.charttools.noaa.gov |
| Nautical Symbols | OpenSeaMap XYZ | tiles.openseamap.org |
| Satellite Imagery | Esri World Imagery XYZ | server.arcgisonline.com |
| Base Map | CARTO Dark Matter | basemaps.cartocdn.com |

## Tech Stack

- **MapLibre GL JS v5** — WebGL map renderer, no API key
- **React 19 + Vite** — UI framework + build tool
- **Tailwind CSS v4** — Styling (via @tailwindcss/vite)
- **Zustand v5** — State management (layer toggles, opacity, date)
- **date-fns** — Date formatting for satellite queries
- **lucide-react** — Icons

## Features

- 14 data layers with toggles and opacity sliders
- Date picker for historical satellite data (back to 2012)
- 20+ curated offshore fishing spots with popups
- Spot clustering at low zoom levels
- Species, depth, and best-month info per spot
- Cursor coordinate display
- Color scale legends for SST, chlorophyll, etc.
- Quick layer shortcut bar on the map
- Collapsible sidebar with Layers + Fishing Spots tabs
- Searchable/filterable spots list
- In-season indicator based on current month
- Keyboard-friendly, accessible UI
- Dark ocean-themed design

## Deployment

Deploy the `dist/` folder to any static host:

```bash
npm run build
# Upload dist/ to Netlify, Vercel, Cloudflare Pages, GitHub Pages, etc.
```

No server required — fully client-side SPA.
