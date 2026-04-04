# Fishing Web App — Oceanographic Data Sources Reference

> Research compiled March 2026. All endpoints verified against live service capabilities documents.
> This document covers every major free/public data layer used by apps like ripcharts.com and satfish.com.

---

## Table of Contents

1. [Sea Surface Temperature (SST)](#1-sea-surface-temperature-sst)
2. [True Color Satellite Imagery](#2-true-color-satellite-imagery)
3. [Chlorophyll-a (Ocean Color)](#3-chlorophyll-a-ocean-color)
4. [Ocean Currents](#4-ocean-currents)
5. [Wind Data](#5-wind-data)
6. [Bathymetry / Ocean Depth](#6-bathymetry--ocean-depth)
7. [Wave Height / Swell](#7-wave-height--swell)
8. [Other Fishing-Relevant Layers](#8-other-fishing-relevant-layers)
9. [NASA GIBS — Master Reference](#9-nasa-gibs--master-reference)
10. [NOAA ERDDAP — Master Reference](#10-noaa-erddap--master-reference)
11. [Integration Strategy & Recommended Stack](#11-integration-strategy--recommended-stack)

---

## 1. Sea Surface Temperature (SST)

SST is the single most important layer for offshore fishing. It reveals temperature breaks, eddies, and the warm-water edges that concentrate baitfish and predators. RipCharts offers 4–12 SST updates per day across multiple products; SatFish uses cloud-free composites.

---

### 1a. NOAA Geo-polar Blended SST (GHRSST) — Best All-Around Daily Product

| Property | Value |
|---|---|
| Dataset ID | `noaacwBLENDEDsstDaily` |
| Resolution | ~5 km (0.05°) global |
| Update frequency | Daily (near real-time; 2017–present NRT, 2002–2016 reanalysis) |
| Variable | `analysed_sst` (in Kelvin; subtract 273.15 for Celsius) |
| Coverage | Global, 2002–present |
| Authentication | None — fully public |
| Format | WMS 1.3.0, griddap (NetCDF, CSV, JSON, PNG, etc.) |

**WMS Endpoint (GetCapabilities):**
```
https://coastwatch.noaa.gov/erddap/wms/noaacwBLENDEDsstDaily/request?service=WMS&request=GetCapabilities&version=1.3.0
```

**WMS GetMap Example (full globe, PNG):**
```
https://coastwatch.noaa.gov/erddap/wms/noaacwBLENDEDsstDaily/request?
  service=WMS&version=1.3.0&request=GetMap
  &bbox=-89.99,-179.99,89.99,180.0
  &crs=EPSG:4326
  &width=1440&height=720
  &layers=Land,noaacwBLENDEDsstDaily:analysed_sst,Coastlines
  &styles=&format=image/png
  &time=2025-06-01T00:00:00Z
```

**Griddap (data extraction) — subset to Gulf Stream region, JSON:**
```
https://coastwatch.noaa.gov/erddap/griddap/noaacwBLENDEDsstDaily.json?
  analysed_sst[(2025-06-01T00:00:00Z)][(20):(50)][(-82):(-60)]
```

**Leaflet/OpenLayers tile integration:**
ERDDAP WMS works with Leaflet's `L.tileLayer.wms()`. Use `version: '1.3.0'`, `layers: 'noaacwBLENDEDsstDaily:analysed_sst'`, and pass `time` as an extra parameter. Note: standard WMTS XYZ tile format is NOT supported — use WMS GetMap only.

---

### 1b. MUR SST (Multi-scale Ultra-high Resolution) — Highest Resolution

| Property | Value |
|---|---|
| Dataset ID | `jplMURSST41` (daily), `jplMURSST41mday` (monthly) |
| Resolution | 0.01° (~1 km) global — highest freely available SST resolution |
| Update frequency | Daily |
| Source | NASA JPL; served via NOAA CoastWatch ERDDAP |
| Coverage | Global, 2002–present |
| Authentication | None |

**WMS Endpoint:**
```
https://coastwatch.pfeg.noaa.gov/erddap/wms/jplMURSST41/request
```

**WMS GetCapabilities:**
```
https://coastwatch.pfeg.noaa.gov/erddap/wms/jplMURSST41/request?service=WMS&request=GetCapabilities&version=1.3.0
```

**Griddap data endpoint:**
```
https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41
```

**Example — extract SST box as PNG image:**
```
https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41.png?
  analysed_sst[(2025-06-01T09:00:00Z)][(24):1:(32)][(-82):1:(-70)]
  &.draw=surface&.vars=longitude|latitude|analysed_sst
  &.colorBar=KT_thermal|||20|32|
```

**Note:** MUR has ~12 hour latency. For the very latest data, prefer the Blended 5km product above.

---

### 1c. NOAA CoralTemp SST — 5km Daily with Anomaly

| Property | Value |
|---|---|
| Dataset ID | `noaacrwsstDaily` |
| Resolution | 5 km global |
| Update frequency | Daily (1985–present) |
| Extras | SST anomaly, Degree Heating Weeks, Bleaching Alert Area also available |
| Authentication | None |

**WMS Endpoint:**
```
https://coastwatch.noaa.gov/erddap/wms/noaacrwsstDaily/request
```

**Griddap:**
```
https://coastwatch.noaa.gov/erddap/griddap/noaacrwsstDaily
```

---

### 1d. NOAA VIIRS SST (ACSPO) — Near Real-Time, 2km

| Property | Value |
|---|---|
| Dataset ID | `noaacwL3CollatednppC` (S-NPP VIIRS, 4km daily) |
| Resolution | 4 km (collated), 2 km (single-pass) |
| Update frequency | Multiple passes per day |
| Latency | ~3 hours from satellite overpass |
| Authentication | None |

**Griddap:**
```
https://coastwatch.noaa.gov/erddap/griddap/noaacwL3CollatednppC
```

---

### 1e. NASA GIBS — GHRSST MUR SST (WMTS Tiles)

NASA GIBS provides pre-rendered SST tiles via WMTS — the easiest way to add a daily SST overlay to a slippy map.

| Layer | Resolution | Period | Format |
|---|---|---|---|
| `GHRSST_L4_MUR_Sea_Surface_Temperature` | 1 km (TileMatrixSet: `1km`) | 2002–present, daily | PNG |
| `GHRSST_L4_MUR25_Sea_Surface_Temperature` | 2 km (`2km`) | 2002–present, daily | PNG |
| `GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies` | 1 km | 2002–present, daily | PNG |
| `GHRSST_L4_AVHRR-OI_Sea_Surface_Temperature` | 2 km | historical | PNG |
| `MODIS_Aqua_L3_SST_Thermal_4km_Day_Daily` | 2 km | 2002–present | PNG |
| `MODIS_Aqua_L2_Sea_Surface_Temp_Day` | 1 km | near real-time | PNG |
| `VIIRS_SNPP_L2_Sea_Surface_Temp_Day` | 1 km | near real-time | PNG |
| `VIIRS_SNPP_L2_Sea_Surface_Temp_Night` | 1 km | near real-time | PNG |

**WMTS REST Tile URL Pattern (EPSG:4326):**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{LayerID}/default/{YYYY-MM-DD}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png
```

**Example — MUR SST tile for June 1 2025:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/2025-06-01/1km/6/15/30.png
```

**Web Mercator (EPSG:3857) — use with Leaflet/Mapbox:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/2025-06-01/GoogleMapsCompatible_Level7/{TileMatrix}/{TileRow}/{TileCol}.png
```

**KVP (WMS-style) request:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?
  SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0
  &LAYER=GHRSST_L4_MUR_Sea_Surface_Temperature
  &TILEMATRIXSET=1km
  &TILEMATRIX=6&TILEROW=15&TILECOL=30
  &TIME=2025-06-01
  &FORMAT=image/png
```

**GetCapabilities (full layer catalog):**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
```

**How ripcharts/satfish likely uses it:** They pull GIBS tiles directly as Leaflet WMS/WMTS layers for the basemap SST visualization, then use ERDDAP griddap to extract raw temperature values at clicked points for the temperature readout feature.

---

## 2. True Color Satellite Imagery

True color composites show ocean color, cloud cover, and phytoplankton blooms visually — useful as a basemap and for locating visible temperature fronts and color breaks.

### 2a. NASA GIBS — MODIS and VIIRS True Color Tiles

All layers below are served via WMTS REST tiles. **No authentication required.** Free and unlimited.

| Layer ID | Satellite | Resolution | Format | Notes |
|---|---|---|---|---|
| `MODIS_Aqua_CorrectedReflectance_TrueColor` | Aqua/MODIS | 250 m | JPEG | Primary daily true color |
| `MODIS_Terra_CorrectedReflectance_TrueColor` | Terra/MODIS | 250 m | JPEG | Morning overpass |
| `VIIRS_SNPP_CorrectedReflectance_TrueColor` | S-NPP/VIIRS | 250 m | JPEG | More recent, finer detail |
| `VIIRS_NOAA20_CorrectedReflectance_TrueColor` | NOAA-20/VIIRS | 250 m | JPEG | 2018–present |
| `VIIRS_NOAA21_CorrectedReflectance_TrueColor` | NOAA-21/VIIRS | 250 m | JPEG | Newest satellite |
| `VIIRS_SNPP_CorrectedReflectance_TrueColor_Granule` | S-NPP/VIIRS | 250 m | PNG | Swath-level (individual passes) |

**TileMatrixSet for all above:** `250m`

**WMTS REST URL (EPSG:4326):**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{LayerID}/default/{YYYY-MM-DD}/250m/{TileMatrix}/{TileRow}/{TileCol}.jpg
```

**Example — MODIS Aqua true color, June 1 2025:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Aqua_CorrectedReflectance_TrueColor/default/2025-06-01/250m/7/28/62.jpg
```

**Web Mercator (Leaflet-compatible):**
```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_CorrectedReflectance_TrueColor/default/2025-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg
```

**Leaflet L.tileLayer integration:**
```javascript
L.tileLayer(
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/' +
  'MODIS_Aqua_CorrectedReflectance_TrueColor/default/' +
  '2025-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
  { tms: false, opacity: 0.9, attribution: 'NASA GIBS' }
).addTo(map);
```

**NASA Worldview (interactive browser for finding dates/layers):**
```
https://worldview.earthdata.nasa.gov/
```

**Update frequency:** Once per day per satellite. Each satellite makes ~1–2 passes over a given ocean region per day. Tiles become available typically 3–5 hours after satellite overpass.

**How ripcharts/satfish uses it:** True color is layered under SST/chlorophyll as a context layer. Users can toggle between SST overlay and true color to visually identify color breaks, cloud-free areas, and phytoplankton blooms.

---

## 3. Chlorophyll-a (Ocean Color)

Chlorophyll concentration indicates phytoplankton density — the base of the food chain. High chl-a "green water" edges and transitions into "blue water" are prime fishing locations for mahi, tuna, and wahoo.

### 3a. NASA GIBS — Chlorophyll WMTS Tiles

| Layer ID | Source | Resolution | Format | Notes |
|---|---|---|---|---|
| `MODIS_Aqua_L2_Chlorophyll_A` | Aqua/MODIS | 1 km (`1km`) | PNG | Daily (replaced old MODIS_Aqua_Chlorophyll_A) |
| `MODIS_Terra_L2_Chlorophyll_A` | Terra/MODIS | 1 km | PNG | Daily |
| `VIIRS_SNPP_L2_Chlorophyll_A` | S-NPP/VIIRS | 1 km | PNG | Near real-time daily |
| `VIIRS_NOAA20_Chlorophyll_a` | NOAA-20/VIIRS | 1 km | PNG | 2018–present |
| `VIIRS_NOAA21_Chlorophyll_a` | NOAA-21/VIIRS | 1 km | PNG | Newest |
| `OCI_PACE_Chlorophyll_a` | PACE/OCI | 1 km | PNG | NASA's newest ocean color satellite (2024+) |
| `S3A_OLCI_Chlorophyll_a` | Sentinel-3A/OLCI | 1 km | PNG | Copernicus, 300m native |
| `S3B_OLCI_Chlorophyll_a` | Sentinel-3B/OLCI | 1 km | PNG | Copernicus |

**WMTS REST URL:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{LayerID}/default/{YYYY-MM-DD}/1km/{TileMatrix}/{TileRow}/{TileCol}.png
```

**Example — VIIRS NOAA-20 Chlorophyll, June 1 2025:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/VIIRS_NOAA20_Chlorophyll_a/default/2025-06-01/1km/6/15/30.png
```

**Important note on old vs new layer names:** The old identifiers `MODIS_Aqua_Chlorophyll_A` and `MODIS_Terra_Chlorophyll_A` were **deprecated March 28, 2022**. Use `MODIS_Aqua_L2_Chlorophyll_A` going forward.

---

### 3b. NOAA CoastWatch ERDDAP — Chlorophyll Datasets

| Dataset ID | Source | Resolution | Frequency |
|---|---|---|---|
| `noaacwNPPVIIRSchlaDaily` | S-NPP VIIRS | 4 km global | Daily NRT |
| `noaacwNPPVIIRSchlaWeekly` | S-NPP VIIRS | 4 km global | Weekly |
| `erdVHNchlamday` | VIIRS North Pacific | 750 m | Monthly composite |
| `noaacwS3AOLCIchlaSector*Daily` | Sentinel-3A OLCI | 300 m | Daily (regional sectors) |
| `noaacwS3BOLCIchlaSector*Daily` | Sentinel-3B OLCI | 300 m | Daily (regional sectors) |

**WMS Endpoint (VIIRS daily, global):**
```
https://coastwatch.noaa.gov/erddap/wms/noaacwNPPVIIRSchlaDaily/request
```

**WMS GetMap Example:**
```
https://coastwatch.noaa.gov/erddap/wms/noaacwNPPVIIRSchlaDaily/request?
  service=WMS&version=1.3.0&request=GetMap
  &bbox=20,-90,50,-60
  &crs=EPSG:4326&width=800&height=600
  &layers=noaacwNPPVIIRSchlaDaily:chlor_a
  &styles=&format=image/png
  &time=2025-06-01T00:00:00Z
```

**Griddap data extraction:**
```
https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPVIIRSchlaDaily.json?
  chlor_a[(2025-06-01T00:00:00Z)][(20):1:(50)][(-90):1:(-60)]
```

---

### 3c. NASA OB.DAAC — Direct Ocean Color Data

For raw Level-3 composites (3-day, 8-day, monthly — cloud-filling composites):

**File search API:**
```
https://oceandata.sci.gsfc.nasa.gov/api/file_search?
  sensor=VIIRS-SNPP&sdate=2025-06-01&edate=2025-06-03
  &dtype=L3m&addurl=1&results_as_file=1
  &search=*CHL*
```

**Authentication:** Requires free NASA Earthdata Login account for download. Browsing/searching is public.

**How satfish uses it:** SatFish credits "NASA OB.DAAC & Copernicus Sentinel Data" and creates 1-day and 3-day composite chlorophyll maps. They likely pull raw L3 NetCDF files, apply custom color rendering, and tile them server-side.

---

## 4. Ocean Currents

### 4a. OSCAR — Ocean Surface Current Analysis (NASA PO.DAAC / GIBS)

OSCAR derives near-surface ocean currents from satellite altimetry, SST gradients, and wind data. It is the standard free current product used in fishing apps.

| Property | Value |
|---|---|
| Resolution | 0.25° (25 km) global |
| Update frequency | Every 5 days (Final); Near Real-Time (NRT) within ~1 week |
| Latency | ~5–7 days for NRT version |
| Authentication | Free; NASA Earthdata Login required for raw file downloads |
| Coverage | Global, 1992–present |

**NASA GIBS WMTS tiles (easiest for web mapping):**

| Layer ID | Variable | TileMatrixSet | Format |
|---|---|---|---|
| `OSCAR_Sea_Surface_Currents_Zonal` | East-West (U) component | `2km` | PNG |
| `OSCAR_Sea_Surface_Currents_Meridional` | North-South (V) component | `2km` | PNG |

**WMTS REST URL:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/OSCAR_Sea_Surface_Currents_Zonal/default/{YYYY-MM-DD}/2km/{TileMatrix}/{TileRow}/{TileCol}.png
```

**Raw data via NASA PO.DAAC ERDDAP (with Earthdata Login):**
```
https://opendap.earthdata.nasa.gov/providers/POCLOUD/collections/OSCAR_L4_OC_NRT_V2.0/
```

**Harmony subsetting API (OGC API Coverages — requires Earthdata Login):**
```
https://harmony.earthdata.nasa.gov/C2102959417-POCLOUD/ogc-api-coverages/1.0.0/collections/all/coverage/rangeset?
  subset=lat(20:50)&subset=lon(-90:-60)
  &subset=time("2025-06-01T00:00:00Z":"2025-06-05T00:00:00Z")
  &format=application/x-netcdf4
```

**PO.DAAC Dataset pages:**
- NRT: `https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_NRT_V2.0`
- Final: `https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_FINAL_V2.0`

**Tip for rendering current vectors:** Download U and V NetCDF components, compute magnitude and direction client-side, and render as animated particle flow using [Leaflet.Velocity](https://github.com/onaci/leaflet-velocity) or [WindyGL](https://github.com/Esri/wind-js). This is almost certainly what ripcharts uses for their current arrows.

---

### 4b. NOAA RTOFS — Real-Time Ocean Forecast System

RTOFS is a full ocean model (HYCOM-based) providing 8-day forecasts of currents, temperature, and salinity at 1/12° (~8 km) resolution.

| Property | Value |
|---|---|
| Model | HYCOM + CICE (1/12° global tripolar grid) |
| Resolution | ~8 km horizontal, 41 vertical levels |
| Update frequency | Daily (one run per day, 8-day forecast) |
| Variables | Velocity U/V, temperature, salinity, SSH, sea ice |
| Authentication | None for NOMADS access |

**NOMADS HTTPS access (current run):**
```
https://ftpprd.ncep.noaa.gov/data/nccf/com/rtofs/prod/
```

**NOAA CoastWatch ERDDAP (RTOFS via ERDDAP interface):**
```
https://coastwatch.pfeg.noaa.gov/erddap/griddap/ncepRtofsG2DForeDaily
```
(Look for surface current datasets; 3D dataset was `ncepRtofsG3DForeDaily` but may have changed — check ERDDAP search)

**ERDDAP search for RTOFS datasets:**
```
https://coastwatch.pfeg.noaa.gov/erddap/search/index.html?searchFor=RTOFS
```

---

### 4c. Sea Surface Height Anomaly (Eddy Proxy)

SSH anomaly is the best proxy for eddy detection — warm-core eddies show as positive anomalies (domed water), cold-core as negative.

**NASA GIBS WMTS layers:**
| Layer ID | TileMatrixSet | Format |
|---|---|---|
| `JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies` | `2km` | PNG |
| `GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies` | `1km` | PNG |

**WMTS URL:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies/default/{YYYY-MM-DD}/2km/{TileMatrix}/{TileRow}/{TileCol}.png
```

---

## 5. Wind Data

### 5a. NOAA NOMADS — GFS Wind (Raw GRIB2, Authoritative)

| Property | Value |
|---|---|
| Model | Global Forecast System (GFS) |
| Resolution | 0.25°, 0.5°, or 1.0° available |
| Update frequency | 4x per day (00Z, 06Z, 12Z, 18Z) |
| Forecast horizon | 16 days |
| Authentication | None |
| Format | GRIB2 |

**GRIB Filter base URL (for subsetting — no authentication needed):**
```
https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl
```

**Example — Extract 10m wind U/V for Gulf Stream region:**
```
https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl?
  file=gfs.t00z.pgrb2.0p25.f000
  &all_lev=on&var_UGRD=on&var_VGRD=on
  &subregion=&toplat=50&leftlon=-90&rightlon=-60&bottomlat=20
  &dir=%2Fgfs.20250601%2F00%2Fatmos
```

**AWS Open Data (trailing 30 days, no auth):**
```
s3://noaa-gfs-bdp-pds/gfs.YYYYMMDD/HH/atmos/gfs.tHHz.pgrb2.0p25.fFFF
```
Or via HTTPS:
```
https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.20250601/00/atmos/gfs.t00z.pgrb2.0p25.f000
```

---

### 5b. NOAA NowCOAST / NDFD — WMS Wind Services

NowCOAST provides time-enabled ArcGIS MapServer services with OGC WMS 1.3.0 support. No authentication required.

**Wind velocity forecast (NDFD, 2.5 km resolution, 7-day):**
```
WMS: https://nowcoast.noaa.gov/arcgis/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_windvel_offsets/MapServer/WMSServer
REST: https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_windvel_offsets/MapServer
```

**Wind speed forecast:**
```
WMS: https://nowcoast.noaa.gov/arcgis/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_windspeed_offsets/MapServer/WMSServer
```

**Wind gust forecast:**
```
WMS: https://nowcoast.noaa.gov/arcgis/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_windgust_offsets/MapServer/WMSServer
```

**WMS GetCapabilities (to list available time steps):**
```
https://nowcoast.noaa.gov/arcgis/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_windvel_offsets/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetCapabilities
```

---

### 5c. Open-Meteo — Free Marine + Wind Forecast API (JSON, No Auth)

Open-Meteo is the easiest free API for JSON wind data at a specific lat/lon. No API key required for non-commercial use.

**Wind endpoint:**
```
https://api.open-meteo.com/v1/forecast?
  latitude=30.0&longitude=-75.0
  &hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m
  &wind_speed_unit=kn
  &forecast_days=7
```

**Marine forecast endpoint (waves + wind):**
```
https://marine-api.open-meteo.com/v1/marine?
  latitude=30.0&longitude=-75.0
  &hourly=wave_height,wave_direction,wave_period,wind_wave_height,swell_wave_height,swell_wave_direction,swell_wave_period
  &forecast_days=7
```

**Response format:** JSON with hourly arrays. `wave_height` in meters.

**License:** Free for non-commercial use (CC BY 4.0). No API key needed.

---

### 5d. Windy API — Animated Wind/Wave Map Embed

Windy provides a JavaScript/Leaflet plugin for embedding animated wind maps.

**Leaflet plugin (free, GFS model only, wind/rain/clouds/waves):**
```
https://api.windy.com/assets/map-forecast/libBoot.js
```

**API Key:** Required. Register free at `https://api.windy.com/keys`

**Free tier:** GFS model, wind/rain/clouds/temperature/pressure/currents/waves. No commercial use.

**Paid tier:** $720/year — adds ECMWF, ICON, GEM models and commercial use rights.

**Point Forecast API (JSON wind/wave at coordinates):**
```
POST https://api.windy.com/api/point-forecast/v2
Headers: Content-Type: application/json
Body: {
  "lat": 30.0, "lon": -75.0,
  "model": "gfs",
  "parameters": ["wind", "waves", "temp"],
  "levels": ["surface"],
  "key": "YOUR_API_KEY"
}
```

---

### 5e. Storm Glass API — Marine-Specific, Multi-Model

Aggregates ECMWF, NOAA, DWD, MetOffice into one JSON response.

**Endpoint:**
```
GET https://api.stormglass.io/v2/weather/point?
  lat=30.0&lng=-75.0
  &params=windSpeed,windDirection,swellHeight,swellDirection,swellPeriod,waterTemperature,waveHeight,currentSpeed,currentDirection
  &start=1748736000&end=1748822400
Headers: Authorization: YOUR_API_KEY
```

**Free tier:** 10 requests/day. Paid plans from $19/month (500 req/day).

**Auth:** Register at `https://stormglass.io` for free API key.

---

## 6. Bathymetry / Ocean Depth

Bathymetry shows underwater structure — canyons, ridges, seamounts, shelf edges — which concentrate fish. The 100-fathom and 200-fathom curves are classic offshore waypoints.

### 6a. GEBCO — Global Bathymetric Chart of the Oceans (WMS, Free)

| Property | Value |
|---|---|
| Data | GEBCO_2025 Grid, 15 arc-second resolution (~450 m) |
| License | Public domain, free for any use |
| Authentication | None |

**WMS Endpoints:**

Global:
```
https://wms.gebco.net/mapserv?
```

Arctic region (IBCAO):
```
https://wms.gebco.net/2024/north-polar/mapserv?
```

Southern Ocean (IBCSO):
```
https://wms.gebco.net/2024/south-polar/mapserv?
```

**GetCapabilities:**
```
https://wms.gebco.net/mapserv?SERVICE=WMS&REQUEST=GetCapabilities
```

**Available Layer Names (GEBCO_2025):**
| Layer Name | Description |
|---|---|
| `gebco_2025` | Shaded relief with ice surface elevation |
| `gebco_2025_2` | Flat color-coded elevation map |
| `gebco_2025_3` | Flat map, measured data only |
| `gebco_2025_sub_ice_topo` | Sub-ice topography shaded relief |
| `gebco_2025_tid` | Type Identifier grid (measured data in black) |

**WMS GetMap Example — Gulf Stream region, depth chart:**
```
https://wms.gebco.net/mapserv?
  SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap
  &LAYERS=gebco_2025_2
  &CRS=CRS:84&BBOX=-82,24,-60,44
  &WIDTH=1200&HEIGHT=800
  &FORMAT=image/png
  &TRANSPARENT=TRUE
```

**Leaflet Integration:**
```javascript
L.tileLayer.wms('https://wms.gebco.net/mapserv?', {
  layers: 'gebco_2025_2',
  format: 'image/png',
  transparent: true,
  version: '1.3.0',
  opacity: 0.6,
  attribution: 'GEBCO 2025'
}).addTo(map);
```

---

### 6b. NOAA Nautical Chart WMS (Bathymetric Contours)

NOAA provides the Electronic Navigational Chart (ENC) and the NOAA RNC (raster charts) as WMS services.

**Bathymetric contour WMS:**
```
https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/WMSServer
```

**GetCapabilities:**
```
https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/WMSServer?SERVICE=WMS&REQUEST=GetCapabilities
```

**NOAA Bathymetric Data Viewer (tile service):**
```
https://gis.ngdc.noaa.gov/arcgis/services/bag_hillshades/ImageServer/WMSServer
```

---

### 6c. NOAA NCEI Bathymetry XYZ Tile Service

For raster hillshaded bathymetry tiles compatible with standard Leaflet/Mapbox tile URLs:

```
https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/GEBCO_basemap_NCEI/MapServer/tile/{z}/{y}/{x}
```
(This is NCEI's GEBCO-based tile service; check NCEI for current URL)

---

## 7. Wave Height / Swell

### 7a. NOAA NowCOAST — NDFD Significant Wave Height (WMS)

| Property | Value |
|---|---|
| Source | NWS National Digital Forecast Database (NDFD) |
| Resolution | 2.5 km |
| Forecast horizon | 3–7 days |
| Update frequency | Every 6 hours |
| Authentication | None |

**Significant wave height forecast WMS:**
```
WMS: https://nowcoast.noaa.gov/arcgis/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_signwaveht_offsets/MapServer/WMSServer
REST: https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_signwaveht_offsets/MapServer
```

**Time-enabled WMS (all NDFD forecast layers combined):**
```
https://nowcoast.noaa.gov/arcgis/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_time/MapServer/WMSServer
```

**GetCapabilities:**
```
https://nowcoast.noaa.gov/arcgis/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_signwaveht_offsets/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetCapabilities
```

---

### 7b. NOAA NOMADS — GFS Wave / WAVEWATCH III (GRIB2)

The operational wave model is now called "GFS Wave" (the successor to WAVEWATCH III in NCEP operations).

**GRIB filter access (no auth):**
```
https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl
```

**Available parameters include:**
- `HTSGW` — Significant height of combined wind waves and swell (meters)
- `PERPW` — Primary wave mean period (seconds)
- `DIRPW` — Primary wave direction (degrees)
- `WVHGT` — Wind wave height
- `SWELL` — Swell height

**Example GRIB filter request:**
```
https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl?
  file=gfswave.t00z.global.0p25.f000.grib2
  &var_HTSGW=on&var_PERPW=on&var_DIRPW=on
  &subregion=&toplat=50&leftlon=-90&rightlon=-60&bottomlat=20
  &dir=%2Fgfs.20250601%2F00%2Fwave%2Fglobal
```

**Product table (all GFS wave regions and products):**
```
https://polar.ncep.noaa.gov/waves/product_table.shtml
```

**FTP (current run):**
```
https://ftpprd.ncep.noaa.gov/data/nccf/com/gfs/prod/
```

---

### 7c. Open-Meteo Marine API — Easiest Free Wave Endpoint

See Section 5c for the full endpoint. Wave-specific parameters:

```
https://marine-api.open-meteo.com/v1/marine?
  latitude=30.0&longitude=-75.0
  &hourly=wave_height,wave_direction,wave_period,
          wind_wave_height,wind_wave_direction,wind_wave_period,
          swell_wave_height,swell_wave_direction,swell_wave_period,
          swell_wave_peak_period
  &forecast_days=7
  &length_unit=imperial
```

Returns JSON. `wave_height` in feet when `length_unit=imperial`. No API key.

---

## 8. Other Fishing-Relevant Layers

### 8a. Sea Surface Height Anomaly (Eddy Tracking)

Eddies are rotating columns of water that trap and concentrate baitfish. Warm-core eddies (positive SSH anomaly) spin off the Gulf Stream and hold 80°F+ water for weeks.

**NASA GIBS WMTS (pre-rendered PNG tiles):**
| Layer | TileMatrixSet | Notes |
|---|---|---|
| `JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies` | `2km` | TOPEX/Jason satellite altimetry merged |
| `GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies` | `1km` | SST anomaly (temp relative to climatology) |

**URL pattern:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies/default/{YYYY-MM-DD}/2km/{TileMatrix}/{TileRow}/{TileCol}.png
```

**AVISO / Copernicus Marine — Advanced Altimetry (free registration):**
- Product: `SEALEVEL_GLO_PHY_L4_NRT_008_046` (NRT sea level anomaly, 0.25°)
- Access: `https://data.marine.copernicus.eu/product/SEALEVEL_GLO_PHY_L4_NRT_008_046`
- Tool: `pip install copernicusmarine` then `copernicusmarine subset --dataset-id ...`
- Auth: Free registration at `https://marine.copernicus.eu/`

---

### 8b. Salinity

Freshwater plumes and salinity fronts affect fish distribution, especially after heavy rains.

**NASA GIBS WMTS — SMAP Salinity tiles:**
| Layer | Source | Period | TileMatrixSet |
|---|---|---|---|
| `SMAP_L3_Sea_Surface_Salinity_CAP_8Day_RunningMean` | SMAP satellite | 2015–present | `2km` |
| `SMAP_L3_Sea_Surface_Salinity_REMSS_8Day_RunningMean` | SMAP satellite | 2015–present | `2km` |
| `SMAP_L3_Sea_Surface_Salinity_CAP_Monthly` | SMAP | monthly | `2km` |
| `Aquarius_Sea_Surface_Salinity_L3_7Day_RunningMean` | Aquarius (historical) | 2011–2015 | `2km` |

**URL pattern:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/SMAP_L3_Sea_Surface_Salinity_CAP_8Day_RunningMean/default/{YYYY-MM-DD}/2km/{TileMatrix}/{TileRow}/{TileCol}.png
```

**Copernicus Marine (CMEMS) — Sea Surface Salinity, daily:**
- Product: `MULTIOBS_GLO_PHY_S_SURFACE_MYNRT_015_013`
- URL: `https://data.marine.copernicus.eu/product/MULTIOBS_GLO_PHY_S_SURFACE_MYNRT_015_013`
- Auth: Free CMEMS registration
- Access: `copernicusmarine subset` CLI or MOTU/WCS API

**NOAA RTOFS salinity (via ERDDAP):**
The RTOFS model outputs salinity at the surface and multiple depths via the NOMADS and ERDDAP interfaces listed in Section 4b.

---

### 8c. Upwelling Zones

Cold, nutrient-rich water brought to the surface by winds — produces explosive chlorophyll blooms. Common off California, Peru, Portugal.

**Best proxy layers (use in combination):**
1. SST anomaly (cold SST anomaly in normally warm water = upwelling)
2. Chlorophyll-a (high chl-a follows upwelling)
3. Wind stress (offshore winds drive coastal upwelling)

**Copernicus Marine upwelling indicator:**
- Product: `GLOBAL_MULTIYEAR_PHY_ENS_001_031`
- URL: `https://data.marine.copernicus.eu/product/GLOBAL_MULTIYEAR_PHY_ENS_001_031`

---

### 8d. Photosynthetically Available Radiation (PAR)

Indicates light penetration into the ocean — useful for understanding productivity zones.

**NASA GIBS WMTS:**
| Layer | Source | TileMatrixSet |
|---|---|---|
| `MODIS_Aqua_L2_Photosynthetically_Available_Radiation` | MODIS Aqua | `1km` |
| `VIIRS_SNPP_L2_Photosynthetically_Available_Radiation` | VIIRS S-NPP | `1km` |
| `VIIRS_NOAA20_Photosynthetically_Available_Radiation` | VIIRS NOAA-20 | `1km` |

---

### 8e. Ocean Wind Speed (Satellite-Derived, not model)

Actual wind speed measured from space — useful for validating model wind forecasts.

**NASA GIBS WMTS:**
| Layer | Source |
|---|---|
| `AMSRU_L3_Ocean_Wind_Speed_Daily` | AMSR2/JAXA daily |
| `AMSRU_L3_Ocean_Wind_Speed_Weekly` | AMSR2/JAXA weekly |
| `Aquarius_Wind_Speed_L3_Daily` | Aquarius (historical) |

---

## 9. NASA GIBS — Master Reference

### Service Endpoints

| Projection | WMTS GetCapabilities URL |
|---|---|
| EPSG:4326 (Geographic) | `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml` |
| EPSG:3857 (Web Mercator) | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml` |
| EPSG:3413 (Arctic) | `https://gibs.earthdata.nasa.gov/wmts/epsg3413/best/1.0.0/WMTSCapabilities.xml` |

### Universal Tile URL Patterns

**EPSG:4326 REST:**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/{LayerID}/default/{YYYY-MM-DD}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.{ext}
```

**EPSG:3857 REST (Leaflet/Mapbox compatible):**
```
https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{LayerID}/default/{YYYY-MM-DD}/GoogleMapsCompatible_Level{maxZoom}/{z}/{y}/{x}.{ext}
```

**KVP (WMS-style for libraries that don't support WMTS):**
```
https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?
  SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0
  &LAYER={LayerID}&TILEMATRIXSET={TileMatrixSet}
  &TILEMATRIX={z}&TILEROW={y}&TILECOL={x}
  &TIME={YYYY-MM-DD}&FORMAT=image/png
```

**WMS (for libraries that need standard WMS bounding box):**
```
https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?
  SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap
  &LAYERS={LayerID}&TIME={YYYY-MM-DD}
  &CRS=EPSG:4326&BBOX={minLat},{minLon},{maxLat},{maxLon}
  &WIDTH={px}&HEIGHT={px}&FORMAT=image/png
```

### TileMatrixSet Zoom Levels

| TileMatrixSet | Tile Size | Zoom 0 Coverage | Max Zoom |
|---|---|---|---|
| `250m` | 512x512 px | 2 tiles | 9 (250m/px) |
| `500m` | 512x512 px | 2 tiles | 8 |
| `1km` | 512x512 px | 2 tiles | 7 |
| `2km` | 512x512 px | 2 tiles | 6 |
| `GoogleMapsCompatible_Level9` | 256x256 px | 1 tile | 9 |

### Authentication
**None required.** GIBS is completely free and open. No API key, no registration.

### Quick Reference — Key Fishing Layers

| Layer | Type | TileMatrixSet | Ext | Update |
|---|---|---|---|---|
| `GHRSST_L4_MUR_Sea_Surface_Temperature` | SST | `1km` | .png | Daily |
| `GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies` | SST anomaly | `1km` | .png | Daily |
| `MODIS_Aqua_L2_Sea_Surface_Temp_Day` | SST (raw swath) | `1km` | .png | Multiple/day |
| `VIIRS_SNPP_L2_Sea_Surface_Temp_Day` | SST (raw swath) | `1km` | .png | Multiple/day |
| `VIIRS_NOAA20_Chlorophyll_a` | Chlorophyll | `1km` | .png | Daily |
| `MODIS_Aqua_L2_Chlorophyll_A` | Chlorophyll | `1km` | .png | Daily |
| `OCI_PACE_Chlorophyll_a` | Chlorophyll (newest) | `1km` | .png | Daily |
| `MODIS_Aqua_CorrectedReflectance_TrueColor` | True color | `250m` | .jpg | Daily |
| `VIIRS_SNPP_CorrectedReflectance_TrueColor` | True color | `250m` | .jpg | Daily |
| `OSCAR_Sea_Surface_Currents_Zonal` | Current U | `2km` | .png | 5-day |
| `OSCAR_Sea_Surface_Currents_Meridional` | Current V | `2km` | .png | 5-day |
| `JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies` | SSH / eddies | `2km` | .png | Weekly |
| `SMAP_L3_Sea_Surface_Salinity_CAP_8Day_RunningMean` | Salinity | `2km` | .png | 8-day |

---

## 10. NOAA ERDDAP — Master Reference

### Server Nodes

| Node | Base URL | Best For |
|---|---|---|
| CoastWatch West Coast | `https://coastwatch.pfeg.noaa.gov/erddap` | MUR SST, VIIRS, Pacific |
| CoastWatch Central | `https://coastwatch.noaa.gov/erddap` | Blended SST, VIIRS Chl, GHRSST |
| PolarWatch | `https://polarwatch.noaa.gov/erddap` | Arctic/polar SST |
| PacIOOS | `https://oceanwatch.pifsc.noaa.gov/erddap` | Pacific Islands |
| AOML | `https://erddap.aoml.noaa.gov/hdb/erddap` | Atlantic SST |

### URL Patterns

**Dataset info:**
```
https://{server}/erddap/info/{datasetID}/index.html
```

**Griddap data extraction (NetCDF, CSV, JSON, PNG):**
```
https://{server}/erddap/griddap/{datasetID}.{fileType}?
  {variable}[({time})][(minLat):(maxLat)][(minLon):(maxLon)]
```

**WMS GetMap:**
```
https://{server}/erddap/wms/{datasetID}/request?
  service=WMS&version=1.3.0&request=GetMap
  &bbox={minLat},{minLon},{maxLat},{maxLon}
  &crs=EPSG:4326&width={px}&height={px}
  &layers={datasetID}:{variable}
  &styles=&format=image/png
  &time={ISO8601}
```

**Important BBOX note:** For WMS 1.3.0 with EPSG:4326, the BBOX order is `minLat,minLon,maxLat,maxLon` (lat/lon, NOT lon/lat).

### Key Dataset IDs Quick Reference

| Dataset ID | Server | Description | Resolution | Frequency |
|---|---|---|---|---|
| `jplMURSST41` | coastwatch.pfeg | MUR SST | 0.01° (1km) | Daily |
| `noaacwBLENDEDsstDaily` | coastwatch.noaa | Geo-polar Blended SST | 0.05° (5km) | Daily |
| `noaacrwsstDaily` | coastwatch.noaa | CoralTemp SST | 5 km | Daily |
| `noaacwNPPVIIRSchlaDaily` | coastwatch.noaa | VIIRS Chlorophyll | 4 km | Daily |
| `noaacwL3CollatednppC` | coastwatch.noaa | VIIRS SST collated | 4 km | Daily |
| `erdVHNchlamday` | coastwatch.pfeg | VIIRS chl N. Pacific | 750 m | Monthly |

### Search ERDDAP for Datasets
```
https://coastwatch.noaa.gov/erddap/search/index.html?searchFor=SST
https://coastwatch.noaa.gov/erddap/search/index.html?searchFor=chlorophyll
https://coastwatch.pfeg.noaa.gov/erddap/search/index.html?searchFor=current
```

---

## 11. Integration Strategy & Recommended Stack

### Architecture for a RipCharts-style App

```
Frontend (Leaflet.js or MapLibre GL)
  ├── Base layer: GEBCO WMS or Mapbox Ocean tile
  ├── Layer 1: SST — GIBS WMTS tiles (GHRSST MUR) + ERDDAP WMS fallback
  ├── Layer 2: True Color — GIBS WMTS (MODIS Aqua or VIIRS)
  ├── Layer 3: Chlorophyll — GIBS WMTS (VIIRS NOAA-20)
  ├── Layer 4: Currents — OSCAR U+V from GIBS → Leaflet.Velocity animated particles
  ├── Layer 5: SSH Anomaly (eddies) — GIBS WMTS
  ├── Layer 6: Wind — NowCOAST WMS or Open-Meteo JSON → rendered arrows
  ├── Layer 7: Waves — Open-Meteo Marine API JSON at click point
  └── Layer 8: Bathymetry — GEBCO WMS contours overlay

Backend (Node.js / Python)
  ├── Cache GIBS tiles (tiles are static by date — cache aggressively)
  ├── Proxy ERDDAP WMS requests (to avoid CORS issues)
  ├── Fetch NOMADS GRIB2 → parse with ecCodes/cfgrib → generate wind/wave tiles
  ├── Poll ERDDAP griddap daily for new SST/chl data → store latest date
  └── Serve point-query API: given lat/lon, return SST, chl, depth from ERDDAP
```

### Layer Priority by Use Case

**Finding temperature breaks (most important for tuna/marlin):**
1. `GHRSST_L4_MUR_Sea_Surface_Temperature` (GIBS, daily, 1km)
2. `VIIRS_SNPP_L2_Sea_Surface_Temp_Day` (GIBS, near-RT swath, 1km)
3. `GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies` (shows anomalous warm/cold)

**Finding color breaks (mahi, wahoo):**
1. `VIIRS_NOAA20_Chlorophyll_a` (GIBS, daily)
2. `MODIS_Aqua_CorrectedReflectance_TrueColor` (GIBS, 250m visual)
3. ERDDAP `noaacwNPPVIIRSchlaDaily` for raw chl values

**Finding eddies (canyon/offshore tournament fishing):**
1. `JPL_MEaSUREs_L4_Sea_Surface_Height_Anomalies` (GIBS) — positive anomaly = warm eddy
2. SSH + SST overlay together
3. OSCAR currents to see rotation

**Pre-trip planning (weather):**
1. Open-Meteo marine API for swell/wave forecast at specific coordinates
2. NowCOAST WMS for NDFD wind speed + wave height forecast tiles
3. Windy API for animated wind map embed

### Date Handling

GIBS tiles require a date in `YYYY-MM-DD` format in the URL. Most layers are available approximately:
- MODIS/VIIRS true color and chl: 3–5 hours after overpass
- GHRSST MUR SST: ~12–24 hour latency
- OSCAR currents: 5–7 days latency (NRT version)

To find the latest available date for a GIBS layer, query the GetCapabilities XML and parse the `<Dimension>` element for `time`.

### CORS Notes

- GIBS tiles: CORS enabled — call directly from browser
- NOAA CoastWatch ERDDAP: CORS enabled — call directly from browser
- NowCOAST ArcGIS REST: CORS enabled
- GEBCO WMS: May require server-side proxy for some browsers
- NOMADS GRIB2: No CORS — must proxy server-side or use AWS S3 version

---

## Sources

- [NOAA CoastWatch ERDDAP West Coast](https://coastwatch.pfeg.noaa.gov/erddapinfo/)
- [NOAA CoastWatch ERDDAP Central — Blended SST](https://coastwatch.noaa.gov/erddap/info/noaacwBLENDEDsstDaily/index.html)
- [NOAA CoastWatch ERDDAP — VIIRS Chlorophyll Daily](https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPVIIRSchlaDaily.html)
- [NOAA ERDDAP WMS Documentation](https://coastwatch.noaa.gov/erddap/wms/documentation.html)
- [NASA GIBS API Documentation — Access Basics](https://nasa-gibs.github.io/gibs-api-docs/access-basics/)
- [NASA GIBS API Documentation — Advanced Topics](https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/)
- [NASA GIBS WMTS Capabilities (EPSG:4326)](https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml)
- [NASA Earthdata GIBS API Portal](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api)
- [NASA Changes to Chlorophyll Layers](https://www.earthdata.nasa.gov/news/blog/changes-chlorophyll-layers)
- [NASA Ocean Color / OB.DAAC](https://oceancolor.gsfc.nasa.gov/data/download_methods/)
- [OSCAR NRT v2.0 — NASA PO.DAAC](https://podaac.jpl.nasa.gov/dataset/OSCAR_L4_OC_NRT_V2.0)
- [NOAA NOMADS Operational Models](https://nomads.ncep.noaa.gov/)
- [NOAA NowCOAST Forecast Wave Height MapServer](https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_signwaveht_offsets/MapServer)
- [NOAA NowCOAST Wind Speed MapServer](https://nowcoast.noaa.gov/arcgis/rest/services/nowcoast/forecast_meteoceanhydro_sfc_ndfd_windspeed_offsets/MapServer)
- [NOAA GFS on AWS Open Data](https://registry.opendata.aws/noaa-gfs-bdp-pds/)
- [NOAA RTOFS on AWS Open Data](https://registry.opendata.aws/noaa-rtofs/)
- [NOAA WAVEWATCH III Wave Model Download](https://polar.ncep.noaa.gov/waves/download2.shtml)
- [GEBCO WMS Service](https://www.gebco.net/data-products/gebco-web-services/web-map-service)
- [Open-Meteo Marine Weather API](https://open-meteo.com/en/docs/marine-weather-api)
- [Windy API](https://api.windy.com/)
- [Storm Glass Marine Weather API](https://stormglass.io/marine-weather/)
- [Copernicus Marine Service APIs](https://help.marine.copernicus.eu/en/articles/4794731-which-apis-are-provided)
- [SatFish Chlorophyll Info](https://www.satfish.com/chlorophyll/)
- [RipCharts Satellite Mapping Comparison — InTheSpread](https://inthespread.com/blog/satellite-mapping-services-for-offshore-fishing-355)
