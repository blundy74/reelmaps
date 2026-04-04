/**
 * User spots store — manages imported fishing spots from CSV/GPX/FIT files.
 * Separate from the hardcoded curated spots + oil rigs.
 */

import { create } from 'zustand'
import type { SavedSpot, ImportBatch } from '../lib/apiClient'
import { getSpots, saveSpot, importSpots, getImportBatches, deleteImportBatch, deleteSpot, updateSpot as apiUpdateSpot } from '../lib/apiClient'
import type { ParsedSpot, FileType } from '../lib/fileParser'

interface UserSpotsState {
  spots: SavedSpot[]
  batches: ImportBatch[]
  loading: boolean
  error: string | null

  fetchSpots: () => Promise<void>
  fetchBatches: () => Promise<void>
  addSpot: (name: string, lat: number, lng: number, icon?: string, depthFt?: number) => Promise<SavedSpot | null>
  importFile: (filename: string, fileType: FileType, spots: ParsedSpot[], icon?: string) => Promise<{ batchId: string; importedCount: number } | null>
  deleteBatch: (batchId: string) => Promise<void>
  removeSpot: (id: string) => Promise<void>
  updateSpot: (id: string, updates: Partial<Pick<SavedSpot, 'name' | 'icon' | 'notes' | 'spotType'>>) => Promise<void>
}

export const useUserSpotsStore = create<UserSpotsState>()((set, get) => ({
  spots: [],
  batches: [],
  loading: false,
  error: null,

  fetchSpots: async () => {
    try {
      const spots = await getSpots()
      set({ spots })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  fetchBatches: async () => {
    try {
      const batches = await getImportBatches()
      set({ batches })
    } catch { /* ignore */ }
  },

  addSpot: async (name, lat, lng, icon, depthFt) => {
    try {
      const spot = await saveSpot({ name, lat, lng, icon: icon || 'flag', depthFt })
      set({ spots: [spot, ...get().spots] })
      return spot
    } catch (err: any) {
      set({ error: err.message })
      return null
    }
  },

  importFile: async (filename, fileType, parsedSpots, icon) => {
    set({ loading: true, error: null })
    try {
      const result = await importSpots(filename, fileType, parsedSpots, icon)
      // Refresh spots and batches after import
      await Promise.all([get().fetchSpots(), get().fetchBatches()])
      set({ loading: false })
      return result
    } catch (err: any) {
      set({ loading: false, error: err.message })
      return null
    }
  },

  deleteBatch: async (batchId) => {
    set({ loading: true, error: null })
    try {
      await deleteImportBatch(batchId)
      await Promise.all([get().fetchSpots(), get().fetchBatches()])
      set({ loading: false })
    } catch (err: any) {
      set({ loading: false, error: err.message })
    }
  },

  removeSpot: async (id) => {
    try {
      await deleteSpot(id)
      set({ spots: get().spots.filter(s => s.id !== id) })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  updateSpot: async (id, updates) => {
    await apiUpdateSpot(id, updates)
    set({ spots: get().spots.map(s => s.id === id ? { ...s, ...updates } : s) })
  },
}))

/** Convert user spots to GeoJSON for MapLibre */
export function userSpotsToGeoJSON(spots: SavedSpot[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: spots.map(s => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        name: s.name,
        depthFt: s.depthFt,
        spotType: s.spotType,
        species: s.species,
        notes: s.notes,
        icon: s.icon || 'fish',
      },
    })),
  }
}
