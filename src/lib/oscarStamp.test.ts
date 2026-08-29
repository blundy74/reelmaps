/**
 * OSCAR age stamp — human date on the rail, never ISO in a tooltip.
 * Run: npx --yes tsx src/lib/oscarStamp.test.ts
 */
import { OSCAR_AGE_STAMP, OSCAR_GIBS_TIME, oscarAgeStamp } from './oscarCurrents'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(OSCAR_GIBS_TIME === '2024-07-17', 'do not change OSCAR_GIBS_TIME')
  assert(oscarAgeStamp() === 'OSCAR 17 Jul 2024', `got ${oscarAgeStamp()}`)
  assert(OSCAR_AGE_STAMP === 'OSCAR 17 Jul 2024', `stamp ${OSCAR_AGE_STAMP}`)
  assert(oscarAgeStamp('2024-07-17') === 'OSCAR 17 Jul 2024', 'explicit iso')
  assert(oscarAgeStamp('2024-01-07') === 'OSCAR 7 Jan 2024', 'no zero-padded day')
  assert(!OSCAR_AGE_STAMP.includes('2024-07-17'), 'no ISO dump')
  console.log('oscarStamp.test.ts: ok')
}

main()
