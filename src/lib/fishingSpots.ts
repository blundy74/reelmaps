import type { FishingSpot } from '../types'
import { oilPlatforms } from './oilPlatforms'
import { fadLocations } from './fadLocations'

/**
 * Curated offshore fishing spots — US East Coast, Gulf of Mexico, and Bahamas.
 * Coordinates are publicly known fishing locations.
 */
export const FISHING_SPOTS: FishingSpot[] = [
  // ── Gulf Stream / Outer Banks ─────────────────────────────────────────────
  {
    id: 'hatteras-point',
    name: 'Cape Hatteras Point',
    lat: 35.215,
    lng: -75.528,
    depth: 25,
    type: 'rip',
    species: ['Red Drum', 'Bluefish', 'Flounder', 'Spanish Mackerel'],
    region: 'Outer Banks, NC',
    description: 'World-famous surf and nearshore fishing at the "Graveyard of the Atlantic". Strong rip currents and bait concentrations attract big predators year-round.',
    bestMonths: [4, 5, 9, 10, 11],
    rating: 5,
  },
  {
    id: 'gulf-stream-hatteras',
    name: 'Gulf Stream Break (Hatteras)',
    lat: 35.0,
    lng: -74.8,
    depth: 600,
    type: 'rip',
    species: ['Yellowfin Tuna', 'Mahi-Mahi', 'White Marlin', 'Blue Marlin', 'Wahoo'],
    region: 'Outer Banks, NC',
    description: 'The Gulf Stream makes its closest approach to shore near Hatteras, creating sharp temperature breaks where warm blue water meets cooler green water. Prime billfish territory.',
    bestMonths: [5, 6, 7, 8, 9, 10],
    rating: 5,
  },
  {
    id: 'diamond-shoals',
    name: 'Diamond Shoals',
    lat: 35.1,
    lng: -75.3,
    depth: 40,
    type: 'ledge',
    species: ['King Mackerel', 'Cobia', 'Spanish Mackerel', 'Amberjack'],
    region: 'Outer Banks, NC',
    description: 'Extensive shallow shoals extending 14 miles southeast of Cape Hatteras. Structure creates upwelling that holds massive concentrations of baitfish.',
    bestMonths: [5, 6, 7, 8, 9, 10],
    rating: 4,
  },

  // ── North Carolina Offshore ───────────────────────────────────────────────
  {
    id: 'the-point',
    name: 'The Point (Morehead City)',
    lat: 34.35,
    lng: -76.25,
    depth: 90,
    type: 'ledge',
    species: ['King Mackerel', 'Cobia', 'Dolphin', 'Wahoo'],
    region: 'Crystal Coast, NC',
    description: 'Classic NC offshore ledge where the 60- and 100-foot contours converge, forming a natural holding area for pelagics following baitfish migrations.',
    bestMonths: [5, 6, 7, 8, 9],
    rating: 4,
  },
  {
    id: 'ar-315',
    name: 'AR-315 Artificial Reef',
    lat: 34.15,
    lng: -76.92,
    depth: 75,
    type: 'artificial',
    species: ['Snapper', 'Grouper', 'Amberjack', 'Vermilion Snapper'],
    region: 'Crystal Coast, NC',
    description: 'NCDENR artificial reef complex with sunken vessels and concrete rubble. Attracts resident populations of snapper and grouper.',
    bestMonths: [5, 6, 7, 8, 9, 10],
    rating: 4,
  },

  // ── Gulf Stream Canyons ───────────────────────────────────────────────────
  {
    id: 'norfolk-canyon',
    name: 'Norfolk Canyon',
    lat: 36.85,
    lng: -74.35,
    depth: 3600,
    type: 'canyon',
    species: ['Blue Marlin', 'White Marlin', 'Yellowfin Tuna', 'Bigeye Tuna', 'Wahoo'],
    region: 'Virginia / Mid-Atlantic',
    description: 'Deep canyon cutting through the continental shelf off Virginia. One of the premier big-game fishing canyons on the East Coast, with consistent blue water and warm Gulf Stream eddies.',
    bestMonths: [6, 7, 8, 9, 10],
    rating: 5,
  },
  {
    id: 'washington-canyon',
    name: 'Washington Canyon',
    lat: 38.22,
    lng: -73.65,
    depth: 4500,
    type: 'canyon',
    species: ['Blue Marlin', 'Yellowfin Tuna', 'Bigeye Tuna', 'Mako Shark', 'Swordfish'],
    region: 'Mid-Atlantic',
    description: 'Premier Maryland / Delaware offshore canyon. The "Fingers" feature multiple canyon heads that concentrate baitfish and attract blue-water pelagics. Night swordfish bite is legendary.',
    bestMonths: [6, 7, 8, 9, 10],
    rating: 5,
  },
  {
    id: 'baltimore-canyon',
    name: 'Baltimore Canyon',
    lat: 38.0,
    lng: -73.8,
    depth: 4200,
    type: 'canyon',
    species: ['Yellowfin Tuna', 'Bigeye Tuna', 'White Marlin', 'Mahi-Mahi', 'Wahoo'],
    region: 'Mid-Atlantic',
    description: 'One of the most productive tuna canyons in the Mid-Atlantic. A consistent overnight swordfish destination and summer yellowfin fishery.',
    bestMonths: [6, 7, 8, 9, 10],
    rating: 5,
  },
  {
    id: 'wilmington-canyon',
    name: 'Wilmington Canyon',
    lat: 38.6,
    lng: -73.4,
    depth: 5000,
    type: 'canyon',
    species: ['Bigeye Tuna', 'Yellowfin Tuna', 'Blue Marlin', 'White Marlin'],
    region: 'Mid-Atlantic',
    description: 'The northernmost major canyon system off the Mid-Atlantic states. Excellent bigeye tuna spot when warm water pushes north.',
    bestMonths: [7, 8, 9, 10],
    rating: 4,
  },
  {
    id: 'poor-mans-canyon',
    name: "Poor Man's Canyon",
    lat: 37.18,
    lng: -74.62,
    depth: 2800,
    type: 'canyon',
    species: ['Yellowfin Tuna', 'Mahi-Mahi', 'Wahoo', 'White Marlin'],
    region: 'Virginia / Mid-Atlantic',
    description: 'Accessible offshore feature without the long run to the deeper canyons. Temperature breaks and bait concentrations make this a consistent producer.',
    bestMonths: [6, 7, 8, 9, 10],
    rating: 4,
  },

  // ── Florida / Bahamas ─────────────────────────────────────────────────────
  {
    id: 'gulf-stream-miami',
    name: 'Gulf Stream (Miami)',
    lat: 25.8,
    lng: -79.95,
    depth: 900,
    type: 'rip',
    species: ['Sailfish', 'Mahi-Mahi', 'Kingfish', 'Tuna', 'Wahoo'],
    region: 'South Florida',
    description: 'The Gulf Stream flows within 3 miles of Miami Beach — the closest it comes to shore anywhere. World-class sailfishing, especially winter-spring.',
    bestMonths: [11, 12, 1, 2, 3, 4],
    rating: 5,
  },
  {
    id: 'islamorada-hump',
    name: 'Islamorada Hump',
    lat: 24.73,
    lng: -81.05,
    depth: 600,
    type: 'hump',
    species: ['Blackfin Tuna', 'Yellowfin Tuna', 'Swordfish', 'Blue Marlin'],
    region: 'Florida Keys',
    description: 'Underwater mountain rising from 1,800 ft to 600 ft. Creates an upwelling effect that concentrates baitfish and attracts swordfish in the daytime — one of the few spots in the world for that.',
    bestMonths: [1, 2, 3, 4, 5, 10, 11, 12],
    rating: 5,
  },
  {
    id: 'marathon-hump',
    name: 'Marathon Hump',
    lat: 24.42,
    lng: -81.65,
    depth: 540,
    type: 'hump',
    species: ['Swordfish', 'Blackfin Tuna', 'Wahoo', 'Kingfish'],
    region: 'Florida Keys',
    description: 'Similar to the Islamorada Hump — a deep-water pinnacle famous for daytime swordfishing and blackfin tuna action.',
    bestMonths: [1, 2, 3, 4, 5, 10, 11, 12],
    rating: 5,
  },
  {
    id: 'bimini-wall',
    name: 'Bimini Wall',
    lat: 25.73,
    lng: -79.28,
    depth: 1200,
    type: 'ledge',
    species: ['Blue Marlin', 'Wahoo', 'Yellowfin Tuna', 'Mahi-Mahi'],
    region: 'Bahamas',
    description: 'The underwater cliff face of the Bahamas bank off North Bimini. The Gulf Stream shears against this wall concentrating bait and predators. Best blue marlin spot in the western Atlantic.',
    bestMonths: [4, 5, 6, 7, 8, 9],
    rating: 5,
  },

  // ── Gulf of Mexico ────────────────────────────────────────────────────────
  {
    id: 'desoto-canyon',
    name: 'DeSoto Canyon',
    lat: 29.45,
    lng: -86.5,
    depth: 3600,
    type: 'canyon',
    species: ['Blue Marlin', 'Yellowfin Tuna', 'Wahoo', 'Mahi-Mahi', 'Swordfish'],
    region: 'Gulf of Mexico (FL Panhandle)',
    description: 'The DeSoto Canyon is the deepest natural feature in the Gulf of Mexico, cutting from 600 ft to over 12,000 ft. The dominant blue-water structure in the eastern Gulf.',
    bestMonths: [5, 6, 7, 8, 9, 10],
    rating: 5,
  },
  {
    id: 'flower-garden-banks',
    name: 'Flower Garden Banks',
    lat: 27.88,
    lng: -93.6,
    depth: 55,
    type: 'reef',
    species: ['Amberjack', 'Snapper', 'Grouper', 'Mahi-Mahi'],
    region: 'Gulf of Mexico',
    description: 'NOAA National Marine Sanctuary — the northernmost coral reef in the US. Pristine coral gardens in 55–180 ft. Exceptional reef fishing around the sanctuary boundaries.',
    bestMonths: [5, 6, 7, 8, 9],
    rating: 5,
  },
  {
    id: 'campeche-bank',
    name: 'Campeche Bank Edge',
    lat: 23.2,
    lng: -90.0,
    depth: 600,
    type: 'ledge',
    species: ['Blue Marlin', 'Sailfish', 'Yellowfin Tuna', 'Wahoo'],
    region: 'Southern Gulf of Mexico',
    description: 'The deep-water edge of the Yucatan/Campeche shelf. Warm Loop Current waters make this one of the most productive blue marlin grounds in the world.',
    bestMonths: [4, 5, 6, 7, 8, 9],
    rating: 5,
  },
  {
    id: 'south-tip-louisiana',
    name: 'South Pass Offshore',
    lat: 28.5,
    lng: -89.2,
    depth: 300,
    type: 'ledge',
    species: ['Yellowfin Tuna', 'Wahoo', 'Mahi-Mahi', 'Cobia'],
    region: 'Louisiana Offshore',
    description: 'The continental shelf break south of Louisiana where the Loop Current creates exceptional blue-water conditions. Oil platform "rigs-to-reefs" dramatically enhance fish populations.',
    bestMonths: [3, 4, 5, 6, 7, 8, 9, 10],
    rating: 4,
  },
  {
    id: 'salt-dome-gulf',
    name: 'West Flower Garden (Salt Dome)',
    lat: 27.83,
    lng: -93.83,
    depth: 80,
    type: 'hump',
    species: ['Amberjack', 'Snapper', 'Grouper', 'Wahoo'],
    region: 'Gulf of Mexico',
    description: 'Salt dome reef structure rising to 80 ft. The surrounding deep water and strong currents concentrate both bait and predators year-round.',
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    rating: 4,
  },

  // ── Historic Wrecks ───────────────────────────────────────────────────────
  {
    id: 'uss-monitor',
    name: 'USS Monitor National Marine Sanctuary',
    lat: 35.0,
    lng: -76.39,
    depth: 235,
    type: 'wreck',
    species: ['Amberjack', 'Vermilion Snapper', 'Barracuda', 'Greater Amberjack'],
    region: 'NC Offshore',
    description: 'The ironclad Civil War warship USS Monitor lies in 235 ft. Protected national marine sanctuary surrounded by excellent fishing structure. Stunning dive site (seasonal permits).',
    bestMonths: [5, 6, 7, 8, 9, 10],
    rating: 4,
  },
  {
    id: 'empire-gem-wreck',
    name: 'Empire Gem Wreck',
    lat: 35.73,
    lng: -75.21,
    depth: 125,
    type: 'wreck',
    species: ['Amberjack', 'Barracuda', 'Snapper', 'Atlantic Spadefish'],
    region: 'Outer Banks, NC',
    description: 'WWII British tanker sunk by German submarine in 1942, lying in 125 ft of water off the Outer Banks. Rich artificial reef with abundant marine life.',
    bestMonths: [5, 6, 7, 8, 9, 10],
    rating: 4,
  },
]

// ── Oil/Gas Platforms (converted from oilPlatforms.ts) ──────────────────────
const platformSpots: FishingSpot[] = oilPlatforms.map((p) => ({
  id: `rig-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name: p.name,
  lat: p.lat,
  lng: p.lon,
  depth: p.waterDepthFt,
  type: 'rig' as const,
  species: ['Yellowfin Tuna', 'Blackfin Tuna', 'Amberjack', 'Red Snapper', 'Cobia', 'Mahi-Mahi'],
  region: `${p.region}, GOM`,
  description: `${p.type} platform operated by ${p.operator} in ${p.block}. Water depth ${p.waterDepthFt.toLocaleString()} ft.${p.notes ? ' ' + p.notes : ''}`,
  bestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  rating: 3,
}))

FISHING_SPOTS.push(...platformSpots)

// ── FADs (converted from fadLocations.ts) ───────────────────────────────────
const fadSpots: FishingSpot[] = fadLocations.map((f) => ({
  id: `fad-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name: f.name,
  lat: f.lat,
  lng: f.lon,
  depth: f.depthFt,
  type: 'fad' as const,
  species: ['Mahi-Mahi', 'Yellowfin Tuna', 'Wahoo', 'King Mackerel', 'Cobia'],
  region: f.region,
  description: `${f.type === 'anchored' ? 'Anchored' : f.type === 'surface' ? 'Surface' : 'Subsurface'} FAD deployed by ${f.deployedBy}. Water depth ${f.depthFt.toLocaleString()} ft.${f.notes ? ' ' + f.notes : ''}`,
  bestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  rating: 3,
}))

FISHING_SPOTS.push(...fadSpots)

/** Returns GeoJSON FeatureCollection for MapLibre */
export function spotsToGeoJSON(spots: FishingSpot[]) {
  return {
    type: 'FeatureCollection' as const,
    features: spots.map((spot) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [spot.lng, spot.lat],
      },
      properties: {
        id: spot.id,
        name: spot.name,
        type: spot.type,
        depth: spot.depth,
        rating: spot.rating,
        species: spot.species.join(', '),
        region: spot.region,
        description: spot.description,
      },
    })),
  }
}

/** Icon color by spot type */
export const SPOT_TYPE_COLORS: Record<string, string> = {
  reef: '#10b981',      // emerald
  wreck: '#8b5cf6',     // purple
  ledge: '#3b82f6',     // blue
  canyon: '#ef4444',    // red
  hump: '#f59e0b',      // amber
  inlet: '#06b6d4',     // cyan
  artificial: '#ec4899', // pink
  rip: '#f97316',       // orange
  rig: '#a3a3a3',       // neutral gray
  fad: '#facc15',       // yellow
}

export const SPOT_TYPE_LABELS: Record<string, string> = {
  reef: 'Natural Reef',
  wreck: 'Shipwreck',
  ledge: 'Ledge',
  canyon: 'Submarine Canyon',
  hump: 'Underwater Hump',
  inlet: 'Inlet / Pass',
  artificial: 'Artificial Reef',
  rip: 'Temperature Rip',
  rig: 'Oil/Gas Platform',
  fad: 'Fish Aggregating Device',
}

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]
