// Player progression and housing tables.

export const MAX_LEVEL = 40;

export function xpForNext(level) {
  return Math.round(30 * Math.pow(level, 1.75) + 20);
}

export function levelReward(level) {
  return {
    coins: 150 * level + 100,
    crystals: level % 5 === 0 ? 8 : 3,
  };
}

// House levels 1..8. Population is before boosts.
export const HOUSE_POP = [0, 14, 32, 64, 120, 210, 340, 520, 760];
export const HOUSE_MAX_LEVEL = 8;
export const HOUSE_NAMES = ['', 'Einfamilienhaus', 'Doppelhaus', 'Reihenhaus', 'Stadthaus', 'Mehrfamilienhaus', 'Wohnblock', 'Wohnturm', 'Hochhaus'];

export function maxHouseLevelFor(playerLevel) {
  return Math.min(HOUSE_MAX_LEVEL, 2 + Math.floor(playerLevel / 2));
}

// Each house uses `level` units of every utility.
export function houseUse(level) {
  return level;
}

export const START = {
  coins: 4000,
  crystals: 25,
  storageCap: 60,
};

// Map layout
export const MAP = { w: 64, h: 64, chunk: 8 };
export const START_CHUNKS = [
  [2, 2], [3, 2], [4, 2], [5, 2],
  [2, 3], [3, 3], [4, 3], [5, 3],
  [2, 4], [3, 4], [4, 4], [5, 4],
];

export function expansionCost(n) {
  return {
    coins: Math.round((1500 * Math.pow(1.45, n)) / 100) * 100,
    parts: 1 + Math.floor(n / 2),
  };
}

export function storageUpgradeCost(n) {
  return { parts: 1 + n, add: 20 + 5 * Math.floor(n / 3) };
}

export function shopSlotCost(n) {
  // n = current number of queue slots
  return Math.round(400 * Math.pow(2.1, n - 2) / 50) * 50;
}

export function factorySlotCost(def, extra) {
  return Math.round((def.cost * 0.6 + 600) * Math.pow(2, extra) / 50) * 50;
}

export function salesSlotCost(n) {
  return Math.round(800 * Math.pow(2, n - 4) / 50) * 50;
}

// Crystal price to finish something that would take `sec` seconds.
export function skipPrice(sec) {
  if (sec <= 0) return 0;
  return Math.max(1, Math.ceil(Math.sqrt(sec / 60) * 1.4));
}

// Crystal price to buy a missing item outright.
export function itemCrystalPrice(value) {
  return Math.max(1, Math.ceil(value / 70));
}
