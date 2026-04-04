/**
 * Gulf of Mexico Offshore Oil & Gas Platform Coordinates
 *
 * Sources:
 *   - Wikipedia platform articles
 *   - 33 CFR Part 147 (U.S. Coast Guard Safety Zones)
 *   - Federal Register safety zone notices
 *   - NOAA National Data Buoy Center (NDBC)
 *   - BOEM / BSEE platform databases
 *   - latitude.to reference pages
 *
 * Coordinate datum: WGS 84 (most sources use NAD 83, which is functionally
 * identical to WGS 84 at this precision).
 *
 * Last updated: 2026-03-27
 */

export interface OilPlatform {
  name: string;
  lat: number;
  lon: number;
  type: string;            // Platform type: TLP, Spar, Semi-Sub, Compliant Tower, Fixed, FPS, FPSO, FPU
  operator: string;
  block: string;           // OCS lease block (e.g. "MC 807")
  region: string;          // Protraction area (e.g. "Mississippi Canyon")
  waterDepthFt: number;    // Approximate water depth in feet
  status: 'active' | 'decommissioned' | 'unknown';
  notes?: string;
}

export const oilPlatforms: OilPlatform[] = [
  // =========================================================================
  //  MISSISSIPPI CANYON (MC)
  // =========================================================================
  {
    name: 'Thunder Horse PDQ',
    lat: 28.1091,
    lon: -88.4944,
    type: 'Semi-Sub',
    operator: 'BP',
    block: 'MC 778',
    region: 'Mississippi Canyon',
    waterDepthFt: 6040,
    status: 'active',
    notes: 'One of the largest semi-submersibles in the world',
  },
  {
    name: 'Mars TLP',
    lat: 28.1695,
    lon: -89.2229,
    type: 'TLP',
    operator: 'Shell',
    block: 'MC 807',
    region: 'Mississippi Canyon',
    waterDepthFt: 2940,
    status: 'active',
    notes: 'Installed 1996, major yellowfin tuna fishing landmark',
  },
  {
    name: 'Olympus TLP (Mars B)',
    lat: 28.1599,
    lon: -89.2391,
    type: 'TLP',
    operator: 'Shell',
    block: 'MC 807',
    region: 'Mississippi Canyon',
    waterDepthFt: 3100,
    status: 'active',
    notes: 'Shell\'s largest floating deepwater platform; adjacent to Mars TLP',
  },
  {
    name: 'Ursa TLP',
    lat: 28.1540,
    lon: -89.1036,
    type: 'TLP',
    operator: 'Shell',
    block: 'MC 809',
    region: 'Mississippi Canyon',
    waterDepthFt: 3950,
    status: 'active',
    notes: 'Installed 1999',
  },
  {
    name: 'Na Kika',
    lat: 28.521,
    lon: -88.289,
    type: 'Semi-Sub',
    operator: 'BP / Shell',
    block: 'MC 474',
    region: 'Mississippi Canyon',
    waterDepthFt: 5900,
    status: 'active',
    notes: 'Semi-submersible hub for multiple subsea fields',
  },
  {
    name: 'Cognac',
    lat: 28.3415,
    lon: -88.2657,
    type: 'Fixed',
    operator: 'Shell',
    block: 'MC 194',
    region: 'Mississippi Canyon',
    waterDepthFt: 1025,
    status: 'active',
    notes: 'First deepwater platform (1978); world record at installation',
  },
  {
    name: "Devil's Tower",
    lat: 28.2089,
    lon: -88.7375,
    type: 'Spar',
    operator: 'ENI / Williams',
    block: 'MC 773',
    region: 'Mississippi Canyon',
    waterDepthFt: 5610,
    status: 'active',
    notes: 'Truss spar',
  },
  {
    name: 'Horn Mountain',
    lat: 28.8660,
    lon: -88.0562,
    type: 'Spar',
    operator: 'BP',
    block: 'MC 127',
    region: 'Mississippi Canyon',
    waterDepthFt: 5400,
    status: 'active',
    notes: 'Truss spar; coordinates from 33 CFR 147.875',
  },
  {
    name: 'Titan Spar',
    lat: 28.0339,
    lon: -89.1011,
    type: 'Spar',
    operator: 'Enbridge',
    block: 'MC 941',
    region: 'Mississippi Canyon',
    waterDepthFt: 4100,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.865',
  },
  {
    name: 'Gulfstar 1 Spar',
    lat: 28.2350,
    lon: -88.9954,
    type: 'Spar',
    operator: 'Williams / Hess',
    block: 'MC 724',
    region: 'Mississippi Canyon',
    waterDepthFt: 4400,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.859',
  },
  {
    name: 'Independence Hub',
    lat: 28.0851,
    lon: -87.9858,
    type: 'Semi-Sub',
    operator: 'Enterprise',
    block: 'MC 920',
    region: 'Mississippi Canyon',
    waterDepthFt: 8000,
    status: 'decommissioned',
    notes: 'Decommissioned 2019; was deepest semi-sub production platform',
  },
  {
    name: 'Appomattox',
    lat: 28.5735,
    lon: -87.9342,
    type: 'Semi-Sub',
    operator: 'Shell',
    block: 'MC 392',
    region: 'Mississippi Canyon',
    waterDepthFt: 7400,
    status: 'active',
    notes: 'Shell\'s largest floating platform in GOM; 33 CFR 147.869',
  },
  {
    name: 'Vito FPS',
    lat: 28.0256,
    lon: -89.2092,
    type: 'FPS',
    operator: 'Shell',
    block: 'MC 939',
    region: 'Mississippi Canyon',
    waterDepthFt: 4050,
    status: 'active',
    notes: 'Floating production system; 33 CFR 147.879',
  },
  {
    name: 'Delta House FPS',
    lat: 28.65,
    lon: -89.05,
    type: 'FPS',
    operator: 'LLOG',
    block: 'MC 254',
    region: 'Mississippi Canyon',
    waterDepthFt: 4500,
    status: 'active',
    notes: 'Floating production system; approximate coordinates from block center',
  },

  // =========================================================================
  //  GREEN CANYON (GC)
  // =========================================================================
  {
    name: 'Atlantis PQ',
    lat: 27.1953,
    lon: -90.0269,
    type: 'Semi-Sub',
    operator: 'BP',
    block: 'GC 743',
    region: 'Green Canyon',
    waterDepthFt: 7070,
    status: 'active',
    notes: 'BP/BHP joint venture; production capacity 200,000 bbl/day',
  },
  {
    name: 'Mad Dog',
    lat: 27.1884,
    lon: -90.2687,
    type: 'Spar',
    operator: 'BP',
    block: 'GC 782',
    region: 'Green Canyon',
    waterDepthFt: 4420,
    status: 'active',
    notes: 'Truss spar; coordinates from Federal Register safety zone',
  },
  {
    name: 'Argos (Mad Dog Phase 2)',
    lat: 27.2100,
    lon: -90.3810,
    type: 'Semi-Sub',
    operator: 'BP',
    block: 'GC 780',
    region: 'Green Canyon',
    waterDepthFt: 4600,
    status: 'active',
    notes: 'Semi-sub FPU; 33 CFR safety zone N 27d12m36s W 90d22m51.6s',
  },
  {
    name: 'Bullwinkle',
    lat: 27.8836,
    lon: -90.9011,
    type: 'Fixed',
    operator: 'Shell',
    block: 'GC 65',
    region: 'Green Canyon',
    waterDepthFt: 1353,
    status: 'active',
    notes: 'One of the tallest fixed-leg platforms; popular fishing landmark',
  },
  {
    name: 'Genesis Spar',
    lat: 27.7797,
    lon: -90.5182,
    type: 'Spar',
    operator: 'Chevron',
    block: 'GC 205',
    region: 'Green Canyon',
    waterDepthFt: 2590,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.825 (27d46m46.365s N 90d31m06.553s W)',
  },
  {
    name: 'Brutus TLP',
    lat: 27.7952,
    lon: -90.6475,
    type: 'TLP',
    operator: 'Shell',
    block: 'GC 158',
    region: 'Green Canyon',
    waterDepthFt: 2985,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.821',
  },
  {
    name: 'Holstein',
    lat: 27.3214,
    lon: -90.5356,
    type: 'Spar',
    operator: 'BP / Shell',
    block: 'GC 645',
    region: 'Green Canyon',
    waterDepthFt: 4344,
    status: 'active',
    notes: 'Largest truss spar at installation; 27d19m17s N 90d32m08s W',
  },
  {
    name: 'Constitution Spar',
    lat: 27.2922,
    lon: -90.9680,
    type: 'Spar',
    operator: 'Anadarko / Oxy',
    block: 'GC 680',
    region: 'Green Canyon',
    waterDepthFt: 4970,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.871 (27d17m31.92s N 90d58m4.8s W)',
  },
  {
    name: 'Marco Polo TLP',
    lat: 27.3620,
    lon: -90.1814,
    type: 'TLP',
    operator: 'Anadarko',
    block: 'GC 608',
    region: 'Green Canyon',
    waterDepthFt: 4300,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.837 (27d21m43.32s N 90d10m53.01s W)',
  },
  {
    name: 'Heidelberg Spar',
    lat: 27.1114,
    lon: -90.7640,
    type: 'Spar',
    operator: 'Anadarko / Oxy',
    block: 'GC 860',
    region: 'Green Canyon',
    waterDepthFt: 5310,
    status: 'active',
    notes: 'Coordinates from Federal Register 2023 (27d6m41.04s N 90d45m50.4s W)',
  },
  {
    name: 'Stampede TLP',
    lat: 27.5093,
    lon: -90.5564,
    type: 'TLP',
    operator: 'Hess',
    block: 'GC 468',
    region: 'Green Canyon',
    waterDepthFt: 3500,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.867 (27d30m33.34s N 90d33m22.96s W)',
  },
  {
    name: 'Anchor FPU',
    lat: 27.2064,
    lon: -91.1981,
    type: 'FPU',
    operator: 'Chevron',
    block: 'GC 763',
    region: 'Green Canyon',
    waterDepthFt: 5183,
    status: 'active',
    notes: 'Coordinates from Federal Register 2023 (27d12m23.04s N 91d11m53.16s W)',
  },
  {
    name: 'Shenzi TLP',
    lat: 27.19,
    lon: -90.58,
    type: 'TLP',
    operator: 'BHP / Woodside',
    block: 'GC 653',
    region: 'Green Canyon',
    waterDepthFt: 4300,
    status: 'active',
    notes: 'Approximate coordinates from block center; ~120 miles offshore Louisiana',
  },
  {
    name: 'Boxer',
    lat: 27.9467,
    lon: -90.9967,
    type: 'Fixed',
    operator: 'Cal Dive',
    block: 'GC 19',
    region: 'Green Canyon',
    waterDepthFt: 650,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.801 (27d56m48s N 90d59m48s W)',
  },

  // =========================================================================
  //  VIOSCA KNOLL (VK)
  // =========================================================================
  {
    name: 'Petronius',
    lat: 29.229,
    lon: -87.781,
    type: 'Compliant Tower',
    operator: 'Chevron / Marathon',
    block: 'VK 786',
    region: 'Viosca Knoll',
    waterDepthFt: 1754,
    status: 'active',
    notes: 'One of tallest freestanding structures ever built (2100 ft); NDBC station KVOA',
  },
  {
    name: 'Marlin TLP',
    lat: 29.1076,
    lon: -87.9437,
    type: 'TLP',
    operator: 'BP / Shell',
    block: 'VK 915',
    region: 'Viosca Knoll',
    waterDepthFt: 3240,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.827 (29d6m27.46s N 87d56m37.14s W)',
  },
  {
    name: 'Ram-Powell TLP',
    lat: 29.0652,
    lon: -88.0692,
    type: 'TLP',
    operator: 'Shell / Talos',
    block: 'VK 956',
    region: 'Viosca Knoll',
    waterDepthFt: 3214,
    status: 'active',
    notes: '125 miles SE of New Orleans; 80 miles S of Mobile, AL',
  },

  // =========================================================================
  //  ALAMINOS CANYON (AC)
  // =========================================================================
  {
    name: 'Perdido',
    lat: 26.1289,
    lon: -94.8981,
    type: 'Spar',
    operator: 'Shell',
    block: 'AC 857',
    region: 'Alaminos Canyon',
    waterDepthFt: 8040,
    status: 'active',
    notes: 'Deepest floating oil platform in the world at installation; ~200 mi SW of Galveston',
  },
  {
    name: 'Hoover Diana',
    lat: 26.9425,
    lon: -94.6888,
    type: 'Semi-Sub',
    operator: 'ExxonMobil',
    block: 'AC 25',
    region: 'Alaminos Canyon',
    waterDepthFt: 4800,
    status: 'active',
    notes: 'Coordinates from safety zone (26d56m33s N 94d41m19.55s W)',
  },

  // =========================================================================
  //  GARDEN BANKS (GB)
  // =========================================================================
  {
    name: 'Magnolia',
    lat: 27.2039,
    lon: -92.2026,
    type: 'Spar',
    operator: 'ConocoPhillips',
    block: 'GB 783',
    region: 'Garden Banks',
    waterDepthFt: 4700,
    status: 'active',
    notes: '180 miles south of Cameron, LA; extended tension leg spar',
  },
  {
    name: 'Auger TLP',
    lat: 27.5460,
    lon: -92.4431,
    type: 'TLP',
    operator: 'Shell',
    block: 'GB 426',
    region: 'Garden Banks',
    waterDepthFt: 2860,
    status: 'active',
    notes: 'Coordinates from safety zone (27d32m45.4s N 92d26m35.09s W)',
  },
  {
    name: 'Gunnison',
    lat: 27.368,
    lon: -93.472,
    type: 'Spar',
    operator: 'Anadarko',
    block: 'GB 668',
    region: 'Garden Banks',
    waterDepthFt: 3100,
    status: 'active',
    notes: 'Approximate coordinates (27d22.08s N 93d28.30s W); 135 miles from Freeport',
  },

  // =========================================================================
  //  WALKER RIDGE (WR)
  // =========================================================================
  {
    name: 'Jack / St. Malo',
    lat: 26.2350,
    lon: -91.2611,
    type: 'Semi-Sub',
    operator: 'Chevron',
    block: 'WR 718',
    region: 'Walker Ridge',
    waterDepthFt: 6950,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.851 (26d14m5.94s N 91d15m39.99s W)',
  },
  {
    name: 'Big Foot TLP',
    lat: 26.922,
    lon: -90.521,
    type: 'TLP',
    operator: 'Chevron',
    block: 'WR 29',
    region: 'Walker Ridge',
    waterDepthFt: 5200,
    status: 'active',
    notes: '225 miles south of New Orleans; coordinates from Federal Register',
  },
  {
    name: 'Stones FPSO (Turritella)',
    lat: 26.60,
    lon: -90.70,
    type: 'FPSO',
    operator: 'Shell',
    block: 'WR 508',
    region: 'Walker Ridge',
    waterDepthFt: 9500,
    status: 'active',
    notes: 'First FPSO in GOM; ~200 mi offshore LA; approximate coordinates from block',
  },

  // =========================================================================
  //  KEATHLEY CANYON (KC)
  // =========================================================================
  {
    name: 'Lucius Spar',
    lat: 26.1320,
    lon: -92.0401,
    type: 'Spar',
    operator: 'Anadarko / Oxy',
    block: 'KC 875',
    region: 'Keathley Canyon',
    waterDepthFt: 7100,
    status: 'active',
    notes: 'Coordinates from 33 CFR 147.873 (26d7m55.06s N 92d2m24.3s W)',
  },

  // =========================================================================
  //  WEST DELTA (WD)
  // =========================================================================
  {
    name: 'West Delta 143 (LOOP)',
    lat: 28.6617,
    lon: -89.5514,
    type: 'Fixed',
    operator: 'Shell / LOOP',
    block: 'WD 143',
    region: 'West Delta',
    waterDepthFt: 55,
    status: 'active',
    notes: 'Louisiana Offshore Oil Port hub; 33 CFR 147.807',
  },

  // =========================================================================
  //  MAIN PASS AREA (MP)  -  Popular fishing rigs
  // =========================================================================
  {
    name: 'Circle Rigs (North)',
    lat: 29.2318,
    lon: -88.5631,
    type: 'Fixed',
    operator: 'Various',
    block: 'MP Area',
    region: 'Main Pass',
    waterDepthFt: 200,
    status: 'active',
    notes: 'Northern-most of the circle/horseshoe rigs; popular fishing landmark',
  },
  {
    name: 'Circle Rigs (Southwest)',
    lat: 29.1997,
    lon: -88.5827,
    type: 'Fixed',
    operator: 'Various',
    block: 'MP Area',
    region: 'Main Pass',
    waterDepthFt: 200,
    status: 'active',
    notes: 'Southwestern-most of the circle/horseshoe rigs',
  },

  // =========================================================================
  //  LOUISIANA OFFSHORE OIL PORT (LOOP)
  // =========================================================================
  {
    name: 'LOOP (LA Offshore Oil Port)',
    lat: 28.8852,
    lon: -90.0251,
    type: 'Fixed',
    operator: 'LOOP LLC',
    block: 'SP Area',
    region: 'South Pass',
    waterDepthFt: 110,
    status: 'active',
    notes: 'Deepwater port for supertankers; significant navigation landmark',
  },

  // =========================================================================
  //  ENSOR / OTHER FISHING LANDMARKS
  // =========================================================================
  {
    name: 'EnStar Rig',
    lat: 29.0817,
    lon: -90.9756,
    type: 'Fixed',
    operator: 'Various',
    block: 'SS Area',
    region: 'Ship Shoal',
    waterDepthFt: 50,
    status: 'active',
    notes: 'Inshore structure; popular fishing spot',
  },
];

/**
 * Helper: get all active platforms
 */
export function getActivePlatforms(): OilPlatform[] {
  return oilPlatforms.filter((p) => p.status === 'active');
}

/**
 * Helper: get platforms by region
 */
export function getPlatformsByRegion(region: string): OilPlatform[] {
  return oilPlatforms.filter((p) =>
    p.region.toLowerCase().includes(region.toLowerCase()),
  );
}

/**
 * Helper: get platforms by type
 */
export function getPlatformsByType(type: string): OilPlatform[] {
  return oilPlatforms.filter((p) =>
    p.type.toLowerCase().includes(type.toLowerCase()),
  );
}
