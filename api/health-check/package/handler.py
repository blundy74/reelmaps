"""
Health Check Lambda — tests all ReelMaps endpoints and data sources.
Runs every 6 hours, stores results in S3 for the admin dashboard.
"""

import json
import time
import logging
import os
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

import boto3
import requests

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
S3_BUCKET = os.environ.get('HRRR_BUCKET', 'fishypro-hrrr')
API_BASE = os.environ.get('API_BASE', 'https://vdfjbl2ku2.execute-api.us-east-2.amazonaws.com')
TILE_BASE = os.environ.get('TILE_BASE', 'https://xhac6pdww5.execute-api.us-east-2.amazonaws.com')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://reelmaps.ai')
TIMEOUT = 10


def check(name, url, method='GET', expected_status=200, body=None, min_size=0, headers=None):
    """Run a single health check."""
    start = time.time()
    try:
        if method == 'POST':
            r = requests.post(url, json=body, headers=headers or {}, timeout=TIMEOUT)
        else:
            r = requests.get(url, headers=headers or {}, timeout=TIMEOUT)

        elapsed = int((time.time() - start) * 1000)
        status_ok = r.status_code == expected_status
        size_ok = len(r.content) >= min_size if min_size > 0 else True

        if status_ok and size_ok:
            if elapsed > 5000:
                return {'name': name, 'status': 'warn', 'responseTime': elapsed,
                        'details': f'{r.status_code} OK but slow ({elapsed}ms)'}
            return {'name': name, 'status': 'pass', 'responseTime': elapsed,
                    'details': f'{r.status_code} OK, {len(r.content)} bytes'}
        elif status_ok and not size_ok:
            return {'name': name, 'status': 'warn', 'responseTime': elapsed,
                    'details': f'{r.status_code} OK but only {len(r.content)} bytes (expected >={min_size})'}
        else:
            return {'name': name, 'status': 'fail', 'responseTime': elapsed,
                    'details': f'HTTP {r.status_code} (expected {expected_status})'}

    except requests.exceptions.Timeout:
        elapsed = int((time.time() - start) * 1000)
        return {'name': name, 'status': 'fail', 'responseTime': elapsed,
                'details': f'Timeout after {TIMEOUT}s'}
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        return {'name': name, 'status': 'fail', 'responseTime': elapsed,
                'details': str(e)[:200]}


def run_all_checks():
    """Run all health checks in parallel."""
    today = datetime.now(timezone.utc).strftime('%Y%m%d')
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y%m%d')

    checks = [
        # ── API Endpoints ──────────────────────────────────────────────
        ('API: EULA', f'{API_BASE}/api/eula/current', 'GET', 200, None, 100),
        ('API: Auth (reject bad creds)', f'{API_BASE}/api/admin/login', 'POST', 401,
         {'email': 'healthcheck@test.com', 'password': 'bad'}, 0),

        # ── Tile Endpoints (try today, handler falls back to yesterday) ──
        ('Tile: Hotspot', f'{TILE_BASE}/tiles/hotspot/{today}/5/8/13.png', 'GET', 200, None, 500),
        ('Tile: Hotspot Inshore', f'{TILE_BASE}/tiles/hotspot-inshore/{today}/5/8/13.png', 'GET', 200, None, 100),
        ('Tile: Hotspot Offshore', f'{TILE_BASE}/tiles/hotspot-offshore/{today}/5/8/13.png', 'GET', 200, None, 500),
        ('Tile: Sargassum 7-day', f'{TILE_BASE}/tiles/sargassum/{today}/5/8/13.png', 'GET', 200, None, 500),
        ('Tile: Sargassum Daily', f'{TILE_BASE}/tiles/sargassum-daily/{today}/5/8/13.png', 'GET', 200, None, 500),
        ('Tile: HRRR Manifest', f'{TILE_BASE}/tiles/hrrr/latest.json', 'GET', 200, None, 50),
        ('Tile: Depth Lookup', f'{TILE_BASE}/tiles/depth?lat=29.5&lng=-88.1', 'GET', 200, None, 10),

        # ── External Data Sources ──────────────────────────────────────
        ('ERDDAP: CoastWatch SST', 'https://coastwatch.pfeg.noaa.gov/erddap/info/jplMURSST41/index.json', 'GET', 200, None, 100),
        ('ERDDAP: Upwell SST', 'https://upwell.pfeg.noaa.gov/erddap/info/jplMURSST41/index.json', 'GET', 200, None, 100),
        ('ERDDAP: AOML AFAI', 'https://cwcgom.aoml.noaa.gov/erddap/info/noaa_aoml_atlantic_oceanwatch_AFAI_7D/index.json', 'GET', 200, None, 100),
        ('Open-Meteo Marine', 'https://marine-api.open-meteo.com/v1/marine?latitude=28&longitude=-88&current=wave_height', 'GET', 200, None, 50),
        ('NASA GIBS WMS', 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetCapabilities', 'GET', 200, None, 1000),

        # ── Frontend ──────────────────────────────────────────────────
        ('Frontend: Homepage', f'{FRONTEND_URL}/', 'GET', 200, None, 500),
    ]

    results = []

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {}
        for args in checks:
            name, url, method, expected, body, min_sz = args
            f = executor.submit(check, name, url, method, expected, body, min_sz)
            futures[f] = name

        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            logger.info(f'{result["status"].upper()}: {result["name"]} ({result["responseTime"]}ms) — {result["details"]}')

    # If today's tiles failed, try yesterday as fallback
    tile_failures = [r for r in results if r['name'].startswith('Tile:') and r['status'] == 'fail' and today in r.get('details', '')]
    if tile_failures:
        for r in tile_failures:
            fallback_url = r.get('details', '').replace(today, yesterday) if today in r.get('details', '') else None
            if fallback_url:
                # Just note it — don't re-run, the original URL was the test
                r['details'] += f' (today tiles may not be generated yet)'
                r['status'] = 'warn'

    # Sort by status: fail first, then warn, then pass
    order = {'fail': 0, 'warn': 1, 'pass': 2}
    results.sort(key=lambda r: (order.get(r['status'], 3), r['name']))

    return results


def handler(event, context):
    """Lambda entry point."""
    try:
        now = datetime.now(timezone.utc)
        logger.info(f'=== Running health checks at {now.isoformat()} ===')

        results = run_all_checks()

        passed = sum(1 for r in results if r['status'] == 'pass')
        warned = sum(1 for r in results if r['status'] == 'warn')
        failed = sum(1 for r in results if r['status'] == 'fail')
        total = len(results)

        overall = 'pass' if failed == 0 and warned == 0 else 'warn' if failed == 0 else 'fail'

        report = {
            'timestamp': now.isoformat(),
            'overall': overall,
            'summary': {'total': total, 'passed': passed, 'warned': warned, 'failed': failed},
            'tests': results,
        }

        report_json = json.dumps(report)

        # Upload latest
        s3.put_object(
            Bucket=S3_BUCKET, Key='health/latest.json',
            Body=report_json, ContentType='application/json',
            CacheControl='no-cache',
        )

        # Upload historical copy
        hist_key = f'health/history/{now.strftime("%Y-%m-%d")}/{now.strftime("%H-%M-%S")}.json'
        s3.put_object(
            Bucket=S3_BUCKET, Key=hist_key,
            Body=report_json, ContentType='application/json',
        )

        logger.info(f'Health check complete: {overall.upper()} — {passed}/{total} passed, {warned} warned, {failed} failed')
        return {'statusCode': 200, 'body': report_json}

    except Exception as e:
        logger.error(f'Health check failed: {e}', exc_info=True)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
