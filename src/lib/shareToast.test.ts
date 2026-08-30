/**
 * Run: npx --yes tsx src/lib/shareToast.test.ts
 */
import { SHARE_TOAST_MS } from './shareToast'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(SHARE_TOAST_MS >= 3000, `share toast must stay readable ~3s (${SHARE_TOAST_MS})`)
  console.log('shareToast.test.ts: ok')
}

main()
