export interface FishingSpot {
  id: string
  name: string
  lat: number
  lng: number
  depth: number // feet
  type: SpotType
  species: string[]
  region: string
  description: string
  bestMonths: number[] // 1-12
  rating: number // 1-5
}

export type SpotType =
  | 'reef'
  | 'wreck'
  | 'ledge'
  | 'canyon'
  | 'hump'
  | 'inlet'
  | 'artificial'
  | 'rip'
  | 'rig'
  | 'fad'

export type LayerGroup = 'satellite' | 'oceanography' | 'charts' | 'fishing'

export interface MapLayer {
  id: string
  name: string
  description: string
  group: LayerGroup
  visible: boolean
  opacity: number
  hasDateControl: boolean
  attribution?: string
  legend?: LayerLegend
}

export interface LayerLegend {
  type: 'gradient' | 'discrete'
  title: string
  unit: string
  stops: { value: number; color: string; label?: string }[]
}

export type BasemapId = 'dark' | 'satellite' | 'nautical' | 'light'

export interface Basemap {
  id: BasemapId
  name: string
  styleUrl: string
  preview: string
}

export interface MapViewState {
  longitude: number
  latitude: number
  zoom: number
  bearing: number
  pitch: number
}

export interface ClickedPoint {
  lat: number
  lng: number
  spot?: FishingSpot
}
