"""
Fishing Hotspot Compute Lambda
===============================
Computes a composite fishing hotspot score by detecting edges/gradients in:
  1. SST (sea surface temperature) — temperature breaks
  2. Chlorophyll-a — color breaks
  3. Bathymetry — shelf breaks, canyons, ledges
  4. SSH anomaly — eddy edges, current boundaries

Scoring formula (from research):
  BASE = SST_edge*0.35 + Chl_edge*0.25 + Bathy_edge*0.18 + SSH_edge*0.12 + species_bonus*0.10
  FINAL = BASE * fishability * moon * pressure_trend * time_of_day

Output: quantized 0-255 grid uploaded to S3, served by the tile Lambda.
"""

import json
import gzip
import logging
import math
import os
import tempfile
from datetime import datetime, timezone, timedelta
from io import BytesIO

import boto3
import numpy as np
import requests
from scipy.ndimage import sobel, gaussian_filter, uniform_filter

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
S3_BUCKET = os.environ.get('HRRR_BUCKET', 'reelmaps-hrrr')

# ── Output grid — matches HRRR tile pipeline for tile serving ───────────────
OUT_LAT_MIN, OUT_LAT_MAX = 20.0, 55.0
OUT_LNG_MIN, OUT_LNG_MAX = -130.0, -60.0
OUT_RES = 0.04  # ~4.4km — matches chlorophyll resolution, good for fishing
OUT_LATS = np.arange(OUT_LAT_MIN, OUT_LAT_MAX, OUT_RES)
OUT_LNGS = np.arange(OUT_LNG_MIN, OUT_LNG_MAX, OUT_RES)

# ── ERDDAP data sources ────────────────────────────────────────────────────
# Primary + fallback ERDDAP servers (coastwatch sometimes goes down)
ERDDAP_SERVERS = [
    'https://upwell.pfeg.noaa.gov/erddap/griddap',
    'https://coastwatch.pfeg.noaa.gov/erddap/griddap',
]
COASTWATCH = ERDDAP_SERVERS[0]

# Species temperature preferences (°F) — optimal range
SPECIES_TEMPS = {
    'yellowfin_tuna': (75, 82),
    'bluefin_tuna':   (60, 72),
    'bigeye_tuna':    (62, 74),
    'mahi_mahi':      (74, 80),
    'wahoo':          (73, 78),
    'blue_marlin':    (74, 82),
    'white_marlin':   (70, 80),
    'sailfish':       (72, 82),
    'swordfish':      (64, 72),
    'king_mackerel':  (70, 78),
    'cobia':          (68, 78),
    'red_snapper':    (55, 70),
    'yellowtail':     (64, 72),
    'albacore':       (62, 65),
    'striped_marlin': (68, 76),
}


def fetch_sst_grid(target_date=None):
    """Fetch MUR SST from ERDDAP as a NetCDF grid.
    Returns SST in °C on the output lat/lon grid, or None on failure.
    target_date: optional YYYYMMDD to fetch SST for a specific date.
    """
    if target_date:
        # Parse YYYYMMDD and try that date + a few days back
        base = datetime.strptime(target_date, '%Y%m%d').replace(tzinfo=timezone.utc)
    else:
        base = datetime.now(timezone.utc)

    for days_ago in range(0, 4):
        date = (base - timedelta(days=days_ago)).strftime('%Y-%m-%dT09:00:00Z')
        url = (
            f'{COASTWATCH}/jplMURSST41.nc?'
            f'analysed_sst[({date})]'
            f'[({OUT_LAT_MIN}):({OUT_LAT_MAX})]'
            f'[({OUT_LNG_MIN}):({OUT_LNG_MAX})]'
        )
        try:
            logger.info(f'Fetching SST for {date}...')
            r = requests.get(url, timeout=120)
            if r.status_code == 200:
                return _parse_netcdf(r.content, 'analysed_sst', date)
            logger.warning(f'SST fetch failed ({r.status_code}) for {date}')
        except Exception as e:
            logger.warning(f'SST fetch error for {date}: {e}')
    return None


def fetch_chlorophyll_grid():
    """Fetch VIIRS/MODIS chlorophyll-a from ERDDAP.
    Returns chlorophyll in mg/m³ on the output grid, or None.
    Uses (last) time constraint to always get the most recent available data.
    """
    # Try multiple dataset IDs with (last) time — more robust than specific dates
    datasets = [
        ('erdMBchla8day', 'chlorophyll'),        # MODIS 8-day composite
        ('erdVHNchla8day', 'chla'),              # VIIRS NOAA-20 8-day
        ('erdMH1chla8day', 'chlorophyll'),        # MODIS Aqua 8-day
        ('nesdisVHNSQchlaWeekly', 'chlor_a'),    # VIIRS weekly
        ('erdVH2018chla1day', 'chla'),           # VIIRS daily
    ]
    for ds, var in datasets:
        url = (
            f'{COASTWATCH}/{ds}.nc?'
            f'{var}[(last)]'
            f'[({OUT_LAT_MIN}):({OUT_LAT_MAX})]'
            f'[({OUT_LNG_MIN}):({OUT_LNG_MAX})]'
        )
        try:
            logger.info(f'Fetching chlorophyll from {ds} (latest)...')
            r = requests.get(url, timeout=120)
            if r.status_code == 200:
                return _parse_netcdf(r.content, var, 'latest')
            logger.warning(f'Chlorophyll fetch failed ({r.status_code}) from {ds}')
        except Exception as e:
            logger.warning(f'Chlorophyll fetch error from {ds}: {e}')

    # Fallback: try with specific recent dates
    for days_ago in range(1, 10):
        date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime('%Y-%m-%dT12:00:00Z')
        for ds, var in datasets[:3]:
            url = (
                f'{COASTWATCH}/{ds}.nc?'
                f'{var}[({date})]'
                f'[({OUT_LAT_MIN}):({OUT_LAT_MAX})]'
                f'[({OUT_LNG_MIN}):({OUT_LNG_MAX})]'
            )
            try:
                r = requests.get(url, timeout=60)
                if r.status_code == 200:
                    return _parse_netcdf(r.content, var, date)
            except Exception:
                continue
    return None


def fetch_ssh_grid():
    """Fetch sea surface height anomaly.
    Returns SSH in cm on the output grid, or None.
    """
    datasets = [
        ('jplSEALEVEL_SSH_2day', 'sla'),
        ('nasa_jpl_c691_1330_3498', 'SLA'),
    ]
    # Try (last) first
    for ds, var in datasets:
        url = (
            f'{COASTWATCH}/{ds}.nc?'
            f'{var}[(last)]'
            f'[({OUT_LAT_MIN}):({OUT_LAT_MAX})]'
            f'[({OUT_LNG_MIN}):({OUT_LNG_MAX})]'
        )
        try:
            logger.info(f'Fetching SSH from {ds} (latest)...')
            r = requests.get(url, timeout=120)
            if r.status_code == 200:
                return _parse_netcdf(r.content, var, 'latest')
            logger.warning(f'SSH fetch failed ({r.status_code}) from {ds}')
        except Exception as e:
            logger.warning(f'SSH fetch error from {ds}: {e}')

    # Fallback with specific dates
    for days_ago in range(0, 5):
        date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime('%Y-%m-%dT12:00:00Z')
        for ds, var in datasets:
            url = (
                f'{COASTWATCH}/{ds}.nc?'
                f'{var}[({date})]'
                f'[({OUT_LAT_MIN}):({OUT_LAT_MAX})]'
                f'[({OUT_LNG_MIN}):({OUT_LNG_MAX})]'
            )
            try:
                r = requests.get(url, timeout=60)
                if r.status_code == 200:
                    return _parse_netcdf(r.content, var, date)
            except Exception:
                continue
    return None


def _parse_netcdf(content, var_name, date_str):
    """Parse NetCDF bytes and reproject to output grid using xarray + scipy."""
    import xarray as xr
    with tempfile.NamedTemporaryFile(suffix='.nc', delete=False) as f:
        f.write(content)
        tmp = f.name
    try:
        ds = xr.open_dataset(tmp, engine='scipy')

        # Find the data variable
        if var_name in ds.data_vars:
            data = ds[var_name].values
        else:
            # Try first data variable
            data = ds[list(ds.data_vars)[0]].values

        # Squeeze out time dimension if present
        while data.ndim > 2:
            data = data[0]

        # Get lat/lon coordinates
        lat_key = 'latitude' if 'latitude' in ds.coords else 'lat'
        lon_key = 'longitude' if 'longitude' in ds.coords else 'lon'
        src_lats = ds.coords[lat_key].values
        src_lons = ds.coords[lon_key].values
        ds.close()

        data = np.array(data, dtype=np.float32)

        # Reproject to output grid using nearest-neighbor
        return _regrid(data, src_lats, src_lons)

    finally:
        os.unlink(tmp)


def _regrid(data, src_lats, src_lons):
    """Regrid 2D data from source lat/lon to output grid (nearest neighbor)."""
    if len(src_lats) == 0 or len(src_lons) == 0:
        return None

    out = np.full((len(OUT_LATS), len(OUT_LNGS)), np.nan, dtype=np.float32)

    # Ensure ascending lat order
    if src_lats[0] > src_lats[-1]:
        src_lats = src_lats[::-1]
        data = data[::-1, :]

    # Convert longitudes if needed
    src_lons = np.array(src_lons)
    if np.any(src_lons > 180):
        src_lons = np.where(src_lons > 180, src_lons - 360, src_lons)

    for i, lat in enumerate(OUT_LATS):
        lat_idx = np.searchsorted(src_lats, lat)
        lat_idx = min(lat_idx, len(src_lats) - 1)
        for j, lon in enumerate(OUT_LNGS):
            lon_idx = np.searchsorted(src_lons, lon)
            lon_idx = min(lon_idx, len(src_lons) - 1)
            val = data[lat_idx, lon_idx]
            if not np.isnan(val):
                out[i, j] = val

    return out


def compute_bathymetry_gradient():
    """Load or compute bathymetry gradient from ETOPO via ERDDAP.
    Returns gradient magnitude (positive = steep slope).
    """
    # Check S3 cache first
    cache_key = f'grids/hotspot/bathy_gradient_{OUT_RES}.bin.gz'
    try:
        resp = s3.get_object(Bucket=S3_BUCKET, Key=cache_key)
        raw = gzip.decompress(resp['Body'].read())
        grid = np.frombuffer(raw, dtype=np.float32).reshape(len(OUT_LATS), len(OUT_LNGS))
        logger.info('Loaded cached bathymetry gradient from S3')
        return grid
    except Exception:
        pass

    logger.info('Computing bathymetry gradient from ETOPO...')
    url = (
        f'{COASTWATCH}/etopo1_bedrock.nc?'
        f'altitude[({OUT_LAT_MIN}):({OUT_LAT_MAX})]'
        f'[({OUT_LNG_MIN}):({OUT_LNG_MAX})]'
    )
    try:
        r = requests.get(url, timeout=180)
        if r.status_code != 200:
            logger.error(f'ETOPO fetch failed: {r.status_code}')
            return None

        bathy = _parse_netcdf(r.content, 'altitude', 'static')
        if bathy is None:
            return None

        # Only keep ocean (negative depth)
        ocean_mask = bathy < 0

        # Compute gradient magnitude using Sobel operator
        # Depth values are in meters (negative for ocean)
        depth = np.abs(bathy)  # positive depth
        depth[~ocean_mask] = 0

        gx = sobel(depth, axis=1)
        gy = sobel(depth, axis=0)
        gradient = np.sqrt(gx**2 + gy**2)

        # Normalize: log scale works better for bathymetry (huge range)
        gradient = np.where(ocean_mask, np.log1p(gradient), 0)
        max_grad = np.nanpercentile(gradient[ocean_mask], 99) if ocean_mask.any() else 1
        gradient = np.clip(gradient / max(max_grad, 0.01), 0, 1).astype(np.float32)

        # Cache to S3
        compressed = gzip.compress(gradient.tobytes())
        s3.put_object(Bucket=S3_BUCKET, Key=cache_key, Body=compressed,
                      ContentType='application/octet-stream')
        logger.info(f'Cached bathymetry gradient ({len(compressed)} bytes)')

        return gradient

    except Exception as e:
        logger.error(f'Bathymetry compute failed: {e}', exc_info=True)
        return None


def compute_edge_score(grid, smooth_sigma=1.5):
    """Compute normalized edge/gradient magnitude using Sobel operator.
    Returns 0-1 score where 1 = strongest edges.
    """
    if grid is None:
        return None

    # Fill NaN with local mean for edge detection stability
    valid = ~np.isnan(grid)
    if valid.sum() < 100:
        return None

    filled = grid.copy()
    filled[~valid] = 0

    # Smooth slightly to reduce noise before edge detection
    smoothed = gaussian_filter(filled, sigma=smooth_sigma)

    # Sobel edge detection (gradient magnitude)
    gx = sobel(smoothed, axis=1)
    gy = sobel(smoothed, axis=0)
    magnitude = np.sqrt(gx**2 + gy**2)

    # Zero out land/invalid areas
    magnitude[~valid] = 0

    # Normalize to 0-1 using 99th percentile (clips outliers)
    p99 = np.percentile(magnitude[valid], 99)
    if p99 < 1e-10:
        return np.zeros_like(grid)

    score = np.clip(magnitude / p99, 0, 1).astype(np.float32)
    score[~valid] = 0

    return score


def compute_species_score(sst_grid):
    """Score each pixel for how many species find it in their optimal range.
    SST is in °C, species ranges are in °F.
    Returns 0-1 score.
    """
    if sst_grid is None:
        return None

    valid = ~np.isnan(sst_grid)
    sst_f = sst_grid * 9 / 5 + 32  # Convert °C to °F

    score = np.zeros_like(sst_grid)
    n_species = len(SPECIES_TEMPS)

    for name, (lo, hi) in SPECIES_TEMPS.items():
        # Gaussian-ish score: 1.0 in optimal range, tapering outside
        mid = (lo + hi) / 2
        width = (hi - lo) / 2
        # Score 1.0 within range, smooth falloff outside
        diff = np.abs(sst_f - mid) - width
        species_score = np.where(diff <= 0, 1.0, np.exp(-0.5 * (diff / 3) ** 2))
        score += species_score

    score = score / n_species  # Normalize to 0-1
    score[~valid] = 0

    return score.astype(np.float32)


def fetch_sargassum_grid():
    """Fetch AFAI (Alternative Floating Algae Index) 7-day composite from ERDDAP.
    Returns AFAI values on the output lat/lon grid, or None.
    Data source: NOAA AOML Atlantic Oceanwatch — covers 0-38N, 98W-38W.
    """
    # AOML ERDDAP is on a different server than CoastWatch
    aoml_base = 'https://cwcgom.aoml.noaa.gov/erddap/griddap'

    # Try with (last) first, then fall back to recent days
    for days_ago in range(1, 5):
        date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime('%Y-%m-%dT12:00:00Z')
        url = (
            f'{aoml_base}/noaa_aoml_atlantic_oceanwatch_AFAI_7D.nc?'
            f'AFAI[({date})]'
            f'[({max(OUT_LAT_MIN, 0)}):({min(OUT_LAT_MAX, 38)})]'
            f'[({max(OUT_LNG_MIN, -98)}):({min(OUT_LNG_MAX, -38)})]'
        )
        try:
            logger.info(f'Fetching sargassum AFAI for {date}...')
            r = requests.get(url, timeout=180)
            if r.status_code == 200:
                grid = _parse_netcdf(r.content, 'AFAI', date)
                if grid is not None:
                    logger.info(f'Sargassum AFAI fetched: {np.count_nonzero(~np.isnan(grid))} valid pixels')
                    return grid
            logger.warning(f'Sargassum AFAI fetch failed ({r.status_code}) for {date}')
        except Exception as e:
            logger.warning(f'Sargassum AFAI fetch error for {date}: {e}')

    return None


def fetch_sargassum_daily_grid():
    """Fetch AFAI daily (single-day) from ERDDAP.
    Returns AFAI values on the output lat/lon grid, or None.
    """
    aoml_base = 'https://cwcgom.aoml.noaa.gov/erddap/griddap'

    for days_ago in range(0, 3):
        date = (datetime.now(timezone.utc) - timedelta(days=days_ago)).strftime('%Y-%m-%dT12:00:00Z')
        url = (
            f'{aoml_base}/noaa_aoml_atlantic_oceanwatch_AFAI_1D.nc?'
            f'AFAI[({date})]'
            f'[({max(OUT_LAT_MIN, 0)}):({min(OUT_LAT_MAX, 38)})]'
            f'[({max(OUT_LNG_MIN, -98)}):({min(OUT_LNG_MAX, -38)})]'
        )
        try:
            logger.info(f'Fetching daily sargassum AFAI for {date}...')
            r = requests.get(url, timeout=180)
            if r.status_code == 200:
                grid = _parse_netcdf(r.content, 'AFAI', date)
                if grid is not None:
                    logger.info(f'Daily sargassum AFAI fetched: {np.count_nonzero(~np.isnan(grid))} valid pixels')
                    return grid
            logger.warning(f'Daily sargassum AFAI fetch failed ({r.status_code}) for {date}')
        except Exception as e:
            logger.warning(f'Daily sargassum AFAI fetch error for {date}: {e}')

    return None


def compute_coastline_distance():
    """Compute distance-from-coastline grid in nautical miles.
    Uses bathymetry: land = positive, ocean = negative.
    Distance is computed as minimum distance to the land/ocean boundary.
    Returns grid of distances (NM) — positive = offshore, 0 = on coast.
    Cached in S3 for reuse.
    """
    cache_key = f'grids/hotspot/coastline_dist_{OUT_RES}.bin.gz'
    try:
        resp = s3.get_object(Bucket=S3_BUCKET, Key=cache_key)
        raw = gzip.decompress(resp['Body'].read())
        grid = np.frombuffer(raw, dtype=np.float32).reshape(len(OUT_LATS), len(OUT_LNGS))
        logger.info('Loaded cached coastline distance grid from S3')
        return grid
    except Exception:
        pass

    logger.info('Computing coastline distance grid from bathymetry...')

    # Try fetching ETOPO from multiple servers
    bathy = None
    for server in ERDDAP_SERVERS:
        url = f'{server}/etopo1_bedrock.nc?altitude[({OUT_LAT_MIN}):({OUT_LAT_MAX})][({OUT_LNG_MIN}):({OUT_LNG_MAX})]'
        try:
            logger.info(f'Trying ETOPO from {server}...')
            r = requests.get(url, timeout=180, allow_redirects=True)
            if r.status_code == 200:
                bathy = _parse_netcdf(r.content, 'altitude', 'static')
                if bathy is not None:
                    break
            logger.warning(f'ETOPO fetch failed ({r.status_code}) from {server}')
        except Exception as e:
            logger.warning(f'ETOPO fetch error from {server}: {e}')

    # Fallback: derive land mask from cached bathymetry gradient
    if bathy is None:
        logger.info('ETOPO unavailable — deriving land mask from bathymetry gradient cache...')
        bathy_grad_key = f'grids/hotspot/bathy_gradient_{OUT_RES}.bin.gz'
        try:
            resp = s3.get_object(Bucket=S3_BUCKET, Key=bathy_grad_key)
            raw = gzip.decompress(resp['Body'].read())
            bathy_grad = np.frombuffer(raw, dtype=np.float32).reshape(len(OUT_LATS), len(OUT_LNGS))
            # Gradient = 0 means land or no data; gradient > 0 means ocean
            # Create a synthetic "bathymetry" where ocean = -1, land = 1
            bathy = np.where(bathy_grad > 0, -1.0, 1.0).astype(np.float32)
            logger.info('Using bathymetry gradient cache as land mask fallback')
        except Exception as e:
            logger.error(f'Bathymetry gradient cache not available: {e}')
            return None

    try:
        # Create land mask: land = True, ocean = False
        land_mask = bathy >= 0

        # Use scipy distance_transform to compute distance from coastline
        from scipy.ndimage import distance_transform_edt

        # Distance from coast for ocean pixels (distance to nearest land pixel)
        # Each grid cell is ~OUT_RES degrees. At ~30°N, 1° lat ≈ 60 NM, 1° lon ≈ 52 NM
        # Use average: ~56 NM per degree as a rough conversion
        nm_per_degree = 60.0  # 1 degree latitude ≈ 60 NM

        # EDT gives distance in grid cells from the nearest True pixel
        # We want distance from ocean pixels to the nearest land pixel
        ocean_dist = distance_transform_edt(~land_mask) * OUT_RES * nm_per_degree

        # Set land pixels to 0
        ocean_dist[land_mask] = 0

        dist_grid = ocean_dist.astype(np.float32)

        # Cache to S3
        compressed = gzip.compress(dist_grid.tobytes())
        s3.put_object(Bucket=S3_BUCKET, Key=cache_key, Body=compressed,
                      ContentType='application/octet-stream')
        logger.info(f'Cached coastline distance grid ({len(compressed)} bytes)')

        return dist_grid

    except Exception as e:
        logger.error(f'Coastline distance compute failed: {e}', exc_info=True)
        return None


INSHORE_LIMIT_NM = 9.0  # nautical miles — boundary between inshore and offshore


def compute_moon_factor():
    """Compute moon phase multiplier (0.8-1.2).
    New moon and full moon = spring tides = best fishing.
    """
    # Simple synodic month calculation
    # Known new moon: Jan 6, 2000 18:14 UTC
    ref = datetime(2000, 1, 6, 18, 14, tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    days = (now - ref).total_seconds() / 86400
    synodic = 29.53058867
    phase = (days % synodic) / synodic  # 0=new, 0.5=full

    # Score: 1.2 at new/full, 0.8 at quarters
    # cos(2*pi*phase) = 1 at new, -1 at first quarter, 1 at full, -1 at third quarter
    # But we want both new AND full to score high
    factor = 1.0 + 0.2 * math.cos(4 * math.pi * phase)
    return max(0.8, min(1.2, factor))


def compute_time_factor():
    """Compute time-of-day multiplier (0.7-1.5).
    Dawn/dusk = best, midday = worst.
    Uses a rough approximation for mid-latitudes.
    """
    hour_utc = datetime.now(timezone.utc).hour
    # Approximate: dawn ~11-13 UTC (6-8am ET), dusk ~23-01 UTC (6-8pm ET)
    # For a broad CONUS average, use a simple sinusoidal
    # Peak at 12 UTC (dawn ET) and 00 UTC (dusk ET)
    dawn_score = math.exp(-0.5 * ((hour_utc - 12) / 2) ** 2)
    dusk_score = math.exp(-0.5 * (((hour_utc - 24) % 24) / 2) ** 2)
    crepuscular = max(dawn_score, dusk_score)

    # Map 0-1 crepuscular to 0.7-1.5
    return 0.7 + 0.8 * crepuscular


def _list_available_dates():
    """List all dates that have hotspot grids in S3."""
    try:
        resp = s3.list_objects_v2(
            Bucket=S3_BUCKET, Prefix='grids/hotspot/', Delimiter='/',
        )
        dates = []
        for cp in resp.get('CommonPrefixes', []):
            # e.g., 'grids/hotspot/20260402/'
            parts = cp['Prefix'].rstrip('/').split('/')
            if len(parts) >= 3 and parts[2].isdigit() and len(parts[2]) == 8:
                dates.append(parts[2])
        dates.sort(reverse=True)
        return dates[:90]  # Last 90 days max
    except Exception as e:
        logger.warning(f'Failed to list available dates: {e}')
        return []


GRID_METADATA = {
    'lat_min': str(OUT_LAT_MIN),
    'lat_max': str(float(OUT_LATS[-1])),
    'lng_min': str(OUT_LNG_MIN),
    'lng_max': str(float(OUT_LNGS[-1])),
    'lat_count': str(len(OUT_LATS)),
    'lng_count': str(len(OUT_LNGS)),
    'lat_res': str(OUT_RES),
    'lng_res': str(OUT_RES),
}


def _upload_grid(quantized, key):
    """Compress and upload a uint8 grid to S3."""
    compressed = gzip.compress(quantized.tobytes())
    s3.put_object(
        Bucket=S3_BUCKET, Key=key, Body=compressed,
        ContentType='application/octet-stream', ContentEncoding='gzip',
        Metadata=GRID_METADATA,
    )
    logger.info(f'Uploaded {key} ({len(compressed)} bytes, {np.count_nonzero(quantized)} nonzero)')


def quantize_score(score):
    """Convert 0-1 float score to 0-255 uint8."""
    quantized = np.zeros_like(score, dtype=np.uint8)
    valid = score > 0.01
    quantized[valid] = np.clip(score[valid] * 255, 1, 255).astype(np.uint8)
    return quantized


def upload_hotspot_grid(score, date_str, hour_str, is_backfill=False):
    """Upload per-run grid and update latest + daily average."""
    quantized = quantize_score(score)

    # 1) Per-run grid: grids/hotspot/{date}/{hour}.bin.gz
    run_key = f'grids/hotspot/{date_str}/{hour_str}.bin.gz'
    _upload_grid(quantized, run_key)

    # 2) Latest grid (always points to most recent run for today)
    latest_key = f'grids/hotspot/{date_str}/latest.bin.gz'
    _upload_grid(quantized, latest_key)

    # 3) Daily grid — for backfills, just copy directly; for live runs, average all
    if is_backfill:
        daily_key = f'grids/hotspot/{date_str}/daily.bin.gz'
        _upload_grid(quantized, daily_key)
    else:
        _update_daily_average(date_str)

    return run_key


def _update_daily_average(date_str):
    """Average all per-run grids for a given date into a daily.bin.gz."""
    prefix = f'grids/hotspot/{date_str}/'
    grid_shape = (len(OUT_LATS), len(OUT_LNGS))

    try:
        resp = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
        run_keys = [
            obj['Key'] for obj in resp.get('Contents', [])
            if obj['Key'].endswith('.bin.gz')
            and 'daily' not in obj['Key']
            and 'latest' not in obj['Key']
        ]

        if not run_keys:
            return

        logger.info(f'Computing daily average from {len(run_keys)} runs for {date_str}')
        accumulator = np.zeros(grid_shape, dtype=np.float32)
        count = 0

        for key in run_keys:
            try:
                obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
                raw = gzip.decompress(obj['Body'].read())
                grid = np.frombuffer(raw, dtype=np.uint8).reshape(grid_shape)
                accumulator += grid.astype(np.float32)
                count += 1
            except Exception as e:
                logger.warning(f'Failed to read {key} for averaging: {e}')

        if count > 0:
            avg = (accumulator / count).astype(np.uint8)
            daily_key = f'grids/hotspot/{date_str}/daily.bin.gz'
            _upload_grid(avg, daily_key)
            logger.info(f'Daily average: {count} runs, nonzero={np.count_nonzero(avg)}')

    except Exception as e:
        logger.warning(f'Daily average computation failed: {e}')


def _update_daily_average_variant(date_str, variant):
    """Average all per-run grids for a given date into daily.bin.gz for a variant (hotspot-inshore or hotspot-offshore)."""
    prefix = f'grids/{variant}/{date_str}/'
    grid_shape = (len(OUT_LATS), len(OUT_LNGS))

    try:
        resp = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix)
        run_keys = [
            obj['Key'] for obj in resp.get('Contents', [])
            if obj['Key'].endswith('.bin.gz')
            and 'daily' not in obj['Key']
            and 'latest' not in obj['Key']
        ]

        if not run_keys:
            return

        logger.info(f'Computing daily average from {len(run_keys)} runs for {variant}/{date_str}')
        accumulator = np.zeros(grid_shape, dtype=np.float32)
        count = 0

        for key in run_keys:
            try:
                obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
                raw = gzip.decompress(obj['Body'].read())
                grid = np.frombuffer(raw, dtype=np.uint8).reshape(grid_shape)
                accumulator += grid.astype(np.float32)
                count += 1
            except Exception as e:
                logger.warning(f'Failed to read {key} for averaging: {e}')

        if count > 0:
            avg = (accumulator / count).astype(np.uint8)
            daily_key = f'grids/{variant}/{date_str}/daily.bin.gz'
            _upload_grid(avg, daily_key)
            logger.info(f'{variant} daily average: {count} runs, nonzero={np.count_nonzero(avg)}')

    except Exception as e:
        logger.warning(f'{variant} daily average computation failed: {e}')


def cleanup_old_grids(max_age_days=180):
    """Delete S3 grid folders older than max_age_days."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=max_age_days)).strftime('%Y%m%d')
    prefixes = ['grids/hotspot/', 'grids/hotspot-inshore/', 'grids/hotspot-offshore/',
                'grids/sargassum/', 'grids/sargassum-daily/']
    deleted = 0
    for prefix in prefixes:
        try:
            resp = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix, Delimiter='/')
            for cp in resp.get('CommonPrefixes', []):
                folder = cp['Prefix']
                # Extract date from folder name (e.g., 'grids/hotspot/20260101/')
                parts = folder.rstrip('/').split('/')
                date_part = parts[-1] if parts else ''
                if date_part.isdigit() and len(date_part) == 8 and date_part < cutoff:
                    # Delete all objects in this folder
                    objs = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=folder)
                    for obj in objs.get('Contents', []):
                        s3.delete_object(Bucket=S3_BUCKET, Key=obj['Key'])
                        deleted += 1
                    logger.info(f'Cleaned up {folder}')
        except Exception as e:
            logger.warning(f'Cleanup error for {prefix}: {e}')
    logger.info(f'Cleanup complete: {deleted} objects deleted (cutoff: {cutoff})')
    return deleted


def handler(event, context):
    """Lambda entry point — compute fishing hotspot scores.
    Optional event keys:
      target_date: YYYYMMDD — compute for a specific date (uses SST from that day)
      cleanup: true — delete grids older than 6 months
    """
    try:
        now = datetime.now(timezone.utc)

        # Cleanup old grids if requested or on the first run of each day (hour 0)
        if (isinstance(event, dict) and event.get('cleanup')) or now.hour == 0:
            cleanup_old_grids(max_age_days=180)

        # Allow override for backfilling historical data
        target_date = event.get('target_date') if isinstance(event, dict) else None
        if target_date and len(target_date) == 8:
            date_str = target_date
            hour_str = '12'  # Use noon for backfill runs
        else:
            date_str = now.strftime('%Y%m%d')
            hour_str = now.strftime('%H')
        logger.info(f'=== Computing fishing hotspot scores for {date_str}/{hour_str}z ===')

        # ── Fetch all data sources ──────────────────────────────────────
        logger.info('--- Fetching SST ---')
        sst = fetch_sst_grid(target_date=date_str if target_date else None)
        sst_status = f'{np.count_nonzero(~np.isnan(sst))} valid pixels' if sst is not None else 'FAILED'
        logger.info(f'SST: {sst_status}')

        logger.info('--- Fetching Chlorophyll ---')
        chl = fetch_chlorophyll_grid()
        chl_status = f'{np.count_nonzero(~np.isnan(chl))} valid pixels' if chl is not None else 'FAILED'
        logger.info(f'Chlorophyll: {chl_status}')

        logger.info('--- Computing Bathymetry gradient ---')
        bathy = compute_bathymetry_gradient()
        bathy_status = f'{np.count_nonzero(bathy > 0)} nonzero' if bathy is not None else 'FAILED'
        logger.info(f'Bathymetry gradient: {bathy_status}')

        logger.info('--- Fetching SSH ---')
        ssh = fetch_ssh_grid()
        ssh_status = f'{np.count_nonzero(~np.isnan(ssh))} valid pixels' if ssh is not None else 'FAILED'
        logger.info(f'SSH: {ssh_status}')

        # ── Compute edge/gradient scores ────────────────────────────────
        logger.info('--- Computing edge scores ---')
        sst_edge = compute_edge_score(sst, smooth_sigma=2.0)
        chl_edge = compute_edge_score(chl, smooth_sigma=1.5)
        ssh_edge = compute_edge_score(ssh, smooth_sigma=2.0)

        # Species temperature match
        species_score = compute_species_score(sst)

        # ── Composite score ─────────────────────────────────────────────
        logger.info('--- Computing composite score ---')
        shape = (len(OUT_LATS), len(OUT_LNGS))
        composite = np.zeros(shape, dtype=np.float32)
        weights_used = 0.0

        if sst_edge is not None:
            composite += sst_edge * 0.35
            weights_used += 0.35
            logger.info(f'SST edge: max={sst_edge.max():.3f}, mean={sst_edge[sst_edge > 0].mean():.3f}')

        if chl_edge is not None:
            composite += chl_edge * 0.25
            weights_used += 0.25
            logger.info(f'Chlorophyll edge: max={chl_edge.max():.3f}, mean={chl_edge[chl_edge > 0].mean():.3f}')

        if bathy is not None:
            composite += bathy * 0.18
            weights_used += 0.18
            logger.info(f'Bathymetry: max={bathy.max():.3f}, mean={bathy[bathy > 0].mean():.3f}')

        if ssh_edge is not None:
            composite += ssh_edge * 0.12
            weights_used += 0.12
            logger.info(f'SSH edge: max={ssh_edge.max():.3f}, mean={ssh_edge[ssh_edge > 0].mean():.3f}')

        if species_score is not None:
            composite += species_score * 0.10
            weights_used += 0.10
            logger.info(f'Species score: max={species_score.max():.3f}')

        # Renormalize if not all weights were used
        if weights_used > 0 and weights_used < 0.95:
            composite = composite / weights_used
            logger.info(f'Renormalized with {weights_used:.2f} total weight')

        # ── Apply co-location bonus ─────────────────────────────────────
        # When SST edge + chlorophyll edge overlap, boost score non-linearly
        if sst_edge is not None and chl_edge is not None:
            colocation = sst_edge * chl_edge  # Both strong = high product
            composite += colocation * 0.15  # Bonus for "double threat"
            logger.info(f'Co-location bonus applied: max overlap={colocation.max():.3f}')

        # Triple threat: SST edge + chlorophyll edge + bathymetry
        if sst_edge is not None and chl_edge is not None and bathy is not None:
            triple = sst_edge * chl_edge * bathy
            composite += triple * 0.20  # Big bonus for triple threat
            logger.info(f'Triple threat bonus: max={triple.max():.3f}')

        # ── Apply temporal modifiers ────────────────────────────────────
        moon = compute_moon_factor()
        tod = compute_time_factor()
        logger.info(f'Moon factor: {moon:.2f}, Time-of-day factor: {tod:.2f}')

        composite = composite * moon * tod

        # ── Final normalization to 0-1 ──────────────────────────────────
        p99 = np.percentile(composite[composite > 0], 99) if (composite > 0).any() else 1
        composite = np.clip(composite / max(p99, 0.01), 0, 1)

        # Light Gaussian smooth for visual appeal on the map
        composite = gaussian_filter(composite, sigma=1.0)

        logger.info(f'Final composite: max={composite.max():.3f}, nonzero={np.count_nonzero(composite > 0.01)}')

        # ── Split into inshore / offshore using coastline distance ─────
        logger.info('--- Computing coastline distance ---')
        coast_dist = compute_coastline_distance()

        if coast_dist is not None:
            # Zero out land pixels (distance = 0 and bathy >= 0)
            land_mask = coast_dist == 0
            composite[land_mask] = 0

            # Inshore: within 9 NM of coastline (but in water)
            inshore_mask = (coast_dist > 0) & (coast_dist <= INSHORE_LIMIT_NM)
            inshore = np.where(inshore_mask, composite, 0).astype(np.float32)

            # Re-normalize inshore independently — the narrow coastal band has
            # inflated scores from land-ocean gradients. Apply percentile normalization
            # and a sqrt (gamma) curve to spread values and reduce the "everything is extreme" effect.
            inshore_valid = inshore[inshore > 0.01]
            if len(inshore_valid) > 100:
                p95 = np.percentile(inshore_valid, 95)
                inshore_renorm = np.where(inshore > 0.01, np.clip(inshore / max(p95, 0.01), 0, 1), 0)
                # Sqrt gamma: compresses high values, expands low values
                inshore = np.where(inshore_renorm > 0, np.sqrt(inshore_renorm), 0).astype(np.float32)
                logger.info(f'Inshore re-normalized: p95={p95:.3f}, new mean={inshore[inshore > 0].mean():.3f}')

            # Offshore: beyond 9 NM from coastline
            offshore_mask = coast_dist > INSHORE_LIMIT_NM
            offshore = np.where(offshore_mask, composite, 0).astype(np.float32)

            logger.info(f'Inshore pixels: {np.count_nonzero(inshore > 0.01)}, '
                        f'Offshore pixels: {np.count_nonzero(offshore > 0.01)}')

            # Upload inshore grid
            inshore_q = quantize_score(inshore)
            _upload_grid(inshore_q, f'grids/hotspot-inshore/{date_str}/{hour_str}.bin.gz')
            _upload_grid(inshore_q, f'grids/hotspot-inshore/{date_str}/latest.bin.gz')

            # Upload offshore grid
            offshore_q = quantize_score(offshore)
            _upload_grid(offshore_q, f'grids/hotspot-offshore/{date_str}/{hour_str}.bin.gz')
            _upload_grid(offshore_q, f'grids/hotspot-offshore/{date_str}/latest.bin.gz')

            # Daily averages for inshore/offshore
            if not target_date:
                _update_daily_average_variant(date_str, 'hotspot-inshore')
                _update_daily_average_variant(date_str, 'hotspot-offshore')
            else:
                _upload_grid(inshore_q, f'grids/hotspot-inshore/{date_str}/daily.bin.gz')
                _upload_grid(offshore_q, f'grids/hotspot-offshore/{date_str}/daily.bin.gz')
        else:
            logger.warning('Coastline distance unavailable — uploading combined grid only')

        # ── Upload combined grid (per-run + latest + daily average) ─────
        key = upload_hotspot_grid(composite, date_str, hour_str, is_backfill=bool(target_date))

        # ── Build manifest with available dates ─────────────────────────
        available_dates = _list_available_dates()
        manifest = {
            'date': date_str,
            'hour': hour_str,
            'generated_at': now.isoformat(),
            'grid_key': key,
            'available_dates': available_dates,
            'moon_factor': round(moon, 3),
            'time_factor': round(tod, 3),
            'data_sources': {
                'sst': sst is not None,
                'chlorophyll': chl is not None,
                'bathymetry': bathy is not None,
                'ssh': ssh is not None,
            },
            'grid': {
                'lat_min': OUT_LAT_MIN,
                'lat_max': float(OUT_LATS[-1]),
                'lng_min': OUT_LNG_MIN,
                'lng_max': float(OUT_LNGS[-1]),
                'resolution': OUT_RES,
            },
            'stats': {
                'nonzero_pixels': int(np.count_nonzero(composite > 0.01)),
                'max_score': round(float(composite.max()), 3),
                'mean_score': round(float(composite[composite > 0.01].mean()), 3) if (composite > 0.01).any() else 0,
            },
        }
        s3.put_object(
            Bucket=S3_BUCKET,
            Key='hotspot-manifest.json',
            Body=json.dumps(manifest),
            ContentType='application/json',
            CacheControl='max-age=300',
        )

        logger.info(f'Done. Hotspot grid uploaded with {manifest["stats"]["nonzero_pixels"]} scored pixels.')

        # ── Sargassum / Weedline grid ──────────────────────────────────────
        logger.info('=== Computing Sargassum / Weedline grid ===')
        try:
            sargassum_grid = fetch_sargassum_grid()
            if sargassum_grid is not None:
                valid = ~np.isnan(sargassum_grid)
                nonzero = np.count_nonzero(valid)
                logger.info(f'Sargassum: {nonzero} valid pixels')

                # Normalize AFAI values to 0-255
                # AFAI range is typically -0.002 to 0.01+ for sargassum
                # Values below 0 = no sargassum, above 0 = sargassum
                sarg_norm = np.zeros_like(sargassum_grid, dtype=np.float32)
                sarg_norm[valid] = np.clip((sargassum_grid[valid] + 0.002) / 0.012, 0, 1)

                # Apply light smoothing
                sarg_norm = gaussian_filter(sarg_norm, sigma=0.5)

                sarg_quantized = np.zeros_like(sarg_norm, dtype=np.uint8)
                sarg_valid = sarg_norm > 0.01
                sarg_quantized[sarg_valid] = np.clip(sarg_norm[sarg_valid] * 255, 1, 255).astype(np.uint8)

                # Upload
                sarg_key = f'grids/sargassum/{date_str}/latest.bin.gz'
                _upload_grid(sarg_quantized, sarg_key)
                _upload_grid(sarg_quantized, f'grids/sargassum/{date_str}/daily.bin.gz')
                logger.info(f'Sargassum 7-day grid uploaded: {np.count_nonzero(sarg_quantized)} nonzero pixels')
            else:
                logger.warning('Sargassum 7-day data unavailable')
        except Exception as e:
            logger.warning(f'Sargassum 7-day compute failed: {e}')

        # ── Sargassum daily (single-day) grid ──────────────────────────────
        logger.info('=== Computing Sargassum Daily grid ===')
        try:
            sarg_daily = fetch_sargassum_daily_grid()
            if sarg_daily is not None:
                valid = ~np.isnan(sarg_daily)
                sarg_d_norm = np.zeros_like(sarg_daily, dtype=np.float32)
                sarg_d_norm[valid] = np.clip((sarg_daily[valid] + 0.002) / 0.012, 0, 1)
                sarg_d_norm = gaussian_filter(sarg_d_norm, sigma=0.5)

                sarg_d_q = np.zeros_like(sarg_d_norm, dtype=np.uint8)
                sarg_d_valid = sarg_d_norm > 0.01
                sarg_d_q[sarg_d_valid] = np.clip(sarg_d_norm[sarg_d_valid] * 255, 1, 255).astype(np.uint8)

                _upload_grid(sarg_d_q, f'grids/sargassum-daily/{date_str}/latest.bin.gz')
                _upload_grid(sarg_d_q, f'grids/sargassum-daily/{date_str}/daily.bin.gz')
                logger.info(f'Sargassum daily grid uploaded: {np.count_nonzero(sarg_d_q)} nonzero pixels')
            else:
                logger.warning('Sargassum daily data unavailable')
        except Exception as e:
            logger.warning(f'Sargassum daily compute failed: {e}')

        return {'statusCode': 200, 'body': json.dumps(manifest)}

    except Exception as e:
        logger.error(f'Hotspot compute failed: {e}', exc_info=True)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
