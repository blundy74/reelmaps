/**
 * Imagery chips are exclusive.
 * Run: npx --yes tsx src/lib/imageryLayers.test.ts
 */
import { IMAGERY_LAYER_IDS, applyExclusiveImagery } from './imageryLayers'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  const layers = IMAGERY_LAYER_IDS.map((id) => ({
    id,
    visible: id === 'sst-mur',
  }))

  const daily = applyExclusiveImagery(layers, 'sst-goes')
  assert(daily.find((l) => l.id === 'sst-goes')?.visible === true, 'Daily on')
  assert(daily.find((l) => l.id === 'sst-mur')?.visible === false, 'Analysis off')
  assert(daily.filter((l) => l.visible).length === 1, 'only one imagery layer')

  const off = applyExclusiveImagery(daily, 'sst-goes')
  assert(off.every((l) => !l.visible), 'clicking the active chip turns it off')

  const other = applyExclusiveImagery(layers, 'current-arrows')
  assert(other === layers, 'non-imagery ids are ignored')

  console.log('imageryLayers.test.ts: ok')
}

main()
