/**
 * Oceanography panel rows: arrows + SSH contours default on;
 * zonal raster + SSH fill listed, default off. No Advanced nest.
 * Run: npx --yes tsx src/lib/oceanographyLayers.test.ts
 */
import { LAYER_REGISTRY } from './layerUrls'
import { SSH_FAT_M } from './sshContours'
import { OSCAR_AGE_STAMP, OSCAR_SLACK_KT } from './oscarCurrents'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  const byId = Object.fromEntries(LAYER_REGISTRY.map((l) => [l.id, l]))
  const arrows = byId['current-arrows']
  const contours = byId['altimetry']
  const zonal = byId['currents']
  const fill = byId['ssh-anomaly']

  assert(arrows?.group === 'oceanography', 'arrows in Oceanography')
  assert(contours?.group === 'oceanography', 'SSH contours in Oceanography')
  assert(zonal?.group === 'oceanography', 'zonal raster in Oceanography')
  assert(fill?.group === 'oceanography', 'SSH fill in Oceanography')

  assert(zonal.unlisted === false, 'currents must be listed (unlisted: false)')
  assert(fill.unlisted === false, 'ssh-anomaly must be listed (unlisted: false)')
  assert(!('advanced' in zonal), 'no advanced on currents')
  assert(!('advanced' in fill), 'no advanced on ssh-anomaly')

  assert(zonal.name.includes('raster'), 'zonal name is honest (not fishing arrows)')
  assert(fill.name === 'SSH Fill', 'fill name is honest (not fat-0 contours)')
  assert(!zonal.description.toLowerCase().includes('unlisted'), 'currents copy not unlisted')
  assert(!fill.description.toLowerCase().includes('unlisted'), 'ssh-anomaly copy not unlisted')

  // Locks from prior UA work — this PR must not retouch them.
  assert(SSH_FAT_M === 0, 'fat contour stays SLA 0')
  assert(OSCAR_AGE_STAMP === 'OSCAR 17 Jul 2024', `OSCAR stamp ${OSCAR_AGE_STAMP}`)
  assert(OSCAR_SLACK_KT === 0.45, 'slack heads-only threshold unchanged')

  console.log('oceanographyLayers.test.ts: ok')
}

main()
