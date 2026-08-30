/**
 * Missing model fields must never render as 0°F / 0.0 kt.
 * Run: npx --yes tsx src/lib/marineDisplay.test.ts
 */
import {
  MISSING_DISPLAY,
  formatModelCurrentKt,
  formatModelFeet,
  formatModelTempF,
  isUnavailableZero,
} from './marineDisplay'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(formatModelTempF(0) === MISSING_DISPLAY, '0°F is missing, not zero')
  assert(formatModelTempF(null) === MISSING_DISPLAY, 'null temp')
  assert(formatModelTempF(undefined) === MISSING_DISPLAY, 'undefined temp')
  assert(formatModelTempF(83) === '83°F', 'real temp')
  assert(formatModelCurrentKt(0) === MISSING_DISPLAY, '0.0 kt is missing')
  assert(formatModelCurrentKt(1.4) === '1.4 kt', 'real current')
  assert(formatModelFeet(0) === MISSING_DISPLAY, '0.0 ft swell is missing')
  assert(formatModelFeet(1.3) === '1.3 ft', 'real waves')
  assert(isUnavailableZero(0), 'zero unavailable')
  assert(!isUnavailableZero(0.2), 'small real value stays')

  console.log('marineDisplay.test.ts: ok')
}

main()
