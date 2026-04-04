"""
HRRR Decode Lambda — fetches HRRR weather forecast variables from NOAA,
reprojects to lat/lon, quantizes to uint8, stores in S3.

Processes multiple variables: precipitation, wind speed, gusts, visibility.
Uses cfgrib/xarray for reliable GRIB2 decoding, scipy for reprojection.
"""

import json
import gzip
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone

import boto3
import numpy as np
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

S3_BUCKET = os.environ.get('HRRR_BUCKET', 'reelmaps-hrrr')
FORECAST_HOURS = 19  # fh00-fh18
NOAA_BASE = 'https://noaa-hrrr-bdp-pds.s3.amazonaws.com'

# Output grid
OUT_LAT_MIN, OUT_LAT_MAX = 20.0, 55.0
OUT_LNG_MIN, OUT_LNG_MAX = -130.0, -60.0
OUT_RES = 0.035  # ~3.9km — close to HRRR native 3km, fits in Lambda timeout
OUT_LATS = np.arange(OUT_LAT_MIN, OUT_LAT_MAX, OUT_RES)
OUT_LNGS = np.arange(OUT_LNG_MIN, OUT_LNG_MAX, OUT_RES)

s3 = boto3.client('s3')

# ── Variable definitions ─────────────────────────────────────────────────────

VARIABLES = {
    'precip': {
        'idx_match': 'APCP',
        'idx_fallback': 'PRATE',
        'quantize': lambda v: _quantize_log(v, threshold=0.25, log_base=76),
    },
    'wind': {
        # Wind needs both UGRD and VGRD — handled specially
        'idx_match': 'UGRD:10 m above ground',
        'idx_match_v': 'VGRD:10 m above ground',
        'quantize': lambda v: _quantize_linear(v, vmin=0, vmax=40),  # m/s, 0-40 → 0-255
    },
    'gust': {
        'idx_match': 'GUST:surface',
        'quantize': lambda v: _quantize_linear(v, vmin=0, vmax=50),  # m/s, 0-50 → 0-255
    },
    'vis': {
        'idx_match': 'VIS:surface',
        'quantize': lambda v: _quantize_vis(v),
    },
    'lightning': {
        'idx_match': 'LTNG:entire atmosphere',
        'quantize': lambda v: _quantize_linear(v, vmin=0, vmax=1),  # 0-1 probability → 0-255
    },
    'cloud': {
        'idx_match': 'TCDC:entire atmosphere',
        'quantize': lambda v: _quantize_linear(v, vmin=0, vmax=100),  # 0-100% → 0-255
    },
}


def _quantize_log(values, threshold=0.25, log_base=76):
    """Logarithmic quantization (for precipitation)."""
    result = np.zeros_like(values, dtype=np.uint8)
    mask = values > threshold
    vals = np.clip(np.log(1 + values[mask]) / np.log(log_base) * 255, 1, 255)
    result[mask] = vals.astype(np.uint8)
    return result


def _quantize_linear(values, vmin=0, vmax=40):
    """Linear quantization: vmin→0, vmax→255."""
    clamped = np.clip(values, vmin, vmax)
    scaled = ((clamped - vmin) / (vmax - vmin) * 255).astype(np.uint8)
    return scaled


def _quantize_vis(values):
    """Visibility quantization: inverted (low vis = high value for strong color).
    Input in meters. 0m → 255, 16000m+ → 0 (transparent)."""
    # Convert to miles for thresholding
    vis_mi = values / 1609.34
    result = np.zeros_like(values, dtype=np.uint8)
    # Only show visibility below 10 miles
    mask = vis_mi < 10
    # Invert: 0 mi → 255, 10 mi → 0
    result[mask] = np.clip(255 - (vis_mi[mask] / 10 * 255), 1, 255).astype(np.uint8)
    return result


# ── Core functions ────────────────────────────────────────────────────────────

def find_latest_run():
    """Find a HRRR run 8-14 hours old so fh00 covers 8h in the past."""
    now = datetime.now(timezone.utc)
    for hours_ago in range(8, 15):
        check = now - timedelta(hours=hours_ago)
        date_str = check.strftime('%Y%m%d')
        hour_str = check.strftime('%H')
        url = f'{NOAA_BASE}/hrrr.{date_str}/conus/hrrr.t{hour_str}z.wrfsfcf00.grib2.idx'
        try:
            r = requests.head(url, timeout=5)
            if r.status_code == 200:
                logger.info(f'Found HRRR run: {date_str}/{hour_str} ({hours_ago}h old)')
                return date_str, hour_str
        except Exception:
            continue
    raise RuntimeError('No HRRR run found')


def parse_idx(idx_text, variable):
    """Parse .idx file to find byte range for a variable."""
    lines = [l for l in idx_text.strip().split('\n') if l.strip()]
    for i, line in enumerate(lines):
        parts = line.split(':')
        if len(parts) >= 4 and variable in line:
            start = int(parts[1])
            end = int(lines[i + 1].split(':')[1]) - 1 if i + 1 < len(lines) else None
            return start, end
    return None, None


def download_grib_field(date_str, hour_str, fh, idx_match):
    """Download a single field from HRRR via byte-range."""
    fh_str = f'{fh:02d}'
    base_key = f'hrrr.{date_str}/conus/hrrr.t{hour_str}z.wrfsfcf{fh_str}.grib2'

    idx_url = f'{NOAA_BASE}/{base_key}.idx'
    try:
        r = requests.get(idx_url, timeout=10)
        r.raise_for_status()
    except Exception as e:
        logger.warning(f'Could not get idx for fh{fh_str}: {e}')
        return None

    start, end = parse_idx(r.text, idx_match)
    if start is None:
        logger.warning(f'Variable {idx_match} not found in fh{fh_str}')
        return None

    data_url = f'{NOAA_BASE}/{base_key}'
    range_hdr = f'bytes={start}-{end}' if end else f'bytes={start}-'
    try:
        r = requests.get(data_url, headers={'Range': range_hdr}, timeout=30)
        return r.content
    except Exception as e:
        logger.warning(f'Download failed: {e}')
        return None


def decode_and_reproject(grib_bytes):
    """Decode GRIB2 with cfgrib and reproject to regular lat/lon grid."""
    import xarray as xr
    from scipy.interpolate import griddata

    with tempfile.NamedTemporaryFile(suffix='.grib2', delete=False) as f:
        f.write(grib_bytes)
        tmp_path = f.name

    try:
        ds = xr.open_dataset(tmp_path, engine='cfgrib')
        var_name = list(ds.data_vars)[0]
        data = ds[var_name].values
        lats = ds.coords['latitude'].values
        lngs = ds.coords['longitude'].values

        if np.any(lngs > 180):
            lngs = np.where(lngs > 180, lngs - 360, lngs)

        # Handle both 2D native grids (HRRR) and regular lat/lon grids (GFS-Wave)
        if lats.ndim == 1 and lngs.ndim == 1 and data.ndim == 2:
            # Regular grid — meshgrid coords to match 2D data
            lats, lngs = np.meshgrid(lats, lngs, indexing='ij')

        src_points = np.column_stack([lats.ravel(), lngs.ravel()])
        src_values = data.ravel().astype(np.float32)
        valid = ~np.isnan(src_values)
        # Also clip to output domain + margin to avoid slow global griddata
        margin = 2.0
        in_domain = (
            valid &
            (src_points[:, 0] >= OUT_LAT_MIN - margin) &
            (src_points[:, 0] <= OUT_LAT_MAX + margin) &
            (src_points[:, 1] >= OUT_LNG_MIN - margin) &
            (src_points[:, 1] <= OUT_LNG_MAX + margin)
        )
        src_points = src_points[in_domain]
        src_values = src_values[in_domain]

        out_lat_grid, out_lng_grid = np.meshgrid(OUT_LATS, OUT_LNGS, indexing='ij')
        out_points = np.column_stack([out_lat_grid.ravel(), out_lng_grid.ravel()])

        out_values = griddata(src_points, src_values, out_points, method='nearest', fill_value=0)
        return out_values.reshape(out_lat_grid.shape).astype(np.float32)

    finally:
        os.unlink(tmp_path)


def upload_grid(quantized, var_name, date_str, hour_str, fh):
    """Compress and upload a quantized grid to S3."""
    fh_str = f'{fh:02d}'
    compressed = gzip.compress(quantized.tobytes())
    key = f'grids/{var_name}/{date_str}/{hour_str}/fh{fh_str}.bin.gz'

    s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=compressed,
        ContentType='application/octet-stream',
        ContentEncoding='gzip',
        Metadata={
            'lat_min': str(OUT_LAT_MIN),
            'lat_max': str(float(OUT_LATS[-1])),
            'lng_min': str(OUT_LNG_MIN),
            'lng_max': str(float(OUT_LNGS[-1])),
            'lat_count': str(len(OUT_LATS)),
            'lng_count': str(len(OUT_LNGS)),
            'lat_res': str(OUT_RES),
            'lng_res': str(OUT_RES),
        },
    )
    logger.info(f'Uploaded {key} ({len(compressed)} bytes, {np.count_nonzero(quantized)} nonzero)')


def process_variable(var_name, var_def, date_str, hour_str):
    """Process all forecast hours for a single variable.

    For precipitation (APCP): HRRR stores CUMULATIVE accumulation from run start.
    fh06 = total precip from fh00 to fh06. We need the HOURLY increment:
    hourly_precip[fh] = cumulative[fh] - cumulative[fh-1]
    """
    available = []
    prev_raw_grid = None  # Track previous hour's raw grid for precip differencing

    for fh in range(FORECAST_HOURS):
        fh_str = f'{fh:02d}'
        try:
            if var_name == 'wind':
                # Wind needs both u and v components → compute magnitude
                u_bytes = download_grib_field(date_str, hour_str, fh, var_def['idx_match'])
                v_bytes = download_grib_field(date_str, hour_str, fh, var_def['idx_match_v'])
                if u_bytes is None or v_bytes is None:
                    continue
                u_grid = decode_and_reproject(u_bytes)
                v_grid = decode_and_reproject(v_bytes)
                grid = np.sqrt(u_grid ** 2 + v_grid ** 2)
            else:
                grib_bytes = download_grib_field(date_str, hour_str, fh, var_def['idx_match'])
                if grib_bytes is None:
                    fallback = var_def.get('idx_fallback')
                    if fallback:
                        grib_bytes = download_grib_field(date_str, hour_str, fh, fallback)
                    if grib_bytes is None:
                        continue
                grid = decode_and_reproject(grib_bytes)

            # For precipitation: convert cumulative → hourly by subtracting previous hour
            if var_name == 'precip':
                raw_cumulative = grid.copy()
                if prev_raw_grid is not None:
                    grid = np.maximum(grid - prev_raw_grid, 0)  # hourly increment (never negative)
                # fh00 has no previous hour — it's already the first hour's accumulation
                prev_raw_grid = raw_cumulative
                logger.info(f'Precip fh{fh_str}: cumulative max={raw_cumulative.max():.2f}, hourly max={grid.max():.2f}')

            quantized = var_def['quantize'](grid)
            upload_grid(quantized, var_name, date_str, hour_str, fh)
            available.append(fh)

        except Exception as e:
            logger.error(f'Failed {var_name} fh{fh_str}: {e}', exc_info=True)

    return available


def process_gfs_wave(hrrr_date_str):
    """Process GFS-Wave significant wave height (HTSGW) for Atlantic + Pacific.

    GFS-Wave runs 4x daily (00z/06z/12z/18z) on s3://noaa-gfs-bdp-pds/.
    We use the global 0.16-degree grid which covers both oceans.
    """
    GFS_BASE = 'https://noaa-gfs-bdp-pds.s3.amazonaws.com'
    WAVE_FORECAST_HOURS = 19  # Match HRRR's 0-18h

    # Find latest GFS-Wave run (runs at 00/06/12/18z, ~4-6h latency)
    now = datetime.now(timezone.utc)
    wave_date = None
    wave_hour = None
    for hours_ago in range(6, 18):
        check = now - timedelta(hours=hours_ago)
        d = check.strftime('%Y%m%d')
        # GFS runs at 00/06/12/18 — find the nearest
        h = str((check.hour // 6) * 6).zfill(2)
        url = f'{GFS_BASE}/gfs.{d}/{h}/wave/gridded/gfswave.t{h}z.global.0p16.f000.grib2.idx'
        try:
            r = requests.head(url, timeout=5)
            if r.status_code == 200:
                wave_date = d
                wave_hour = h
                logger.info(f'Found GFS-Wave run: {d}/{h}')
                break
        except Exception:
            continue

    if not wave_date:
        logger.warning('No GFS-Wave run found')
        return []

    available = []
    for step in range(WAVE_FORECAST_HOURS):
        # GFS-Wave uses 3-hourly steps: f000, f003, f006, ...
        gfs_fh = step * 3  # actual hours ahead from run start
        if gfs_fh > 54:
            continue  # GFS-Wave goes to ~180h but we only need 54h max
        gfs_fh_str = f'{gfs_fh:03d}'

        base_key = f'gfs.{wave_date}/{wave_hour}/wave/gridded/gfswave.t{wave_hour}z.global.0p16.f{gfs_fh_str}.grib2'

        try:
            # Get idx and find HTSGW
            idx_url = f'{GFS_BASE}/{base_key}.idx'
            r = requests.get(idx_url, timeout=10)
            if r.status_code != 200:
                continue

            start, end = parse_idx(r.text, 'HTSGW:surface')
            if start is None:
                continue

            # Download wave height field
            data_url = f'{GFS_BASE}/{base_key}'
            range_hdr = f'bytes={start}-{end}' if end else f'bytes={start}-'
            r = requests.get(data_url, headers={'Range': range_hdr}, timeout=30)
            if r.status_code not in (200, 206):
                continue

            grid = decode_and_reproject(r.content)

            # Quantize: 0-10m wave height → 0-255
            # More aggressive for fishing: 1ft(0.3m)→25, 5ft(1.5m)→128, 10ft(3m)→255
            quantized = np.zeros_like(grid, dtype=np.uint8)
            mask = grid > 0.1  # ignore < 0.1m (~0.3ft)
            vals = np.clip(grid[mask] / 5.0 * 255, 1, 255)  # 0-5m maps to 0-255
            quantized[mask] = vals.astype(np.uint8)

            upload_grid(quantized, 'waves', wave_date, wave_hour, gfs_fh)
            available.append(gfs_fh)
            logger.info(f'Wave fh{gfs_fh:02d} (gfs f{gfs_fh_str}): max={grid.max():.2f}m, nonzero={np.count_nonzero(quantized)}')

        except Exception as e:
            logger.error(f'Failed wave fh{gfs_fh}: {e}', exc_info=True)

    # Write wave-specific manifest info
    if available:
        wave_manifest = {
            'run_date': wave_date,
            'run_hour': wave_hour,
            'forecast_hours': available,
            'source': 'gfs-wave-global-0p16',
        }
        s3.put_object(
            Bucket=S3_BUCKET,
            Key='wave-manifest.json',
            Body=json.dumps(wave_manifest),
            ContentType='application/json',
            CacheControl='max-age=300',
        )

    return available


def handler(event, context):
    """Lambda entry point — processes all variables for the latest HRRR run."""
    try:
        date_str, hour_str = find_latest_run()
        logger.info(f'Processing HRRR run {date_str}/{hour_str}')

        # Also maintain backward-compatible precip grids at the old path
        results = {}
        for var_name, var_def in VARIABLES.items():
            logger.info(f'=== Processing variable: {var_name} ===')
            available = process_variable(var_name, var_def, date_str, hour_str)
            results[var_name] = available
            logger.info(f'{var_name}: {len(available)} hours processed')

        # Also write precip grids at the legacy path (grids/{date}/{hour}/fh{FH}.bin.gz)
        # so existing tile Lambda still works
        precip_hours = results.get('precip', [])
        for fh in precip_hours:
            fh_str = f'{fh:02d}'
            src_key = f'grids/precip/{date_str}/{hour_str}/fh{fh_str}.bin.gz'
            dst_key = f'grids/{date_str}/{hour_str}/fh{fh_str}.bin.gz'
            try:
                s3.copy_object(
                    Bucket=S3_BUCKET,
                    CopySource=f'{S3_BUCKET}/{src_key}',
                    Key=dst_key,
                    MetadataDirective='COPY',
                )
            except Exception:
                pass

        # Write manifest with all variables
        manifest = {
            'run_date': date_str,
            'run_hour': hour_str,
            'variables': {name: hours for name, hours in results.items()},
            'forecast_hours': precip_hours,  # backward compat
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'grid': {
                'lat_min': OUT_LAT_MIN,
                'lat_max': float(OUT_LATS[-1]),
                'lng_min': OUT_LNG_MIN,
                'lng_max': float(OUT_LNGS[-1]),
                'resolution': OUT_RES,
            },
        }

        s3.put_object(
            Bucket=S3_BUCKET,
            Key='latest.json',
            Body=json.dumps(manifest),
            ContentType='application/json',
            CacheControl='max-age=300',
        )

        # ── GFS-Wave: significant wave height (Atlantic + Pacific + Gulf) ──
        # GFS-Wave runs on a different bucket/schedule than HRRR
        logger.info('=== Processing GFS-Wave (HTSGW) ===')
        wave_hours = process_gfs_wave(date_str)
        if wave_hours:
            results['waves'] = wave_hours
            logger.info(f'waves: {len(wave_hours)} hours processed')

        # Re-write manifest to include wave data
        # Wave grids use different run_date/run_hour so include wave_run field
        wave_manifest_data = None
        try:
            wm_resp = s3.get_object(Bucket=S3_BUCKET, Key='wave-manifest.json')
            wave_manifest_data = json.loads(wm_resp['Body'].read())
        except Exception:
            pass

        manifest['variables'] = {name: hours for name, hours in results.items()}
        if wave_manifest_data:
            manifest['wave_run'] = {
                'run_date': wave_manifest_data['run_date'],
                'run_hour': wave_manifest_data['run_hour'],
            }
        s3.put_object(
            Bucket=S3_BUCKET,
            Key='latest.json',
            Body=json.dumps(manifest),
            ContentType='application/json',
            CacheControl='max-age=300',
        )

        total = sum(len(h) for h in results.values())
        logger.info(f'Done. {total} total grids across {len(results)} variables.')
        return {'statusCode': 200, 'body': json.dumps({
            'run': f'{date_str}/{hour_str}',
            'variables': {k: len(v) for k, v in results.items()},
        })}

    except Exception as e:
        logger.error(f'HRRR decode failed: {e}', exc_info=True)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
