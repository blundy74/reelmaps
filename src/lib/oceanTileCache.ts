/** Tiny LRU for processed oceanography tiles (PNG bytes). */

const DEFAULT_MAX = 96

export class OceanTileCache {
  private max: number
  private map = new Map<string, Uint8Array>()

  constructor(max = DEFAULT_MAX) {
    this.max = max
  }

  get(key: string): Uint8Array | undefined {
    const hit = this.map.get(key)
    if (!hit) return undefined
    this.map.delete(key)
    this.map.set(key, hit)
    return hit
  }

  set(key: string, value: Uint8Array): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }
}
