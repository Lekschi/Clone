// Core game model: state, rules, economy and city simulation. No rendering in here.
import { ITEMS, RAW_IDS, GOOD_IDS, STORAGE_PARTS, EXPAND_PARTS, SHOPS } from '../data/items.js';
import { BUILDINGS, maxCount, buildCost, ROAD_COST, isRes, RES_TYPES } from '../data/buildings.js';
import {
  xpForNext, levelReward, HOUSE_POP, maxHouseLevelFor, houseUse, START, MAP, START_CHUNKS,
  expansionCost, storageUpgradeCost, shopSlotCost, factorySlotCost, salesSlotCost, skipPrice, itemCrystalPrice, MAX_LEVEL,
} from '../data/progress.js';
import { Emitter, pick } from './emitter.js';
import { fillQuests, questProgress } from './quests.js';

export const SAVE_VERSION = 1;
const ROAD = -1;
export const WISH_HAPPY = 50;
const CUSTOMERS = ['Frau Albers', 'Herr Yilmaz', 'Familie Becker', 'Jonas', 'Frau Nowak', 'Herr Schmidt', 'Mia', 'Opa Karl', 'Frau Haddad', 'Herr Weber', 'Lena', 'Familie Kraus', 'Frau Rossi', 'Herr Lindqvist', 'Emil', 'Frau Wagner'];

export function newState(name = 'Neustadt') {
  const now = Date.now();
  const s = {
    version: SAVE_VERSION,
    name,
    seed: Math.floor(Math.random() * 1e9),
    created: now,
    updated: now,
    coins: START.coins,
    crystals: START.crystals,
    xp: 0,
    level: 1,
    chunks: START_CHUNKS.map(([cx, cz]) => cz * (MAP.w / MAP.chunk) + cx),
    roads: [],
    buildings: [],
    nextId: 1,
    storage: { items: { steel: 2, wood: 2 }, cap: START.storageCap, upgrades: 0 },
    taxes: { acc: 0, last: now },
    market: { offers: [], refreshAt: 0, sales: [], slots: 4 },
    cargo: { wagons: [], returnAt: 0 },
    quests: { step: 0, active: [], uid: 0 },
    stats: { produced: {}, crafted: {}, upgrades: 0, sold: 0, cargoWagons: 0, expansions: 0, taxCollected: 0, popRecord: 0 },
    seen: {},
  };
  // Starting layout: a main avenue from the west map edge into the build area.
  const z = 30;
  for (let x = 0; x <= 40; x++) s.roads.push(z * MAP.w + x);
  for (let zz = 22; zz <= 38; zz++) if (zz !== z) s.roads.push(zz * MAP.w + 26);
  const mk = (type, x, zz, extra = {}) => s.buildings.push({ id: s.nextId++, type, x, z: zz, rot: 0, built: now, v: Math.floor(Math.random() * 1000), ...extra });
  mk('cityhall', 23, 28);
  mk('storage', 27, 28);
  mk('factory', 27, 31, { slots: [], extra: 0 });
  mk('house', 18, 31, { level: 1 });
  return s;
}

export class Game extends Emitter {
  constructor(state) {
    super();
    this.state = state;
    this.migrate();
    this.W = MAP.w;
    this.H = MAP.h;
    this.CW = MAP.w / MAP.chunk;
    this.grid = new Int32Array(this.W * this.H);
    this.byId = new Map();
    this.unlocked = new Set(state.chunks);
    this.info = new Map();
    this.city = { pop: 0, happy: 0, supply: {}, demand: {}, taxRate: 0, houses: 0 };
    this.rebuildGrid();
    this.recompute();
    for (const b of state.buildings) if (isRes(b.type) && !b.req) this.makeRequest(b);
    if (!state.market.offers.length) this.refreshMarket(true);
    if (!state.cargo.wagons.length) this.newCargo();
    fillQuests(this);
  }

  migrate() {
    const s = this.state;
    s.stats ||= { produced: {}, crafted: {}, upgrades: 0, sold: 0, cargoWagons: 0, expansions: 0, taxCollected: 0, popRecord: 0 };
    s.seen ||= {};
    for (const k of ['produced', 'crafted']) s.stats[k] ||= {};
  }

  // ---------------------------------------------------------------- grid & placement
  idx(x, z) { return z * this.W + x; }
  inMap(x, z) { return x >= 0 && z >= 0 && x < this.W && z < this.H; }
  chunkOf(x, z) { return Math.floor(z / MAP.chunk) * this.CW + Math.floor(x / MAP.chunk); }
  isUnlocked(x, z) { return this.inMap(x, z) && this.unlocked.has(this.chunkOf(x, z)); }
  isRoad(x, z) { return this.inMap(x, z) && this.grid[this.idx(x, z)] === ROAD; }
  at(x, z) { return this.inMap(x, z) ? this.grid[this.idx(x, z)] : 0; }

  rebuildGrid() {
    this.grid.fill(0);
    this.byId.clear();
    for (const r of this.state.roads) this.grid[r] = ROAD;
    for (const b of this.state.buildings) {
      this.byId.set(b.id, b);
      const [w, d] = this.size(b);
      for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) this.grid[this.idx(b.x + dx, b.z + dz)] = b.id;
    }
  }

  size(b) {
    const s = BUILDINGS[b.type].size;
    return b.rot % 2 ? [s[1], s[0]] : [s[0], s[1]];
  }

  countType(type) {
    let n = 0;
    for (const b of this.state.buildings) if (b.type === type) n++;
    return n;
  }

  findUnique(type) {
    return this.state.buildings.find((b) => b.type === type);
  }

  roadAdjacent(x, z, w, d) {
    for (let dx = 0; dx < w; dx++) if (this.isRoad(x + dx, z - 1) || this.isRoad(x + dx, z + d)) return true;
    for (let dz = 0; dz < d; dz++) if (this.isRoad(x - 1, z + dz) || this.isRoad(x + w, z + dz)) return true;
    return false;
  }

  canPlace(type, x, z, rot = 0, ignoreId = 0) {
    const def = BUILDINGS[type];
    const [w, d] = rot % 2 ? [def.size[1], def.size[0]] : def.size;
    for (let dz = 0; dz < d; dz++) {
      for (let dx = 0; dx < w; dx++) {
        const cx = x + dx, cz = z + dz;
        if (!this.isUnlocked(cx, cz)) return { ok: false, reason: 'Dieses Land gehört dir noch nicht' };
        const g = this.grid[this.idx(cx, cz)];
        if (g !== 0 && g !== ignoreId) return { ok: false, reason: 'Hier ist kein Platz' };
      }
    }
    if (!def.noRoad && !this.roadAdjacent(x, z, w, d)) return { ok: false, reason: 'Braucht eine Straße daneben' };
    return { ok: true };
  }

  costOf(type) {
    const def = BUILDINGS[type];
    return buildCost(def, this.countType(type));
  }

  buildStatus(type) {
    const def = BUILDINGS[type];
    const lvl = this.state.level;
    if (def.level > lvl) return { ok: false, locked: true, reason: `Ab Stufe ${def.level}` };
    if (isRes(type)) {
      const z = this.zoneInfo();
      if (z.used >= z.allowed) return { ok: false, zones: true, reason: z.atLevelCap ? `Mehr Wohngebiete ab Stufe ${lvl + 1}` : `Baue erst bestehende Häuser aus (${z.used}/${z.allowed} Wohngebiete)` };
    }
    const max = maxCount(def, lvl);
    if (this.countType(type) >= max) return { ok: false, reason: max === 1 ? 'Bereits gebaut' : `Maximal ${max} auf dieser Stufe` };
    const cost = this.costOf(type);
    if (this.state.coins < cost) return { ok: false, cost, reason: 'Nicht genug Münzen' };
    return { ok: true, cost };
  }

  // New residential zones are earned by upgrading the ones you have (every two upgrade
  // steps unlock one more), with an upper bound that grows with the player level.
  zoneInfo() {
    let used = 0, steps = 0;
    for (const b of this.state.buildings) if (isRes(b.type)) { used++; steps += (b.level || 1) - 1; }
    const byUpgrades = 4 + Math.floor(steps / 2);
    const byLevel = 6 + this.state.level * 3;
    const allowed = Math.min(byUpgrades, byLevel);
    const nextAt = (Math.floor(steps / 2) + 1) * 2;
    return { used, allowed, steps, stepsToNext: nextAt - steps, atLevelCap: byLevel <= byUpgrades };
  }

  place(type, x, z, rot = 0) {
    const st = this.buildStatus(type);
    if (!st.ok) return this.fail(st.reason);
    const c = this.canPlace(type, x, z, rot);
    if (!c.ok) return this.fail(c.reason);
    this.state.coins -= st.cost;
    const def = BUILDINGS[type];
    const b = { id: this.state.nextId++, type, x, z, rot, built: Date.now(), v: Math.floor(Math.random() * 1000) };
    if (isRes(type)) b.level = 1;
    if (def.factory) { b.slots = []; b.extra = 0; }
    if (def.shop) { b.queue = []; b.qslots = 2; }
    this.state.buildings.push(b);
    if (isRes(type)) this.makeRequest(b);
    this.rebuildGrid();
    this.recompute();
    this.addXP(Math.max(2, Math.round(Math.sqrt(st.cost) / 3)));
    this.emit('built', b);
    this.emit('change');
    this.questCheck();
    return b;
  }

  move(id, x, z, rot) {
    const b = this.byId.get(id);
    if (!b) return false;
    const c = this.canPlace(b.type, x, z, rot ?? b.rot, id);
    if (!c.ok) return this.fail(c.reason);
    b.x = x; b.z = z; if (rot != null) b.rot = rot;
    this.rebuildGrid();
    this.recompute();
    this.emit('moved', b);
    this.emit('change');
    return true;
  }

  demolish(id) {
    const b = this.byId.get(id);
    if (!b) return false;
    const def = BUILDINGS[b.type];
    if (def.cat === 'fixed') return this.fail('Dieses Gebäude kann nicht abgerissen werden');
    this.state.buildings = this.state.buildings.filter((o) => o.id !== id);
    const refund = Math.round(buildCost(def, Math.max(0, this.countType(b.type))) * 0.25);
    this.state.coins += refund;
    this.rebuildGrid();
    this.recompute();
    this.emit('removed', b);
    this.emit('change');
    return true;
  }

  roadPathCost(cells) {
    let n = 0;
    for (const [x, z] of cells) if (this.isUnlocked(x, z) && this.grid[this.idx(x, z)] === 0) n++;
    return n * ROAD_COST;
  }

  placeRoads(cells) {
    const valid = cells.filter(([x, z]) => this.isUnlocked(x, z) && this.grid[this.idx(x, z)] === 0);
    if (!valid.length) return 0;
    const cost = valid.length * ROAD_COST;
    if (this.state.coins < cost) { this.fail('Nicht genug Münzen'); return 0; }
    this.state.coins -= cost;
    for (const [x, z] of valid) this.state.roads.push(this.idx(x, z));
    this.rebuildGrid();
    this.recompute();
    this.emit('roads');
    this.emit('change');
    return valid.length;
  }

  removeRoads(cells) {
    const set = new Set(cells.filter(([x, z]) => this.isRoad(x, z) && this.isUnlocked(x, z)).map(([x, z]) => this.idx(x, z)));
    if (!set.size) return 0;
    this.state.roads = this.state.roads.filter((r) => !set.has(r));
    this.rebuildGrid();
    this.recompute();
    this.emit('roads');
    this.emit('change');
    return set.size;
  }

  // ---------------------------------------------------------------- land expansion
  chunkUnlockable(ci) {
    if (this.unlocked.has(ci)) return false;
    const cx = ci % this.CW, cz = Math.floor(ci / this.CW);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= this.CW || nz >= this.CW) continue;
      if (this.unlocked.has(nz * this.CW + nx)) return true;
    }
    return false;
  }

  expansionPrice() {
    return expansionCost(this.state.chunks.length - START_CHUNKS.length);
  }

  expand(ci) {
    if (!this.chunkUnlockable(ci)) return this.fail('Nur angrenzendes Land kann gekauft werden');
    const p = this.expansionPrice();
    if (this.state.coins < p.coins) return this.fail('Nicht genug Münzen');
    for (const part of EXPAND_PARTS) if ((this.state.storage.items[part] || 0) < p.parts) return this.fail('Es fehlen Teile für die Erweiterung');
    this.state.coins -= p.coins;
    for (const part of EXPAND_PARTS) this.state.storage.items[part] -= p.parts;
    this.state.chunks.push(ci);
    this.unlocked.add(ci);
    this.state.stats.expansions++;
    this.addXP(40 + 10 * this.state.chunks.length);
    this.emit('expanded', ci);
    this.emit('change');
    this.questCheck();
    return true;
  }

  // ---------------------------------------------------------------- storage
  stored(id) { return this.state.storage.items[id] || 0; }

  storageUsed() {
    let n = 0;
    for (const [k, v] of Object.entries(this.state.storage.items)) if (ITEMS[k] && ITEMS[k].kind !== 'special') n += v;
    return n;
  }

  storageFree() { return this.state.storage.cap - this.storageUsed(); }

  addItem(id, n = 1) {
    this.state.storage.items[id] = (this.state.storage.items[id] || 0) + n;
  }

  hasItems(req) {
    for (const [k, n] of Object.entries(req)) if (this.stored(k) < n) return false;
    return true;
  }

  takeItems(req) {
    for (const [k, n] of Object.entries(req)) {
      this.state.storage.items[k] -= n;
      if (this.state.storage.items[k] <= 0) delete this.state.storage.items[k];
    }
  }

  missingCrystals(req) {
    let c = 0;
    for (const [k, n] of Object.entries(req)) {
      const miss = Math.max(0, n - this.stored(k));
      c += miss * itemCrystalPrice(ITEMS[k].value);
    }
    return c;
  }

  storageUpgradeInfo() {
    return storageUpgradeCost(this.state.storage.upgrades);
  }

  upgradeStorage() {
    const c = this.storageUpgradeInfo();
    for (const p of STORAGE_PARTS) if (this.stored(p) < c.parts) return this.fail('Es fehlen Teile');
    for (const p of STORAGE_PARTS) this.state.storage.items[p] -= c.parts;
    this.state.storage.cap += c.add;
    this.state.storage.upgrades++;
    this.addXP(30 + 5 * this.state.storage.upgrades);
    this.toast(`Lager vergrößert: ${this.state.storage.cap} Plätze`, 'good');
    this.emit('change');
    return true;
  }

  sellToScrap(id, n) {
    // emergency space: sell items back for a third of their value
    n = Math.min(n, this.stored(id));
    if (n <= 0) return;
    this.takeItems({ [id]: n });
    const coins = Math.max(1, Math.round(ITEMS[id].value * 0.3)) * n;
    this.state.coins += coins;
    this.emit('change');
  }

  // Chance for a special part when collecting goods.
  maybeDropPart(chance) {
    if (Math.random() >= chance) return null;
    const needStorage = this.storageUsed() > this.state.storage.cap * 0.6;
    const pool = Math.random() < (needStorage ? 0.6 : 0.45) ? STORAGE_PARTS : EXPAND_PARTS;
    // prefer the part we have the fewest of
    const sorted = [...pool].sort((a, b) => this.stored(a) - this.stored(b) + (Math.random() - 0.5) * 2);
    const id = sorted[0];
    this.addItem(id, 1);
    return id;
  }

  // ---------------------------------------------------------------- factories
  factorySlots(b) { return BUILDINGS[b.type].factory.slots + (b.extra || 0); }

  factoryItems() {
    return RAW_IDS.filter((id) => ITEMS[id].level <= this.state.level);
  }

  produce(bid, item) {
    const b = this.byId.get(bid);
    if (!b || !BUILDINGS[b.type].factory) return false;
    const it = ITEMS[item];
    if (it.level > this.state.level) return this.fail(`Ab Stufe ${it.level}`);
    if (b.slots.length >= this.factorySlots(b)) return this.fail('Alle Plätze belegt');
    const now = Date.now();
    b.slots.push({ item, start: now, end: now + it.time * 1000 });
    this.emit('production', b);
    this.emit('change');
    return true;
  }

  collectFactory(bid) {
    const b = this.byId.get(bid);
    if (!b) return 0;
    const now = Date.now();
    let n = 0;
    const keep = [];
    const got = [];
    for (const s of b.slots) {
      if (s.end <= now && this.storageFree() > 0) {
        this.addItem(s.item, 1);
        this.state.stats.produced[s.item] = (this.state.stats.produced[s.item] || 0) + 1;
        this.addXP(ITEMS[s.item].xp, false);
        got.push(s.item);
        n++;
      } else keep.push(s);
    }
    b.slots = keep;
    if (n) {
      const part = this.maybeDropPart(0.05 * n);
      this.emit('collected', b, got, part);
      this.emit('change');
      this.questCheck();
    } else if (b.slots.some((s) => s.end <= now)) this.fail('Das Lager ist voll');
    return n;
  }

  buyFactorySlot(bid) {
    const b = this.byId.get(bid);
    if (!b || (b.extra || 0) >= 3) return false;
    const cost = factorySlotCost(BUILDINGS[b.type], b.extra || 0);
    if (this.state.coins < cost) return this.fail('Nicht genug Münzen');
    this.state.coins -= cost;
    b.extra = (b.extra || 0) + 1;
    this.emit('change');
    return true;
  }

  factorySlotPrice(b) { return (b.extra || 0) >= 3 ? null : factorySlotCost(BUILDINGS[b.type], b.extra || 0); }

  // ---------------------------------------------------------------- shops
  shopItems(b) {
    return SHOPS[BUILDINGS[b.type].shop].items;
  }

  queueGood(bid, item) {
    const b = this.byId.get(bid);
    if (!b) return false;
    const it = ITEMS[item];
    if (it.level > this.state.level) return this.fail(`Ab Stufe ${it.level}`);
    if (b.queue.length >= b.qslots) return this.fail('Die Warteschlange ist voll');
    if (!this.hasItems(it.req)) return this.fail('Es fehlen Zutaten');
    this.takeItems(it.req);
    const now = Date.now();
    const last = b.queue.length ? b.queue[b.queue.length - 1].end : now;
    const start = Math.max(now, last);
    b.queue.push({ item, start, end: start + it.time * 1000 });
    this.emit('production', b);
    this.emit('change');
    return true;
  }

  collectShop(bid) {
    const b = this.byId.get(bid);
    if (!b) return 0;
    const now = Date.now();
    let n = 0;
    const got = [];
    while (b.queue.length && b.queue[0].end <= now && this.storageFree() > 0) {
      const q = b.queue.shift();
      this.addItem(q.item, 1);
      this.state.stats.crafted[q.item] = (this.state.stats.crafted[q.item] || 0) + 1;
      this.addXP(ITEMS[q.item].xp, false);
      got.push(q.item);
      n++;
    }
    if (n) {
      const part = this.maybeDropPart(0.07 * n);
      this.emit('collected', b, got, part);
      this.emit('change');
      this.questCheck();
    } else if (b.queue.length && b.queue[0].end <= now) this.fail('Das Lager ist voll');
    return n;
  }

  shopSlotPrice(b) { return b.qslots >= 7 ? null : shopSlotCost(b.qslots); }

  buyShopSlot(bid) {
    const b = this.byId.get(bid);
    const cost = this.shopSlotPrice(b);
    if (cost == null) return false;
    if (this.state.coins < cost) return this.fail('Nicht genug Münzen');
    this.state.coins -= cost;
    b.qslots++;
    this.emit('change');
    return true;
  }

  // Remaining seconds for whatever the building is working on.
  remaining(b) {
    const now = Date.now();
    if (b.slots) { const r = b.slots.filter((s) => s.end > now).map((s) => s.end - now); return r.length ? Math.max(...r) / 1000 : 0; }
    if (b.queue) { const r = b.queue.filter((s) => s.end > now); return r.length ? (r[r.length - 1].end - now) / 1000 : 0; }
    return 0;
  }

  skip(bid, which) {
    // which: index of slot/queue entry
    const b = this.byId.get(bid);
    const now = Date.now();
    const list = b.slots || b.queue;
    const e = list[which];
    if (!e || e.end <= now) return false;
    let secs = (e.end - now) / 1000;
    if (b.queue) secs = (e.end - Math.max(now, e.start)) / 1000;
    const price = skipPrice(secs);
    if (this.state.crystals < price) return this.fail('Nicht genug Kristalle');
    this.state.crystals -= price;
    if (b.slots) e.end = now;
    else {
      const shift = e.end - Math.max(now, e.start);
      e.end = Math.max(now, e.start);
      for (let i = which + 1; i < list.length; i++) { list[i].start -= shift; list[i].end -= shift; }
      if (which === 0) e.end = now;
    }
    this.emit('production', b);
    this.emit('change');
    return true;
  }

  skipPriceFor(b, which) {
    const now = Date.now();
    const list = b.slots || b.queue;
    const e = list[which];
    if (!e) return 0;
    const secs = b.queue ? (e.end - Math.max(now, e.start)) / 1000 : (e.end - now) / 1000;
    return skipPrice(secs);
  }

  // ---------------------------------------------------------------- houses
  requestPool() {
    const lvl = this.state.level;
    const raws = RAW_IDS.filter((id) => ITEMS[id].level <= lvl);
    const goods = GOOD_IDS.filter((id) => ITEMS[id].level <= lvl && this.countType(ITEMS[id].shop) > 0);
    return { raws, goods };
  }

  makeRequest(b) {
    const L = b.level;
    const pools = this.requestPool();
    const raws = pools.raws;
    let goods = pools.goods;
    const wants = BUILDINGS[b.type].res?.wants;
    if (wants && goods.length > 3) {
      const shopsFor = { basic: ['bausupply', 'hardware', 'farmers', 'bakery'], luxury: ['furniture', 'fashion', 'electro', 'bakery', 'garden'], green: ['garden', 'farmers', 'bakery', 'furniture'] }[wants];
      const pref = goods.filter((g) => shopsFor.includes(ITEMS[g].shop));
      if (pref.length >= 2) goods = pref;
    }
    const types = Math.max(1, Math.min(4, 1 + Math.floor((L + Math.random() * 2) / 2)));
    const req = {};
    const usedPool = [];
    for (let i = 0; i < types; i++) {
      // the higher the house, the more it wants finished goods
      const wantGood = goods.length && Math.random() < Math.min(0.9, 0.35 + L * 0.12);
      let pool = wantGood ? goods : raws;
      pool = pool.filter((p) => !usedPool.includes(p));
      if (!pool.length) break;
      // weight towards cheaper items to keep requests achievable
      pool.sort((a, c) => ITEMS[a].value - ITEMS[c].value);
      const span = Math.max(1, Math.ceil(pool.length * Math.min(1, 0.45 + L * 0.08)));
      const id = pool[Math.floor(Math.random() * span)];
      usedPool.push(id);
      const maxQ = ITEMS[id].kind === 'raw' ? 2 + Math.floor(L / 2) : 1 + Math.floor(L / 3);
      req[id] = 1 + Math.floor(Math.random() * maxQ);
    }
    b.req = req;
    b.reqAt = Date.now();
    b.wish = 0; // residents voice the wish once they are happy enough
  }

  // A house wishes for an upgrade only while its residents are happy and supplied.
  wishReady(b) {
    const inf = this.info.get(b.id);
    if (!inf || b.level >= maxHouseLevelFor(this.state.level)) return false;
    return inf.road && !inf.missing.length && !inf.burning && inf.happy >= WISH_HAPPY;
  }

  rerollRequest(bid) {
    const b = this.byId.get(bid);
    if (!b) return false;
    const wait = (b.reqAt || 0) + 5 * 60 * 1000 - Date.now();
    if (wait > 0) return this.fail('Neue Wünsche gibt es erst später');
    this.makeRequest(b);
    this.emit('change');
    return true;
  }

  houseUpgradeBlock(b) {
    if (b.level >= maxHouseLevelFor(this.state.level)) return b.level >= 8 ? 'Höchste Stufe erreicht' : 'Erreiche eine höhere Spielerstufe';
    const inf = this.info.get(b.id);
    if (inf && !inf.road) return 'Keine Straßenanbindung';
    if (inf && inf.missing.length) return 'Versorgung fehlt';
    if (inf && inf.happy < WISH_HAPPY) return `Die Bewohner sind unzufrieden (${inf.happy} %). Erst ab ${WISH_HAPPY} % wünschen sie sich einen Ausbau.`;
    if (b.upgradingUntil && b.upgradingUntil > Date.now()) return 'Wird gerade ausgebaut';
    return null;
  }

  upgradeHouse(bid, buyMissing = false) {
    const b = this.byId.get(bid);
    if (!b) return false;
    const block = this.houseUpgradeBlock(b);
    if (block) return this.fail(block);
    if (!this.hasItems(b.req)) {
      if (!buyMissing) return this.fail('Es fehlen Materialien');
      const price = this.missingCrystals(b.req);
      if (this.state.crystals < price) return this.fail('Nicht genug Kristalle');
      this.state.crystals -= price;
      for (const [k, n] of Object.entries(b.req)) {
        const miss = Math.max(0, n - this.stored(k));
        if (miss) this.addItem(k, miss);
      }
    }
    let value = 0, xp = 0;
    for (const [k, n] of Object.entries(b.req)) { value += ITEMS[k].value * n; xp += ITEMS[k].xp * n; }
    this.takeItems(b.req);
    b.level++;
    b.upgradingUntil = Date.now() + 3500;
    b.upgradedAt = Date.now();
    const coins = Math.round(value * 0.45 + 20 * b.level);
    this.state.coins += coins;
    this.state.stats.upgrades++;
    this.makeRequest(b);
    this.recompute();
    const part = this.maybeDropPart(0.3);
    this.addXP(Math.round(xp * 1.5 + 8 * b.level));
    this.emit('upgraded', b, { coins, part });
    this.emit('change');
    this.questCheck();
    return true;
  }

  // ---------------------------------------------------------------- city simulation
  recompute() {
    const S = this.state;
    const info = new Map();
    const supply = { power: 0, water: 0, sewage: 0, waste: 0 };
    const demand = { power: 0, water: 0, sewage: 0, waste: 0 };
    const services = [], boosts = [], polluters = [];
    const lvl = S.level;
    for (const b of S.buildings) {
      const def = BUILDINGS[b.type];
      const [w, d] = this.size(b);
      const road = def.noRoad || this.roadAdjacent(b.x, b.z, w, d);
      const cx = b.x + w / 2, cz = b.z + d / 2;
      if (def.supply && road) for (const [k, v] of Object.entries(def.supply)) supply[k] += v;
      if (def.service) services.push({ ...def.service, cx, cz, half: Math.max(w, d) / 2 });
      if (def.boost) boosts.push({ ...def.boost, cx, cz, half: Math.max(w, d) / 2 });
      if (def.pollution) polluters.push({ r: def.pollution, cx, cz, half: Math.max(w, d) / 2 });
      info.set(b.id, { road, cx, cz, missing: [], pop: 0, happy: 0 });
    }
    // services that are not yet available don't count against happiness
    const svcAvail = {
      fire: lvl >= BUILDINGS.firesmall.level,
      police: lvl >= BUILDINGS.policesmall.level,
      health: lvl >= BUILDINGS.clinic.level,
    };
    const left = { ...supply };
    let pop = 0, happySum = 0, houses = 0, taxRate = 0;
    const houseList = S.buildings.filter((b) => isRes(b.type)).sort((a, b) => a.id - b.id);
    for (const b of houseList) {
      const inf = info.get(b.id);
      const rt = BUILDINGS[b.type].res;
      const use = Math.max(1, Math.round(houseUse(b.level) * rt.use));
      for (const k of Object.keys(demand)) demand[k] += use;
      if (!inf.road) inf.missing.push('road');
      else {
        for (const k of ['power', 'water', 'sewage', 'waste']) {
          // waste & sewage only matter once their buildings are unlocked
          if ((k === 'sewage' && lvl < BUILDINGS.septic.level) || (k === 'waste' && lvl < BUILDINGS.dump.level)) continue;
          if (left[k] >= use) left[k] -= use;
          else inf.missing.push(k);
        }
      }
      const dist = (o) => Math.hypot(o.cx - inf.cx, o.cz - inf.cz) - o.half - 1;
      inf.services = {};
      for (const k of ['fire', 'police', 'health']) inf.services[k] = services.some((s) => s.kind === k && dist(s) <= s.r);
      inf.boost = {};
      let boostPct = 0;
      for (const bo of boosts) if (dist(bo) <= bo.r) { inf.boost[bo.kind] = (inf.boost[bo.kind] || 0) + bo.pct; boostPct += bo.pct; }
      boostPct = Math.min(250, boostPct);
      inf.boostPct = boostPct;
      inf.polluted = polluters.some((p) => dist(p) <= p.r);
      inf.burning = !!b.fire;
      let h = 45;
      for (const k of ['fire', 'police', 'health']) h += !svcAvail[k] || inf.services[k] ? 10 : 0;
      const parkPct = (inf.boost.park || 0) * ((rt.parks || 1) - 1);
      h += Math.min(rt.parks ? 35 : 25, (boostPct + parkPct) * 0.4);
      if (inf.polluted) h -= 22 * (rt.smog ?? 1);
      else if (rt.clean) h += rt.clean;
      h -= inf.missing.length * 18;
      if (inf.burning) h -= 30;
      inf.happy = Math.max(0, Math.min(100, Math.round(h)));
      const base = HOUSE_POP[b.level] * rt.pop;
      inf.pop = Math.round(base * (1 + boostPct / 100) * (inf.missing.length ? 0.5 : 1) * (inf.burning ? 0.3 : 1));
      pop += inf.pop;
      happySum += inf.happy * Math.max(1, inf.pop);
      houses++;
      if (!inf.missing.length && !inf.burning) taxRate += inf.pop * 0.09 * rt.tax * (0.4 + inf.happy / 100 * 0.8);
    }
    this.info = info;
    this.city = {
      pop,
      happy: pop ? Math.round(happySum / Math.max(1, houseList.reduce((a, b) => a + Math.max(1, info.get(b.id).pop), 0))) : 0,
      supply, demand, houses,
      taxRate, // coins per minute
    };
    if (pop > S.stats.popRecord) S.stats.popRecord = pop;
    this.emit('city');
  }

  // ---------------------------------------------------------------- taxes
  taxCap() { return Math.max(300, Math.round(this.city.taxRate * 180)); }

  collectTaxes() {
    const n = Math.floor(this.state.taxes.acc);
    if (n < 1) return 0;
    this.state.coins += n;
    this.state.taxes.acc -= n;
    this.state.stats.taxCollected++;
    this.addXP(Math.max(1, Math.round(n / 120)));
    this.emit('taxes', n);
    this.emit('change');
    this.questCheck();
    return n;
  }

  // ---------------------------------------------------------------- XP & level
  addXP(n, emit = true) {
    const S = this.state;
    S.xp += n;
    let leveled = false;
    while (S.level < MAX_LEVEL && S.xp >= xpForNext(S.level)) {
      S.xp -= xpForNext(S.level);
      S.level++;
      const r = levelReward(S.level);
      S.coins += r.coins;
      S.crystals += r.crystals;
      leveled = true;
      this.emit('levelup', S.level, r);
    }
    if (leveled) { this.recompute(); this.refreshMarket(true); }
    if (emit) this.emit('change');
  }

  // ---------------------------------------------------------------- market (NPC traders)
  marketPool() {
    const lvl = this.state.level;
    return [...RAW_IDS, ...GOOD_IDS].filter((id) => ITEMS[id].level <= lvl);
  }

  makeOffer() {
    const pool = this.marketPool();
    let item, qty;
    if (Math.random() < 0.22) {
      item = pick([...STORAGE_PARTS, ...EXPAND_PARTS]);
      qty = 1;
    } else {
      item = pick(pool);
      qty = ITEMS[item].kind === 'raw' ? 2 + Math.floor(Math.random() * 6) : 1 + Math.floor(Math.random() * 3);
    }
    const unit = ITEMS[item].value * (0.95 + Math.random() * 0.45);
    return { item, qty, price: Math.max(5, Math.round(unit * qty)), sold: false };
  }

  refreshMarket(free = false) {
    const m = this.state.market;
    if (!free) {
      const now = Date.now();
      if (now < m.refreshAt) {
        if (this.state.crystals < 2) return this.fail('Nicht genug Kristalle');
        this.state.crystals -= 2;
      }
    }
    m.offers = Array.from({ length: 9 }, () => this.makeOffer());
    m.refreshAt = Date.now() + 8 * 60 * 1000;
    this.emit('change');
    return true;
  }

  buyOffer(i) {
    const m = this.state.market;
    const o = m.offers[i];
    if (!o || o.sold) return false;
    if (this.state.coins < o.price) return this.fail('Nicht genug Münzen');
    if (ITEMS[o.item].kind !== 'special' && this.storageFree() < o.qty) return this.fail('Nicht genug Platz im Lager');
    this.state.coins -= o.price;
    this.addItem(o.item, o.qty);
    o.sold = true;
    o.restock = Date.now() + 3 * 60 * 1000;
    this.emit('change');
    return true;
  }

  fairPrice(item, qty) { return ITEMS[item].value * qty; }

  listSale(item, qty, price) {
    const m = this.state.market;
    if (m.sales.length >= m.slots) return this.fail('Alle Verkaufsplätze belegt');
    if (this.stored(item) < qty) return this.fail('Nicht genug auf Lager');
    this.takeItems({ [item]: qty });
    const fair = this.fairPrice(item, qty);
    const ratio = price / fair;
    const secs = Math.max(20, 60 * Math.pow(ratio, 4) * (0.6 + Math.random() * 0.8) * (1 + qty * 0.08));
    m.sales.push({ item, qty, price, listed: Date.now(), soldAt: Date.now() + secs * 1000 });
    this.emit('change');
    return true;
  }

  collectSale(i) {
    const m = this.state.market;
    const s = m.sales[i];
    if (!s || s.soldAt > Date.now()) return false;
    m.sales.splice(i, 1);
    this.state.coins += s.price;
    this.state.stats.sold++;
    this.addXP(Math.max(1, Math.round(s.price / 60)));
    this.emit('sold', s);
    this.emit('change');
    this.questCheck();
    return true;
  }

  cancelSale(i) {
    const m = this.state.market;
    const s = m.sales[i];
    if (!s) return false;
    if (s.soldAt <= Date.now()) return this.collectSale(i);
    if (this.storageFree() < s.qty) return this.fail('Nicht genug Platz im Lager');
    m.sales.splice(i, 1);
    this.addItem(s.item, s.qty);
    this.emit('change');
    return true;
  }

  buySalesSlot() {
    const m = this.state.market;
    if (m.slots >= 10) return false;
    const c = salesSlotCost(m.slots);
    if (this.state.coins < c) return this.fail('Nicht genug Münzen');
    this.state.coins -= c;
    m.slots++;
    this.emit('change');
    return true;
  }

  salesSlotPrice() { return this.state.market.slots >= 10 ? null : salesSlotCost(this.state.market.slots); }

  // ---------------------------------------------------------------- cargo trains
  newCargo() {
    const lvl = this.state.level;
    const { raws, goods } = this.requestPool();
    const pool = [...raws, ...goods.filter((g) => ITEMS[g].level <= lvl)];
    const wagons = [];
    const used = new Set();
    for (let i = 0; i < 3; i++) {
      let id = pick(pool);
      for (let t = 0; t < 6 && used.has(id); t++) id = pick(pool);
      used.add(id);
      const it = ITEMS[id];
      const qty = it.kind === 'raw' ? 3 + Math.floor(Math.random() * 5) : 1 + Math.floor(Math.random() * 3);
      wagons.push({ item: id, qty, done: false, coins: Math.round(it.value * qty * 1.5), xp: Math.round(it.xp * qty * 2.2) });
    }
    this.state.cargo.wagons = wagons;
    this.state.cargo.returnAt = 0;
  }

  loadWagon(i) {
    const c = this.state.cargo;
    const w = c.wagons[i];
    if (!w || w.done || c.returnAt) return false;
    if (this.stored(w.item) < w.qty) return this.fail('Nicht genug auf Lager');
    this.takeItems({ [w.item]: w.qty });
    w.done = true;
    this.state.coins += w.coins;
    this.state.stats.cargoWagons++;
    this.addXP(w.xp);
    if (c.wagons.every((x) => x.done)) {
      // full train bonus
      const bonus = Math.round(c.wagons.reduce((a, x) => a + x.coins, 0) * 0.3);
      this.state.coins += bonus;
      const part = this.maybeDropPart(1);
      const crystal = Math.random() < 0.35 ? 1 : 0;
      this.state.crystals += crystal;
      c.returnAt = Date.now() + 12 * 60 * 1000;
      this.emit('train', { bonus, part, crystal });
    }
    this.emit('change');
    this.questCheck();
    return true;
  }

  skipCargo() {
    const c = this.state.cargo;
    const secs = (c.returnAt - Date.now()) / 1000;
    if (secs <= 0) return false;
    const p = skipPrice(secs);
    if (this.state.crystals < p) return this.fail('Nicht genug Kristalle');
    this.state.crystals -= p;
    this.newCargo();
    this.emit('change');
    return true;
  }

  // ---------------------------------------------------------------- quests
  questCheck() {
    // emit progress events; completion is claimed by the player
    this.emit('quests');
  }

  questDone(q) { return questProgress(this, q) >= q.n; }

  claimQuest(uid) {
    const qs = this.state.quests;
    const q = qs.active.find((a) => a.uid === uid);
    if (!q || !this.questDone(q)) return false;
    qs.active = qs.active.filter((a) => a !== q);
    this.state.coins += q.coins || 0;
    this.state.crystals += q.crystals || 0;
    let part = null;
    if (q.part) part = this.maybeDropPart(1);
    this.addXP(q.xp || 0);
    fillQuests(this);
    this.emit('questClaimed', q, part);
    this.emit('change');
    return true;
  }

  // ---------------------------------------------------------------- time
  tick(dtSec) {
    const S = this.state;
    const now = Date.now();
    // taxes
    const cap = this.taxCap();
    if (S.taxes.acc < cap) S.taxes.acc = Math.min(cap, S.taxes.acc + (this.city.taxRate / 60) * dtSec);
    // market restock
    for (let i = 0; i < S.market.offers.length; i++) {
      const o = S.market.offers[i];
      if (o.sold && o.restock <= now) S.market.offers[i] = this.makeOffer();
    }
    // cargo return
    if (S.cargo.returnAt && S.cargo.returnAt <= now) { this.newCargo(); this.emit('change'); }
    this.fireTick(dtSec);
    this.wishTick(now);
    this.shopCustomersTick(now);
    S.updated = now;
  }

  // ---------------------------------------------------------------- shop customers
  // Townspeople come into the shops and ask for goods; they pay above market value.
  shopCustomersTick(now) {
    if ((this._custT || 0) > now) return;
    this._custT = now + 5000;
    let changed = false;
    for (const b of this.state.buildings) {
      const def = BUILDINGS[b.type];
      if (!def.shop) continue;
      b.customers ||= [];
      const before = b.customers.length;
      b.customers = b.customers.filter((c) => c.leaveAt > now);
      if (b.customers.length !== before) changed = true;
      if (b.customers.length >= 3 || (b.nextCustomer || 0) > now) continue;
      const items = SHOPS[def.shop].items.filter((id) => ITEMS[id].level <= this.state.level);
      if (!items.length) continue;
      // prefer things the player has made before
      const known = items.filter((id) => this.state.stats.crafted[id]);
      const pool = known.length && Math.random() < 0.7 ? known : items;
      const item = pool[Math.floor(Math.random() * pool.length)];
      const qty = 1 + Math.floor(Math.random() * (ITEMS[item].value > 400 ? 1 : 3));
      const pay = Math.round(ITEMS[item].value * qty * (1.25 + Math.random() * 0.35) / 5) * 5;
      this.state.custSeq = (this.state.custSeq || 0) + 1;
      b.customers.push({ id: this.state.custSeq, who: CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)], item, qty, pay, xp: Math.round(ITEMS[item].xp * qty * 1.6), leaveAt: now + (12 + Math.random() * 12) * 60000 });
      b.nextCustomer = now + (60 + Math.random() * 120) * 1000;
      changed = true;
    }
    if (changed) this.emit('change');
  }

  serveCustomer(bid, cid) {
    const b = this.byId.get(bid);
    const c = b?.customers?.find((x) => x.id === cid);
    if (!c) return false;
    if (this.stored(c.item) < c.qty) return this.fail('Nicht genug auf Lager');
    this.takeItems({ [c.item]: c.qty });
    b.customers = b.customers.filter((x) => x !== c);
    b.nextCustomer = Math.min(b.nextCustomer || 0, Date.now() + 45000);
    this.state.coins += c.pay;
    this.state.stats.customers = (this.state.stats.customers || 0) + 1;
    this.addXP(c.xp);
    this.emit('served', b, c);
    this.emit('change');
    this.questCheck();
    return true;
  }

  // Sell goods straight over the counter to passers-by at a fair price.
  sellOverCounter(item, n = 1) {
    n = Math.min(n, this.stored(item));
    if (n <= 0) return 0;
    this.takeItems({ [item]: n });
    const coins = Math.max(1, Math.round(ITEMS[item].value * 0.85)) * n;
    this.state.coins += coins;
    this.addXP(Math.max(1, Math.round(ITEMS[item].xp * 0.5)) * n);
    this.emit('change');
    return coins;
  }

  // ---------------------------------------------------------------- wishes
  wishTick(now) {
    let changed = false;
    for (const b of this.state.buildings) {
      if (!isRes(b.type)) continue;
      const ready = this.wishReady(b) && now - (b.built || 0) > 12000 && now - (b.upgradedAt || 0) > 15000;
      if (ready && !b.wish) { b.wish = now; changed = true; this.emit('wish', b); }
      else if (!ready && b.wish) { b.wish = 0; changed = true; }
    }
    if (changed) this.emit('change');
  }

  // ---------------------------------------------------------------- fires
  // Houses without fire protection occasionally catch fire. A fire station in range puts it out;
  // otherwise the mayor can pay the volunteer brigade.
  fireTick(dtSec) {
    const S = this.state;
    if (S.level < BUILDINGS.firesmall.level || dtSec > 600) return;
    this.fireAcc = (this.fireAcc || 0) + dtSec;
    if (this.fireAcc < 30) return;
    this.fireAcc = 0;
    let changed = false;
    for (const b of S.buildings) {
      if (!isRes(b.type)) continue;
      const inf = this.info.get(b.id);
      if (!inf) continue;
      // protected houses: the fire brigade drives out; if it cannot get there the fire dies down
      if (b.fire && inf.services?.fire && Date.now() - b.fire > 50000) { b.fire = null; changed = true; this.emit('fireOut', b); continue; }
      const risk = inf.services?.fire ? 0.003 : 0.012;
      if (!b.fire && b.level >= 2 && Math.random() < risk) {
        b.fire = Date.now();
        changed = true;
        this.emit('fire', b, !!inf.services?.fire);
      }
    }
    if (changed) { this.recompute(); this.emit('change'); }
  }

  extinguishCost(b) { return 40 + 30 * b.level; }

  // put out by the city's own fire brigade (engine arrived on the scene)
  extinguishFree(bid) {
    const b = this.byId.get(bid);
    if (!b || !b.fire) return false;
    b.fire = null;
    this.state.stats.firesOut = (this.state.stats.firesOut || 0) + 1;
    this.recompute();
    this.emit('fireOut', b, true);
    this.emit('change');
    return true;
  }

  extinguish(bid) {
    const b = this.byId.get(bid);
    if (!b || !b.fire) return false;
    const c = this.extinguishCost(b);
    if (this.state.coins < c) return this.fail('Nicht genug Münzen');
    this.state.coins -= c;
    b.fire = null;
    this.recompute();
    this.emit('fireOut', b);
    this.emit('change');
    return true;
  }

  // ---------------------------------------------------------------- daily bonus
  dailyBonus() {
    const S = this.state;
    const day = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const today = day(new Date());
    S.daily ||= { last: '', streak: 0 };
    if (S.daily.last === today) return null;
    const y = new Date(); y.setDate(y.getDate() - 1);
    S.daily.streak = S.daily.last === day(y) ? S.daily.streak + 1 : 1;
    S.daily.last = today;
    const d = ((S.daily.streak - 1) % 7) + 1;
    const r = { day: d, coins: Math.round((150 + S.level * 40) * d / 10) * 10, crystals: d === 7 ? 6 : d >= 4 ? 2 : 1, part: d === 5 };
    S.coins += r.coins;
    S.crystals += r.crystals;
    if (r.part) r.partId = this.maybeDropPart(1);
    this.emit('change');
    return r;
  }

  // ---------------------------------------------------------------- helpers
  fail(msg) {
    this.emit('toast', msg, 'bad');
    return false;
  }

  toast(msg, kind = 'info') {
    this.emit('toast', msg, kind);
  }

  markSeen(key) { this.state.seen[key] = 1; }
}
