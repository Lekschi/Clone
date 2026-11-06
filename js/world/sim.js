// City simulation: networks, coverage maps, growth, economy.
import {
  BUILDINGS, ZONE_CAP, TIER_DESIRE, DENSITY_TIERS, POWER_USE, WATER_USE, SERVICE_POWER, SERVICE_WATER,
  MILESTONES, DAYS_PER_MONTH, TIER_NAMES, ZONE_NAMES,
} from '../data/defs.js';
import { T_WATER } from './world.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Sim {
  constructor(world) {
    this.w = world;
    const n = world.n;
    this.nearComp = new Int32Array(n);
    this.nearRoad = new Int32Array(n);
    this.powerComp = new Int32Array(n);
    this.comps = [];
    this.lastNetVersion = -1;
    this.bList = [];
    this.advice = [];
    this.lastAdviceDay = {};
    this.tmpF = new Float32Array(n);
    this.tmpF2 = new Float32Array(n);
  }

  init() {
    this.updateNetworks();
    for (let k = 0; k < 3; k++) this.updateMaps();
    this.updateStats();
    this.updateAdvice();
  }

  // One simulated day.
  tick() {
    const w = this.w;
    w.day++;
    if (w.dirty.version !== this.lastNetVersion || w.day % 4 === 0) this.updateNetworks();
    this.growth();
    if (w.settings.disasters) this.fires();
    if (w.day % 5 === 0) this.updateMaps();
    this.updateStats();
    if (w.day % DAYS_PER_MONTH === 0) this.monthEnd();
  }

  // ---------- Networks ----------
  updateNetworks() {
    this.lastNetVersion = this.w.dirty.version;
    this.updateRoads();
    this.updatePower();
    this.updateWater();
  }

  updateRoads() {
    const w = this.w; const { n } = w; const W = w.w, H = w.h;
    const comp = w.roadComp; comp.fill(-1);
    const q = new Int32Array(n);
    this.comps = [];
    for (let s = 0; s < n; s++) {
      if (!w.road[s] || comp[s] >= 0) continue;
      const id = this.comps.length; const info = { outside: false, size: 0, pop: 0, jobs: 0, waterSupply: 0, waterUsed: 0 };
      this.comps.push(info);
      let qh = 0, qt = 0; q[qt++] = s; comp[s] = id;
      while (qh < qt) {
        const i = q[qh++]; info.size++;
        const x = i % W, y = (i / W) | 0;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) info.outside = true;
        if (x > 0 && w.road[i - 1] && comp[i - 1] < 0) { comp[i - 1] = id; q[qt++] = i - 1; }
        if (x < W - 1 && w.road[i + 1] && comp[i + 1] < 0) { comp[i + 1] = id; q[qt++] = i + 1; }
        if (y > 0 && w.road[i - W] && comp[i - W] < 0) { comp[i - W] = id; q[qt++] = i - W; }
        if (y < H - 1 && w.road[i + W] && comp[i + W] < 0) { comp[i + W] = id; q[qt++] = i + W; }
      }
    }
    // Multi-source BFS: distance to nearest road + which component/tile
    const dist = w.roadDist; dist.fill(255);
    const nc = this.nearComp, nr = this.nearRoad; nc.fill(-1); nr.fill(-1);
    let qh = 0, qt = 0;
    for (let i = 0; i < n; i++) if (w.road[i]) { dist[i] = 0; nc[i] = comp[i]; nr[i] = i; q[qt++] = i; }
    while (qh < qt) {
      const i = q[qh++]; const nd = dist[i] + 1; if (nd > 6) continue;
      const x = i % W, y = (i / W) | 0;
      const push = (j) => { if (dist[j] > nd && w.terrain[j] !== T_WATER) { dist[j] = nd; nc[j] = nc[i]; nr[j] = nr[i]; q[qt++] = j; } };
      if (x > 0) push(i - 1); if (x < W - 1) push(i + 1); if (y > 0) push(i - W); if (y < H - 1) push(i + W);
    }
    w.stats.outside = this.comps.some((c) => c.outside);
  }

  bRoadDist(b) {
    const w = this.w; let best = 255, bi = -1;
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
      const i = w.idx(xx, yy); if (w.roadDist[i] < best) { best = w.roadDist[i]; bi = i; }
    }
    return [best, bi];
  }

  powerUse(b) {
    if (b.abandoned || b.kind === 'rubble') return 0;
    if (b.kind === 'zone') return Math.max(1, ZONE_CAP[b.zt][b.tier] * POWER_USE[b.zt] * (0.5 + b.occ * 0.5));
    if (b.def && b.def.power) return 0;
    return SERVICE_POWER * b.w;
  }
  waterUse(b) {
    if (b.abandoned || b.kind === 'rubble') return 0;
    if (b.kind === 'zone') return Math.max(1, ZONE_CAP[b.zt][b.tier] * WATER_USE[b.zt] * (0.5 + b.occ * 0.5));
    if (b.def && b.def.water) return 0;
    return SERVICE_WATER * b.w;
  }

  updatePower() {
    const w = this.w; const { n } = w; const W = w.w, H = w.h;
    const pc = this.powerComp; pc.fill(-1);
    const cond = (i) => w.pline[i] || w.road[i] || w.bld[i] || w.zoneT[i];
    const q = new Int32Array(n);
    const fund = Math.min(1.1, w.funding.utilities / 100);
    let totalSupply = 0, totalDemand = 0;
    w.power.fill(0);
    let compId = 0;
    for (const b of w.buildings.values()) b.powered = false;
    for (let s = 0; s < n; s++) {
      if (!cond(s) || pc[s] >= 0) continue;
      const id = compId++;
      let qh = 0, qt = 0; q[qt++] = s; pc[s] = id;
      const seen = new Set(); const list = []; let supply = 0;
      while (qh < qt) {
        const i = q[qh++];
        const bid = w.bld[i];
        if (bid && !seen.has(bid)) {
          seen.add(bid); const b = w.buildings.get(bid);
          if (b) { list.push(b); if (b.def && b.def.power) supply += b.def.power * fund * (b.fire ? 0.2 : 1); }
        }
        const x = i % W, y = (i / W) | 0;
        if (x > 0 && pc[i - 1] < 0 && cond(i - 1)) { pc[i - 1] = id; q[qt++] = i - 1; }
        if (x < W - 1 && pc[i + 1] < 0 && cond(i + 1)) { pc[i + 1] = id; q[qt++] = i + 1; }
        if (y > 0 && pc[i - W] < 0 && cond(i - W)) { pc[i - W] = id; q[qt++] = i - W; }
        if (y < H - 1 && pc[i + W] < 0 && cond(i + W)) { pc[i + W] = id; q[qt++] = i + W; }
      }
      totalSupply += supply;
      for (const b of list) if (b.def && b.def.power) b._linked = qt > b.w * b.h;
      if (supply <= 0) continue;
      list.sort((a, b) => a.id - b.id);
      let left = supply;
      for (const b of list) {
        const u = this.powerUse(b); totalDemand += u;
        if (b.def && b.def.power) { b.powered = true; continue; }
        if (u <= left) { b.powered = true; left -= u; }
      }
      // mark tiles
      const spare = left > 0;
      for (let k = 0; k < qt; k++) {
        const i = q[k]; const bid = w.bld[i];
        if (bid) { const b = w.buildings.get(bid); w.power[i] = b && b.powered ? 1 : 0; }
        else w.power[i] = spare ? 1 : 0;
      }
    }
    // Count demand of unconnected buildings too (for stats)
    for (const b of w.buildings.values()) if (pc[w.idx(b.x, b.y)] >= 0 && !b.powered && !(b.def && b.def.power)) { /* counted */ }
    w.stats.powerSupply = Math.round(totalSupply);
    let dem = 0; for (const b of w.buildings.values()) dem += this.powerUse(b);
    w.stats.powerDemand = Math.round(dem);
  }

  updateWater() {
    const w = this.w;
    const fund = Math.min(1.1, w.funding.utilities / 100);
    for (const c of this.comps) { c.waterSupply = 0; c.waterUsed = 0; }
    let total = 0;
    const consumers = [];
    for (const b of w.buildings.values()) {
      b.watered = false;
      const [d, bi] = this.bRoadDist(b);
      b._comp = d <= 2 && bi >= 0 ? this.nearComp[bi] : -1;
      b._roadDist = d;
      if (b.def && b.def.water) {
        const out = b.powered ? b.def.water * fund * (b.fire ? 0.2 : 1) : 0;
        total += out;
        if (b._comp >= 0) this.comps[b._comp].waterSupply += out;
        b.watered = true;
      } else consumers.push(b);
    }
    consumers.sort((a, b) => a.id - b.id);
    let dem = 0;
    for (const b of consumers) {
      const u = this.waterUse(b); dem += u;
      if (b._comp < 0) continue;
      const c = this.comps[b._comp];
      if (c.waterUsed + u <= c.waterSupply) { c.waterUsed += u; b.watered = true; }
    }
    const wm = w.water; wm.fill(0);
    for (let i = 0; i < w.n; i++) {
      const bid = w.bld[i];
      if (bid) { const b = w.buildings.get(bid); wm[i] = b && b.watered ? 1 : 0; continue; }
      if (w.roadDist[i] <= 2) { const c = this.comps[this.nearComp[i]]; if (c && c.waterSupply > c.waterUsed) wm[i] = 1; }
    }
    w.stats.waterSupply = Math.round(total);
    w.stats.waterDemand = Math.round(dem);
  }

  // ---------- Maps ----------
  stamp(map, cx, cy, r, strength, additive) {
    const w = this.w;
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(w.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy; const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const v = strength * (1 - Math.sqrt(d2) / r * 0.7);
      const i = y * w.w + x;
      if (additive) map[i] = Math.min(255, map[i] + v); else if (v > map[i]) map[i] = Math.min(255, v);
    }
  }

  blur(src, passes = 1) {
    const w = this.w; const W = w.w, H = w.h; const t = this.tmpF2;
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x;
        let s = src[i] * 2, c = 2;
        if (x > 0) { s += src[i - 1]; c++; } if (x < W - 1) { s += src[i + 1]; c++; }
        if (y > 0) { s += src[i - W]; c++; } if (y < H - 1) { s += src[i + W]; c++; }
        t[i] = s / c;
      }
      src.set(t);
    }
  }

  updateMaps() {
    const w = this.w; const { n } = w;
    // Coverage
    for (const k of ['covPolice', 'covFire', 'covHealth', 'covEdu', 'covPark']) w[k].fill(0);
    const covKey = { police: 'covPolice', fire: 'covFire', health: 'covHealth', edu: 'covEdu', park: 'covPark' };
    for (const b of w.buildings.values()) {
      const d = b.def; if (!d || !d.cov) continue;
      const fund = clamp(w.funding[d.dept] / 100, 0, 1.2);
      const isPark = d.cov === 'park';
      if (!isPark && (!b.powered || (b._roadDist ?? 0) > 2)) continue;
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (isPark) this.stamp(w.covPark, cx, cy, d.r * (0.7 + 0.3 * fund), (d.lv || 30) * 1.6 * Math.min(1, fund + 0.2), true);
      else this.stamp(w[covKey[d.cov]], cx, cy, d.r * (0.6 + 0.4 * fund), 255 * Math.min(1, fund), false);
    }
    // Traffic
    const tr = this.tmpF; tr.fill(0);
    let outsideTrips = 0;
    for (const b of w.buildings.values()) {
      if (b.kind !== 'zone' || b.abandoned) continue;
      const [d, bi] = this.bRoadDist(b);
      if (d > 3 || bi < 0) continue;
      const ri = this.nearRoad[bi]; if (ri < 0) continue;
      const trips = b.zt === 1 ? b.pop * 0.45 : b.jobs * 0.5;
      tr[ri] += trips; outsideTrips += trips;
    }
    const roadFund = clamp(w.funding.roads / 100, 0.3, 1.2);
    const W = w.w;
    for (let it = 0; it < 6; it++) {
      const t2 = this.tmpF2;
      for (let i = 0; i < n; i++) {
        if (!w.road[i]) { t2[i] = 0; continue; }
        const x = i % W; let s = tr[i] * 1.0, c = 1;
        if (x > 0 && w.road[i - 1]) { s += tr[i - 1]; c++; }
        if (x < W - 1 && w.road[i + 1]) { s += tr[i + 1]; c++; }
        if (i >= W && w.road[i - W]) { s += tr[i - W]; c++; }
        if (i < n - W && w.road[i + W]) { s += tr[i + W]; c++; }
        t2[i] = s / c * (c > 2 ? 1.25 : 1.1);
      }
      tr.set(t2);
    }
    let tSum = 0, tCnt = 0;
    for (let i = 0; i < n; i++) {
      if (!w.road[i]) { w.traffic[i] = 0; continue; }
      const v = clamp(tr[i] * 1.6 / roadFund + 6, 0, 255);
      w.traffic[i] = v; tSum += v; tCnt++;
    }
    w.stats.trafficAvg = tCnt ? tSum / tCnt : 0;

    // Pollution
    const po = this.tmpF; po.fill(0);
    const edu = w.stats.edu || 0;
    for (const b of w.buildings.values()) {
      let p = 0;
      if (b.kind === 'zone' && b.zt === 3 && !b.abandoned) p = (40 + b.tier * 28) * (1 - edu * 0.45) * (0.4 + b.occ * 0.6);
      else if (b.def && b.def.pollution) p = b.def.pollution;
      if (!p) continue;
      for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) po[w.idx(xx, yy)] += p;
    }
    for (let i = 0; i < n; i++) if (w.road[i]) po[i] += w.traffic[i] * 0.35;
    this.blur(po, 4);
    let pSum = 0, pCnt = 0;
    for (let i = 0; i < n; i++) {
      const v = clamp(po[i] * 2.2 - w.tree[i] * 8 - w.covPark[i] * 0.15, 0, 255);
      w.pollution[i] = v;
      if (w.zoneT[i] === 1 && w.bld[i]) { pSum += v; pCnt++; }
    }
    w.stats.pollAvg = pCnt ? pSum / pCnt : 0;

    // Crime
    const cr = this.tmpF; cr.fill(0);
    const unemp = w.stats.unemployment || 0;
    for (const b of w.buildings.values()) {
      if (b.kind !== 'zone') continue;
      const dens = b.zt === 1 ? b.pop / 8 : b.jobs / 10;
      const base = Math.min(200, 18 + dens * 1.2) + (b.abandoned ? 90 : 0) + unemp * 140;
      for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) cr[w.idx(xx, yy)] += base / (b.w * b.h) * 1.4;
    }
    this.blur(cr, 2);
    let cSum = 0, cCnt = 0;
    for (let i = 0; i < n; i++) {
      const v = clamp(cr[i] * 1.6 - w.covPolice[i] * 0.85 - w.landValue[i] * 0.1, 0, 255);
      w.crime[i] = v; if (w.zoneT[i] && w.bld[i]) { cSum += v; cCnt++; }
    }
    w.stats.crimeAvg = cCnt ? cSum / cCnt : 0;

    // Land value
    for (let i = 0; i < n; i++) {
      if (w.terrain[i] === T_WATER) { w.landValue[i] = 0; continue; }
      const wd = w.waterDist[i];
      let v = 55 + (wd <= 5 ? (6 - wd) * 11 : 0) + w.covPark[i] * 0.55 + w.tree[i] * 6
        + (w.covPolice[i] + w.covHealth[i] + w.covEdu[i] + w.covFire[i]) * 0.045
        - w.pollution[i] * 0.75 - w.crime[i] * 0.3;
      const ri = this.nearRoad[i];
      if (ri >= 0) v -= w.traffic[ri] * 0.12;
      w.landValue[i] = clamp(v, 0, 255);
    }
  }

  desirability(i, zt) {
    const w = this.w;
    const lv = w.landValue[i], po = w.pollution[i], cr = w.crime[i];
    const ri = this.nearRoad[i]; const tr = ri >= 0 ? w.traffic[ri] : 0;
    let v;
    if (zt === 1) v = lv * 1.05 + (w.covHealth[i] + w.covEdu[i]) * 0.12 - po * 0.9 - cr * 0.5 - tr * 0.25 + w.covPark[i] * 0.1;
    else if (zt === 2) v = lv * 0.85 + Math.min(tr, 140) * 0.18 - cr * 0.6 - po * 0.3 + 18 + w.covPark[i] * 0.05;
    else v = 150 + lv * 0.12 - cr * 0.4 - Math.max(0, tr - 160) * 0.3 + (w.covEdu[i] * 0.08);
    return clamp(v, 0, 255);
  }

  // ---------- Growth ----------
  growth() {
    const w = this.w; const { n } = w; const rnd = Math.random;
    const samples = Math.max(150, Math.floor(n / 9));
    for (let s = 0; s < samples; s++) {
      const i = (rnd() * n) | 0;
      const zt = w.zoneT[i];
      const bid = w.bld[i];
      if (bid) {
        const b = w.buildings.get(bid);
        if (!b) continue;
        if (b.x + b.y * w.w !== i) continue; // process at origin only
        if (b.kind === 'zone') this.growBuilding(b);
        else if (b.kind === 'rubble') { b.age++; if (b.age > 10) { w.removeBuilding(b, true); } }
        else if (b.built < 1) { b.built = Math.min(1, b.built + 0.5); w.touch(i); }
        continue;
      }
      if (!zt) continue;
      if (w.roadDist[i] > 3 || !w.power[i]) continue;
      const dem = w.demand[zt];
      if (dem <= 0.03) continue;
      const zd = w.zoneD[i] || 1;
      const [lo] = DENSITY_TIERS[zd];
      const desir = this.desirability(i, zt);
      if (desir < TIER_DESIRE[lo] - 35) continue;
      if (lo >= 3 && !w.water[i]) continue;
      // isolated city grows slowly
      const c = this.comps[this.nearComp[i]];
      const iso = c && (c.outside || w.stats.pop > 400) ? 1 : 0.35;
      const chance = dem * 0.55 * (0.45 + desir / 255) * iso;
      if (rnd() < chance) {
        const x = i % w.w, y = (i / w.w) | 0;
        w.tree[i] = 0;
        w.addBuilding({ kind: 'zone', x, y, w: 1, h: 1, zt, tier: lo, occ: 0.35, built: 0 });
      }
    }
  }

  growBuilding(b) {
    const w = this.w; const rnd = Math.random;
    const i = w.idx(b.x, b.y);
    b.age++;
    if (b.built < 1) { b.built = Math.min(1, b.built + 0.34); if (b.built >= 1) w.touch(i); return; }
    const zt = b.zt; const zd = w.zoneD[i] || 1;
    const [lo, hi] = DENSITY_TIERS[zd];
    const dem = w.demand[zt];
    const desir = this.desirability(i, zt);
    if (!b.powered) { b.noPower++; if (b.noPower > 8 && !b.abandoned) { b.abandoned = true; w.touch(i); } }
    else b.noPower = 0;
    if (b.abandoned) {
      if (b.powered && dem > 0.05 && desir > TIER_DESIRE[b.tier] - 30 && (b.tier < 3 || b.watered) && rnd() < 0.35) { b.abandoned = false; b.occ = 0.3; w.touch(i); }
      else if (b.age > 200 && rnd() < 0.03) { this.toRubble(b); }
      return;
    }
    if (b.tier > hi && b.w === 1) { b.tier = hi; w.touch(i); }
    if (b.tier >= 3 && !b.watered) {
      if (rnd() < 0.3) { if (b.tier > lo && b.tier > 2) { b.tier--; } else if (b.tier >= 3) { b.abandoned = true; } w.touch(i); }
      return;
    }
    const target = clamp(0.3 + desir / 380 + dem * 0.45, 0.08, 1);
    b.occ += (target - b.occ) * 0.35;
    if (b.w === 1 && b.tier < hi && b.tier < 5 && dem > 0.04 && desir >= TIER_DESIRE[b.tier + 1] && (b.tier + 1 < 3 || b.watered)
      && rnd() < 0.18 + dem * 0.3) {
      b.tier++; b.built = 0.35; b.variant = (rnd() * 1e6) | 0; w.touch(i); return;
    }
    if (b.w === 1 && b.tier === 5 && zd === 3 && dem > 0.12 && desir >= TIER_DESIRE[6] && rnd() < 0.12) {
      if (this.tryMerge(b)) return;
    }
    if (desir < TIER_DESIRE[b.tier] - 50 && rnd() < 0.12) {
      if (b.w === 1 && b.tier > lo) { b.tier--; w.touch(i); }
      else if (rnd() < 0.3) { b.abandoned = true; w.touch(i); }
    }
    if (dem < -0.35 && rnd() < 0.05) { b.abandoned = true; w.touch(i); }
  }

  tryMerge(b) {
    const w = this.w;
    const parts = [];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const x = b.x + dx, y = b.y + dy;
      if (!w.inb(x, y)) return false;
      const j = w.idx(x, y);
      if (w.zoneT[j] !== b.zt || w.zoneD[j] !== 3) return false;
      const o = w.buildingAt(x, y);
      if (!o || o.kind !== 'zone' || o.w !== 1 || o.tier !== 5 || o.abandoned || !o.watered || !o.powered) return false;
      parts.push(o);
    }
    for (const o of parts) w.removeBuilding(o, true);
    w.addBuilding({ kind: 'zone', x: b.x, y: b.y, w: 2, h: 2, zt: b.zt, tier: 6, occ: 0.4, built: 0, powered: true, watered: true });
    w.emit('news', { text: `A new ${TIER_NAMES[b.zt][6].toLowerCase()} is rising downtown.`, x: b.x, y: b.y, tone: 'good' });
    return true;
  }

  toRubble(b) {
    const w = this.w;
    w.removeBuilding(b, true);
    for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
      w.addBuilding({ kind: 'rubble', x: xx, y: yy, w: 1, h: 1, age: 0 });
    }
  }

  // ---------- Fire ----------
  fires() {
    const w = this.w; const rnd = Math.random;
    if (this.bList.length && rnd() < 0.5) {
      const b = w.buildings.get(this.bList[(rnd() * this.bList.length) | 0]);
      if (b && !b.fire && b.kind !== 'rubble' && b.built >= 1) {
        const i = w.idx(b.x, b.y);
        const risk = (b.kind === 'zone' ? (b.zt === 3 ? 2.6 : 1) * (0.5 + b.tier * 0.15) : 0.4) * (1 - w.covFire[i] / 255 * 0.92);
        const base = Math.min(0.012, 0.0008 + this.bList.length * 0.0000025);
        if (rnd() < risk * base) {
          b.fire = 1; w.touch(i);
          w.emit('news', { text: `Fire reported at ${b.def ? b.def.name : TIER_NAMES[b.zt][b.tier]}!`, x: b.x, y: b.y, tone: 'bad', kind: 'fire' });
        }
      }
    }
    for (const b of w.buildings.values()) {
      if (!b.fire) continue;
      const i = w.idx(b.x, b.y);
      const cov = w.covFire[i] / 255;
      b.fire++;
      if (rnd() < 0.03 + cov * 0.3) {
        b.fire = 0; w.touch(i);
        continue;
      }
      if (rnd() < 0.08 * (1 - cov * 0.85)) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const [dx, dy] = dirs[(rnd() * 4) | 0];
        const nx = dx > 0 ? b.x + b.w : dx < 0 ? b.x - 1 : b.x + ((rnd() * b.w) | 0);
        const ny = dy > 0 ? b.y + b.h : dy < 0 ? b.y - 1 : b.y + ((rnd() * b.h) | 0);
        const o = w.buildingAt(nx, ny);
        if (o && !o.fire && o.kind !== 'rubble') { o.fire = 1; w.touch(w.idx(o.x, o.y)); }
      }
      if (b.fire > 22) {
        this.toRubble(b);
        w.emit('news', { text: 'A building burned down.', x: b.x, y: b.y, tone: 'bad' });
      }
    }
  }

  // ---------- Stats / demand ----------
  updateStats() {
    const w = this.w; const s = w.stats;
    let pop = 0, jobsC = 0, jobsI = 0, eduW = 0, healthW = 0, resTiles = 0;
    let hasPolice = 0, hasFire = 0;
    this.bList.length = 0;
    let happyBonus = 0;
    for (const b of w.buildings.values()) {
      this.bList.push(b.id);
      if (b.kind === 'zone') {
        const live = !b.abandoned && b.built >= 1 ? 1 : 0;
        const cap = ZONE_CAP[b.zt][b.tier] * b.occ * live * (b.fire ? 0.3 : 1);
        if (b.zt === 1) {
          b.pop = Math.round(cap); b.jobs = 0; pop += b.pop;
          const i = w.idx(b.x, b.y); eduW += w.covEdu[i] * b.pop; healthW += w.covHealth[i] * b.pop; resTiles++;
        } else { b.jobs = Math.round(cap); b.pop = 0; if (b.zt === 2) jobsC += b.jobs; else jobsI += b.jobs; }
      } else if (b.def) {
        if (b.def.happy && b.powered !== false) happyBonus += b.def.happy;
        if (b.def.cov === 'police') hasPolice++;
        if (b.def.cov === 'fire') hasFire++;
      }
    }
    s.pop = pop; s.jobsC = jobsC; s.jobsI = jobsI;
    s.edu = pop ? eduW / pop / 255 : 0;
    s.health = pop ? healthW / pop / 255 : 0;
    const labour = pop * 0.55;
    const jobs = jobsC + jobsI;
    s.unemployment = labour > 20 ? clamp((labour - jobs) / labour, 0, 1) : 0;

    // approval
    const avgTax = (w.taxes[1] * 2 + w.taxes[2] + w.taxes[3]) / 4;
    let ap = 62 - (avgTax - 9) * 3.2 + s.edu * 10 + s.health * 12 - s.pollAvg / 255 * 30 - s.crimeAvg / 255 * 35
      - s.unemployment * 40 - Math.max(0, s.trafficAvg - 120) / 135 * 15 + Math.min(12, happyBonus);
    if (s.powerDemand > s.powerSupply) ap -= 10;
    if (s.waterDemand > s.waterSupply && pop > 200) ap -= 8;
    if (pop > 600 && !hasPolice) ap -= 6;
    if (pop > 600 && !hasFire) ap -= 6;
    if (pop < 60) ap = 62 - (avgTax - 9) * 2;
    s.approval = clamp(s.approval + (clamp(ap, 0, 100) - s.approval) * 0.05, 0, 100);

    // Demand
    const ext = s.outside ? 1 : 0.3;
    const rTarget = jobs / 0.55 * 1.04 + 140 * ext;
    let rD = (rTarget - pop) / Math.max(rTarget, 120);
    const cTarget = pop * 0.21 * (1 + s.edu * 0.7) + 25 * ext;
    let cD = (cTarget - jobsC) / Math.max(cTarget, 40);
    const iTarget = pop * 0.34 * (1 - s.edu * 0.35) + 70 * ext;
    let iD = (iTarget - jobsI) / Math.max(iTarget, 60);
    rD -= (w.taxes[1] - 9) * 0.045; cD -= (w.taxes[2] - 9) * 0.045; iD -= (w.taxes[3] - 9) * 0.045;
    rD += (s.approval - 55) / 250;
    if (!s.outside && pop > 400) { rD = Math.min(rD, 0.15); cD = Math.min(cD, 0.15); iD = Math.min(iD, 0.1); }
    const sm = 0.08;
    w.demand[1] += (clamp(rD, -1, 1) - w.demand[1]) * sm;
    w.demand[2] += (clamp(cD, -1, 1) - w.demand[2]) * sm;
    w.demand[3] += (clamp(iD, -1, 1) - w.demand[3]) * sm;

    // Milestones
    const next = MILESTONES[w.milestone + 1];
    if (next && pop >= next.pop) {
      w.milestone++;
      w.funds += next.grant;
      w.emit('milestone', { index: w.milestone, name: next.name, grant: next.grant });
    }
  }

  monthEnd() {
    const w = this.w; const s = w.stats;
    const taxR = s.pop * w.taxes[1] * 0.1;
    const taxC = s.jobsC * w.taxes[2] * 0.11;
    const taxI = s.jobsI * w.taxes[3] * 0.1;
    let roads = 0; for (let i = 0; i < w.n; i++) if (w.road[i]) roads += w.terrain[i] === T_WATER ? 2.2 : 0.55;
    let plines = 0; for (let i = 0; i < w.n; i++) if (w.pline[i]) plines += 0.1;
    const exp = { roads: roads * w.funding.roads / 100, police: 0, fire: 0, health: 0, edu: 0, parks: 0, utilities: plines };
    for (const b of w.buildings.values()) {
      if (!b.def) continue;
      exp[b.def.dept] += b.def.upkeep * w.funding[b.def.dept] / 100;
    }
    let loanPay = 0;
    for (const l of w.loans) { if (l.months > 0) { loanPay += l.payment; l.months--; } }
    w.loans = w.loans.filter((l) => l.months > 0);
    const income = taxR + taxC + taxI;
    const expense = Object.values(exp).reduce((a, b) => a + b, 0) + loanPay;
    w.funds += Math.round(income - expense);
    w.ledger.lastIncome = Math.round(income);
    w.ledger.lastExpense = Math.round(expense);
    w.ledger.lastBuild = Math.round(w.ledger.build); w.ledger.build = 0;
    w.ledger.lastBreakdown = { taxR: Math.round(taxR), taxC: Math.round(taxC), taxI: Math.round(taxI), loans: Math.round(loanPay) };
    for (const k in exp) w.ledger.lastBreakdown[k] = Math.round(exp[k]);
    w.history.push({ d: w.day, pop: s.pop, funds: Math.round(w.funds), inc: Math.round(income), exp: Math.round(expense),
      jobs: s.jobsC + s.jobsI, ap: Math.round(s.approval) });
    if (w.history.length > 360) w.history.shift();
    this.updateAdvice();
    w.emit('month', {});
  }

  projectedMonth() {
    const w = this.w; const s = w.stats;
    const taxR = s.pop * w.taxes[1] * 0.1, taxC = s.jobsC * w.taxes[2] * 0.11, taxI = s.jobsI * w.taxes[3] * 0.1;
    let roads = 0, plines = 0;
    for (let i = 0; i < w.n; i++) { if (w.road[i]) roads += w.terrain[i] === T_WATER ? 2.2 : 0.55; if (w.pline[i]) plines += 0.1; }
    const exp = { roads: roads * w.funding.roads / 100, police: 0, fire: 0, health: 0, edu: 0, parks: 0, utilities: plines };
    for (const b of w.buildings.values()) if (b.def) exp[b.def.dept] += b.def.upkeep * w.funding[b.def.dept] / 100;
    let loans = 0; for (const l of w.loans) loans += l.payment;
    return { taxR, taxC, taxI, exp, loans };
  }

  // ---------- Advisors ----------
  updateAdvice() {
    const w = this.w; const s = w.stats; const a = [];
    const zoneCount = { 1: 0, 2: 0, 3: 0 }; let unpoweredZones = 0, noRoad = 0, noWaterMed = 0;
    for (let i = 0; i < w.n; i++) {
      const zt = w.zoneT[i]; if (!zt) continue;
      zoneCount[zt]++;
      if (!w.power[i]) unpoweredZones++;
      if (w.roadDist[i] > 3) noRoad++;
      if (w.zoneD[i] >= 2 && !w.water[i]) noWaterMed++;
    }
    const total = zoneCount[1] + zoneCount[2] + zoneCount[3];
    if (!total) a.push({ who: 'Planning', tone: 'info', text: 'Lay a road from the map edge, then zone homes, shops and industry along it.' });
    if (!w.stats.outside && total) a.push({ who: 'Transport', tone: 'warn', text: 'No road reaches the map edge. Connect to the region so newcomers can arrive.' });
    if (s.powerSupply === 0 && total) a.push({ who: 'Utilities', tone: 'bad', text: 'The city has no power plant. Zones will not develop without electricity.' });
    else if (s.powerDemand > s.powerSupply) a.push({ who: 'Utilities', tone: 'bad', text: `Power shortage: ${s.powerDemand} MW needed, ${s.powerSupply} MW available.` });
    else if (unpoweredZones > 4) a.push({ who: 'Utilities', tone: 'warn', text: `${unpoweredZones} zoned lots have no power. Connect them with power lines.` });
    if (noRoad > 4) a.push({ who: 'Planning', tone: 'warn', text: `${noRoad} zoned lots are too far from a road (max 3 tiles).` });
    if (s.pop > 150 && s.waterSupply === 0) a.push({ who: 'Utilities', tone: 'warn', text: 'No water supply. Build a pump by the water and connect it to a road; mains run under the streets.' });
    else if (s.waterDemand > s.waterSupply && s.pop > 150) a.push({ who: 'Utilities', tone: 'bad', text: `Water shortage: ${s.waterDemand} kgal needed, ${s.waterSupply} kgal supplied.` });
    if (noWaterMed > 4) a.push({ who: 'Utilities', tone: 'warn', text: 'Medium and high density zones need running water to develop.' });
    if (s.pop > 500 && s.crimeAvg > 70) a.push({ who: 'Police', tone: 'warn', text: 'Crime is rising. Residents want more police coverage.' });
    if (s.pollAvg > 70) a.push({ who: 'Environment', tone: 'warn', text: 'Pollution is hurting land value. Plant trees or move industry away from homes.' });
    if (s.pop > 800 && s.edu < 0.3) a.push({ who: 'Education', tone: 'info', text: 'Few residents are near a school. Education unlocks cleaner industry and offices.' });
    if (s.pop > 800 && s.health < 0.3) a.push({ who: 'Health', tone: 'info', text: 'Health coverage is thin. Clinics keep residents happy.' });
    if (s.unemployment > 0.15) a.push({ who: 'Economy', tone: 'warn', text: `Unemployment at ${Math.round(s.unemployment * 100)}%. Zone more commercial or industrial land.` });
    if (w.demand[1] > 0.5 && zoneCount[1] - this.countBuilt(1) < 6) a.push({ who: 'Planning', tone: 'info', text: 'Strong demand for housing. Zone more residential land.' });
    if (w.demand[2] > 0.5 && zoneCount[2] - this.countBuilt(2) < 4) a.push({ who: 'Planning', tone: 'info', text: 'Shops are in demand. Zone more commercial land.' });
    if (w.demand[3] > 0.5 && zoneCount[3] - this.countBuilt(3) < 4) a.push({ who: 'Planning', tone: 'info', text: 'Industry wants to move in. Zone more industrial land.' });
    if (s.trafficAvg > 140) a.push({ who: 'Transport', tone: 'warn', text: 'Streets are congested. Add parallel roads and more connections.' });
    if (w.funds < 0) a.push({ who: 'Finance', tone: 'bad', text: 'The treasury is in the red. Raise taxes, cut budgets or take a loan.' });
    const avgTax = (w.taxes[1] + w.taxes[2] + w.taxes[3]) / 3;
    if (avgTax > 13) a.push({ who: 'Finance', tone: 'warn', text: 'High taxes are driving people away.' });
    if (!a.length) a.push({ who: 'Mayor’s office', tone: 'good', text: 'Things are running smoothly. Keep growing!' });
    this.advice = a;
  }

  countBuilt(zt) {
    let c = 0; for (const b of this.w.buildings.values()) if (b.kind === 'zone' && b.zt === zt) c += b.w * b.h; return c;
  }
}

export function describeBuilding(w, b) {
  if (!b) return null;
  if (b.kind === 'zone') return { title: TIER_NAMES[b.zt][b.tier], sub: `${ZONE_NAMES[b.zt]} · tier ${b.tier}` };
  if (b.kind === 'rubble') return { title: 'Rubble', sub: 'Clears on its own, or bulldoze it' };
  return { title: b.def.name, sub: b.def.desc };
}
