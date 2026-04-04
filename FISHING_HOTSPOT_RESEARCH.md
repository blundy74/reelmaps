# Fishing Hotspot Algorithm Research

Comprehensive research on environmental and oceanographic variables for building an automated fishing hotspot heat map layer. All values are based on published scientific literature, satellite data specifications, and professional offshore fishing expertise.

---

## 1. Sea Surface Temperature (SST)

### Why It Matters
SST is the single most important variable for offshore fishing. Temperature breaks (fronts) where different water masses meet create convergence zones that concentrate plankton, baitfish, and predators along the edges. Fish are cold-blooded and their metabolism, feeding behavior, and migration are directly governed by water temperature.

### Temperature Breaks / Gradients
- **What triggers fish aggregation**: A change of 1-3°F over 1-5 nautical miles is considered a significant temperature break
- **Strong fronts**: Gradients > 0.2°C/km (roughly 0.6°F per nautical mile) are considered significant in oceanographic literature
- **Detection threshold**: SST front detection algorithms commonly use a threshold of 0.03°C/km for frontal frequency counting
- **Key insight**: The GRADIENT matters more than absolute temperature. A 2°F break in the right temp range for a species will outfish "perfect" temperature water with no break
- **Fish behavior**: Predators patrol the clean/warm side of the break, making quick forays into the cooler/greener water to ambush bait

### Species-Specific Ideal SST Ranges (°F)

| Species | Optimal Range | Tolerance Range | Avoidance |
|---------|--------------|-----------------|-----------|
| Yellowfin Tuna | 75-82 | 64-86 | <60, >88 |
| Bluefin Tuna | 60-72 | 55-78 | <50, >82 |
| Bigeye Tuna | 62-74 | 55-78 | <52, >80 |
| Albacore Tuna | 62-65 | 59-68 | <55, >70 |
| Blue Marlin | 74-82 | 72-88 | <68, >90 |
| White Marlin | 70-80 | 68-84 | <65, >86 |
| Striped Marlin | 68-76 | 61-78 | <58, >80 |
| Sailfish | 72-82 | 70-86 | <68, >88 |
| Swordfish | 64-72 | 58-78 | <55, >82 |
| Mahi-Mahi (Dolphin) | 74-80 | 70-84 | <68, >86 |
| Wahoo | 73-78 | 64-82 | <60, >84 |
| King Mackerel | 70-78 | 65-82 | <62, >85 |
| Cobia | 68-78 | 62-84 | <58, >86 |
| Red Snapper | 55-70 | 50-75 | <48, >78 |
| Yellowtail | 64-72 | 60-76 | <56, >78 |

### Data Sources
- **NOAA GOES/JPSS satellites**: 1km resolution, hourly updates (cloud-free composites daily)
- **GHRSST Multi-sensor foundation SST**: 1km resolution, daily
- **HYCOM model**: 0.08° (~9km), daily
- **Feasibility for algorithm**: EXCELLENT - highest priority variable

---

## 2. Chlorophyll-a Concentration

### Why It Matters
Chlorophyll-a is a proxy for phytoplankton abundance -- the base of the marine food chain. High chlorophyll = high productivity = baitfish = predators. But the EDGES of chlorophyll concentrations matter most, not the centers.

### Ideal Ranges
- **Optimal fishing zone**: 0.1 - 1.5 mg/m³
- **Below 0.1 mg/m³**: Oligotrophic "desert" water, too nutrient-poor
- **0.1 - 0.3 mg/m³**: Clean blue water, good for billfish/tuna when near edges
- **0.3 - 1.0 mg/m³**: The sweet spot - productive but still clear enough for visual predators
- **1.0 - 1.5 mg/m³**: Very productive, green water, attracts bait schools
- **Above 2.0 mg/m³**: Too turbid, potentially low oxygen, less suitable for gamefish
- **Above 5.0 mg/m³**: Possible harmful algal bloom, avoid

### Chlorophyll Edges (Color Breaks)
- The transition zone between blue (low chlorophyll) and green (high chlorophyll) water is called a "color break"
- Predatory gamefish patrol the CLEAN side of the edge where visibility is good
- Baitfish hide in the murky (high chlorophyll) side
- A color break combined with a temperature break is a high-probability fishing zone
- Look for where chlorophyll changes by 0.3+ mg/m³ over a few miles

### Data Sources
- **NASA MODIS/VIIRS Ocean Color**: ~1km resolution, daily (cloud-dependent)
- **Copernicus Sentinel-3 OLCI**: 300m resolution, daily
- **NOAA CoastWatch**: Various products, 1-4km, daily composites
- **Feasibility for algorithm**: EXCELLENT - second highest priority variable

---

## 3. Ocean Currents

### Why It Matters
Current edges, eddies, and convergence zones physically concentrate bait and nutrients. Where currents collide, water piles up and pushes nutrients and small organisms together. Major currents like the Gulf Stream, Kuroshio, and California Current create some of the world's most productive fishing grounds.

### Key Current Features for Fishing
1. **Current edges**: Where a major current meets shelf water (e.g., Gulf Stream western wall)
2. **Convergence zones**: Where two currents meet and surface water is pushed downward, concentrating floating debris and bait
3. **Divergence zones**: Where currents separate, causing upwelling of nutrient-rich water
4. **Eddy edges**: The perimeter of rotating water masses (see SSH section)
5. **Current rips**: Where opposing or angled currents create visible surface disturbance

### Current Speed Considerations
- **Eddy rotational velocity**: Up to 1 m/s (~2 knots) at edges
- **Gulf Stream**: 1-2.5 m/s (2-5 knots)
- **Fishing current sweet spot**: Fish tend to aggregate where current speed changes -- at the transition from fast to slow, not in the fastest flow
- **Trolling factor**: Current speed affects trolling presentation -- with-current vs against-current matters

### Warm-Core vs Cold-Core Eddies
| Feature | Warm-Core Eddy | Cold-Core Eddy |
|---------|---------------|----------------|
| SSH Anomaly | Positive (raised surface) | Negative (depressed surface) |
| Rotation (N. Hemisphere) | Clockwise (anticyclonic) | Counter-clockwise (cyclonic) |
| Water Movement | Downwelling (center) | Upwelling (center) |
| Nutrients | Lower in center | Higher in center (upwelled) |
| Best Fishing | Along edges, warm side | Along edges, nutrient-rich upwelled water |
| Species Trapped | Warm-water pelagics (tuna, mahi) | Attracts bait via nutrients |

### Data Sources
- **OSCAR (Ocean Surface Current Analysis Real-time)**: 1/3° (~33km), 5-day
- **HYCOM model**: 0.08° (~9km), daily
- **Copernicus GlobCurrent**: 1/4° (~25km), daily
- **Altimetry-derived geostrophic currents**: ~25km, daily
- **Feasibility for algorithm**: GOOD - lower spatial resolution but very important

---

## 4. Sea Surface Height (SSH) Anomaly

### Why It Matters
SSH anomaly is the primary tool for detecting and tracking ocean eddies from space. The ocean surface is not flat -- warm water expands and stands higher, cold water contracts and sits lower. Satellite altimeters measure these tiny height differences (centimeters) to reveal eddies and current boundaries.

### Key Values
- **Warm-core eddies**: Positive SSH anomaly, typically +10 to +50 cm above surrounding ocean
- **Cold-core eddies**: Negative SSH anomaly, typically -10 to -50 cm below surrounding ocean
- **Significant eddy**: SSH anomaly > ±15 cm usually indicates a well-defined, fishable eddy
- **Strong eddy**: SSH anomaly > ±30 cm indicates intense rotation with strong edges
- **Eddy detection threshold**: Most algorithms use ±5 cm as minimum detection

### How to Use for Fishing
- Look for TIGHT SSH gradients (closely spaced contour lines) -- these indicate strong current edges
- The edge of a warm-core ring where it meets surrounding water = temperature break + current edge
- Cold-core eddies drive upwelling of nutrients, creating productivity hotspots with a time lag (days to weeks)
- Where SSH contours compress together = acceleration zone = bait concentration

### Data Sources
- **AVISO+ (CNES)**: 1/4° (~25km), daily composite from multiple altimeter missions
- **Copernicus Marine Service**: 1/4°, daily
- **Jason-3, Sentinel-6**: Along-track measurements
- **SWOT (Surface Water and Ocean Topography)**: ~15km wide-swath, submesoscale features
- **Feasibility for algorithm**: GOOD - essential for eddy detection

---

## 5. Salinity

### Why It Matters
Salinity fronts mark boundaries between different water masses. Where freshwater runoff meets saltwater, nutrients concentrate and productivity spikes. The "halocline" (salinity gradient) can create density barriers that trap plankton at specific depths.

### Key Ranges
- **Open ocean**: 34-37 PSU (practical salinity units)
- **Nearshore/estuarine influence**: 28-34 PSU
- **Significant salinity front**: Change of 1+ PSU over a few km
- **River plume edge**: Where salinity transitions from <30 to >34 PSU -- productive fishing zone
- **Species tolerance**: Most offshore gamefish prefer >33 PSU; freshwater-influenced water (<30 PSU) pushes offshore species seaward

### Freshwater Runoff Effects
- 72% of commercially important species are linked to river flows for some part of their life cycle
- River plumes carry nutrients that fuel food chains extending far offshore
- The boundary between the fresh plume and saltwater creates a convergence zone
- Major rivers (Mississippi, Amazon, Congo) create plumes extending 100-1000 km offshore
- Shrimp, crabs, and many juvenile fish depend on the nutrient-rich mixing zone

### Data Sources
- **SMAP (NASA)**: ~40km resolution, weekly
- **SMOS (ESA)**: ~50km resolution, weekly
- **HYCOM model**: 0.08° (~9km), daily
- **Copernicus Marine Service**: 1/4° (~25km), daily
- **Feasibility for algorithm**: MODERATE - coarse resolution limits usefulness for fine-scale features

---

## 6. Bathymetry / Bottom Structure

### Why It Matters
Underwater topography is a STATIC variable (doesn't change) that creates persistent fishing features. Depth changes force currents upward (upwelling), concentrate bait, and provide habitat. Any structure in otherwise featureless ocean bottom attracts and holds fish.

### Key Bathymetric Features

| Feature | Why It Matters | Typical Depth |
|---------|---------------|---------------|
| Continental shelf break | Dramatic depth change forces upwelling; boundary between coastal and pelagic zones | 100-200m (330-660 ft) |
| Submarine canyons | Funnel nutrients and bait; create current acceleration zones | Varies, 200-2000m |
| Seamounts | Upwelling on upcurrent side; attract pelagic species | Summit 50-500m from surface |
| Ledges/drop-offs | Depth changes create current deflection; bottom fish habitat | Any depth |
| Humps/high spots | Current deflection creates upwelling; aggregation points | Any depth |
| Artificial reefs/wrecks | Structure in otherwise featureless bottom | Any depth |
| Oil/gas platforms (Gulf) | Act as massive FADs; attract entire food chain | Any depth |

### Algorithm Application
- Compute bathymetric gradient (rate of depth change) -- steep gradients = edges
- Flag where SST/chlorophyll breaks align with bathymetric features (these are "triple threat" spots)
- Use the up-current side of seamounts and ledges as higher-probability zones
- Continental shelf break is a persistent feature that should always be scored

### Data Sources
- **GEBCO (General Bathymetric Chart of the Oceans)**: 15 arc-second (~450m) global
- **ETOPO1/ETOPO2 (NOAA)**: 1 arc-minute (~1.8km) global
- **NOAA high-res coastal bathymetry**: 1/3 arc-second (~10m) for US waters
- **NOAA ENC (Electronic Navigational Charts)**: Variable, detailed nearshore
- **Feasibility for algorithm**: EXCELLENT - static data, compute once, always relevant

---

## 7. Water Clarity / Turbidity

### Why It Matters
Water clarity affects how predators hunt. Most offshore gamefish are visual predators -- they need reasonably clear water to see and chase bait. But extremely clear water with no productivity is a desert. The ideal is productive water that's still clear enough for visual hunting.

### Ideal Ranges
- **Tuna optimal Secchi depth**: 15-35 meters
- **Billfish**: Prefer clear blue water (Secchi >20m), hunt along edges of green water
- **Mahi-mahi**: Moderate clarity, often found at color breaks
- **Inshore species**: Tolerate more turbidity, 3-10m Secchi depth
- **Rule of thumb**: Best fishing is at the TRANSITION between clear and turbid water (the color break)

### Satellite Proxy
- Water clarity is inversely related to chlorophyll-a and suspended sediment
- Kd490 (diffuse attenuation coefficient at 490nm) is a satellite-derived measure of water clarity
- Low Kd490 = clear water; High Kd490 = turbid water
- Color breaks visible in true-color satellite imagery

### Data Sources
- **MODIS/VIIRS Kd490**: ~1km, daily
- **True color imagery (MODIS, VIIRS, Sentinel-2)**: 250m-1km, daily
- **Feasibility for algorithm**: GOOD - can derive from chlorophyll data or use dedicated Kd490 product

---

## 8. Moon Phase and Tidal Currents

### Why It Matters
The moon drives tidal flows, which move bait and create feeding opportunities. The scientific consensus is that fish respond to TIDAL CURRENT, not the moon phase itself. New and full moons produce the strongest tides (spring tides), increasing current flow and fish activity.

### Key Findings
- **New moon and full moon**: Produce spring tides (strongest tidal flow) -- generally best fishing
- **Quarter moons**: Produce neap tides (weakest flow) -- generally slower fishing
- **Best inshore/nearshore**: Fish moving water during spring tides, particularly the first hour of incoming/outgoing tide
- **Offshore pelagic**: Less direct tidal effect, but moonlight affects nocturnal feeding
- **Night fishing**: Dark (new moon) nights are better for swordfish and some tuna species (less light = fish come shallower)
- **Scientific caveat**: Mixed empirical evidence; many confounding variables

### Algorithm Application
- Moon phase is easily computed (deterministic, no data feed needed)
- Apply as a modifier (multiplier) to the overall score, not a primary driver
- Weight more heavily for nearshore/reef species than deep offshore pelagics
- New/full moon = 1.0-1.2x multiplier; quarter moons = 0.8-0.9x

### Data Sources
- **Computed astronomically**: Perfect accuracy, infinite resolution
- **NOAA tide predictions**: Station-based, hourly
- **Feasibility for algorithm**: EXCELLENT - trivial to compute

---

## 9. Barometric Pressure and Pressure Changes

### Why It Matters
Barometric pressure changes correlate with weather fronts, and many anglers report increased feeding activity during falling pressure (before storms) and stable high-pressure periods. Scientific evidence is mixed -- pressure changes at depth are trivial compared to hydrostatic pressure, but the correlation with weather patterns is real.

### Key Thresholds
- **Normal/stable (best overall)**: 29.70 - 30.40 inHg (1006-1030 hPa)
- **Falling rapidly (feeding frenzy window)**: Drop of 0.10+ inHg in 3 hours
- **Best bite for tuna**: 29.70-30.20 inHg and falling
- **Rising after storm**: Good fishing 1-2 days after front passes as pressure stabilizes
- **Very high pressure (>30.50 inHg)**: Often corresponds to bluebird days -- fish can be sluggish
- **Very low pressure (<29.60 inHg)**: Storm conditions, usually unfishable

### Algorithm Application
- Use rate of change (derivative) more than absolute value
- Falling pressure = increased score multiplier (1.1-1.3x)
- Stable moderate pressure = baseline (1.0x)
- Rapidly rising after storm = moderate boost (1.05-1.15x)
- High stable pressure (bluebird) = slight penalty (0.85-0.95x)

### Data Sources
- **NOAA GFS/NAM weather models**: Various resolution, hourly forecasts
- **NDBC buoy data**: Point measurements, hourly
- **Feasibility for algorithm**: GOOD - weather model data readily available

---

## 10. Wind Speed and Direction

### Why It Matters
Wind drives surface currents, affects wave state (fishability), moves bait, and creates upwelling. Wind blowing against current creates rips that concentrate bait. Wind direction relative to coastline determines if upwelling occurs.

### Ideal Conditions
- **Optimal for offshore fishing**: 5-15 mph (5-13 knots)
- **Sweet spot for feeding activity**: ~15 mph -- enough water movement to trigger feeding
- **Above 20 mph**: Generally too rough for most offshore fishing
- **Calm (< 5 mph)**: Fishable but often slower bite; fish can see boat/lines easily
- **Wind against current**: Creates rips and choppy conditions that concentrate bait at surface -- excellent for fishing but uncomfortable seas

### Wind Direction Effects
- **Offshore wind (land to sea)**: Pushes surface water offshore, can trigger upwelling nearshore
- **Onshore wind (sea to land)**: Pushes bait and debris toward shore, good for nearshore species
- **Alongshore wind**: Drives Ekman transport and coastal upwelling (N. Hemisphere: wind from north along west-facing coast = upwelling)
- **Pre-frontal (south/southeast in N. Hemisphere)**: Often associated with feeding activity before cold front arrival

### Data Sources
- **GFS/NAM weather models**: Various resolution, hourly
- **ASCAT satellite scatterometer**: 25km, twice daily
- **NDBC buoy data**: Point measurements, hourly
- **Feasibility for algorithm**: EXCELLENT - high-quality forecast data readily available

---

## 11. Wave Height / Sea State

### Why It Matters
Wave height determines fishability (safety/comfort) and affects bait behavior. Moderate seas can improve fishing by stirring up bait; heavy seas make fishing impossible.

### Fishability Thresholds
- **< 2 ft, period > 6 sec**: Near-calm, excellent fishing conditions
- **2-3 ft, period > 6 sec**: Comfortable, good fishing
- **3-4 ft, period > 8 sec**: Moderate, fishable for experienced anglers
- **4-6 ft**: Rough, only experienced crews, reduced fishing effectiveness
- **> 6 ft**: Generally unfishable for recreational/sportfishing
- **Rule of thumb**: Wave height x 2 should be less than wave period (in seconds) for comfortable conditions

### Effect on Fishing
- Post-storm settling seas often produce excellent fishing as fish resume feeding
- Moderate chop (2-3 ft) can be better than dead calm for trolling (boat action improves lure presentation)
- Long-period swells (>10 sec) are much more comfortable than short-period wind waves even at same height

### Data Sources
- **NOAA WaveWatch III model**: Various resolution, 3-hourly
- **NDBC buoy data**: Point measurements, hourly
- **Copernicus wave products**: 1/12° global, 3-hourly
- **Feasibility for algorithm**: EXCELLENT - primarily a fishability filter, not a hotspot indicator

---

## 12. Time of Day / Sun Angle

### Why It Matters
Most pelagic species are crepuscular feeders -- most active at dawn and dusk. Low-light conditions give predators an advantage over prey. Thermocline depth changes with solar heating throughout the day.

### Key Windows
- **Dawn (30 min before to 90 min after sunrise)**: Prime feeding window, strongest bite
- **Dusk (90 min before to 30 min after sunset)**: Second-strongest feeding window
- **Midday (10am-2pm)**: Generally slowest period; fish go deeper to avoid light/heat
- **Night**: Best for swordfish (rise to surface), certain tuna species, and live-bait fishing
- **Overcast days**: Extend the dawn/dusk feeding behavior throughout the day

### Algorithm Application
- Time of day is a MODIFIER, not a location-specific variable
- Dawn/dusk hours: 1.2-1.5x multiplier
- Midday: 0.7-0.8x multiplier
- Night: Species-dependent (1.3x for swordfish, 0.3x for most others)
- Cloud cover can flatten this curve

### Data Sources
- **Computed astronomically**: Sunrise/sunset times for any location
- **Cloud cover from weather models**: Modifies the effect
- **Feasibility for algorithm**: EXCELLENT - trivial to compute

---

## 13. Dissolved Oxygen

### Why It Matters
Fish need oxygen. Dissolved oxygen (DO) sets the vertical habitat limits for most pelagic species. Low-oxygen zones (oxygen minimum zones, or OMZs) compress the usable water column, forcing fish into shallower layers where they are more catchable.

### Key Thresholds
- **Billfish minimum**: 3.5 mg/L (will dive to areas with 1.5 mg/L briefly)
- **Albacore tuna minimum**: 2.5 mg/L
- **Yellowfin tuna**: Respond to low DO by staying shallower
- **Bigeye tuna**: Most tolerant of low DO -- forage below thermocline in OMZ
- **Dead zones (Gulf of Mexico)**: DO < 2 mg/L -- most fish leave these areas
- **Healthy offshore water**: > 5 mg/L at surface

### Habitat Compression Effect
When the oxygen minimum zone shoals (rises closer to surface), it compresses the usable water column. This concentrates fish in a thinner surface layer, making them more accessible to fishing. This is particularly relevant in the Eastern Tropical Pacific.

### Data Sources
- **Copernicus CMEMS Global Biogeochemistry**: 1/4° (~25km), 50 depth levels, daily forecast / monthly hindcast
- **HYCOM does NOT include DO** (temperature, salinity, velocity only)
- **Argo floats with BGC sensors**: Sparse coverage, real-time
- **Feasibility for algorithm**: MODERATE - coarse resolution, model-derived, but useful for habitat compression scoring

---

## 14. Thermocline Depth

### Why It Matters
The thermocline is a sharp temperature gradient that separates warm surface water from cold deep water. It acts as a "floor" for many surface-feeding species and a "ceiling" for deep species. Thermocline depth determines how deep fish can be found and how accessible they are to different fishing methods.

### Key Relationships
- **Shallow thermocline (30-50m)**: Concentrates pelagic fish near surface; good for trolling
- **Deep thermocline (100-200m)**: Fish spread across deeper water column; harder to target
- **Yellowfin tuna**: 97.6% of time above 200m, 71% above 50m -- strongly influenced by thermocline
- **Bigeye tuna**: Regularly dive below thermocline to forage in cooler, oxygen-depleted water
- **Swordfish**: Daytime below thermocline (300-600m), nighttime above (surface to 100m)
- **Billfish**: Generally stay above thermocline

### Algorithm Application
- Shallow thermocline = higher surface fishing score
- Can be estimated from SST + climatological mixed-layer depth
- Warm-core eddies deepen the thermocline; cold-core eddies raise it

### Data Sources
- **HYCOM model**: Mixed layer depth available, 0.08°, daily
- **Copernicus CMEMS**: Temperature profiles, 1/4°, daily
- **Argo float profiles**: Sparse but precise
- **Climatological MLD datasets**: Monthly averages
- **Feasibility for algorithm**: MODERATE - model data available but indirect fishing relevance

---

## 15. Bioluminescence / Plankton Blooms

### Why It Matters
Bioluminescent plankton indicates high biological productivity and can indicate areas where the food chain is active. However, harmful algal blooms (HABs) can create dead zones.

### Current State
- **Satellite detection**: Limited. NASA MODIS/HICO can detect some bioluminescent blooms (e.g., Noctiluca scintillans "blue tears")
- **Milky seas**: Detected by low-light satellite sensors (VIIRS Day-Night Band) -- very large events only
- **Practical limitation**: Most bioluminescence occurs at night and below surface -- not reliably detectable from satellites
- **HAB detection**: Chlorophyll-a anomalies and specific spectral signatures can indicate harmful blooms to AVOID

### Data Sources
- **VIIRS Day-Night Band**: Can detect large bioluminescent events
- **HAB bulletins from NOAA**: Regional, weekly
- **Feasibility for algorithm**: LOW - not reliable enough for automated scoring; use chlorophyll-a as proxy

---

## 16. Upwelling Zones

### Why It Matters
Upwelling brings cold, nutrient-rich deep water to the surface, fueling massive phytoplankton blooms that support entire food chains. 25% of global marine fish catch comes from upwelling zones, which cover only 5% of ocean area.

### Indicators of Upwelling
- **Cool SST anomaly**: Localized cold spot relative to surrounding water
- **Elevated chlorophyll-a**: Phytoplankton bloom following nutrient injection (lag of days to weeks)
- **Negative SSH anomaly**: Depressed sea surface in upwelling areas
- **Alongshore winds**: Wind parallel to coast (N. Hemisphere: northerly winds on west coast) drives Ekman transport offshore, pulling deep water up
- **Wind stress curl**: Positive curl drives Ekman pumping (slower upwelling)

### Types
1. **Coastal upwelling**: Wind-driven, along continental margins (California, Peru, NW Africa, Benguela)
2. **Equatorial upwelling**: Trade wind-driven divergence along the equator
3. **Eddy-driven upwelling**: Cold-core (cyclonic) eddies pump nutrients upward
4. **Topographic upwelling**: Currents forced upward by seamounts, shelf breaks

### Fishing Implications
- Upwelling itself creates cold, turbid water that most gamefish avoid initially
- The EDGES of upwelling plumes -- where nutrient-rich water meets warmer offshore water -- are prime fishing zones
- Time lag: Best fishing is typically 1-3 weeks after upwelling event, after phytoplankton bloom matures and baitfish arrive
- Look for: Cool SST + elevated chlorophyll + temperature break at the upwelling boundary

### Data Sources
- **Derived from SST, chlorophyll, SSH, and wind data**: No single "upwelling" product needed
- **NOAA upwelling indices**: Regional, daily (e.g., Pacific Fisheries Environmental Lab)
- **Feasibility for algorithm**: GOOD - can be derived from existing variables (SST anomaly + chlorophyll + wind direction)

---

## 17. River Outflow / Freshwater Plumes

### Why It Matters
Major rivers inject massive amounts of nutrients into coastal and offshore waters. The boundary between the freshwater plume and saltwater creates a productive convergence zone. But excessive nutrient loading can cause hypoxic dead zones.

### Key Features
- **Mississippi River plume**: Extends hundreds of miles into the Gulf; delivers 80% of freshwater, 91% of nitrogen load to northern Gulf
- **Dead zone**: Every summer, nutrient overload creates a hypoxic zone (< 2 mg/L DO) off the TX-LA shelf -- fish flee this area
- **Productive zone**: The OUTER EDGE of the plume where nutrients meet clear oceanic water is highly productive
- **Salinity front**: Transition from <30 PSU (river-influenced) to >34 PSU (oceanic) marks the productive boundary
- **Nutrient "sandwich"**: Between the turbid inner plume and clear ocean water, optimal light + nutrients create phytoplankton hotspots

### Algorithm Application
- Identify river plume boundaries from salinity data or satellite true color imagery
- Score the edges positively, the dead zone core negatively
- Seasonal -- strongest during spring runoff and monsoon seasons
- Gulf of Mexico: Mississippi River plume is a dominant feature from March-September

### Data Sources
- **SMAP/SMOS salinity**: ~40-50km, weekly
- **MODIS/VIIRS true color**: Shows turbidity plumes, ~1km, daily
- **USGS river discharge data**: Real-time streamflow for major rivers
- **HYCOM salinity**: 0.08°, daily
- **Feasibility for algorithm**: MODERATE - low-resolution salinity; use true color and river discharge as proxies

---

## 18. FADs (Fish Aggregating Devices) / Floating Debris / Weedlines

### Why It Matters
Fish are irresistibly attracted to floating objects. Even a single plank of wood in open ocean can aggregate mahi-mahi, tuna, wahoo, and billfish. Sargassum weedlines concentrate massive amounts of bait and predators along their edges.

### Types
- **Natural FADs**: Sargassum weedlines, floating logs, dead whales, jellyfish aggregations
- **Man-made FADs**: Deployed buoys, lost gear, shipping debris
- **The Great Atlantic Sargassum Belt**: Stretches from West Africa to Gulf of Mexico; currents and eddies concentrate it into lines

### Satellite Detection Status
- **Sargassum detection**: OPERATIONAL. NOAA NESDIS, USF Optical Oceanography Lab, and CARICOOS provide satellite-based Sargassum tracking
- **Resolution**: New systems achieving ~50m resolution (up from several km)
- **Sensors**: MODIS, VIIRS, Sentinel-3 OLCI, Landsat OLI, GOES ABI
- **Algorithms**: Specific spectral signatures of floating Sargassum (AFAI - Alternative Floating Algae Index)
- **Drift models**: Once detected, drift forecasting predicts where Sargassum will move
- **Individual FADs**: Not detectable by satellite (too small); commercial FADs use GPS buoys with satellite uplink

### Algorithm Application
- Incorporate Sargassum density/presence data where available
- Weight weedline EDGES more than solid mats (fish patrol the edges)
- Combine with current data to predict where debris lines will form (convergence zones)
- Any floating structure in open water = significant score boost

### Data Sources
- **NOAA Sargassum Watch**: Atlantic/Gulf, ~1km, weekly
- **USF Optical Oceanography Lab**: Caribbean/Atlantic, daily
- **CARICOOS Sargassum Tracker**: Caribbean, near-real-time
- **Feasibility for algorithm**: MODERATE-GOOD - Sargassum data available for Atlantic/Gulf; no general "floating debris" satellite detection exists

---

## 19. Species-Specific Preferences Summary

### Atlantic Species

| Species | SST (°F) | Depth (ft) | Chlorophyll Preference | Structure | Key Feature |
|---------|----------|-----------|----------------------|-----------|-------------|
| Yellowfin Tuna | 75-82 | 0-650 | Edges of 0.2-1.0 mg/m³ | Canyon edges, seamounts | SST breaks on Gulf Stream edge |
| Bluefin Tuna | 60-72 | 0-3000+ | Productive water 0.5-2.0 | Shelf break, canyons | Cooler water, high productivity |
| Bigeye Tuna | 62-74 | 150-1500 | Less important (deep feeder) | Seamounts, thermal fronts | Deep thermocline, warm-core eddies |
| Mahi-Mahi | 74-80 | 0-250 | Color breaks | Weedlines, FADs, debris | Floating structure is #1 factor |
| Wahoo | 73-78 | 0-400 | Clean blue water edge | Shelf break, drop-offs | SST breaks, full/new moon |
| Blue Marlin | 74-82 | 0-600 | Blue water (< 0.3 mg/m³) | Canyon edges, current edges | Warm Gulf Stream water, SST breaks |
| White Marlin | 70-80 | 0-500 | Blue-green transition | Canyons, 100-fathom curve | Slightly cooler than blue marlin |
| Sailfish | 72-82 | 0-200 | Blue-green edges | Reef edges, current breaks | Shallower than other billfish |
| Swordfish | 64-72 (surface) | 0-2000+ | Productive areas | Deep canyons, shelf break | Night: surface; Day: deep |

### Gulf of Mexico Species

| Species | SST (°F) | Depth (ft) | Structure | Key Feature |
|---------|----------|-----------|-----------|-------------|
| Yellowfin Tuna | 75-82 | 0-650 | Oil rigs, blue water ledges | Loop Current eddies, rigs |
| Red Snapper | 55-70 | 60-400 | Reefs, wrecks, platforms, ledges | Bottom structure is #1 factor |
| Grouper | 65-78 | 30-200 | Rocky bottom, ledges, reef | Bottom structure, live bottom |
| King Mackerel | 70-78 | 30-200 | Reefs, wrecks, passes | Migration corridors, bait schools |
| Cobia | 68-78 | 20-200 | Buoys, platforms, wrecks | Structure-oriented; spring migration |
| Mahi-Mahi | 74-80 | 0-250 | Weedlines, rigs, debris | Sargassum lines, color breaks |

### Pacific Species

| Species | SST (°F) | Depth (ft) | Structure | Key Feature |
|---------|----------|-----------|-----------|-------------|
| Yellowfin Tuna | 68-82 | 0-650 | Seamounts, banks, current edges | Warm-water intrusions, El Nino years |
| Pacific Bluefin | 60-72 | 0-1600 | Banks, islands, current edges | Cooler California Current edge |
| Striped Marlin | 68-76 | 0-500 | Banks, seamounts | SST breaks, bait schools |
| Dorado (Mahi) | 72-80 | 0-200 | Kelp paddies, debris | Floating structure, warm water |
| Yellowtail | 62-72 | 0-400 | Islands, banks, kelp beds | Structure + cool current edges |
| Albacore | 62-65 | 0-1000 | Blue water edge | Very narrow SST preference |

---

## 20. Interaction Effects and Composite Scoring

### The "Triple Threat" and Beyond

The most productive fishing spots occur where multiple favorable variables converge. Professional anglers use a "point system" -- the more factors that line up, the higher the probability.

### Tier 1 Variables (Highest Predictive Power)
These should carry the most weight in any scoring algorithm:

1. **SST gradient/break** (35-40% of score weight)
   - Temperature within species range AND a gradient present
   - Gradient strength matters: stronger = better
   
2. **Chlorophyll-a edge** (20-25% of score weight)
   - Color break present in fishable chlorophyll range
   - Best when co-located with SST break

3. **Bathymetric feature** (15-20% of score weight)
   - Continental shelf break, canyon, seamount, or ledge
   - Static -- always active

### Tier 2 Variables (Important Modifiers)
4. **Current edge / eddy boundary** (10-15%)
   - SSH anomaly indicating eddy edges
   - Current convergence zones
   
5. **Floating structure** (5-10% when present)
   - Sargassum weedlines
   - Debris convergence zones

### Tier 3 Variables (Condition Modifiers)
Applied as multipliers to the base score:

6. **Wind/sea state** -- Fishability filter (0.0 to 1.0 multiplier)
7. **Moon phase** -- Activity modifier (0.8 to 1.2)
8. **Barometric pressure trend** -- Bite rate modifier (0.85 to 1.3)
9. **Time of day** -- Feeding window modifier (0.7 to 1.5)
10. **Salinity front** -- Bonus when co-located with other features

### The "Triple Threat" Combination
**SST break + Chlorophyll edge + Bathymetric feature** = Highest probability fishing zone

When all three align in the same area, the probability of finding fish is dramatically higher than any single variable. Example: A temperature break that runs along the 100-fathom curve at the continental shelf break, with a color change visible in satellite imagery.

### "Grand Slam" Combination
**SST break + Chlorophyll edge + Bathymetric feature + Current convergence + Floating debris/weedline** = Exceptional. Drop everything and go fishing.

### Proposed Scoring Formula

```
BASE_SCORE = (
    SST_gradient_score * 0.35 +
    Chlorophyll_edge_score * 0.25 +
    Bathymetry_score * 0.18 +
    Current_edge_score * 0.12 +
    Floating_structure_score * 0.10
) * species_temp_match_factor

FINAL_SCORE = BASE_SCORE
    * wind_sea_state_factor        // 0.0-1.0 (fishability gate)
    * moon_phase_factor            // 0.8-1.2
    * barometric_pressure_factor   // 0.85-1.3
    * time_of_day_factor           // 0.7-1.5
    * upwelling_bonus              // 1.0-1.3 (if upwelling indicators present)
    * salinity_front_bonus         // 1.0-1.15 (if co-located)
```

### Temporal Considerations
- SST and chlorophyll data: Use most recent cloud-free composite (1-3 days)
- Currents/SSH: Updated daily
- Bathymetry: Static, precomputed
- Weather/sea state: Use forecast data, valid for 24-72 hours
- Moon/time of day: Computed, always current

### Spatial Resolution Target
- Aim for 1km grid cells for the heat map
- SST and chlorophyll provide the finest resolution (~1km)
- Coarser data (currents, SSH at ~25km) should be interpolated or used as regional modifiers
- Bathymetry can be at native resolution (~450m GEBCO)

---

## Data Source Summary

| Variable | Primary Source | Resolution | Update Frequency | API Available |
|----------|---------------|-----------|-----------------|---------------|
| SST | NOAA GHRSST / GOES | 1km | Daily/Hourly | Yes (ERDDAP) |
| Chlorophyll-a | NASA OC / NOAA CoastWatch | 1-4km | Daily | Yes (ERDDAP) |
| Ocean Currents | HYCOM / OSCAR | 9-33km | Daily/5-day | Yes (OPeNDAP) |
| SSH Anomaly | AVISO+ / Copernicus | 25km | Daily | Yes (Copernicus) |
| Salinity | HYCOM / SMAP | 9-50km | Daily/Weekly | Yes (ERDDAP) |
| Bathymetry | GEBCO / ETOPO | 450m-1.8km | Static | Yes (download) |
| Wind | GFS / ASCAT | 25km-0.25° | Hourly/12hr | Yes (NOMADS) |
| Waves | WaveWatch III | 0.5° | 3-hourly | Yes (NOMADS) |
| Barometric Pressure | GFS / NDBC Buoys | 0.25° | Hourly | Yes (NOMADS) |
| Moon Phase | Computed | N/A | N/A | Computed locally |
| Dissolved Oxygen | Copernicus CMEMS BGC | 25km, 50 levels | Daily | Yes (Copernicus) |
| Sargassum | NOAA/USF | 1km | Weekly/Daily | Partial |
| Mixed Layer Depth | HYCOM | 9km | Daily | Yes (OPeNDAP) |

---

## Implementation Priority

### Phase 1 (Core - Highest Impact)
1. SST gradient detection (edge detection algorithm on SST field)
2. Chlorophyll-a edge detection (same algorithm on chlorophyll field)
3. Bathymetric gradient (precomputed from GEBCO/ETOPO)
4. Species temperature range filtering
5. Basic composite scoring

### Phase 2 (Enhanced)
6. SSH anomaly / eddy detection integration
7. Current edge detection from HYCOM
8. Sargassum/weedline overlay (where available)
9. Wind/sea state fishability filter
10. Moon phase and time-of-day modifiers

### Phase 3 (Advanced)
11. Barometric pressure trend scoring
12. Upwelling detection (derived from SST + wind + chlorophyll)
13. River plume boundary detection
14. Dissolved oxygen / habitat compression
15. Mixed layer depth / thermocline scoring

---

## Key Algorithm Design Notes

1. **Edge detection is paramount**: The Sobel operator or Canny edge detection applied to SST and chlorophyll fields will identify the most important fishing features (temperature breaks and color breaks).

2. **Gradient magnitude matters**: Not just presence/absence of an edge, but HOW STEEP the gradient is. Steeper = more fish concentration.

3. **Co-location multiplier**: When multiple edges coincide spatially, the score should increase non-linearly (not just additively). A SST break co-located with a chlorophyll edge is worth more than the sum of each individually.

4. **Species context is critical**: A 60°F zone with a great temperature break is worthless for mahi-mahi but excellent for bluefin tuna. The species temperature match must gate everything.

5. **Temporal decay**: Satellite data has a freshness factor. A 1-day-old SST image is much more reliable than a 5-day composite. Apply confidence decay to older data.

6. **Cloud masking**: Satellite ocean color and SST data have gaps from clouds. The algorithm must handle missing data gracefully -- use the most recent cloud-free observation per pixel, with a confidence/age flag.

7. **Persistence scoring**: Features that persist for multiple days are more reliable than one-day anomalies. A temperature break that shows up on 3 consecutive daily images is more trustworthy.
