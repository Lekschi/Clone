// Building catalogue. Sizes are in grid cells (1 cell = one road tile).
// Costs are coins; `costStep` multiplies the price for every copy already built.

const B = [];
const add = (def) => B.push(def);

// --- Housing -------------------------------------------------------------------------------
add({ id: 'house', name: 'Wohngebiet', cat: 'res', size: [2, 2], cost: 60, costStep: 1.11, costCap: 9000, level: 1,
  res: { pop: 1, tax: 1, use: 1, label: 'Ausgewogen' },
  desc: 'Bürger ziehen ein. Mit Material ausbauen, damit mehr Menschen hier wohnen.' });
add({ id: 'workers', name: 'Arbeitersiedlung', cat: 'res', size: [2, 2], cost: 90, costStep: 1.11, costCap: 12000, level: 5,
  res: { pop: 1.35, tax: 0.75, use: 1.3, smog: 0.5, wants: 'basic', label: 'Viele Bewohner, wenig Steuern' },
  desc: 'Dicht bebaut und bodenständig. Stört sich kaum an Fabrikabgasen, braucht aber viel Strom und Wasser.' });
add({ id: 'villa', name: 'Villenviertel', cat: 'res', size: [2, 2], cost: 400, costStep: 1.13, costCap: 30000, level: 9,
  res: { pop: 0.55, tax: 2.4, use: 0.8, parks: 2, wants: 'luxury', label: 'Wenige Bewohner, hohe Steuern' },
  desc: 'Großzügige Häuser mit Garten und Pool. Parks in der Nähe machen die Bewohner doppelt glücklich – sie wünschen sich edle Waren.' });
add({ id: 'eco', name: 'Öko-Siedlung', cat: 'res', size: [2, 2], cost: 700, costStep: 1.13, costCap: 30000, level: 13,
  res: { pop: 1.05, tax: 1.1, use: 0.5, clean: 12, wants: 'green', label: 'Halber Strom- und Wasserbedarf' },
  desc: 'Gründächer, Solarzellen und Gemüsegärten. Verbraucht nur die Hälfte an Versorgung und liebt saubere Luft.' });

// --- Utilities -----------------------------------------------------------------------------
add({ id: 'wind', name: 'Windrad', cat: 'util', group: 'power', size: [1, 1], cost: 400, costStep: 1.12, level: 1, supply: { power: 8 },
  desc: 'Sauberer Strom für ein paar Häuser.' });
add({ id: 'coal', name: 'Kohlekraftwerk', cat: 'util', group: 'power', size: [2, 2], cost: 1600, costStep: 1.2, level: 3, supply: { power: 30 }, pollution: 4,
  desc: 'Viel Strom, aber die Nachbarschaft leidet unter dem Rauch.' });
add({ id: 'solar', name: 'Solarpark', cat: 'util', group: 'power', size: [2, 2], cost: 6000, costStep: 1.2, level: 8, supply: { power: 28 },
  desc: 'Strom aus Sonnenlicht, ohne Abgase.' });
add({ id: 'gas', name: 'Gaskraftwerk', cat: 'util', group: 'power', size: [2, 2], cost: 14000, costStep: 1.2, level: 12, supply: { power: 70 }, pollution: 3,
  desc: 'Leistungsstark und etwas sauberer als Kohle.' });
add({ id: 'nuclear', name: 'Kernkraftwerk', cat: 'util', group: 'power', size: [3, 3], cost: 48000, costStep: 1.3, level: 18, supply: { power: 180 },
  desc: 'Riesige Leistung für eine Metropole.' });

add({ id: 'watertower', name: 'Wasserturm', cat: 'util', group: 'water', size: [1, 1], cost: 450, costStep: 1.12, level: 1, supply: { water: 8 },
  desc: 'Frisches Wasser für die ersten Straßen.' });
add({ id: 'pump', name: 'Pumpwerk', cat: 'util', group: 'water', size: [2, 2], cost: 3200, costStep: 1.2, level: 5, supply: { water: 35 },
  desc: 'Fördert Grundwasser für ganze Viertel.' });
add({ id: 'waterworks', name: 'Wasserwerk', cat: 'util', group: 'water', size: [2, 2], cost: 16000, costStep: 1.2, level: 12, supply: { water: 85 },
  desc: 'Moderne Aufbereitung für die Großstadt.' });

add({ id: 'septic', name: 'Kleinkläranlage', cat: 'util', group: 'sewage', size: [1, 1], cost: 500, costStep: 1.12, level: 2, supply: { sewage: 8 }, pollution: 2,
  desc: 'Reinigt das Abwasser einiger Häuser. Riecht etwas.' });
add({ id: 'sewageplant', name: 'Klärwerk', cat: 'util', group: 'sewage', size: [2, 2], cost: 4000, costStep: 1.2, level: 8, supply: { sewage: 40 }, pollution: 3,
  desc: 'Große Kläranlage mit Faultürmen.' });
add({ id: 'ecosewage', name: 'Bio-Klärwerk', cat: 'util', group: 'sewage', size: [2, 2], cost: 18000, costStep: 1.2, level: 16, supply: { sewage: 95 },
  desc: 'Reinigt biologisch und geruchlos.' });

add({ id: 'dump', name: 'Mülldeponie', cat: 'util', group: 'waste', size: [2, 2], cost: 900, costStep: 1.15, level: 2, supply: { waste: 16 }, pollution: 4,
  desc: 'Hier landet der Abfall der Stadt.' });
add({ id: 'incinerator', name: 'Müllheizkraftwerk', cat: 'util', group: 'waste', size: [2, 2], cost: 7000, costStep: 1.2, level: 9, supply: { waste: 45, power: 6 }, pollution: 3,
  desc: 'Verbrennt Abfall und liefert nebenbei etwas Strom.' });
add({ id: 'recycling', name: 'Recyclingzentrum', cat: 'util', group: 'waste', size: [2, 2], cost: 20000, costStep: 1.2, level: 16, supply: { waste: 100 },
  desc: 'Trennt und verwertet Abfall ohne Schadstoffe.' });

// --- Services ------------------------------------------------------------------------------
add({ id: 'firesmall', name: 'Feuerwehrhaus', cat: 'service', group: 'fire', size: [1, 1], cost: 1200, costStep: 1.25, level: 3, service: { kind: 'fire', r: 6 },
  desc: 'Schützt die nähere Umgebung vor Bränden.' });
add({ id: 'firebig', name: 'Hauptfeuerwache', cat: 'service', group: 'fire', size: [2, 2], cost: 9000, costStep: 1.3, level: 9, service: { kind: 'fire', r: 10 },
  desc: 'Großer Löschzug mit weitem Einsatzgebiet.' });
add({ id: 'policesmall', name: 'Polizeiposten', cat: 'service', group: 'police', size: [1, 1], cost: 1500, costStep: 1.25, level: 4, service: { kind: 'police', r: 6 },
  desc: 'Streifen sorgen für Sicherheit im Viertel.' });
add({ id: 'policebig', name: 'Polizeipräsidium', cat: 'service', group: 'police', size: [2, 2], cost: 11000, costStep: 1.3, level: 9, service: { kind: 'police', r: 10 },
  desc: 'Zentrale mit großem Revier.' });
add({ id: 'clinic', name: 'Ärztehaus', cat: 'service', group: 'health', size: [1, 1], cost: 1800, costStep: 1.25, level: 5, service: { kind: 'health', r: 6 },
  desc: 'Hausärzte versorgen die Nachbarschaft.' });
add({ id: 'hospital', name: 'Krankenhaus', cat: 'service', group: 'health', size: [2, 2], cost: 13000, costStep: 1.3, level: 10, service: { kind: 'health', r: 11 },
  desc: 'Notaufnahme und Fachärzte für viele Viertel.' });

// --- Industry ------------------------------------------------------------------------------
const factoryMax = (lvl) => (lvl >= 15 ? 6 : lvl >= 11 ? 5 : lvl >= 8 ? 4 : lvl >= 5 ? 3 : lvl >= 2 ? 2 : 1);
add({ id: 'factory', name: 'Fabrik', cat: 'industry', size: [2, 2], cost: 500, costStep: 2.2, level: 1, factory: { slots: 2 }, pollution: 3, maxFn: factoryMax,
  desc: 'Stellt Rohstoffe her. Mehrere Aufträge laufen gleichzeitig.' });
add({ id: 'bigfactory', name: 'Großfabrik', cat: 'industry', size: [3, 2], cost: 12000, costStep: 1.8, level: 10, factory: { slots: 4 }, pollution: 4, max: 2,
  desc: 'Mehr Produktionsplätze, mehr Rauch.' });
add({ id: 'ecofactory', name: 'Öko-Fabrik', cat: 'industry', size: [2, 2], cost: 30000, costStep: 1.6, level: 14, factory: { slots: 3 }, max: 2,
  desc: 'Produziert ohne Schadstoffe – darf mitten in die Stadt.' });

// --- Commerce ------------------------------------------------------------------------------
add({ id: 'bausupply', name: 'Baumarkt', cat: 'commerce', size: [2, 2], cost: 300, level: 2, shop: 'bausupply', max: 1,
  desc: 'Verarbeitet Rohstoffe zu Baumaterial.' });
add({ id: 'hardware', name: 'Werkzeugladen', cat: 'commerce', size: [2, 2], cost: 900, level: 3, shop: 'hardware', max: 1,
  desc: 'Werkzeug für Handwerker und Heimwerker.' });
add({ id: 'farmers', name: 'Bauernmarkt', cat: 'commerce', size: [2, 2], cost: 1800, level: 4, shop: 'farmers', max: 1,
  desc: 'Frisches aus der Region.' });
add({ id: 'furniture', name: 'Möbelhaus', cat: 'commerce', size: [2, 2], cost: 3500, level: 6, shop: 'furniture', max: 1,
  desc: 'Einrichtung für jede Wohnung.' });
add({ id: 'garden', name: 'Gartencenter', cat: 'commerce', size: [2, 2], cost: 4500, level: 7, shop: 'garden', max: 1,
  desc: 'Alles für Balkon und Garten.' });
add({ id: 'bakery', name: 'Bäckerei', cat: 'commerce', size: [2, 2], cost: 8000, level: 10, shop: 'bakery', max: 1,
  desc: 'Frisch gebacken, jeden Morgen.' });
add({ id: 'fashion', name: 'Modehaus', cat: 'commerce', size: [2, 2], cost: 11000, level: 11, shop: 'fashion', max: 1,
  desc: 'Kleidung und Accessoires.' });
add({ id: 'electro', name: 'Elektromarkt', cat: 'commerce', size: [2, 2], cost: 16000, level: 14, shop: 'electro', max: 1,
  desc: 'Technik für Haushalt und Freizeit.' });
add({ id: 'market', name: 'Marktplatz', cat: 'commerce', size: [3, 2], cost: 2000, level: 5, max: 1, unique: 'market',
  desc: 'Kaufe und verkaufe Waren mit Händlern aus der Region.' });
add({ id: 'cargo', name: 'Güterbahnhof', cat: 'commerce', size: [4, 2], cost: 3000, level: 6, max: 1, unique: 'cargo',
  desc: 'Erfülle Lieferaufträge gegen Münzen, Erfahrung und Teile.' });

// --- Leisure (population boosts) -----------------------------------------------------------
add({ id: 'park', name: 'Kleiner Park', cat: 'leisure', group: 'park', size: [1, 1], cost: 300, costStep: 1.15, level: 1, boost: { kind: 'park', pct: 4, r: 3 }, noRoad: true,
  desc: 'Bäume und Bänke. Steigert die Bevölkerung ringsum.' });
add({ id: 'playground', name: 'Spielplatz', cat: 'leisure', group: 'park', size: [1, 1], cost: 700, costStep: 1.15, level: 4, boost: { kind: 'park', pct: 6, r: 3 }, noRoad: true,
  desc: 'Familien ziehen gern hierher.' });
add({ id: 'plaza', name: 'Brunnenplatz', cat: 'leisure', group: 'park', size: [2, 2], cost: 2600, costStep: 1.2, level: 7, boost: { kind: 'park', pct: 10, r: 4 }, noRoad: true,
  desc: 'Ein Treffpunkt mit Springbrunnen.' });
add({ id: 'citypark', name: 'Stadtpark', cat: 'leisure', group: 'park', size: [3, 3], cost: 9000, costStep: 1.25, level: 10, boost: { kind: 'park', pct: 18, r: 6 }, noRoad: true,
  desc: 'Die grüne Lunge des Viertels mit Teich.' });
add({ id: 'school', name: 'Grundschule', cat: 'leisure', group: 'edu', size: [2, 2], cost: 4000, costStep: 1.3, level: 6, boost: { kind: 'edu', pct: 10, r: 6 },
  desc: 'Bildung macht die Gegend attraktiv.' });
add({ id: 'library', name: 'Bibliothek', cat: 'leisure', group: 'edu', size: [2, 2], cost: 6500, costStep: 1.3, level: 8, boost: { kind: 'edu', pct: 9, r: 6 },
  desc: 'Bücher, Lesesaal und Ruhe.' });
add({ id: 'highschool', name: 'Gymnasium', cat: 'leisure', group: 'edu', size: [3, 2], cost: 14000, costStep: 1.3, level: 12, boost: { kind: 'edu', pct: 16, r: 8 },
  desc: 'Weiterführende Schule mit Sportplatz.' });
add({ id: 'university', name: 'Universität', cat: 'leisure', group: 'edu', size: [3, 3], cost: 32000, costStep: 1.3, level: 16, boost: { kind: 'edu', pct: 26, r: 11 },
  desc: 'Studenten bringen Leben in die Stadt.' });
add({ id: 'cinema', name: 'Kino', cat: 'leisure', group: 'fun', size: [2, 2], cost: 5000, costStep: 1.3, level: 7, boost: { kind: 'fun', pct: 10, r: 6 },
  desc: 'Große Leinwand, großes Popcorn.' });
add({ id: 'theater', name: 'Theater', cat: 'leisure', group: 'fun', size: [2, 2], cost: 12000, costStep: 1.3, level: 11, boost: { kind: 'fun', pct: 15, r: 8 },
  desc: 'Bühne für Oper, Schauspiel und Ballett.' });
add({ id: 'stadium', name: 'Stadion', cat: 'leisure', group: 'fun', size: [3, 3], cost: 36000, costStep: 1.3, level: 14, boost: { kind: 'fun', pct: 26, r: 12 },
  desc: 'Samstags bebt die ganze Stadt.' });
add({ id: 'busdepot', name: 'Busbahnhof', cat: 'leisure', group: 'transport', size: [2, 2], cost: 7000, costStep: 1.3, level: 9, boost: { kind: 'transport', pct: 9, r: 6 },
  desc: 'Busse verbinden die Viertel miteinander.' });
add({ id: 'trainstation', name: 'Hauptbahnhof', cat: 'leisure', group: 'transport', size: [3, 2], cost: 22000, costStep: 1.3, level: 13, boost: { kind: 'transport', pct: 18, r: 10 },
  desc: 'Züge bringen Pendler und Besucher in die Stadt.' });
add({ id: 'airport', name: 'Flughafen', cat: 'leisure', group: 'transport', size: [4, 3], cost: 60000, costStep: 1.5, level: 20, boost: { kind: 'transport', pct: 34, r: 16 }, max: 1, pollution: 2,
  desc: 'Das Tor zur Welt – lockt Menschen aus dem ganzen Land an.' });
add({ id: 'clocktower', name: 'Uhrturm', cat: 'leisure', group: 'landmark', size: [1, 1], cost: 9000, costStep: 1.4, level: 12, boost: { kind: 'landmark', pct: 14, r: 7 },
  desc: 'Ein Wahrzeichen, das jeder kennt.' });
add({ id: 'tvtower', name: 'Fernsehturm', cat: 'leisure', group: 'landmark', size: [2, 2], cost: 45000, costStep: 1.4, level: 18, boost: { kind: 'landmark', pct: 32, r: 14 },
  desc: 'Von der Aussichtsplattform sieht man die ganze Region.' });

// --- Fixed buildings (placed at start, can be moved) ---------------------------------------
add({ id: 'cityhall', name: 'Rathaus', cat: 'fixed', size: [2, 2], cost: 0, level: 1, max: 1, unique: 'cityhall',
  desc: 'Hier gehen die Steuern ein.' });
add({ id: 'storage', name: 'Lagerhaus', cat: 'fixed', size: [2, 2], cost: 0, level: 1, max: 1, unique: 'storage',
  desc: 'Hier lagern alle Rohstoffe und Waren.' });

export const BUILDINGS = Object.fromEntries(B.map((b) => [b.id, b]));
export const BUILD_ORDER = B.map((b) => b.id);

export const CATEGORIES = [
  { id: 'res', name: 'Wohnen', icon: 'home' },
  { id: 'road', name: 'Straßen', icon: 'road' },
  { id: 'util', name: 'Versorgung', icon: 'bolt' },
  { id: 'service', name: 'Dienste', icon: 'shield' },
  { id: 'industry', name: 'Industrie', icon: 'factory' },
  { id: 'commerce', name: 'Handel', icon: 'shop' },
  { id: 'leisure', name: 'Freizeit', icon: 'tree' },
];

export const ROAD_COST = 10;

export const UTIL_NAMES = { power: 'Strom', water: 'Wasser', sewage: 'Abwasser', waste: 'Müllabfuhr' };
export const SERVICE_NAMES = { fire: 'Feuerwehr', police: 'Polizei', health: 'Gesundheit' };
export const BOOST_NAMES = { park: 'Parks', edu: 'Bildung', fun: 'Unterhaltung', transport: 'Verkehr', landmark: 'Wahrzeichen' };

export const RES_TYPES = B.filter((b) => b.cat === 'res').map((b) => b.id);
export const isRes = (type) => BUILDINGS[type]?.cat === 'res';

export function maxCount(def, level) {
  if (def.maxFn) return def.maxFn(level);
  return def.max ?? Infinity;
}

export function buildCost(def, owned) {
  if (!def.costStep) return def.cost;
  const c = def.cost * Math.pow(def.costStep, owned);
  const capped = def.costCap ? Math.min(def.costCap, c) : c;
  return Math.round(capped / 10) * 10;
}
