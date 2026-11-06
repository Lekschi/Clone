// World state: tile layers, buildings, finances. Pure data + editing operations.
import { mulberry32, fbm, hash2 } from '../util/rng.js';
import {
  BUILDINGS, ZONE_COST, ROAD_COST, BRIDGE_COST, PLINE_COST, TREE_COST, DEMOLISH_COST,
  DIFFICULTY, DENSITY_TIERS,
} from '../data/defs.js';

export const T_GRASS = 0, T_WATER = 1, T_SAND = 2;
const LAYERS_U8 = ['terrain', 'tree', 'road', 'pline', 'zoneT', 'zoneD', 'deco'];
const MAPS_U8 = ['power', 'water', 'pollution', 'landValue', 'crime', 'traffic',
  'covPolice', 'covFire', 'covHealth', 'covEdu', 'covPark', 'roadDist', 'waterDist'];

export class World {
  constructor(w, h) {
    this.w = w; this.h = h; this.n = w * h;
    for (const k of LAYERS_U8) this[k] = new Uint8Array(this.n);
    for (const k of MAPS_U8) this[k] = new Uint8Array(this.n);
    this.bld = new Int32Array(this.n);
    this.roadComp = new Int32Array(this.n);
    this.buildings = new Map();
    this.nextId = 1;
    this.funds = 25000;
    this.day = 0; // days since founding
    this.taxes = { 1: 9, 2: 9, 3: 9 };
    this.funding = { roads: 100, police: 100, fire: 100, health: 100, edu: 100, parks: 100, utilities: 100 };
    this.loans = [];
    this.history = []; // monthly {pop, funds, income, expense, jobs}
    this.ledger = { income: 0, expense: 0, build: 0, lastIncome: 0, lastExpense: 0, lastBuild: 0, lastBreakdown: null };
    this.demand = { 1: 0.6, 2: 0.2, 3: 0.5 };
    this.stats = { pop: 0, jobsC: 0, jobsI: 0, approval: 60, edu: 0, powerSupply: 0, powerDemand: 0,
      waterSupply: 0, waterDemand: 0, unemployment: 0, outside: false, crimeAvg: 0, pollAvg: 0, trafficAvg: 0 };
    this.milestone = 0;
    this.name = 'New City';
    this.seed = 1;
    this.mapType = 'river';
    this.difficulty = 'normal';
    this.costMul = 1;
    this.settings = { disasters: true };
    this.dirty = { ground: true, objects: true, version: 0 };
    this.changedTiles = new Set();
    this.events = []; // outbound messages for UI
  }

  idx(x, y) { return y * this.w + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

  touch(i) { this.dirty.version++; this.changedTiles.add(i); }

  emit(type, data) { this.events.push({ type, ...data }); }

  // ---------- Terrain ----------
  generate(opts) {
    const { seed = 1, mapType = 'river', difficulty = 'normal', name } = opts;
    this.seed = seed; this.mapType = mapType; this.difficulty = difficulty;
    const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.funds = diff.funds; this.costMul = diff.costMul;
    if (name) this.name = name;
    const { w, h } = this;
    const rng = mulberry32(seed);
    const height = new Float32Array(this.n);
    const s = 1 / 22;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = fbm(x * s, y * s, seed, 5);
      const nx = x / (w - 1), ny = y / (h - 1);
      if (mapType === 'coast') {
        const side = seed % 4;
        const t = [nx, 1 - nx, ny, 1 - ny][side];
        v = v * 0.55 + t * 0.9 - 0.12;
      } else if (mapType === 'bay') {
        const cx = (seed % 2) ? 0 : 1, cy = ((seed >> 1) % 2) ? 0 : 1;
        const d = Math.hypot(nx - cx, ny - cy);
        v = v * 0.5 + Math.min(1, Math.abs(d - 0.05) * 1.25) * 0.85 - 0.05;
      } else if (mapType === 'lakes') {
        v = v * 1.05 + 0.03;
      } else {
        v = v * 0.5 + 0.42;
      }
      height[y * w + x] = v;
    }
    let sea = 0.40;
    if (mapType === 'lakes') sea = 0.375;
    if (mapType === 'river' || mapType === 'plains') sea = -1;
    for (let i = 0; i < this.n; i++) this.terrain[i] = height[i] < sea ? T_WATER : T_GRASS;

    if (mapType === 'river' || mapType === 'plains') this.carveRiver(rng, mapType === 'river' ? 2.3 : 0.9);
    if (mapType === 'river') {
      // a couple of oxbow ponds
      for (let k = 0; k < 2; k++) this.blob(rng, 2 + rng() * 3);
    }
    // keep a ring of land at the very edge mostly accessible (except coast/bay edges which are water by design)
    this.smoothWater();
    // beaches
    this.computeWaterDist();
    for (let i = 0; i < this.n; i++) {
      if (this.terrain[i] === T_GRASS && this.waterDist[i] === 1) {
        const x = i % w, y = (i / w) | 0;
        if (hash2(x, y, seed + 7) < (mapType === 'coast' || mapType === 'bay' ? 0.92 : 0.45)) this.terrain[i] = T_SAND;
      }
    }
    // forests
    const fs = 1 / 14;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (this.terrain[i] !== T_GRASS) continue;
      const f = fbm(x * fs + 50, y * fs - 30, seed + 99, 4);
      const thr = mapType === 'lakes' ? 0.5 : 0.56;
      if (f > thr) this.tree[i] = f > thr + 0.1 ? 3 : f > thr + 0.05 ? 2 : 1;
      else if (hash2(x, y, seed + 3) < 0.025) this.tree[i] = 1;
      // decorative ground details (rocks, flowers)
      const d = hash2(x, y, seed + 11);
      this.deco[i] = d < 0.05 ? 1 : d < 0.09 ? 2 : 0;
    }
    // ensure central area is land-ish so the player has room
    this.dirty.version++;
  }

  carveRiver(rng, width) {
    const { w, h } = this;
    const vertical = rng() < 0.5;
    const len = vertical ? h : w;
    const span = vertical ? w : h;
    let pos = span * (0.3 + rng() * 0.4);
    let drift = 0;
    for (let t = -2; t < len + 2; t++) {
      drift += (rng() - 0.5) * 0.35; drift *= 0.94;
      pos += drift + Math.sin(t / 11 + this.seed) * 0.35;
      pos = Math.max(span * 0.15, Math.min(span * 0.85, pos));
      const wv = width + Math.sin(t / 7) * 0.5;
      for (let o = -Math.ceil(wv) - 1; o <= Math.ceil(wv) + 1; o++) {
        const p = Math.round(pos + o);
        if (Math.abs(pos - p) > wv) continue;
        const x = vertical ? p : t, y = vertical ? t : p;
        if (this.inb(x, y)) this.terrain[this.idx(x, y)] = T_WATER;
      }
    }
  }

  blob(rng, r) {
    const cx = Math.floor(this.w * (0.15 + rng() * 0.7)), cy = Math.floor(this.h * (0.15 + rng() * 0.7));
    for (let y = -Math.ceil(r) - 1; y <= r + 1; y++) for (let x = -Math.ceil(r) - 1; x <= r + 1; x++) {
      const d = Math.hypot(x, y) + (hash2(cx + x, cy + y, this.seed) - 0.5) * 1.2;
      if (d < r && this.inb(cx + x, cy + y)) this.terrain[this.idx(cx + x, cy + y)] = T_WATER;
    }
  }

  smoothWater() {
    const { w, h } = this;
    for (let pass = 0; pass < 2; pass++) {
      const copy = this.terrain.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let c = 0, tot = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const xx = x + dx, yy = y + dy;
          if (!this.inb(xx, yy)) continue;
          tot++; if (copy[yy * w + xx] === T_WATER) c++;
        }
        const i = y * w + x;
        if (copy[i] === T_WATER && c <= 2) this.terrain[i] = T_GRASS;
        else if (copy[i] !== T_WATER && c >= 6) this.terrain[i] = T_WATER;
      }
    }
  }

  computeWaterDist() {
    // BFS distance (capped at 12) from water tiles.
    const { w, h, n } = this;
    const d = this.waterDist; d.fill(255);
    const q = new Int32Array(n); let qh = 0, qt = 0;
    for (let i = 0; i < n; i++) if (this.terrain[i] === T_WATER) { d[i] = 0; q[qt++] = i; }
    while (qh < qt) {
      const i = q[qh++]; const x = i % w, y = (i / w) | 0; const nd = d[i] + 1;
      if (nd > 12) continue;
      if (x > 0 && d[i - 1] > nd) { d[i - 1] = nd; q[qt++] = i - 1; }
      if (x < w - 1 && d[i + 1] > nd) { d[i + 1] = nd; q[qt++] = i + 1; }
      if (y > 0 && d[i - w] > nd) { d[i - w] = nd; q[qt++] = i - w; }
      if (y < h - 1 && d[i + w] > nd) { d[i + w] = nd; q[qt++] = i + w; }
    }
  }

  // ---------- Queries ----------
  isWater(x, y) { return this.inb(x, y) && this.terrain[this.idx(x, y)] === T_WATER; }
  buildingAt(x, y) { if (!this.inb(x, y)) return null; const id = this.bld[this.idx(x, y)]; return id ? this.buildings.get(id) : null; }
  roadAt(x, y) { return this.inb(x, y) && this.road[this.idx(x, y)] === 1; }
  plineAt(x, y) { return this.inb(x, y) && this.pline[this.idx(x, y)] === 1; }

  roadMask(x, y) {
    return (this.roadAt(x, y - 1) ? 1 : 0) | (this.roadAt(x + 1, y) ? 2 : 0) | (this.roadAt(x, y + 1) ? 4 : 0) | (this.roadAt(x - 1, y) ? 8 : 0);
  }
  plineMask(x, y) {
    const c = (xx, yy) => this.plineAt(xx, yy) || (this.buildingAt(xx, yy)?.def?.power > 0);
    return (c(x, y - 1) ? 1 : 0) | (c(x + 1, y) ? 2 : 0) | (c(x, y + 1) ? 4 : 0) | (c(x - 1, y) ? 8 : 0);
  }

  cost(base) { return Math.round(base * this.costMul); }

  canAfford(c) { return this.funds >= c; }
  spend(c) { this.funds -= c; this.ledger.build += c; }

  // ---------- Building ops ----------
  placeCheck(key, x, y) {
    const def = BUILDINGS[key];
    if (!def) return { ok: false, reason: 'Unknown building' };
    const s = def.size;
    let nearWater = false, clearCost = 0;
    for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) {
      if (!this.inb(xx, yy)) return { ok: false, reason: 'Out of bounds' };
      const i = this.idx(xx, yy);
      if (this.terrain[i] === T_WATER) return { ok: false, reason: 'Cannot build on water' };
      if (this.road[i]) return { ok: false, reason: 'Road in the way' };
      if (this.bld[i]) {
        const b = this.buildings.get(this.bld[i]);
        if (b && b.kind === 'zone' || b && b.kind === 'rubble') clearCost += DEMOLISH_COST;
        else return { ok: false, reason: 'Occupied' };
      }
    }
    for (let k = -1; k <= s; k++) {
      for (const [xx, yy] of [[x + k, y - 1], [x + k, y + s], [x - 1, y + k], [x + s, y + k]]) if (this.isWater(xx, yy)) nearWater = true;
    }
    if (def.needsWater && !nearWater) return { ok: false, reason: 'Must be built next to water' };
    if (def.unique) for (const b of this.buildings.values()) if (b.kind === key) return { ok: false, reason: 'Only one allowed' };
    const cost = this.cost(def.cost) + clearCost;
    if (!this.canAfford(cost)) return { ok: false, reason: 'Not enough funds', cost };
    return { ok: true, cost };
  }

  place(key, x, y) {
    const chk = this.placeCheck(key, x, y);
    if (!chk.ok) return chk;
    const def = BUILDINGS[key];
    const s = def.size;
    for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) {
      const i = this.idx(xx, yy);
      if (this.bld[i]) this.removeBuilding(this.buildings.get(this.bld[i]), true);
      this.zoneT[i] = 0; this.zoneD[i] = 0; this.tree[i] = 0; this.pline[i] = 0;
    }
    const b = this.addBuilding({ kind: key, x, y, w: s, h: s });
    this.spend(chk.cost);
    this.emit('built', { x, y, key });
    return { ok: true, cost: chk.cost, b };
  }

  addBuilding(props) {
    const b = Object.assign({ id: this.nextId++, tier: 0, variant: (Math.random() * 1e6) | 0, pop: 0, jobs: 0, occ: 0.5,
      powered: false, watered: false, noPower: 0, abandoned: false, fire: 0, age: 0, built: 1 }, props);
    b.def = BUILDINGS[b.kind] || null;
    this.buildings.set(b.id, b);
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
      const i = this.idx(xx, yy); this.bld[i] = b.id; this.touch(i);
    }
    return b;
  }

  removeBuilding(b, silent = false) {
    if (!b) return;
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
      const i = this.idx(xx, yy); if (this.bld[i] === b.id) { this.bld[i] = 0; this.touch(i); }
    }
    this.buildings.delete(b.id);
    if (!silent) this.emit('demolished', { x: b.x, y: b.y });
  }

  // Road: returns cost or -1 if not placeable
  roadCost(x, y) {
    if (!this.inb(x, y)) return -1;
    const i = this.idx(x, y);
    if (this.road[i]) return 0;
    const b = this.bld[i] ? this.buildings.get(this.bld[i]) : null;
    if (b && b.kind !== 'zone' && b.kind !== 'rubble') return -1;
    if (this.terrain[i] === T_WATER) {
      // bridges cannot start next to existing perpendicular bridges in a messy way; keep simple
      return this.cost(BRIDGE_COST);
    }
    return this.cost(ROAD_COST) + (b ? DEMOLISH_COST : 0) + (this.tree[i] ? 2 : 0);
  }
  buildRoad(x, y) {
    const c = this.roadCost(x, y);
    if (c <= 0) return 0;
    if (!this.canAfford(c)) return -1;
    const i = this.idx(x, y);
    if (this.bld[i]) this.removeBuilding(this.buildings.get(this.bld[i]), true);
    this.road[i] = 1; this.tree[i] = 0; this.zoneT[i] = 0; this.zoneD[i] = 0;
    this.spend(c); this.touchAround(x, y);
    return c;
  }
  touchAround(x, y) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.inb(x + dx, y + dy)) this.touch(this.idx(x + dx, y + dy));
  }

  plineCost(x, y) {
    if (!this.inb(x, y)) return -1;
    const i = this.idx(x, y);
    if (this.pline[i]) return 0;
    if (this.terrain[i] === T_WATER) return -1;
    if (this.bld[i]) return -1;
    return this.cost(PLINE_COST) + (this.tree[i] ? 2 : 0);
  }
  buildPline(x, y) {
    const c = this.plineCost(x, y);
    if (c <= 0) return 0;
    if (!this.canAfford(c)) return -1;
    const i = this.idx(x, y);
    this.pline[i] = 1; this.tree[i] = 0; this.zoneT[i] = 0; this.zoneD[i] = 0;
    this.spend(c); this.touchAround(x, y);
    return c;
  }

  zoneCost(x, y, zt, zd) {
    if (!this.inb(x, y)) return -1;
    const i = this.idx(x, y);
    if (this.terrain[i] === T_WATER || this.road[i] || this.pline[i]) return -1;
    const b = this.bld[i] ? this.buildings.get(this.bld[i]) : null;
    if (b && b.kind !== 'zone' && b.kind !== 'rubble') return -1;
    if (this.zoneT[i] === zt && this.zoneD[i] === zd) return 0;
    let c = this.cost(ZONE_COST[zd]);
    if (b && b.kind === 'zone' && b.zt !== zt) c += DEMOLISH_COST * b.w * b.h;
    return c;
  }
  setZone(x, y, zt, zd) {
    const c = this.zoneCost(x, y, zt, zd);
    if (c <= 0) return 0;
    if (!this.canAfford(c)) return -1;
    const i = this.idx(x, y);
    const b = this.bld[i] ? this.buildings.get(this.bld[i]) : null;
    if (b && b.kind === 'zone' && b.zt !== zt) {
      // clear zone of whole building footprint
      for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
        const j = this.idx(xx, yy); if (j !== i) { this.zoneT[j] = 0; this.zoneD[j] = 0; }
      }
      this.removeBuilding(b, true);
    }
    if (b && b.kind === 'zone' && b.zt === zt) {
      // density change: clamp building tier into new density range on next growth tick
      const [lo, hi] = DENSITY_TIERS[zd];
      if (b.tier > hi && b.w === 1) { b.tier = hi; this.touch(i); }
      if (b.w > 1 && zd < 3) { this.removeBuilding(b, true); }
    }
    this.zoneT[i] = zt; this.zoneD[i] = zd;
    this.spend(c); this.touch(i);
    return c;
  }

  bulldozeCost(x, y) {
    if (!this.inb(x, y)) return -1;
    const i = this.idx(x, y);
    const b = this.bld[i] ? this.buildings.get(this.bld[i]) : null;
    if (b) return DEMOLISH_COST * b.w * b.h;
    if (this.road[i] || this.pline[i]) return 1;
    if (this.tree[i]) return 1;
    if (this.zoneT[i]) return 0.0001;
    return -1;
  }
  bulldoze(x, y) {
    if (!this.inb(x, y)) return 0;
    const i = this.idx(x, y);
    const b = this.bld[i] ? this.buildings.get(this.bld[i]) : null;
    let c = 0;
    if (b) {
      c = DEMOLISH_COST * b.w * b.h;
      if (b.kind !== 'zone' && b.kind !== 'rubble') {
        // refund a little of utility buildings
        for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) this.touchAround(xx, yy);
      }
      this.removeBuilding(b);
    } else if (this.road[i]) { this.road[i] = 0; c = 1; this.touchAround(x, y); }
    else if (this.pline[i]) { this.pline[i] = 0; c = 1; this.touchAround(x, y); }
    else if (this.tree[i]) { this.tree[i] = 0; c = 1; this.touch(i); }
    else if (this.zoneT[i]) { this.zoneT[i] = 0; this.zoneD[i] = 0; this.touch(i); }
    if (c) this.spend(c);
    return c;
  }

  plantCost(x, y) {
    if (!this.inb(x, y)) return -1;
    const i = this.idx(x, y);
    if (this.terrain[i] === T_WATER || this.road[i] || this.pline[i] || this.bld[i] || this.tree[i] >= 3) return -1;
    return this.cost(TREE_COST);
  }
  plant(x, y) {
    const c = this.plantCost(x, y);
    if (c <= 0) return 0;
    if (!this.canAfford(c)) return -1;
    const i = this.idx(x, y);
    this.tree[i] = Math.min(3, this.tree[i] + 2);
    this.spend(c); this.touch(i);
    return c;
  }

  // ---------- Serialization ----------
  serialize() {
    const layers = {};
    for (const k of LAYERS_U8) layers[k] = this[k];
    const buildings = [];
    for (const b of this.buildings.values()) {
      const { def, ...rest } = b; buildings.push(rest);
    }
    return {
      v: 1, w: this.w, h: this.h, name: this.name, seed: this.seed, mapType: this.mapType, difficulty: this.difficulty,
      costMul: this.costMul, funds: this.funds, day: this.day, taxes: this.taxes, funding: this.funding, loans: this.loans,
      history: this.history, ledger: this.ledger, demand: this.demand, stats: this.stats, milestone: this.milestone,
      settings: this.settings, nextId: this.nextId, layers, buildings,
    };
  }

  static deserialize(d) {
    const wd = new World(d.w, d.h);
    for (const k of ['name', 'seed', 'mapType', 'difficulty', 'costMul', 'funds', 'day', 'taxes', 'funding', 'loans',
      'history', 'ledger', 'demand', 'stats', 'milestone', 'settings', 'nextId']) if (d[k] !== undefined) wd[k] = d[k];
    wd.funding = Object.assign({ roads: 100, police: 100, fire: 100, health: 100, edu: 100, parks: 100, utilities: 100 }, d.funding);
    for (const k of LAYERS_U8) if (d.layers[k]) wd[k].set(d.layers[k]);
    for (const b of d.buildings) {
      b.def = BUILDINGS[b.kind] || null;
      wd.buildings.set(b.id, b);
      for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) wd.bld[wd.idx(xx, yy)] = b.id;
    }
    wd.computeWaterDist();
    return wd;
  }
}

// Base64 helpers for export files
export function u8ToB64(u8) {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
export function b64ToU8(b64) {
  const s = atob(b64); const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
