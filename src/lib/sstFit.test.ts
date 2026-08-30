/**
 * Fit window must exaggerate late-August Gulf structure, not 80–88.5 red.
 * Run: npx --yes tsx src/lib/sstFit.test.ts
 */
import { spanFromTempsF } from './sstPalette'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  const gulf = Array.from({ length: 200 }, (_, i) => 86.2 + (i / 199) * 2.6)
  const span = spanFromTempsF(gulf)
  assert(span != null, 'gulf span')
  assert(span!.maxF - span!.minF <= 5.1, `fit too wide: ${span!.minF}–${span!.maxF}`)
  assert(span!.minF >= 85, `fit low end too cool: ${span!.minF}`)
  assert(span!.maxF <= 90, `fit high end too hot: ${span!.maxF}`)
  assert(span!.maxF - span!.minF >= 1.4, 'must still stretch ~1°F structure')

  const mixed = [
    ...Array.from({ length: 80 }, () => 72),
    ...Array.from({ length: 120 }, (_, i) => 86 + (i / 119) * 3),
  ]
  const mixedSpan = spanFromTempsF(mixed)
  assert(mixedSpan != null, 'mixed span')
  assert(mixedSpan!.maxF - mixedSpan!.minF <= 5.1, `mixed fit crushed: ${mixedSpan!.minF}–${mixedSpan!.maxF}`)

  console.log('sstFit.test.ts: ok')
}

main()
