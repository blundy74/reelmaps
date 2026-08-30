/**
 * First-load camera: user's water, not East Coast / Bahamas leftovers.
 * Run: npx --yes tsx src/lib/homeViewport.test.ts
 */
import {
  GULF_HOME,
  isExplicitShareView,
  isGenericHomeView,
  spotsBoundingBox,
  spotsHomeCenter,
} from './homeViewport'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(GULF_HOME.latitude === 28 && GULF_HOME.longitude === -88, 'Gulf default')
  assert(isGenericHomeView({ latitude: 30, longitude: -80, zoom: 4 }), 'legacy East Coast is generic')
  assert(isGenericHomeView({ latitude: 28, longitude: -88, zoom: 5 }), 'Gulf default is generic')
  assert(isGenericHomeView({ latitude: 27.1837, longitude: -74.1113, zoom: 5 }), 'Bahamas leftover is generic')
  assert(!isGenericHomeView({ latitude: 29.34, longitude: -87.4, zoom: 8 }), 'Orange Beach is not generic')
  assert(!isExplicitShareView({ latitude: 30, longitude: -80, zoom: 4 }), 'default hash is not a share')
  assert(isExplicitShareView({ latitude: 25.2, longitude: -83.7, zoom: 7 }), 'real share wins')

  const spots = [
    { lat: 29.34, lng: -87.40 },
    { lat: 29.27, lng: -87.53 },
    { lat: 30.3, lng: -87.6 },
  ]
  const box = spotsBoundingBox(spots)
  assert(box != null, 'spots box')
  assert(box!.west < -87.6 && box!.east > -87.40, 'box covers spots + pad')
  const home = spotsHomeCenter(spots)
  assert(home != null, 'spots home')
  assert(home!.latitude > 29 && home!.latitude < 31, 'home lat is Orange Beach / GOM')
  assert(home!.longitude < -86 && home!.longitude > -89, 'home lng is Orange Beach')
  assert(home!.zoom >= 6, 'cluster should not stay Gulf-wide')

  console.log('homeViewport.test.ts: ok')
}

main()
