// All tradeable things in the game: raw materials (factories), goods (shops) and special parts
// (storage upgrades and land expansion). Values and XP are derived from time and inputs so the
// economy stays consistent when numbers are tuned.

const RAW = [
  // id, name, icon, seconds, unlock level
  ['steel', 'Stahl', '🔩', 20, 1],
  ['wood', 'Holz', '🪵', 45, 1],
  ['plastic', 'Kunststoff', '🧴', 120, 2],
  ['seeds', 'Saatgut', '🌱', 240, 3],
  ['stone', 'Steine', '🪨', 360, 4],
  ['chem', 'Chemikalien', '🧪', 720, 6],
  ['textile', 'Stoff', '🧵', 1080, 8],
  ['sugar', 'Zucker', '🍬', 1440, 10],
  ['glass', 'Glas', '🫙', 1800, 11],
  ['elec', 'Elektronik', '🔌', 2400, 13],
];

// id, name, icon, shop, seconds, level, recipe
const GOODS = [
  ['nails', 'Nägel', '📌', 'bausupply', 180, 2, { steel: 2 }],
  ['planks', 'Bretter', '🪚', 'bausupply', 360, 2, { wood: 2 }],
  ['bricks', 'Ziegel', '🧱', 'bausupply', 480, 4, { stone: 2 }],
  ['cement', 'Zement', '🪣', 'bausupply', 720, 7, { stone: 2, chem: 1 }],
  ['glue', 'Leim', '🫗', 'bausupply', 900, 8, { plastic: 1, chem: 2 }],
  ['paint', 'Farbe', '🎨', 'bausupply', 1200, 11, { steel: 2, stone: 1, chem: 2 }],

  ['hammer', 'Hammer', '🔨', 'hardware', 240, 3, { steel: 1, wood: 1 }],
  ['tape', 'Maßband', '📏', 'hardware', 300, 3, { steel: 1, plastic: 1 }],
  ['pick', 'Spitzhacke', '⛏️', 'hardware', 480, 5, { steel: 1, wood: 1, plastic: 1 }],
  ['pan', 'Pfanne', '🍳', 'hardware', 600, 6, { steel: 2, wood: 1, plastic: 1 }],
  ['ladder', 'Leiter', '🪜', 'hardware', 720, 8, { planks: 2, steel: 1 }],
  ['drill', 'Akkuschrauber', '🪛', 'hardware', 1080, 14, { steel: 2, plastic: 2, elec: 1 }],

  ['veggies', 'Gemüse', '🥕', 'farmers', 360, 4, { seeds: 2 }],
  ['fruit', 'Obst', '🍎', 'farmers', 900, 8, { seeds: 2, sapling: 1 }],
  ['flour', 'Mehl', '🌾', 'farmers', 540, 9, { seeds: 2, textile: 1 }],
  ['juice', 'Saft', '🧃', 'farmers', 1200, 13, { fruit: 2, glass: 1 }],
  ['jam', 'Marmelade', '🍓', 'farmers', 1500, 13, { fruit: 1, sugar: 1, glass: 1 }],

  ['chair', 'Stuhl', '🪑', 'furniture', 900, 6, { planks: 2, nails: 1, hammer: 1 }],
  ['table', 'Esstisch', '🍽️', 'furniture', 1080, 7, { planks: 1, nails: 2, hammer: 1 }],
  ['bed', 'Bett', '🛏️', 'furniture', 1800, 10, { planks: 2, textile: 2, nails: 1 }],
  ['shelf', 'Regal', '🗄️', 'furniture', 1200, 11, { planks: 2, glue: 1, paint: 1 }],
  ['sofa', 'Sofa', '🛋️', 'furniture', 1500, 12, { textile: 3, glue: 1, planks: 1 }],

  ['sapling', 'Setzling', '🌿', 'garden', 600, 7, { seeds: 2, pick: 1 }],
  ['flowerpot', 'Blumentopf', '🪴', 'garden', 540, 7, { seeds: 2, bricks: 1 }],
  ['grill', 'Gartengrill', '🔥', 'garden', 840, 8, { steel: 3, pan: 1 }],
  ['parasol', 'Sonnenschirm', '⛱️', 'garden', 1200, 10, { planks: 1, plastic: 2, textile: 1 }],
  ['mower', 'Rasenmäher', '🚜', 'garden', 1500, 11, { steel: 3, paint: 1, plastic: 1 }],

  ['bread', 'Brot', '🍞', 'bakery', 720, 10, { flour: 2 }],
  ['pretzel', 'Brezel', '🥨', 'bakery', 900, 10, { flour: 2, sugar: 1 }],
  ['cookies', 'Kekse', '🍪', 'bakery', 1080, 11, { sugar: 2, flour: 1 }],
  ['cake', 'Kuchen', '🎂', 'bakery', 1800, 12, { flour: 1, sugar: 2, fruit: 1 }],

  ['shirt', 'T-Shirt', '👕', 'fashion', 720, 11, { textile: 2, plastic: 1 }],
  ['cap', 'Kappe', '🧢', 'fashion', 900, 11, { textile: 2, tape: 1 }],
  ['shoes', 'Schuhe', '👟', 'fashion', 1320, 12, { textile: 2, plastic: 1, glue: 1 }],
  ['bag', 'Tasche', '👜', 'fashion', 1500, 13, { textile: 2, plastic: 2, tape: 1 }],
  ['watch', 'Armbanduhr', '⌚', 'fashion', 1800, 14, { glass: 1, steel: 1, elec: 1 }],

  ['lamp', 'Lampe', '💡', 'electro', 900, 14, { elec: 1, glass: 1, steel: 1 }],
  ['radio', 'Radio', '📻', 'electro', 1500, 15, { elec: 2, plastic: 1, glue: 1 }],
  ['tv', 'Fernseher', '📺', 'electro', 2400, 16, { elec: 3, glass: 2, plastic: 1 }],
  ['fridge', 'Kühlschrank', '🧊', 'electro', 2700, 17, { elec: 2, steel: 2, paint: 1 }],
  ['phone', 'Smartphone', '📱', 'electro', 2100, 18, { elec: 2, glass: 1, chem: 1 }],
];

const SPECIAL = [
  // storage upgrade parts
  ['lock', 'Schloss', '🔒', 'storage', 140],
  ['bolt', 'Riegel', '🔐', 'storage', 140],
  ['chain', 'Kette', '⛓️', 'storage', 140],
  // land expansion parts
  ['stake', 'Vermessungspflock', '📍', 'expand', 160],
  ['blueprint', 'Bauplan', '📐', 'expand', 160],
  ['deed', 'Grundbuchauszug', '📜', 'expand', 160],
];

export const ITEMS = {};
export const RAW_IDS = [];
export const GOOD_IDS = [];
export const STORAGE_PARTS = SPECIAL.filter((s) => s[3] === 'storage').map((s) => s[0]);
export const EXPAND_PARTS = SPECIAL.filter((s) => s[3] === 'expand').map((s) => s[0]);

for (const [id, name, icon, time, level] of RAW) {
  ITEMS[id] = { id, name, icon, kind: 'raw', time, level, req: null, value: Math.round(6 + (time / 60) * 10) };
  RAW_IDS.push(id);
}
for (const [id, name, icon, shop, time, level, req] of GOODS) {
  ITEMS[id] = { id, name, icon, kind: 'good', shop, time, level, req };
  GOOD_IDS.push(id);
}
for (const [id, name, icon, group, value] of SPECIAL) {
  ITEMS[id] = { id, name, icon, kind: 'special', group, time: 0, level: 1, req: null, value };
}

// Derive good values in dependency order: inputs plus a premium for crafting time.
function valueOf(id) {
  const it = ITEMS[id];
  if (it.value != null) return it.value;
  let v = 0;
  for (const [k, n] of Object.entries(it.req)) v += valueOf(k) * n;
  v += (it.time / 60) * 8;
  it.value = Math.round((v * 1.1) / 5) * 5;
  return it.value;
}
for (const id of Object.keys(ITEMS)) {
  valueOf(id);
  const it = ITEMS[id];
  it.xp = it.kind === 'special' ? 0 : Math.max(1, Math.round(it.value / 14));
}

export const SHOPS = {
  bausupply: { name: 'Baumarkt', items: GOOD_IDS.filter((g) => ITEMS[g].shop === 'bausupply') },
  hardware: { name: 'Werkzeugladen', items: GOOD_IDS.filter((g) => ITEMS[g].shop === 'hardware') },
  farmers: { name: 'Bauernmarkt', items: GOOD_IDS.filter((g) => ITEMS[g].shop === 'farmers') },
  furniture: { name: 'Möbelhaus', items: GOOD_IDS.filter((g) => ITEMS[g].shop === 'furniture') },
  garden: { name: 'Gartencenter', items: GOOD_IDS.filter((g) => ITEMS[g].shop === 'garden') },
  bakery: { name: 'Bäckerei', items: GOOD_IDS.filter((g) => ITEMS[g].shop === 'bakery') },
  fashion: { name: 'Modehaus', items: GOOD_IDS.filter((g) => ITEMS[g].shop === 'fashion') },
  electro: { name: 'Elektromarkt', items: GOOD_IDS.filter((g) => ITEMS[g].shop === 'electro') },
};

export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h < 24) return mm ? `${h}h ${mm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}
