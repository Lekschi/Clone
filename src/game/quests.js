// Mayor's task list: a guided start, then an endless stream of generated tasks.
import { ITEMS, RAW_IDS, GOOD_IDS } from '../data/items.js';
import { BUILDINGS } from '../data/buildings.js';

const SCRIPT = [
  { kind: 'build', type: 'house', n: 2, text: 'Baue 2 Wohngebiete an einer Straße', coins: 150, xp: 10 },
  { kind: 'build', type: 'wind', n: 1, text: 'Baue ein Windrad für Strom', coins: 150, xp: 10 },
  { kind: 'build', type: 'watertower', n: 1, text: 'Baue einen Wasserturm', coins: 150, xp: 10 },
  { kind: 'produce', item: 'steel', n: 4, text: 'Produziere 4 Stahl in der Fabrik', coins: 120, xp: 12 },
  { kind: 'upgrade', n: 1, text: 'Baue ein Haus aus', coins: 200, xp: 15 },
  { kind: 'build', type: 'house', n: 4, text: 'Erweitere auf 4 Wohngebiete', coins: 200, xp: 15 },
  { kind: 'pop', n: 120, text: 'Erreiche 120 Einwohner', coins: 300, xp: 20, crystals: 2 },
  { kind: 'build', type: 'bausupply', n: 1, text: 'Eröffne den Baumarkt', coins: 200, xp: 15 },
  { kind: 'craft', item: 'nails', n: 2, text: 'Stelle 2 Nägel her', coins: 250, xp: 20 },
  { kind: 'build', type: 'dump', n: 1, text: 'Baue eine Mülldeponie', coins: 250, xp: 15 },
  { kind: 'build', type: 'septic', n: 1, text: 'Baue eine Kleinkläranlage', coins: 250, xp: 15 },
  { kind: 'upgrade', n: 4, text: 'Baue 4 Häuser aus', coins: 400, xp: 30 },
  { kind: 'build', type: 'park', n: 1, text: 'Lege einen kleinen Park an', coins: 200, xp: 15 },
  { kind: 'build', type: 'firesmall', n: 1, text: 'Baue ein Feuerwehrhaus', coins: 300, xp: 20 },
  { kind: 'pop', n: 400, text: 'Erreiche 400 Einwohner', coins: 600, xp: 40, crystals: 3 },
  { kind: 'build', type: 'market', n: 1, text: 'Eröffne den Marktplatz', coins: 400, xp: 25 },
  { kind: 'sell', n: 1, text: 'Verkaufe Waren auf dem Marktplatz', coins: 300, xp: 25 },
  { kind: 'expand', n: 1, text: 'Kaufe neues Bauland', coins: 500, xp: 30, crystals: 2 },
  { kind: 'build', type: 'cargo', n: 1, text: 'Baue den Güterbahnhof', coins: 500, xp: 30 },
  { kind: 'cargo', n: 3, text: 'Belade 3 Güterwagen', coins: 600, xp: 40 },
];

export function questProgress(game, q) {
  const s = game.state.stats;
  switch (q.kind) {
    case 'build': return game.countType(q.type);
    case 'pop': return game.city.pop;
    case 'level': return game.state.level;
    case 'produce': return (s.produced[q.item] || 0) - q.base;
    case 'craft': return (s.crafted[q.item] || 0) - q.base;
    case 'upgrade': return s.upgrades - q.base;
    case 'sell': return s.sold - q.base;
    case 'cargo': return s.cargoWagons - q.base;
    case 'expand': return s.expansions - q.base;
    case 'collectTax': return s.taxCollected - q.base;
    default: return 0;
  }
}

function baseFor(game, q) {
  const s = game.state.stats;
  switch (q.kind) {
    case 'produce': return s.produced[q.item] || 0;
    case 'craft': return s.crafted[q.item] || 0;
    case 'upgrade': return s.upgrades;
    case 'sell': return s.sold;
    case 'cargo': return s.cargoWagons;
    case 'expand': return s.expansions;
    case 'collectTax': return s.taxCollected;
    default: return 0;
  }
}

function generate(game, rnd = Math.random) {
  const lvl = game.state.level;
  const opts = [];
  const raws = RAW_IDS.filter((id) => ITEMS[id].level <= lvl);
  const goods = GOOD_IDS.filter((id) => ITEMS[id].level <= lvl && game.countType(ITEMS[id].shop) > 0);
  if (raws.length) {
    const item = raws[Math.floor(rnd() * raws.length)];
    const n = Math.max(2, Math.round(6 - ITEMS[item].time / 400));
    opts.push({ kind: 'produce', item, n, text: `Produziere ${n}× ${ITEMS[item].name}` });
  }
  if (goods.length) {
    const item = goods[Math.floor(rnd() * goods.length)];
    const n = 1 + Math.floor(rnd() * 3);
    opts.push({ kind: 'craft', item, n, text: `Stelle ${n}× ${ITEMS[item].name} her` });
  }
  const up = 2 + Math.floor(rnd() * 4);
  opts.push({ kind: 'upgrade', n: up, text: `Baue ${up} Häuser aus` });
  const target = Math.ceil((game.city.pop * 1.15 + 100) / 50) * 50;
  opts.push({ kind: 'pop', n: target, text: `Erreiche ${target.toLocaleString('de-DE')} Einwohner` });
  if (game.countType('market')) {
    const n = 2 + Math.floor(rnd() * 3);
    opts.push({ kind: 'sell', n, text: `Verkaufe ${n} Angebote auf dem Marktplatz` });
  }
  if (game.countType('cargo')) opts.push({ kind: 'cargo', n: 3, text: 'Belade 3 Güterwagen' });
  opts.push({ kind: 'collectTax', n: 3, text: 'Sammle 3× Steuern im Rathaus ein' });
  const q = opts[Math.floor(rnd() * opts.length)];
  const scale = 1 + lvl * 0.25;
  q.coins = Math.round((150 + q.n * 30) * scale / 10) * 10;
  q.xp = Math.round((15 + q.n * 3) * (1 + lvl * 0.15));
  if (rnd() < 0.25) q.crystals = 1 + Math.floor(rnd() * 2);
  if (rnd() < 0.3) q.part = true;
  return q;
}

export function fillQuests(game) {
  const qs = game.state.quests;
  while (qs.active.length < 3) {
    let q;
    if (qs.step < SCRIPT.length) {
      q = { ...SCRIPT[qs.step] };
      qs.step++;
      // skip scripted build tasks that are not yet unlockable
      if (q.kind === 'build' && BUILDINGS[q.type].level > game.state.level + 3) continue;
    } else {
      q = generate(game);
      if (qs.active.some((a) => a.kind === q.kind && a.item === q.item)) continue;
    }
    q.uid = ++qs.uid;
    q.base = baseFor(game, q);
    qs.active.push(q);
  }
}
