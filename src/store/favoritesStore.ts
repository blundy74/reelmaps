import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface FavoriteLocation {
  id: string
  name: string
  lat: number
  lng: number
  createdAt: string
}

interface FavoritesState {
  favorites: FavoriteLocation[]
  addFavorite: (name: string, lat: number, lng: number) => void
  removeFavorite: (id: string) => void
  renameFavorite: (id: string, name: string) => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      favorites: [],

      addFavorite: (name, lat, lng) =>
        set((s) => ({
          favorites: [
            ...s.favorites,
            {
              id: crypto.randomUUID(),
              name,
              lat,
              lng,
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      removeFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.filter((f) => f.id !== id),
        })),

      renameFavorite: (id, name) =>
        set((s) => ({
          favorites: s.favorites.map((f) =>
            f.id === id ? { ...f, name } : f,
          ),
        })),
    }),
    {
      name: 'reelmaps-favorites',
    },
  ),
)
