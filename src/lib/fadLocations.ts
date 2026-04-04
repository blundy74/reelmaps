/**
 * Fish Aggregating Device (FAD) Locations — US Coastal Waters
 *
 * Sources:
 *   - NOAA Fisheries Caribbean FAD Program (USVI & Puerto Rico)
 *   - Florida Fish & Wildlife Conservation Commission (FWC) artificial reef database
 *   - South Atlantic Fishery Management Council (SAFMC) artificial reef/FAD data
 *   - Gulf States Marine Fisheries Commission (GSMFC)
 *   - Louisiana Dept. of Wildlife & Fisheries
 *   - Texas Parks & Wildlife Dept. (TPWD) artificial reef program
 *   - North Carolina Division of Marine Fisheries
 *   - Hawaii Division of Aquatic Resources (DAR) FAD program
 *
 * Coordinate datum: WGS 84
 * Last updated: 2026-04-01
 */

export interface FADLocation {
  name: string
  lat: number
  lon: number
  type: 'anchored' | 'surface' | 'subsurface'
  region: string
  depthFt: number
  status: 'active' | 'inactive' | 'unknown'
  deployedBy: string
  notes?: string
}

export const fadLocations: FADLocation[] = [
  // =========================================================================
  //  US VIRGIN ISLANDS — NOAA / DPNR FAD Program
  // =========================================================================
  {
    name: 'St. Thomas South FAD',
    lat: 18.2700,
    lon: -64.9300,
    type: 'anchored',
    region: 'US Virgin Islands',
    depthFt: 6000,
    status: 'active',
    deployedBy: 'NOAA / VIDPNR',
    notes: 'Primary pelagic FAD south of St. Thomas; yellowfin tuna, mahi-mahi',
  },
  {
    name: 'St. Thomas East FAD',
    lat: 18.2900,
    lon: -64.8200,
    type: 'anchored',
    region: 'US Virgin Islands',
    depthFt: 5500,
    status: 'active',
    deployedBy: 'NOAA / VIDPNR',
  },
  {
    name: 'St. Croix South FAD',
    lat: 17.6500,
    lon: -64.7700,
    type: 'anchored',
    region: 'US Virgin Islands',
    depthFt: 5800,
    status: 'active',
    deployedBy: 'NOAA / VIDPNR',
    notes: 'Deep-water FAD south of St. Croix; wahoo and tuna concentrations',
  },
  {
    name: 'St. Croix West FAD',
    lat: 17.7200,
    lon: -64.9100,
    type: 'anchored',
    region: 'US Virgin Islands',
    depthFt: 4500,
    status: 'active',
    deployedBy: 'NOAA / VIDPNR',
  },
  {
    name: 'St. John East FAD',
    lat: 18.3100,
    lon: -64.7000,
    type: 'anchored',
    region: 'US Virgin Islands',
    depthFt: 5200,
    status: 'active',
    deployedBy: 'NOAA / VIDPNR',
  },

  // =========================================================================
  //  PUERTO RICO — NOAA / DNER FAD Program
  // =========================================================================
  {
    name: 'San Juan North FAD',
    lat: 18.6100,
    lon: -66.1000,
    type: 'anchored',
    region: 'Puerto Rico',
    depthFt: 6500,
    status: 'active',
    deployedBy: 'NOAA / PR DNER',
    notes: 'Pelagic FAD off San Juan; heavy mahi-mahi and tuna action',
  },
  {
    name: 'Mayagüez West FAD',
    lat: 18.2000,
    lon: -67.3500,
    type: 'anchored',
    region: 'Puerto Rico',
    depthFt: 5000,
    status: 'active',
    deployedBy: 'NOAA / PR DNER',
    notes: 'Mona Passage FAD; strong currents attract wahoo and marlin',
  },
  {
    name: 'Ponce South FAD',
    lat: 17.8800,
    lon: -66.6200,
    type: 'anchored',
    region: 'Puerto Rico',
    depthFt: 5500,
    status: 'active',
    deployedBy: 'NOAA / PR DNER',
  },
  {
    name: 'Fajardo East FAD',
    lat: 18.3500,
    lon: -65.5000,
    type: 'anchored',
    region: 'Puerto Rico',
    depthFt: 6000,
    status: 'active',
    deployedBy: 'NOAA / PR DNER',
    notes: 'Near the Virgin Islands Trough; yellowfin tuna hotspot',
  },
  {
    name: 'Rincón Northwest FAD',
    lat: 18.4200,
    lon: -67.3800,
    type: 'anchored',
    region: 'Puerto Rico',
    depthFt: 4800,
    status: 'active',
    deployedBy: 'NOAA / PR DNER',
  },
  {
    name: 'Cabo Rojo Southwest FAD',
    lat: 17.9200,
    lon: -67.2500,
    type: 'anchored',
    region: 'Puerto Rico',
    depthFt: 5200,
    status: 'active',
    deployedBy: 'NOAA / PR DNER',
  },

  // =========================================================================
  //  FLORIDA — FWC FAD / Artificial Reef Program
  // =========================================================================
  {
    name: 'Miami Beach FAD',
    lat: 25.8000,
    lon: -79.9800,
    type: 'anchored',
    region: 'Southeast Florida',
    depthFt: 650,
    status: 'active',
    deployedBy: 'Miami-Dade County / FWC',
    notes: 'Gulf Stream edge FAD; mahi-mahi, kingfish, sailfish',
  },
  {
    name: 'Fort Lauderdale Offshore FAD',
    lat: 26.1200,
    lon: -79.9500,
    type: 'anchored',
    region: 'Southeast Florida',
    depthFt: 800,
    status: 'active',
    deployedBy: 'Broward County / FWC',
    notes: 'Near Gulf Stream; consistent dolphinfish aggregation',
  },
  {
    name: 'Palm Beach Offshore FAD',
    lat: 26.7200,
    lon: -79.8800,
    type: 'anchored',
    region: 'Southeast Florida',
    depthFt: 700,
    status: 'active',
    deployedBy: 'Palm Beach County / FWC',
    notes: 'Close Gulf Stream access; pelagic species year-round',
  },
  {
    name: 'Jupiter FAD',
    lat: 26.9500,
    lon: -79.8700,
    type: 'anchored',
    region: 'Southeast Florida',
    depthFt: 600,
    status: 'active',
    deployedBy: 'FWC',
  },
  {
    name: 'Key West South FAD',
    lat: 24.3500,
    lon: -81.8500,
    type: 'anchored',
    region: 'Florida Keys',
    depthFt: 1800,
    status: 'active',
    deployedBy: 'FWC / Monroe County',
    notes: 'Deep FAD south of Key West; tuna, wahoo, mahi',
  },
  {
    name: 'Islamorada Offshore FAD',
    lat: 24.8200,
    lon: -80.5500,
    type: 'anchored',
    region: 'Florida Keys',
    depthFt: 1200,
    status: 'active',
    deployedBy: 'FWC',
    notes: 'Sportfishing capital of the world; mahi and sailfish staging area',
  },
  {
    name: 'Marathon FAD',
    lat: 24.6000,
    lon: -81.0500,
    type: 'anchored',
    region: 'Florida Keys',
    depthFt: 1500,
    status: 'active',
    deployedBy: 'FWC',
  },
  {
    name: 'Panama City Beach FAD',
    lat: 29.9500,
    lon: -85.8800,
    type: 'anchored',
    region: 'Florida Panhandle',
    depthFt: 250,
    status: 'active',
    deployedBy: 'FWC / Bay County',
    notes: 'Nearshore FAD; red snapper, triggerfish, amberjack',
  },
  {
    name: 'Destin Offshore FAD',
    lat: 30.2200,
    lon: -86.4500,
    type: 'anchored',
    region: 'Florida Panhandle',
    depthFt: 200,
    status: 'active',
    deployedBy: 'FWC / Okaloosa County',
  },
  {
    name: 'Tampa Bay Offshore FAD',
    lat: 27.4500,
    lon: -83.0500,
    type: 'anchored',
    region: 'West Florida',
    depthFt: 150,
    status: 'active',
    deployedBy: 'FWC / Hillsborough County',
    notes: 'Nearshore artificial reef/FAD; grouper, snapper, cobia',
  },

  // =========================================================================
  //  GULF OF MEXICO — Louisiana & Texas
  // =========================================================================
  {
    name: 'Grand Isle FAD',
    lat: 28.9000,
    lon: -89.9800,
    type: 'anchored',
    region: 'Louisiana',
    depthFt: 120,
    status: 'active',
    deployedBy: 'LDWF',
    notes: 'Nearshore FAD off Grand Isle; red snapper, cobia, tarpon',
  },
  {
    name: 'Venice Offshore FAD',
    lat: 28.7500,
    lon: -89.2000,
    type: 'anchored',
    region: 'Louisiana',
    depthFt: 300,
    status: 'active',
    deployedBy: 'LDWF',
    notes: 'Near Mississippi Canyon; yellowfin tuna staging',
  },
  {
    name: 'Port Fourchon FAD',
    lat: 28.8500,
    lon: -90.2000,
    type: 'anchored',
    region: 'Louisiana',
    depthFt: 180,
    status: 'active',
    deployedBy: 'LDWF',
  },
  {
    name: 'Galveston Offshore FAD',
    lat: 29.1000,
    lon: -94.3500,
    type: 'anchored',
    region: 'Texas',
    depthFt: 200,
    status: 'active',
    deployedBy: 'TPWD',
    notes: 'Part of Texas artificial reef program; snapper and kingfish',
  },
  {
    name: 'Port Aransas FAD',
    lat: 27.6800,
    lon: -96.6000,
    type: 'anchored',
    region: 'Texas',
    depthFt: 180,
    status: 'active',
    deployedBy: 'TPWD',
    notes: 'Nearshore FAD complex; king mackerel, ling, snapper',
  },
  {
    name: 'South Padre Island FAD',
    lat: 26.0500,
    lon: -96.9500,
    type: 'anchored',
    region: 'Texas',
    depthFt: 150,
    status: 'active',
    deployedBy: 'TPWD',
  },
  {
    name: 'Freeport FAD',
    lat: 28.7000,
    lon: -95.1500,
    type: 'anchored',
    region: 'Texas',
    depthFt: 160,
    status: 'active',
    deployedBy: 'TPWD',
  },

  // =========================================================================
  //  SOUTH ATLANTIC — NC, SC, GA
  // =========================================================================
  {
    name: 'Charleston Offshore FAD',
    lat: 32.5500,
    lon: -79.4500,
    type: 'anchored',
    region: 'South Carolina',
    depthFt: 120,
    status: 'active',
    deployedBy: 'SCDNR',
    notes: 'Near Gulf Stream edge; mahi-mahi, wahoo, king mackerel',
  },
  {
    name: 'Hilton Head FAD',
    lat: 31.9500,
    lon: -80.3000,
    type: 'anchored',
    region: 'South Carolina',
    depthFt: 100,
    status: 'active',
    deployedBy: 'SCDNR',
  },
  {
    name: 'Savannah Offshore FAD',
    lat: 31.7000,
    lon: -80.3500,
    type: 'anchored',
    region: 'Georgia',
    depthFt: 90,
    status: 'active',
    deployedBy: 'GA DNR',
    notes: 'Artificial reef complex with FAD component; snapper, amberjack',
  },
  {
    name: 'Morehead City Offshore FAD',
    lat: 34.3000,
    lon: -76.3500,
    type: 'anchored',
    region: 'North Carolina',
    depthFt: 130,
    status: 'active',
    deployedBy: 'NC DMF',
    notes: 'Near the Break; mahi-mahi, tuna, wahoo in summer',
  },
  {
    name: 'Wrightsville Beach FAD',
    lat: 33.9800,
    lon: -77.5000,
    type: 'anchored',
    region: 'North Carolina',
    depthFt: 100,
    status: 'active',
    deployedBy: 'NC DMF',
  },
  {
    name: 'Oregon Inlet Offshore FAD',
    lat: 35.5500,
    lon: -75.2000,
    type: 'anchored',
    region: 'North Carolina',
    depthFt: 110,
    status: 'active',
    deployedBy: 'NC DMF',
    notes: 'Outer Banks offshore FAD; yellowfin and bluefin staging',
  },

  // =========================================================================
  //  HAWAII — DAR FAD Program (Buoys)
  // =========================================================================
  {
    name: 'Oahu South Buoy (SS)',
    lat: 21.0500,
    lon: -157.9500,
    type: 'anchored',
    region: 'Hawaii — Oahu',
    depthFt: 6600,
    status: 'active',
    deployedBy: 'Hawaii DAR',
    notes: 'One of Hawaii\'s iconic FAD buoys; yellowfin ahi, mahi-mahi, ono',
  },
  {
    name: 'Oahu East Buoy (CO)',
    lat: 21.2500,
    lon: -157.5000,
    type: 'anchored',
    region: 'Hawaii — Oahu',
    depthFt: 6000,
    status: 'active',
    deployedBy: 'Hawaii DAR',
  },
  {
    name: 'Oahu North Buoy (CB)',
    lat: 21.6500,
    lon: -158.1000,
    type: 'anchored',
    region: 'Hawaii — Oahu',
    depthFt: 6200,
    status: 'active',
    deployedBy: 'Hawaii DAR',
  },
  {
    name: 'Oahu West Buoy (HH)',
    lat: 21.3500,
    lon: -158.3500,
    type: 'anchored',
    region: 'Hawaii — Oahu',
    depthFt: 5800,
    status: 'active',
    deployedBy: 'Hawaii DAR',
    notes: 'Popular with recreational and charter boats',
  },
  {
    name: 'Maui South Buoy (B)',
    lat: 20.5500,
    lon: -156.4000,
    type: 'anchored',
    region: 'Hawaii — Maui',
    depthFt: 6000,
    status: 'active',
    deployedBy: 'Hawaii DAR',
  },
  {
    name: 'Maui North Buoy (W)',
    lat: 21.1500,
    lon: -156.6000,
    type: 'anchored',
    region: 'Hawaii — Maui',
    depthFt: 6400,
    status: 'active',
    deployedBy: 'Hawaii DAR',
  },
  {
    name: 'Big Island Kona Buoy (V)',
    lat: 19.5500,
    lon: -156.2000,
    type: 'anchored',
    region: 'Hawaii — Big Island',
    depthFt: 6800,
    status: 'active',
    deployedBy: 'Hawaii DAR',
    notes: 'Kona coast FAD; world-class ahi and marlin fishing',
  },
  {
    name: 'Big Island Hilo Buoy (P)',
    lat: 19.8000,
    lon: -154.7500,
    type: 'anchored',
    region: 'Hawaii — Big Island',
    depthFt: 6200,
    status: 'active',
    deployedBy: 'Hawaii DAR',
  },
  {
    name: 'Kauai North Buoy (N)',
    lat: 22.3000,
    lon: -159.3500,
    type: 'anchored',
    region: 'Hawaii — Kauai',
    depthFt: 6500,
    status: 'active',
    deployedBy: 'Hawaii DAR',
  },
  {
    name: 'Kauai South Buoy (S)',
    lat: 21.8000,
    lon: -159.4000,
    type: 'anchored',
    region: 'Hawaii — Kauai',
    depthFt: 6100,
    status: 'active',
    deployedBy: 'Hawaii DAR',
  },
  {
    name: 'Molokai South Buoy (M)',
    lat: 21.0000,
    lon: -157.0000,
    type: 'anchored',
    region: 'Hawaii — Molokai',
    depthFt: 6000,
    status: 'active',
    deployedBy: 'Hawaii DAR',
  },

  // =========================================================================
  //  MID-ATLANTIC
  // =========================================================================
  {
    name: 'Virginia Beach Offshore FAD',
    lat: 36.7500,
    lon: -75.5000,
    type: 'anchored',
    region: 'Virginia',
    depthFt: 110,
    status: 'active',
    deployedBy: 'VMRC',
    notes: 'Norfolk Canyon approach; yellowfin tuna and mahi-mahi in summer',
  },
  {
    name: 'Ocean City MD Offshore FAD',
    lat: 38.1000,
    lon: -74.5000,
    type: 'anchored',
    region: 'Maryland',
    depthFt: 130,
    status: 'active',
    deployedBy: 'MD DNR',
    notes: 'Near Washington Canyon; offshore pelagic species',
  },
]

// ── Helper functions ────────────────────────────────────────────────────────

export function getActiveFADs() {
  return fadLocations.filter((f) => f.status === 'active')
}

export function getFADsByRegion(region: string) {
  return fadLocations.filter((f) => f.region.toLowerCase().includes(region.toLowerCase()))
}
