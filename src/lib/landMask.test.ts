/**
 * Run: npx --yes tsx src/lib/landMask.test.ts
 */
import { parseWmsBbox3857 } from './landMask'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  const parsed = parseWmsBbox3857('https://example.com/wms?BBOX=-9750000,3500000,-9740000,3510000')
  assert(parsed != null && parsed.xmin === -9750000 && parsed.ymax === 3510000, 'bbox')
  assert(parseWmsBbox3857('https://example.com/wms?BBOX={bbox-epsg-3857}') == null, 'placeholder')
  console.log('landMask.test.ts: ok')
}

main()
