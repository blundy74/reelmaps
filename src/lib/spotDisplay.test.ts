/**
 * Run: npx --yes tsx src/lib/spotDisplay.test.ts
 */
import { displaySpotName } from './spotDisplay'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(displaySpotName('CAPT--CARL-RAFFI') === 'CAPT CARL RAFFI', 'double hyphen')
  assert(displaySpotName('Destin Reef') === 'Destin Reef', 'plain name')
  assert(displaySpotName('A---B') === 'A B', 'triple')
  assert(displaySpotName('TACKY-JACKS--1') === 'TACKY JACKS 1', 'mixed')
  assert(displaySpotName('CITY OF ORANGE BEACH') === 'CITY OF ORANGE BEACH', 'spaces stay')
  console.log('spotDisplay.test.ts: ok')
}

main()
