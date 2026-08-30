/**
 * SSH look lock + ERDDAP parse.
 * Run: npx --yes tsx src/lib/sshField.test.ts
 */
import { parseErddapCsv, parseErddapSla, sshAgeStamp, SSH_GIBS_TIME } from './sshField'
import { isolineSegments, SSH_CONTOUR_LEVELS, SSH_FAT_M, SSH_INTERVAL_M } from './sshContours'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(SSH_INTERVAL_M === 0.10, '10 cm interval')
  assert(SSH_FAT_M === 0, 'fat contour is SLA 0 (FishTrack eddy wall)')
  assert(!SSH_CONTOUR_LEVELS.includes(0.17 as never) && !SSH_CONTOUR_LEVELS.includes(0.05 as never), 'no 17 cm or ±5 cm')
  assert(!SSH_CONTOUR_LEVELS.includes(-0.05 as never), 'no −5 cm')
  assert(!SSH_CONTOUR_LEVELS.includes(0 as never), '0 is fat, not in the 10 cm set')
  assert(SSH_CONTOUR_LEVELS.every((l) => Math.abs(l * 100) % 10 === 0), '10 cm only')
  assert(sshAgeStamp('2026-03-25T00:00:00Z') === 'SSH 25 Mar 2026', sshAgeStamp('2026-03-25T00:00:00Z'))
  assert(!sshAgeStamp('2026-03-25').includes('2026-03-25T'), 'no ISO dump')
  assert(SSH_GIBS_TIME === '2019-01-22', 'do not invent a later GIBS TIME')

  const w = 3
  const h = 3
  const g = new Float32Array([
    -0.05, -0.05, -0.05,
    -0.05, 0.30, -0.05,
    -0.05, -0.05, -0.05,
  ])
  const fat = isolineSegments(g, w, h, SSH_FAT_M)
  assert(fat.length > 0, '0 anomaly closes around a warm core')
  const seventeen = isolineSegments(g, w, h, 0.17)
  assert(seventeen.length >= 0, '17 cm still computable but is not a chart level')
  const five = isolineSegments(g, w, h, 0.05)
  assert(five.length >= 0, '±5 still computable but not in the chart set')

  const parsed = parseErddapSla({
    table: {
      columnNames: ['time', 'latitude', 'longitude', 'sla'],
      rows: [
        ['2026-03-25T00:00:00Z', 24.125, -91.875, 0.09],
        ['2026-03-25T00:00:00Z', 24.125, -91.625, 0.11],
        ['2026-03-25T00:00:00Z', 24.125, -91.375, 0.10],
        ['2026-03-25T00:00:00Z', 24.375, -91.875, 0.12],
        ['2026-03-25T00:00:00Z', 24.375, -91.625, 0.22],
        ['2026-03-25T00:00:00Z', 24.375, -91.375, 0.13],
        ['2026-03-25T00:00:00Z', 24.625, -91.875, 0.10],
        ['2026-03-25T00:00:00Z', 24.625, -91.625, 0.14],
        ['2026-03-25T00:00:00Z', 24.625, -91.375, 0.11],
      ],
    },
  })
  assert(parsed != null, 'parse erddap')
  assert(parsed!.source === 'erddap', 'source')
  assert(parsed!.fieldDate === '2026-03-25', parsed!.fieldDate)
  assert(parsed!.rows === 3 && parsed!.cols === 3, 'grid shape')
  assert(Math.abs(parsed!.sla[0] - 0.10) < 1e-5, 'north-up first cell')

  const csv = parseErddapCsv(
    'time,latitude,longitude,sla\nUTC,degrees_north,degrees_east,m\n'
    + '2026-03-25T00:00:00Z,24.125,-91.875,0.09\n'
    + '2026-03-25T00:00:00Z,24.125,-91.625,0.11\n'
    + '2026-03-25T00:00:00Z,24.125,-91.375,0.10\n'
    + '2026-03-25T00:00:00Z,24.375,-91.875,0.12\n'
    + '2026-03-25T00:00:00Z,24.375,-91.625,0.22\n'
    + '2026-03-25T00:00:00Z,24.375,-91.375,0.13\n'
    + '2026-03-25T00:00:00Z,24.625,-91.875,0.10\n'
    + '2026-03-25T00:00:00Z,24.625,-91.625,0.14\n'
    + '2026-03-25T00:00:00Z,24.625,-91.375,0.11\n',
  )
  assert(csv != null && csv.fieldDate === '2026-03-25', 'csv parse')

  console.log('sshField.test.ts: ok')
}

main()
