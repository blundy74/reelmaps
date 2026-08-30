/**
 * Right-rail IMAGERY chips — exclusive radio group.
 * Left-rail toggles for the same ids stay in sync.
 */
export const IMAGERY_LAYER_IDS = [
  'sst-mur',
  'sst-goes',
  'chlorophyll',
  'true-color-viirs',
  'sargassum',
] as const

export type ImageryLayerId = (typeof IMAGERY_LAYER_IDS)[number]

export function isImageryLayerId(id: string): id is ImageryLayerId {
  return (IMAGERY_LAYER_IDS as readonly string[]).includes(id)
}

/** Apply a radio-group click: turning one on turns the others off. */
export function applyExclusiveImagery<T extends { id: string; visible: boolean }>(
  layers: T[],
  clickedId: string,
): T[] {
  if (!isImageryLayerId(clickedId)) return layers
  const current = layers.find((l) => l.id === clickedId)
  const turningOn = !current?.visible
  return layers.map((l) => {
    if (!isImageryLayerId(l.id)) return l
    if (l.id === clickedId) return { ...l, visible: turningOn }
    return turningOn ? { ...l, visible: false } : l
  })
}
