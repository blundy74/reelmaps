/**
 * Run: npx --yes tsx src/lib/spotDisplay.test.ts
 */
import { displaySpotName } from './spotDisplay'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(displaySpotName('CAPT--CARL-RAFFI') === 'CAPT-CARL-RAFFI', 'double hyphen')
  assert(displaySpotName('Destin Reef') === 'Destin Reef', 'plain name')
  assert(displaySpotName('A---B') === 'A-B', 'triple')
  console.log('spotDisplay.test.ts: ok')
}

main()
