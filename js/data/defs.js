// Static game data: zones, buildings, milestones, economy constants.

export const ZONE = { NONE: 0, R: 1, C: 2, I: 3 };
export const ZONE_NAMES = ['', 'Residential', 'Commercial', 'Industrial'];
export const ZONE_SHORT = ['', 'R', 'C', 'I'];
export const DENSITY_NAMES = ['', 'Low', 'Medium', 'High'];
export const DENSITY_TIERS = [null, [1, 2], [3, 4], [5, 6]];
export const ZONE_COST = [0, 5, 12, 25];

// Capacity per tier (tier 6 is the merged 2x2 tower/complex).
export const ZONE_CAP = {
  1: [0, 8, 18, 46, 104, 260, 1600],   // residents
  2: [0, 6, 14, 36, 84, 220, 1350],    // jobs
  3: [0, 14, 30, 62, 112, 170, 980],   // jobs
};
// Desirability needed to reach a tier (0..255 scale).
export const TIER_DESIRE = [0, 0, 70, 95, 120, 150, 178];

export const TIER_NAMES = {
  1: ['', 'Cottage', 'Family house', 'Townhouses', 'Apartment block', 'Residential tower', 'Residential complex'],
  2: ['', 'Corner shop', 'Shopping row', 'Office building', 'Business center', 'Office tower', 'Financial plaza'],
  3: ['', 'Workshop', 'Warehouse', 'Factory', 'Assembly plant', 'Processing works', 'Industrial complex'],
};

export const ROAD_COST = 10;
export const BRIDGE_COST = 60;
export const PLINE_COST = 5;
export const TREE_COST = 4;
export const DEMOLISH_COST = 5;

export const CATS = [
  { id: 'power', name: 'Power' },
  { id: 'water', name: 'Water' },
  { id: 'safety', name: 'Safety' },
  { id: 'health', name: 'Health' },
  { id: 'edu', name: 'Education' },
  { id: 'parks', name: 'Parks' },
  { id: 'landmark', name: 'Landmarks' },
];

// Service / utility buildings. size = footprint (square). unlock = milestone index.
// cov: coverage map written to, r: radius, lv: land value bonus at center, happy: approval contribution.
export const BUILDINGS = {
  coal:      { name: 'Coal Power Plant', cat: 'power', size: 3, cost: 4000, upkeep: 110, power: 700, pollution: 230, unlock: 0, dept: 'utilities',
               desc: 'Cheap, reliable and dirty. Keep it far from homes.' },
  wind:      { name: 'Wind Turbine', cat: 'power', size: 1, cost: 320, upkeep: 6, power: 22, unlock: 0, dept: 'utilities',
               desc: 'Small, clean output. Works best in clusters.' },
  solar:     { name: 'Solar Farm', cat: 'power', size: 3, cost: 4800, upkeep: 35, power: 200, unlock: 1, dept: 'utilities',
               desc: 'Clean energy across a broad field of panels.' },
  gas:       { name: 'Gas Power Plant', cat: 'power', size: 2, cost: 6500, upkeep: 150, power: 520, pollution: 70, unlock: 2, dept: 'utilities',
               desc: 'Compact and much cleaner than coal.' },
  nuclear:   { name: 'Nuclear Plant', cat: 'power', size: 4, cost: 24000, upkeep: 480, power: 3400, unlock: 4, dept: 'utilities',
               desc: 'Enormous zero-emission output for a big city.' },

  pump:      { name: 'Water Pump', cat: 'water', size: 1, cost: 450, upkeep: 14, water: 520, unlock: 0, needsWater: true, dept: 'utilities',
               desc: 'Must sit next to a lake, river or sea. Feeds water mains under your roads.' },
  wtower:    { name: 'Water Tower', cat: 'water', size: 1, cost: 700, upkeep: 18, water: 200, unlock: 0, dept: 'utilities',
               desc: 'Pumps groundwater anywhere. Lower output than a pump.' },
  treatment: { name: 'Water Works', cat: 'water', size: 3, cost: 7500, upkeep: 160, water: 3400, unlock: 3, needsWater: true, dept: 'utilities',
               desc: 'Large intake and filtration plant on the waterfront.' },

  police:    { name: 'Police Station', cat: 'safety', size: 2, cost: 1200, upkeep: 55, cov: 'police', r: 15, unlock: 0, dept: 'police',
               desc: 'Patrols reduce crime in the surrounding blocks.' },
  policehq:  { name: 'Police Headquarters', cat: 'safety', size: 3, cost: 5200, upkeep: 190, cov: 'police', r: 27, unlock: 3, dept: 'police',
               desc: 'Citywide dispatch with a wide patrol radius.' },
  fire:      { name: 'Fire Station', cat: 'safety', size: 2, cost: 1200, upkeep: 55, cov: 'fire', r: 15, unlock: 0, dept: 'fire',
               desc: 'Prevents and fights building fires nearby.' },
  firehq:    { name: 'Fire Headquarters', cat: 'safety', size: 3, cost: 5200, upkeep: 190, cov: 'fire', r: 27, unlock: 3, dept: 'fire',
               desc: 'Heavy engines and a long response radius.' },

  clinic:    { name: 'Clinic', cat: 'health', size: 2, cost: 1500, upkeep: 65, cov: 'health', r: 14, unlock: 1, dept: 'health',
               desc: 'Neighborhood care keeps residents healthy.' },
  hospital:  { name: 'Hospital', cat: 'health', size: 3, cost: 7200, upkeep: 250, cov: 'health', r: 28, unlock: 3, dept: 'health',
               desc: 'Full hospital with emergency services.' },

  school:    { name: 'Primary School', cat: 'edu', size: 2, cost: 1500, upkeep: 65, cov: 'edu', r: 14, unlock: 1, dept: 'edu',
               desc: 'Basic education. Educated citizens want offices over factories.' },
  library:   { name: 'Public Library', cat: 'edu', size: 2, cost: 2400, upkeep: 55, cov: 'edu', r: 18, lv: 25, unlock: 2, dept: 'edu',
               desc: 'Raises education and nearby land value.' },
  highschool:{ name: 'High School', cat: 'edu', size: 3, cost: 5200, upkeep: 170, cov: 'edu', r: 22, unlock: 2, dept: 'edu',
               desc: 'Secondary education for a growing town.' },
  university:{ name: 'University', cat: 'edu', size: 4, cost: 19000, upkeep: 420, cov: 'edu', r: 40, lv: 40, unlock: 4, dept: 'edu',
               desc: 'Draws high-tech industry and office demand.' },

  park:      { name: 'Pocket Park', cat: 'parks', size: 1, cost: 150, upkeep: 3, cov: 'park', r: 5, lv: 30, unlock: 0, dept: 'parks',
               desc: 'A patch of green. Lifts land value nearby.' },
  playground:{ name: 'Playground', cat: 'parks', size: 1, cost: 260, upkeep: 4, cov: 'park', r: 6, lv: 30, unlock: 1, dept: 'parks',
               desc: 'Families love living near one.' },
  plaza:     { name: 'Town Square', cat: 'parks', size: 2, cost: 700, upkeep: 10, cov: 'park', r: 7, lv: 45, unlock: 1, dept: 'parks',
               desc: 'Paved square with a fountain. Boosts commerce.' },
  pond:      { name: 'Pond Garden', cat: 'parks', size: 2, cost: 950, upkeep: 12, cov: 'park', r: 8, lv: 55, unlock: 2, dept: 'parks',
               desc: 'Quiet water garden. Very desirable.' },
  bigpark:   { name: 'Central Park', cat: 'parks', size: 3, cost: 2600, upkeep: 28, cov: 'park', r: 11, lv: 70, unlock: 2, dept: 'parks',
               desc: 'Lawns, paths and old trees.' },
  sports:    { name: 'Sports Ground', cat: 'parks', size: 3, cost: 3200, upkeep: 35, cov: 'park', r: 11, lv: 40, happy: 2, unlock: 3, dept: 'parks',
               desc: 'Pitch and track for the whole neighborhood.' },

  cityhall:  { name: 'City Hall', cat: 'landmark', size: 3, cost: 8000, upkeep: 90, cov: 'park', r: 16, lv: 60, happy: 4, unlock: 2, unique: true, dept: 'parks',
               desc: 'Seat of government. Raises approval.' },
  museum:    { name: 'Museum of Art', cat: 'landmark', size: 3, cost: 12500, upkeep: 140, cov: 'park', r: 20, lv: 75, happy: 3, unlock: 3, unique: true, dept: 'parks',
               desc: 'Culture brings commerce and pride.' },
  stadium:   { name: 'Stadium', cat: 'landmark', size: 4, cost: 26000, upkeep: 280, cov: 'park', r: 26, lv: 40, happy: 6, unlock: 4, unique: true, dept: 'parks',
               desc: 'Match days fill the streets.' },
  spire:     { name: 'Meridian Spire', cat: 'landmark', size: 2, cost: 60000, upkeep: 200, cov: 'park', r: 36, lv: 110, happy: 8, unlock: 5, unique: true, dept: 'parks',
               desc: 'An observation tower that defines your skyline.' },
};

export const POWER_USE = { 1: 1 / 12, 2: 1 / 9, 3: 1 / 5 };
export const WATER_USE = { 1: 1 / 10, 2: 1 / 12, 3: 1 / 8 };
export const SERVICE_POWER = 6;
export const SERVICE_WATER = 4;

export const MILESTONES = [
  { pop: 0,      name: 'Settlement', grant: 0 },
  { pop: 300,    name: 'Hamlet',     grant: 2000 },
  { pop: 1200,   name: 'Village',    grant: 5000, density: 2 },
  { pop: 4000,   name: 'Town',       grant: 10000 },
  { pop: 12000,  name: 'City',       grant: 20000, density: 3 },
  { pop: 35000,  name: 'Metropolis', grant: 40000 },
  { pop: 80000,  name: 'Megacity',   grant: 80000 },
];

export const DEPTS = [
  { id: 'roads', name: 'Roads' },
  { id: 'police', name: 'Police' },
  { id: 'fire', name: 'Fire' },
  { id: 'health', name: 'Health' },
  { id: 'edu', name: 'Education' },
  { id: 'parks', name: 'Parks & culture' },
  { id: 'utilities', name: 'Utilities' },
];

export const DIFFICULTY = {
  easy:   { funds: 50000, name: 'Relaxed', costMul: 0.8 },
  normal: { funds: 25000, name: 'Standard', costMul: 1 },
  hard:   { funds: 12000, name: 'Austere', costMul: 1.2 },
};

export const MAP_TYPES = {
  river:   { name: 'Riverlands', desc: 'A winding river splits fertile plains.' },
  coast:   { name: 'Coastline', desc: 'Sea along one side with sandy beaches.' },
  lakes:   { name: 'Lake District', desc: 'Scattered lakes and dense woods.' },
  bay:     { name: 'Bay', desc: 'A sheltered bay wraps around the land.' },
  plains:  { name: 'Open Plains', desc: 'Wide flat land, a single creek.' },
};

export const MAP_SIZES = { small: 72, medium: 100, large: 128 };
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAYS_PER_MONTH = 30;
