/**
 * Fishing-appropriate icons for user-imported spots.
 * Each icon is a small SVG rendered as a MapLibre symbol image.
 */

export interface SpotIconDef {
  key: string
  label: string
  color: string
  /** SVG path data (24x24 viewBox) */
  path: string
}

export const SPOT_ICONS: SpotIconDef[] = [
  {
    key: 'fish',
    label: 'Fish',
    color: '#06b6d4',
    // Simple fish silhouette
    path: 'M12 8c-3 0-6 2-8 4 2 2 5 4 8 4 1.5 0 3-.5 4-1.5l2 2.5 2-1-2-3c1-1.2 1.5-2.5 1.5-4S19 6 18 5l2-3-2-1-2 2.5C15 2.5 13.5 2 12 2 9 2 6 4 4 6l8 0c2 0 3.5 1 4 2.5-.5 1.5-2 2.5-4 2.5H8l0-3z',
  },
  {
    key: 'anchor',
    label: 'Anchor',
    color: '#3b82f6',
    path: 'M12 2a3 3 0 0 0-1 5.83V10H8v2h3v6.17A5.001 5.001 0 0 1 7 13H5a7 7 0 0 0 14 0h-2a5.001 5.001 0 0 1-4 5.17V12h3v-2h-3V7.83A3 3 0 0 0 12 2zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  },
  {
    key: 'hook',
    label: 'Hook',
    color: '#f59e0b',
    path: 'M12 2v8a4 4 0 0 1-4 4 4 4 0 0 1-4-4h2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V2h2zm4 0v2h-2V2h2zm-2 4h2v2h-2V4z',
  },
  {
    key: 'star',
    label: 'Star',
    color: '#eab308',
    path: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.27 5.82 21 7 14.14l-5-4.87 6.91-1.01L12 2z',
  },
  {
    key: 'marker',
    label: 'Pin',
    color: '#ef4444',
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
  },
  {
    key: 'buoy',
    label: 'Buoy',
    color: '#f97316',
    path: 'M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6l4 5 4-5c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 1.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  },
  {
    key: 'target',
    label: 'Target',
    color: '#10b981',
    path: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  },
  {
    key: 'flag',
    label: 'Flag',
    color: '#8b5cf6',
    path: 'M5 2v20h2v-8l3-1 4 2 6-3V3l-6 3-4-2-5 1V2H5zm2 2.5l3-.75 4 2 4-2v6.5l-4 2-4-2-3 .75V4.5z',
  },
  {
    key: 'diamond',
    label: 'Diamond',
    color: '#ec4899',
    path: 'M12 2L2 12l10 10 10-10L12 2zm0 3.41L19.59 12 12 19.59 4.41 12 12 5.41z',
  },
  {
    key: 'skull',
    label: 'Wreck',
    color: '#94a3b8',
    path: 'M12 2C8 2 5 5 5 9c0 2.5 1 4 2.5 5.5V17h2v-1h5v1h2v-2.5C18 13 19 11.5 19 9c0-4-3-7-7-7zM9.5 8a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM9 19v1c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-1H9z',
  },
]

export const DEFAULT_SPOT_ICON = 'fish'

export function getSpotIcon(key: string): SpotIconDef {
  return SPOT_ICONS.find(i => i.key === key) || SPOT_ICONS[0]
}

/**
 * Generate a data-URL PNG for a spot icon, suitable for MapLibre addImage().
 * Renders the SVG path at the given size with the icon's color.
 */
export function renderIconToImageData(
  icon: SpotIconDef,
  size = 32,
): { width: number; height: number; data: Uint8Array } {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Draw filled circle background
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2)
  ctx.fillStyle = icon.color
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Draw icon path centered and scaled
  const scale = (size - 8) / 24
  ctx.save()
  ctx.translate(4, 4)
  ctx.scale(scale, scale)
  const path2d = new Path2D(icon.path)
  ctx.fillStyle = '#ffffff'
  ctx.fill(path2d)
  ctx.restore()

  const imageData = ctx.getImageData(0, 0, size, size)
  return { width: size, height: size, data: new Uint8Array(imageData.data.buffer) }
}
