"""
GLM Flash Extraction Lambda — fetches latest GOES-East/West GLM data from
NOAA S3, extracts individual flash locations, returns JSON.

Called by the frontend every 20-30 seconds for animated lightning strikes.

Returns: { flashes: [{lat, lon, energy, time}], timestamp, count }
"""

import json
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone

import boto3
import numpy as np

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3', region_name='us-east-1')  # GOES buckets are in us-east-1
# GOES-18 (West) has current 2026 GLM data; GOES-16 (East) stopped at 2025
GOES_BUCKETS = ['noaa-goes18']

# How many minutes of recent flashes to return
LOOKBACK_MINUTES = int(os.environ.get('LOOKBACK_MINUTES', '10'))


def list_recent_glm_files(bucket, minutes=10):
    """List GLM LCFA files from the last N minutes."""
    now = datetime.now(timezone.utc)
    files = []

    for mins_ago in range(0, minutes + 1):
        check = now - timedelta(minutes=mins_ago)
        prefix = f"GLM-L2-LCFA/{check.year}/{check.timetuple().tm_yday:03d}/{check.hour:02d}/"

        try:
            resp = s3.list_objects_v2(
                Bucket=bucket,
                Prefix=prefix,
                MaxKeys=100,
            )
            for obj in resp.get('Contents', []):
                files.append(obj['Key'])
        except Exception as e:
            logger.warning(f'Error listing {prefix}: {e}')

    # Filter to files from the last N minutes based on filename timestamp
    cutoff = now - timedelta(minutes=minutes)
    recent = []
    for key in files:
        # Extract start time from filename: ..._sYYYYDDDHHMMSSS_...
        try:
            parts = key.split('_')
            for p in parts:
                if p.startswith('s2'):
                    year = int(p[1:5])
                    doy = int(p[5:8])
                    hour = int(p[8:10])
                    minute = int(p[10:12])
                    file_time = datetime(year, 1, 1, hour, minute, tzinfo=timezone.utc) + timedelta(days=doy - 1)
                    if file_time >= cutoff:
                        recent.append(key)
                    break
        except Exception:
            recent.append(key)  # Include if we can't parse

    return sorted(set(recent))[-30:]  # Last 30 files max (~10 min at 20s intervals)


def extract_flashes_from_netcdf(bucket, key):
    """Download a GLM NetCDF file and extract flash locations."""
    try:
        import h5netcdf.legacyapi as netCDF4
    except ImportError:
        import netCDF4

    with tempfile.NamedTemporaryFile(suffix='.nc', delete=False) as f:
        s3.download_file(bucket, key, f.name)
        tmp_path = f.name

    flashes = []
    try:
        ds = netCDF4.Dataset(tmp_path, 'r')

        if 'flash_lat' in ds.variables and 'flash_lon' in ds.variables:
            lats = ds.variables['flash_lat'][:]
            lons = ds.variables['flash_lon'][:]

            energies = None
            if 'flash_energy' in ds.variables:
                energies = ds.variables['flash_energy'][:]

            for i in range(len(lats)):
                lat = float(lats[i])
                lon = float(lons[i])
                # Filter to roughly CONUS + Gulf + Caribbean
                if -130 <= lon <= -60 and 15 <= lat <= 55:
                    flash = {'lat': round(lat, 4), 'lon': round(lon, 4)}
                    if energies is not None:
                        flash['energy'] = float(energies[i])
                    flashes.append(flash)

        ds.close()
    except Exception as e:
        logger.warning(f'Error reading {key}: {e}')
    finally:
        os.unlink(tmp_path)

    return flashes


def handler(event, context):
    """Lambda entry point — returns recent flash locations as JSON."""
    try:
        all_flashes = []

        # Get flashes from available GOES satellites
        for bucket in GOES_BUCKETS:
            files = list_recent_glm_files(bucket, LOOKBACK_MINUTES)
            logger.info(f'{bucket}: found {len(files)} recent files')

            for key in files:
                flashes = extract_flashes_from_netcdf(bucket, key)
                all_flashes.extend(flashes)

        # Deduplicate nearby flashes (within ~0.01 deg / ~1km)
        seen = set()
        unique = []
        for f in all_flashes:
            key = (round(f['lat'], 2), round(f['lon'], 2))
            if key not in seen:
                seen.add(key)
                unique.append(f)

        logger.info(f'Returning {len(unique)} unique flashes')

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=15',
            },
            'body': json.dumps({
                'flashes': unique,
                'count': len(unique),
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'lookback_minutes': LOOKBACK_MINUTES,
            }),
        }

    except Exception as e:
        logger.error(f'GLM extraction failed: {e}', exc_info=True)
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
        }
