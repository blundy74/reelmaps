/**
 * Run: npx --yes tsx src/lib/uaBuild.test.ts
 */
import { UA_BUILD } from './uaBuild'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(UA_BUILD === 'UA 15', `build mark ${UA_BUILD}`)
  console.log('uaBuild.test.ts: ok')
}

main()
