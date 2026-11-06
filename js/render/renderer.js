// Main isometric renderer: ground, traffic, objects, particles, overlays, day/night.
import { HW, HH, SCALE, Painter, makeCanvas, mix, rgba } from './art.js';
import { hash2, fbm } from '../util/rng.js';
import { T_WATER, T_SAND, ZSTEP, HIGHWAY } from '../world/world.js';
const Z = ZSTEP;
import { VARIANTS } from './sprites.js';

const CAR_COLORS = ['#c7413a', '#2f5d8a', '#e9e5dc', '#33363b', '#d9b443', '#6b8e5a', '#8b93a0', '#e9e5dc', '#5a5f66'];
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const CH = 16, CPAD = 6, CPAD_T = 26 + 15 * ZSTEP;
const CHUNK_BUDGET = 140 * 1024 * 1024;

export const OVERLAYS = {
  power:     { name: 'Power', legend: ['No power', 'Powered'] },
  water:     { name: 'Water', legend: ['Dry', 'Supplied'] },
  landValue: { name: 'Land value', legend: ['Low', 'High'], ramp: ['#7a4b3a', '#e8c35a', '#3fa35a'] },
  pollution: { name: 'Pollution', legend: ['Clean', 'Polluted'], ramp: ['#3fa35a', '#d9b443', '#8a3a2e'] },
  crime:     { name: 'Crime', legend: ['Safe', 'Dangerous'], ramp: ['#3f7fc0', '#d9b443', '#b8312f'] },
  traffic:   { name: 'Traffic', legend: ['Free-flowing', 'Jammed'], ramp: ['#3fa35a', '#e0a526', '#b8312f'] },
  covPolice: { name: 'Police', legend: ['None', 'Full'], ramp: ['#40464d', '#2f6fb8', '#7fc3ff'] },
  covFire:   { name: 'Fire', legend: ['None', 'Full'], ramp: ['#40464d', '#c25b2b', '#ffb36b'] },
  covHealth: { name: 'Health', legend: ['None', 'Full'], ramp: ['#40464d', '#2f9e6b', '#9fe3bf'] },
  covEdu:    { name: 'Education', legend: ['None', 'Full'], ramp: ['#40464d', '#7a5bb8', '#cdb6ff'] },
  covTransit: { name: 'Transit', legend: ['None', 'Full'], ramp: ['#40464d', '#b8862f', '#ffd36b'] },
};

function pointInPoly(px, py, q) {
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i], [xj, yj] = q[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function rampColor(ramp, t) {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) return mix(ramp[0], ramp[1], t * 2);
  return mix(ramp[1], ramp[2], (t - 0.5) * 2);
}

export class Renderer {
  constructor(canvas, world, bank) {
    this.cv = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.world = world; this.bank = bank;
    this.cam = { x: 0, y: (world.w + world.h) * HH / 2, zoom: 1 };
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.overlay = null;
    this.preview = null;
    this.timeOfDay = 0.45;
    this.dayNight = true;
    this.cars = []; this.particles = [];
    this.anim = 0; this.lastT = 0;
    this.quality = 'high';
    this.select = null;
    this.buckets = [];
    this.initTerrainCache();
    this.carSprites = new Map();
    this.resize();
  }

  setWorld(w) { this.world = w; this.cars = []; this.particles = []; this.initTerrainCache(); this.chunks = null; }

  initTerrainCache() {
    const w = this.world; const n = w.n;
    this.tint = new Uint8Array(n); this.depth = new Uint8Array(n); this.var = new Uint8Array(n);
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const i = y * w.w + x;
      const f = fbm(x / 9, y / 9, w.seed + 5, 3);
      this.tint[i] = Math.max(0, Math.min(3, Math.floor((f - 0.3) * 8)));
      this.var[i] = (hash2(x, y, w.seed) * 4) | 0;
    }
    // water depth = distance from land (cap 3)
    const d = this.depth; d.fill(3);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
        const i = y * w.w + x; if (w.terrain[i] !== T_WATER) { d[i] = 0; continue; }
        let m = 3;
        for (const [dx, dy] of DIRS) {
          const xx = x + dx, yy = y + dy; if (!w.inb(xx, yy)) continue;
          const j = yy * w.w + xx; const v = w.terrain[j] !== T_WATER ? 0 : d[j];
          if (v + 1 < m) m = v + 1;
        }
        d[i] = Math.min(d[i], m);
      }
    }
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    this.vw = r.width || window.innerWidth; this.vh = r.height || window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.vw * this.dpr); this.cv.height = Math.round(this.vh * this.dpr);
  }

  // ---- coordinate transforms ----
  screenToWorld(sx, sy) { return [(sx - this.vw / 2) / this.cam.zoom + this.cam.x, (sy - this.vh / 2) / this.cam.zoom + this.cam.y]; }
  worldToScreen(wx, wy) { return [(wx - this.cam.x) * this.cam.zoom + this.vw / 2, (wy - this.cam.y) * this.cam.zoom + this.vh / 2]; }
  screenToTile(sx, sy) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    const tx = (wx / HW + wy / HH) / 2, ty = (wy / HH - wx / HW) / 2;
    const w = this.world;
    const fx = Math.floor(tx), fy = Math.floor(ty);
    if (!w.maxH) return [fx, fy, tx, ty];
    // tiles further "south" may be lifted up under the pointer: test lifted quads, frontmost wins
    const K = Math.ceil(w.maxH * Z / (2 * HH)) + 1;
    let best = null;
    for (let k = 0; k <= K; k++) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
      const x = fx + k + dx, y = fy + k + dy;
      if (!w.inb(x, y)) continue;
      const q = this.tileQuad(x, y);
      if (pointInPoly(wx, wy, q) && (!best || x + y > best[0] + best[1])) best = [x, y];
    }
    if (best) return [best[0], best[1], best[0] + 0.5, best[1] + 0.5];
    return [fx, fy, tx, ty];
  }
  tileQuad(x, y) {
    const w = this.world; const [t, r, b, l] = w.inb(x, y) ? w.tileCorners(x, y) : [0, 0, 0, 0];
    const sx = (x - y) * HW, sy = (x + y) * HH;
    return [[sx, sy - t * Z], [sx + HW, sy + HH - r * Z], [sx, sy + 2 * HH - b * Z], [sx - HW, sy + HH - l * Z]];
  }
  tileToScreen(x, y, z = 0) {
    const w = this.world; const h = w.inb(Math.floor(x), Math.floor(y)) ? w.heightAt(x, y) * Z : 0;
    return this.worldToScreen((x - y) * HW, (x + y) * HH - z - h);
  }
  centerOn(tx, ty) { this.cam.x = (tx - ty) * HW; this.cam.y = (tx + ty) * HH; }
  clampCam() {
    const w = this.world;
    const minX = -w.h * HW, maxX = w.w * HW, maxY = (w.w + w.h) * HH;
    this.cam.x = Math.max(minX, Math.min(maxX, this.cam.x));
    this.cam.y = Math.max(-40, Math.min(maxY, this.cam.y));
    this.cam.zoom = Math.max(0.3, Math.min(2.6, this.cam.zoom));
  }

  nightness() {
    if (!this.dayNight) return 0;
    const sun = Math.cos((this.timeOfDay - 0.5) * Math.PI * 2);
    return Math.max(0, Math.min(1, (0.15 - sun) / 0.55));
  }
  duskness() {
    if (!this.dayNight) return 0;
    const sun = Math.cos((this.timeOfDay - 0.5) * Math.PI * 2);
    const q = (sun - 0.05) / 0.22; return Math.exp(-(q * q));
  }

  // ---- main draw ----
  draw(t) {
    const dt = Math.min(0.1, (t - (this.lastT || t)) / 1000); this.lastT = t;
    this.anim += dt;
    const { ctx, world: w, cam, dpr } = this;
    const z = cam.zoom;
    const night = this.overlay ? 0 : this.nightness();
    const dusk = this.overlay ? 0 : this.duskness();

    // background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, this.cv.height);
    bg.addColorStop(0, mix(mix('#cfd8d2', '#141b2b', night), '#e7b48a', dusk * 0.35));
    bg.addColorStop(1, mix('#b3c0bb', '#0d121d', night));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, this.cv.width, this.cv.height);

    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (this.vw / 2 - cam.x * z), dpr * (this.vh / 2 - cam.y * z));
    ctx.imageSmoothingEnabled = true;

    // visible tile bounds
    const [x0w, y0w] = this.screenToWorld(-80, -80), [x1w, y1w] = this.screenToWorld(this.vw + 80, this.vh + 320 + w.maxH * Z * z);
    const corners = [[x0w, y0w], [x1w, y0w], [x0w, y1w], [x1w, y1w]].map(([wx, wy]) => [(wx / HW + wy / HH) / 2, (wy / HH - wx / HW) / 2]);
    const minTX = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])))), maxTX = Math.min(w.w - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))));
    const minTY = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])))), maxTY = Math.min(w.h - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))));
    this.view = { x0w, y0w, x1w, y1w, minTX, maxTX, minTY, maxTY };

    this.drawEdges();
    this.consumeChanges();
    this.drawChunks(x0w, x1w, y0w, y1w, false);
    if (z >= 0.55 && this.quality !== 'low') this.drawWaterAnim(minTX, maxTX, minTY, maxTY, x0w, x1w, y0w, y1w);

    if (this.overlay) this.drawOverlay(minTX, maxTX, minTY, maxTY, x0w, x1w, y0w, y1w);

    // night tint for ground
    if (night > 0.01 || dusk > 0.02) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = mix(mix('#ffffff', '#ffc89a', dusk * 0.45), '#2a3558', night);
      ctx.fillRect(0, 0, this.cv.width, this.cv.height);
      ctx.restore();
      if (night > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = night; this.drawChunks(x0w, x1w, y0w, y1w, true); ctx.restore(); }
    }

    this.updateCars(dt);
    this.drawCars(night, x0w, x1w, y0w, y1w);
    this.updateTrains(dt);
    this.drawTrains(night, x0w, x1w, y0w, y1w);
    this.drawObjects(minTX, maxTX, minTY, maxTY, x0w, x1w, y0w, y1w, night, dusk);
    this.drawParticles(dt, night);
    if (this.select) this.drawSelect(this.select);
    if (this.preview) this.drawPreview(this.preview);
  }

  culled(sx, sy, s) {
    const v = this.view;
    return sx - s.ax + s.w < v.x0w || sx - s.ax > v.x1w || sy - s.ay + s.h < v.y0w || sy - s.ay > v.y1w;
  }

  blit(s, x, y) {
    const sx = (x - y) * HW, sy = (x + y) * HH;
    if (this.culled(sx, sy, s)) return false;
    this.ctx.drawImage(s.img, sx - s.ax, sy - s.ay, s.w, s.h);
    return true;
  }

  drawEdges() {
    // Diorama-style cut-away along the two front edges, following the terrain height.
    const { ctx, world: w } = this;
    const D = 26;
    const face = (x, y, side) => {
      const i = w.idx(x, y); const water = w.terrain[i] === T_WATER;
      let a, b, ha, hb;
      if (side === 'L') { a = [(x - (y + 1)) * HW, (x + y + 1) * HH]; b = [(x + 1 - (y + 1)) * HW, (x + 1 + y + 1) * HH]; ha = w.ch(x, y + 1); hb = w.ch(x + 1, y + 1); }
      else { a = [(x + 1 - y) * HW, (x + 1 + y) * HH]; b = [(x + 1 - (y + 1)) * HW, (x + 1 + y + 1) * HH]; ha = w.ch(x + 1, y); hb = w.ch(x + 1, y + 1); }
      const top = Math.min(a[1] - ha * Z, b[1] - hb * Z);
      const g = ctx.createLinearGradient(0, top, 0, a[1] + D);
      if (water) { g.addColorStop(0, side === 'L' ? '#3c7f95' : '#2c6578'); g.addColorStop(1, '#1d4152'); }
      else {
        const k = side === 'L' ? 1 : 0.8;
        g.addColorStop(0, mix('#6b8d43', '#000000', 1 - k)); g.addColorStop(0.1, mix('#8a6a48', '#000000', 1 - k));
        g.addColorStop(0.55, mix('#76583c', '#000000', 1 - k)); g.addColorStop(1, mix('#5b4532', '#000000', 1 - k));
      }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(a[0], a[1] - ha * Z); ctx.lineTo(b[0], b[1] - hb * Z); ctx.lineTo(b[0], b[1] + D); ctx.lineTo(a[0], a[1] + D); ctx.closePath(); ctx.fill();
    };
    for (let x = 0; x < w.w; x++) face(x, w.h - 1, 'L');
    for (let y = 0; y < w.h; y++) face(w.w - 1, y, 'R');
  }

  // ---------- Ground chunk cache ----------
  // The static ground (terrain, roads, zones) is rendered into 16x16-tile canvases and only
  // re-rendered when tiles inside change. Resolution follows zoom; an LRU keeps memory bounded.
  chunkScale() {
    const s = this.cam.zoom * this.dpr;
    return s > 1.25 ? 2 : s > 0.62 ? 1 : 0.5;
  }

  consumeChanges() {
    const w = this.world;
    if (!this.chunks) { this.chunks = new Map(); this.chunkBytes = 0; }
    if (!w.changedTiles.size) return;
    for (const i of w.changedTiles) {
      const x = i % w.w, y = (i / w.w) | 0;
      const k = ((x / CH) | 0) + ',' + ((y / CH) | 0);
      const c = this.chunks.get(k); if (c) { c.dirty = true; c.lightsDirty = true; }
    }
    w.changedTiles.clear();
  }

  chunkBounds(cx, cy) {
    const x0 = cx * CH, y0 = cy * CH;
    return { minX: (x0 - (y0 + CH)) * HW - CPAD, minY: (x0 + y0) * HH - CPAD_T, w: 2 * CH * HW + 2 * CPAD, h: 2 * CH * HH + CPAD + CPAD_T, x0, y0 };
  }

  renderChunk(c, cx, cy, scale) {
    const b = this.chunkBounds(cx, cy);
    const W = Math.ceil(b.w * scale), H = Math.ceil(b.h * scale);
    if (!c.cv || c.cv.width !== W || c.cv.height !== H) {
      if (c.cv) this.chunkBytes -= c.cv.width * c.cv.height * 4;
      c.cv = makeCanvas(W, H); this.chunkBytes += W * H * 4;
    }
    const ctx = c.cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.setTransform(scale, 0, 0, scale, -b.minX * scale, -b.minY * scale);
    const w = this.world;
    for (let d = 0; d <= 2 * CH - 2; d++) for (let k = 0; k <= d; k++) {
      const x = b.x0 + k, y = b.y0 + d - k;
      if (k >= CH || d - k >= CH || x >= w.w || y >= w.h) continue;
      this.drawGroundTile(ctx, x, y);
    }
    c.scale = scale; c.dirty = false; c.lightsDirty = true;
  }

  renderChunkLights(c, cx, cy) {
    const b = this.chunkBounds(cx, cy); const scale = Math.min(1, c.scale);
    const W = Math.ceil(b.w * scale), H = Math.ceil(b.h * scale);
    if (!c.lights || c.lights.width !== W) { if (c.lights) this.chunkBytes -= c.lights.width * c.lights.height * 4; c.lights = makeCanvas(W, H); this.chunkBytes += W * H * 4; }
    const ctx = c.lights.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.setTransform(scale, 0, 0, scale, -b.minX * scale, -b.minY * scale);
    const w = this.world; let any = false;
    for (let y = b.y0; y < Math.min(w.h, b.y0 + CH); y++) for (let x = b.x0; x < Math.min(w.w, b.x0 + CH); x++) {
      const i = y * w.w + x; if (!w.road[i]) continue;
      const s = this.roadSprite(x, y, i);
      if (s.glow) { const sx = (x - y) * HW, sy = (x + y) * HH; ctx.drawImage(s.glow, sx - s.ax, sy - s.ay - w.tileMaxH(x, y) * Z, s.w, s.h); any = true; }
    }
    c.lightsDirty = false; c.hasLights = any;
  }

  drawChunks(wx0, wx1, wy0, wy1, lights) {
    const { ctx, world: w } = this;
    const scale = this.chunkScale();
    const ncx = Math.ceil(w.w / CH), ncy = Math.ceil(w.h / CH);
    const now = this.anim;
    let budget = lights ? 3 : 4;
    for (let s = 0; s <= ncx + ncy - 2; s++) for (let cy = 0; cy < ncy; cy++) {
      const cx = s - cy; if (cx < 0 || cx >= ncx) continue;
      const b = this.chunkBounds(cx, cy);
      if (b.minX > wx1 || b.minX + b.w < wx0 || b.minY > wy1 || b.minY + b.h < wy0) continue;
      const k = cx + ',' + cy;
      let c = this.chunks.get(k);
      if (!c) { c = { dirty: true }; this.chunks.set(k, c); }
      c.used = now;
      if (lights) {
        if (!c.cv) continue;
        if (c.lightsDirty && budget-- > 0) this.renderChunkLights(c, cx, cy);
        if (c.lights && c.hasLights) ctx.drawImage(c.lights, b.minX, b.minY, b.w, b.h);
        continue;
      }
      if (!c.cv || ((c.dirty || c.scale !== scale) && budget-- > 0)) this.renderChunk(c, cx, cy, scale);
      ctx.drawImage(c.cv, b.minX, b.minY, b.w, b.h);
    }
    if (!lights && this.chunkBytes > CHUNK_BUDGET) this.evictChunks();
  }

  evictChunks() {
    const list = [...this.chunks.entries()].filter(([, c]) => c.cv).sort((a, b) => a[1].used - b[1].used);
    for (const [k, c] of list) {
      if (this.chunkBytes <= CHUNK_BUDGET * 0.75 || c.used === this.anim) break;
      this.chunkBytes -= c.cv.width * c.cv.height * 4; if (c.lights) this.chunkBytes -= c.lights.width * c.lights.height * 4;
      c.cv.width = 0; if (c.lights) c.lights.width = 0;
      this.chunks.delete(k);
    }
  }

  invalidateChunks() { if (this.chunks) for (const c of this.chunks.values()) { c.dirty = true; c.lightsDirty = true; } }

  roadSprite(x, y, i) {
    const w = this.world; const water = w.terrain[i] === T_WATER;
    if (w.road[i] === HIGHWAY) return this.bank.highway(w.roadMask(x, y), w.hwyMask(x, y), water);
    return this.bank.road(w.roadMask(x, y), water);
  }

  drawGroundTile(ctx, x, y) {
    const { world: w, bank } = this;
    const sx = (x - y) * HW, sy = (x + y) * HH;
    const i = y * w.w + x;
    const ter = w.terrain[i];
    const c = w.tileCorners(x, y);
    const put = (s) => this.warp(ctx, s, sx, sy, c, false);
    if (ter === T_WATER) {
      put(bank.water(this.depth[i]));
      if (this.depth[i] === 1) {
        const m = (y > 0 && w.terrain[i - w.w] !== T_WATER ? 1 : 0) | (x < w.w - 1 && w.terrain[i + 1] !== T_WATER ? 2 : 0)
          | (y < w.h - 1 && w.terrain[i + w.w] !== T_WATER ? 4 : 0) | (x > 0 && w.terrain[i - 1] !== T_WATER ? 8 : 0);
        if (m) put(bank.foam(m));
      }
    } else {
      if (ter === T_SAND) this.warp(ctx, bank.sand(this.var[i] % 3), sx, sy, c, true);
      else this.warp(ctx, bank.grass(this.tint[i], this.var[i]), sx, sy, c, true);
      if (w.deco[i] && !w.tree[i] && !w.bld[i] && !w.road[i] && !w.rail[i] && !w.zoneT[i]) put(bank.deco(w.deco[i], this.var[i]));
    }
    if (w.road[i]) put(this.roadSprite(x, y, i));
    else if (w.zoneT[i] && !w.bld[i]) put(bank.zone(w.zoneT[i], w.zoneD[i] || 1));
    if (w.rail[i]) put(bank.rail(w.railMask(x, y), w.road[i] ? 2 : ter === T_WATER ? 1 : 0));
  }

  // Draw a flat-tile sprite onto a tile whose four corners may sit at different heights.
  // Each triangle of the tile gets its own affine transform, so roads and zones follow slopes.
  warp(ctx, s, sx, sy, c, shadeIt) {
    const [hT, hR, hB, hL] = c;
    if (hT === hR && hR === hB && hB === hL) { ctx.drawImage(s.img, sx - s.ax, sy - s.ay - hT * Z, s.w, s.h); return; }
    const P = [[0, 0, hT], [HW, HH, hR], [0, 2 * HH, hB], [-HW, HH, hL]];
    const tris = (hT === hB || (hL !== hR && Math.abs(hT - hB) <= Math.abs(hL - hR))) ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
    for (const t of tris) {
      const p0 = P[t[0]], p1 = P[t[1]], p2 = P[t[2]];
      // plane h = a x + b y + c through the three points (tile-relative screen coords)
      const det = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
      const a = ((p1[2] - p0[2]) * (p2[1] - p0[1]) - (p2[2] - p0[2]) * (p1[1] - p0[1])) / det;
      const b = ((p2[2] - p0[2]) * (p1[0] - p0[0]) - (p1[2] - p0[2]) * (p2[0] - p0[0])) / det;
      const cc = p0[2] - a * p0[0] - b * p0[1];
      const L = [p0, p1, p2].map((p) => [sx + p[0], sy + p[1] - p[2] * Z]);
      const mx = (L[0][0] + L[1][0] + L[2][0]) / 3, my = (L[0][1] + L[1][1] + L[2][1]) / 3;
      ctx.save();
      ctx.beginPath();
      L.forEach(([px, py], k) => { const ex = px + (px - mx) * 0.03, ey = py + (py - my) * 0.03; k ? ctx.lineTo(ex, ey) : ctx.moveTo(ex, ey); });
      ctx.closePath(); ctx.clip();
      ctx.save();
      ctx.transform(1, -Z * a, 0, 1 - Z * b, 0, Z * a * sx + Z * b * sy - Z * cc);
      ctx.drawImage(s.img, sx - s.ax, sy - s.ay, s.w, s.h);
      ctx.restore();
      if (shadeIt) {
        const dTx = a * HW + b * HH, dTy = -a * HW + b * HH; // height change per tile step in x / y
        const light = dTx * 0.13 - dTy * 0.09;
        ctx.fillStyle = light < 0 ? `rgba(22,32,26,${Math.min(0.3, -light)})` : `rgba(255,246,220,${Math.min(0.22, light)})`;
        ctx.fillRect(mx - 80, my - 80, 160, 160);
      }
      ctx.restore();
    }
  }

  drawWaterAnim(x0, x1, y0, y1, wx0, wx1, wy0, wy1) {
    const { ctx, world: w, bank } = this;
    const frameBase = Math.floor(this.anim * 2.2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w.w + x;
      if (w.terrain[i] !== T_WATER || w.road[i]) continue;
      const sx = (x - y) * HW, sy = (x + y) * HH;
      if (sx + HW < wx0 || sx - HW > wx1 || sy + 2 * HH < wy0 || sy > wy1) continue;
      const sh = bank.shimmer((frameBase + this.var[i]) % 4, this.var[i] % 3);
      ctx.drawImage(sh.img, sx - sh.ax, sy - sh.ay, sh.w, sh.h);
    }
  }

  drawOverlay(x0, x1, y0, y1, wx0, wx1, wy0, wy1) {
    const { ctx, world: w } = this; const key = this.overlay; const def = OVERLAYS[key];
    const map = w[key];
    ctx.save();
    ctx.globalAlpha = 0.62;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w.w + x;
      if (w.terrain[i] === T_WATER) continue;
      let col;
      if (key === 'power' || key === 'water') {
        const relevant = w.bld[i] || w.zoneT[i] || (key === 'power' && w.pline[i]) || (key === 'water' && w.road[i]);
        if (!relevant) continue;
        if (key === 'water' && w.road[i]) col = '#4aa8d8';
        else col = map[i] ? (key === 'power' ? '#f2c94c' : '#4aa8d8') : '#c8423b';
      } else if (key === 'traffic') {
        if (!w.road[i]) continue;
        col = rampColor(def.ramp, map[i] / 200);
      } else if (key === 'covTransit') {
        if (map[i] < 8 && !w.rail[i]) continue;
        col = w.rail[i] && map[i] < 8 ? '#8a8378' : rampColor(def.ramp, map[i] / 255 * 1.2);
      } else {
        const v = map[i] / 255;
        if (v < 0.03 && key.startsWith('cov')) continue;
        col = rampColor(def.ramp, key === 'landValue' ? v * 1.3 - 0.1 : v * 1.4);
      }
      const q = this.tileQuad(x, y);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Objects ----------
  facing(b) {
    if (b._face) return b._face;
    const w = this.world;
    let f = 'B';
    for (let k = 0; k < b.w; k++) if (w.roadAt(b.x + k, b.y + b.h)) f = 'L';
    if (f === 'B') for (let k = 0; k < b.h; k++) if (w.roadAt(b.x + b.w, b.y + k)) f = 'R';
    if (f === 'B') f = (b.variant & 1) ? 'L' : 'R';
    b._face = f;
    return f;
  }

  spriteFor(b) {
    const bank = this.bank;
    if (b.kind === 'zone') {
      if (b.built < 1) return bank.construction(b.w, b.tier >= 4, b.variant % 3);
      return bank.zoneBuilding(b.zt, b.tier, b.variant % VARIANTS, this.facing(b));
    }
    if (b.kind === 'rubble') return bank.rubble(b.variant % 4);
    return bank.service(b.kind, 0);
  }

  drawObjects(x0, x1, y0, y1, wx0, wx1, wy0, wy1, night, dusk) {
    const { ctx, world: w, bank } = this;
    const nb = 2 * (w.w + w.h) + 8;
    if (this.buckets.length !== nb) { this.buckets = []; for (let k = 0; k < nb; k++) this.buckets.push([]); }
    const B = this.buckets; for (const a of B) a.length = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w.w + x;
      if (w.bld[i]) continue;
      if (w.tree[i] || w.pline[i]) B[2 * x + 2 * y + 2].push(i);
    }
    for (const b of w.buildings.values()) {
      const sx = (b.x - b.y) * HW, sy = (b.x + b.y) * HH;
      if (sx + (b.w + 2) * HW < wx0 || sx - (b.h + 2) * HW > wx1 || sy - 320 > wy1 || sy + (b.w + b.h) * HH + 40 < wy0) continue;
      B[2 * b.x + b.w + 2 * b.y + b.h].push(b);
    }
    const ov = !!this.overlay;
    if (ov) ctx.globalAlpha = 0.5;
    for (let k = 0; k < nb; k++) {
      const list = B[k];
      for (let j = 0; j < list.length; j++) {
        const o = list[j];
        if (typeof o === 'number') {
          const x = o % w.w, y = (o / w.w) | 0;
          let s;
          const zz = w.maxH ? w.tileAvgH(x, y) * Z : 0;
          if (w.tree[o]) { s = bank.tree(w.tree[o], (this.var[o] + x * 3) % 8); this.drawSprite(s, x, y, night, false, zz); }
          if (w.pline[o]) { s = bank.pole(w.plineMask(x, y)); this.drawSprite(s, x, y, night, false, zz); }
        } else {
          this.drawBuilding(o, night, dusk);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  drawSprite(s, x, y, night, glow, z = 0) {
    const ctx = this.ctx;
    const sx = (x - y) * HW, sy = (x + y) * HH - z;
    if (this.culled(sx, sy, s)) return;
    if (night < 0.98) ctx.drawImage(s.img, sx - s.ax, sy - s.ay, s.w, s.h);
    if (night > 0.02) {
      const n = this.bank.night(s);
      const a = ctx.globalAlpha;
      ctx.globalAlpha = a * Math.min(1, night);
      ctx.drawImage(n, sx - s.ax, sy - s.ay, s.w, s.h);
      if (glow && s.glow) {
        ctx.globalAlpha = a * Math.min(1, night) * 0.8;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(s.glow, sx - s.ax, sy - s.ay, s.w, s.h);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = a;
    }
  }

  drawBuilding(b, night, dusk) {
    const ctx = this.ctx; const w = this.world;
    const s = this.spriteFor(b);
    const base = w.maxH ? w.areaMaxH(b.x, b.y, b.w, b.h) : 0;
    const bz = base * Z;
    const sx = (b.x - b.y) * HW, sy = (b.x + b.y) * HH - bz;
    if (this.culled(sx, sy, s)) return;
    if (base > 0 && w.areaMinH(b.x, b.y, b.w, b.h) < base) this.foundation(b, base, night);
    if (b.abandoned && b.kind === 'zone') {
      ctx.drawImage(this.bank.abandoned(s), sx - s.ax, sy - s.ay, s.w, s.h);
      if (night > 0.02) { const a = ctx.globalAlpha; ctx.globalAlpha = a * night; ctx.drawImage(this.bank.night(s), sx - s.ax, sy - s.ay, s.w, s.h); ctx.globalAlpha = a; }
    } else {
      const lit = b.kind !== 'zone' ? b.powered !== false || !!b.def?.cov && b.def.cov === 'park' : b.powered;
      this.drawSprite(s, b.x, b.y, night, lit, bz);
    }
    const m = s.meta;
    if (m && b.built >= 1) {
      const active = b.kind !== 'zone' || (!b.abandoned && b.powered);
      if (m.rotor) this.drawRotor(b, m.rotor, night, bz);
      if (m.beacon && night > 0.2 && Math.sin(this.anim * 3 + b.id) > 0.2) {
        for (const [x, y, z] of m.beacon) this.glow(b.x + x, b.y + y, z + bz, 4, 'rgba(255,60,50,0.95)');
      }
      if (active && m.smoke && this.particles.length < 900) {
        for (const [x, y, z] of m.smoke) if (Math.random() < 0.09) this.spawn(b.x + x, b.y + y, z + bz, 'smoke');
      }
      if (active && m.steam && this.particles.length < 900) {
        for (const [x, y, z] of m.steam) if (Math.random() < 0.12) this.spawn(b.x + x, b.y + y, z + bz, 'steam');
      }
    }
    if (b.fire) {
      for (let k = 0; k < 2; k++) if (Math.random() < 0.6) this.spawn(b.x + 0.2 + Math.random() * (b.w - 0.4), b.y + 0.2 + Math.random() * (b.h - 0.4), bz + 6 + Math.random() * 14, 'fire');
      if (Math.random() < 0.25) this.spawn(b.x + b.w / 2, b.y + b.h / 2, bz + 24, 'blacksmoke');
    }
  }

  foundation(b, base, night) {
    const ctx = this.ctx; const w = this.world;
    const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    const P = (x, y, h) => [(x - y) * HW, (x + y) * HH - h * Z];
    const colL = mix('#b3a895', '#2a3040', night * 0.8), colR = mix('#8d8371', '#202634', night * 0.8);
    // left face along y = y1
    ctx.beginPath(); ctx.moveTo(...P(x0, y1, base)); ctx.lineTo(...P(x1, y1, base));
    for (let x = x1; x >= x0; x--) ctx.lineTo(...P(x, y1, w.ch(x, y1)));
    ctx.closePath(); ctx.fillStyle = colL; ctx.fill();
    // right face along x = x1
    ctx.beginPath(); ctx.moveTo(...P(x1, y0, base)); ctx.lineTo(...P(x1, y1, base));
    for (let y = y1; y >= y0; y--) ctx.lineTo(...P(x1, y, w.ch(x1, y)));
    ctx.closePath(); ctx.fillStyle = colR; ctx.fill();
    // stone courses
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.6;
    // stone courses, clipped to the foundation faces
    ctx.save();
    ctx.beginPath(); ctx.moveTo(...P(x0, y1, base)); ctx.lineTo(...P(x1, y1, base)); ctx.lineTo(...P(x1, y0, base));
    for (let y = y0; y <= y1; y++) ctx.lineTo(...P(x1, y, w.ch(x1, y)));
    for (let x = x1; x >= x0; x--) ctx.lineTo(...P(x, y1, w.ch(x, y1)));
    ctx.closePath(); ctx.clip();
    const lo = w.areaMinH(b.x, b.y, b.w, b.h);
    for (let h = base - 0.5; h > lo; h -= 0.5) {
      ctx.beginPath(); ctx.moveTo(...P(x0, y1, h)); ctx.lineTo(...P(x1, y1, h)); ctx.lineTo(...P(x1, y0, h)); ctx.stroke();
    }
    ctx.restore();
  }

  drawRotor(b, [x, y, z], night, bz = 0) {
    const ctx = this.ctx;
    const sx = (b.x + x - (b.y + y)) * HW + 4, sy = (b.x + x + b.y + y) * HH - z - 1 - bz;
    const a0 = this.anim * (b.powered === false ? 0.3 : 2.4) + b.id;
    ctx.save();
    ctx.fillStyle = night > 0.5 ? '#5a6070' : '#f2f2ee';
    for (let k = 0; k < 3; k++) {
      const a = a0 + k * Math.PI * 2 / 3;
      const ex = Math.cos(a) * 15 * 0.55, ey = Math.sin(a) * 15;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + ex - Math.sin(a) * 1.2, sy + ey + Math.cos(a) * 0.8);
      ctx.lineTo(sx + ex, sy + ey); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + ex, sy + ey); ctx.stroke();
    }
    ctx.fillStyle = '#d8d8d2'; ctx.beginPath(); ctx.arc(sx, sy, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  glow(x, y, z, r, col) {
    const ctx = this.ctx; const sx = (x - y) * HW, sy = (x + y) * HH - z;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,80,60,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // ---------- Particles ----------
  spawn(x, y, z, kind) {
    this.particles.push({ x, y, z, kind, t: 0, life: kind === 'fire' ? 0.6 + Math.random() * 0.4 : 3 + Math.random() * 2.5,
      vx: 0.06 + Math.random() * 0.05, vy: -0.03 + Math.random() * 0.03, vz: kind === 'fire' ? 18 : 9 + Math.random() * 4, r: kind === 'fire' ? 2 : 3 });
  }

  drawParticles(dt, night) {
    const ctx = this.ctx; const P = this.particles;
    let j = 0;
    for (let k = 0; k < P.length; k++) {
      const p = P[k];
      p.t += dt; if (p.t > p.life) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz *= 0.995;
      const f = p.t / p.life;
      const sx = (p.x - p.y) * HW, sy = (p.x + p.y) * HH - p.z;
      let r = p.r + f * (p.kind === 'fire' ? 0 : 10), col;
      if (p.kind === 'smoke') col = `rgba(${Math.round(150 - night * 90)},${Math.round(148 - night * 90)},${Math.round(144 - night * 80)},${0.32 * (1 - f)})`;
      else if (p.kind === 'steam') { col = `rgba(${Math.round(245 - night * 150)},${Math.round(245 - night * 150)},${Math.round(242 - night * 140)},${0.45 * (1 - f)})`; r = 5 + f * 16; }
      else if (p.kind === 'blacksmoke') col = `rgba(40,36,34,${0.45 * (1 - f)})`;
      else { col = f < 0.4 ? `rgba(255,220,120,${0.9 - f})` : `rgba(240,110,40,${0.9 - f})`; r = 3.2 * (1 - f) + 1; }
      if (p.kind === 'fire') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      if (p.kind === 'fire') ctx.restore();
      P[j++] = p;
    }
    P.length = j;
  }

  // ---------- Cars ----------
  carSprite(col, axis) {
    const key = col + axis;
    let s = this.carSprites.get(key);
    if (!s) {
      s = this.bank.get('car' + key, () => ({ fw: 1, fd: 1, H: 6, pad: 2, draw(P) { P.car(0.5, 0.5, axis, col); } }));
      this.carSprites.set(key, s);
    }
    return s;
  }

  updateCars(dt) {
    const w = this.world;
    if (!this.roadList || this.roadListVersion !== w.dirty.version) {
      this.roadList = []; for (let i = 0; i < w.n; i++) if (w.road[i]) this.roadList.push(i);
      this.roadListVersion = w.dirty.version;
      this.cars = this.cars.filter((c) => w.road[c.y * w.w + c.x]);
    }
    const target = Math.min(700, Math.floor(Math.min(this.roadList.length * 0.6, (w.stats.pop + w.stats.jobsC + w.stats.jobsI) / 14)));
    let tries = 6;
    while (this.cars.length < target && tries-- > 0 && this.roadList.length) {
      const i = this.roadList[(Math.random() * this.roadList.length) | 0];
      if (Math.random() > 0.15 + w.traffic[i] / 200) continue;
      const x = i % w.w, y = (i / w.w) | 0;
      const opts = []; for (let d = 0; d < 4; d++) if (w.roadAt(x + DIRS[d][0], y + DIRS[d][1])) opts.push(d);
      if (!opts.length) continue;
      this.cars.push({ x, y, d: opts[(Math.random() * opts.length) | 0], t: Math.random(), sp: 0.9 + Math.random() * 0.6, bus: w.stats.busDepot && Math.random() < 0.1,
        col: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0], life: 20 + Math.random() * 60 });
    }
    if (this.cars.length > target + 20) this.cars.length = target;
    const out = [];
    for (const c of this.cars) {
      const i = c.y * w.w + c.x;
      const jam = 1 - Math.min(0.75, w.traffic[i] / 340);
      c.t += dt * c.sp * jam * (w.road[i] === HIGHWAY ? 2 : 1.1);
      if (c.t >= 1) {
        c.t -= 1; c.x += DIRS[c.d][0]; c.y += DIRS[c.d][1]; c.life--;
        if (!w.roadAt(c.x, c.y) || c.life <= 0) continue;
        const opts = [];
        for (let d = 0; d < 4; d++) if (d !== (c.d + 2) % 4 && w.roadAt(c.x + DIRS[d][0], c.y + DIRS[d][1])) opts.push(d);
        if (!opts.length) { if (w.roadAt(c.x + DIRS[(c.d + 2) % 4][0], c.y + DIRS[(c.d + 2) % 4][1])) c.d = (c.d + 2) % 4; else continue; }
        else c.d = opts.includes(c.d) && Math.random() < 0.7 ? c.d : opts[(Math.random() * opts.length) | 0];
      }
      out.push(c);
    }
    this.cars = out;
  }

  drawCars(night, wx0, wx1, wy0, wy1) {
    const ctx = this.ctx;
    if (this.cam.zoom < 0.4) return;
    const w = this.world;
    for (const c of this.cars) {
      const [dx, dy] = DIRS[c.d];
      // move from tile center toward the next tile center
      const fx = c.x + 0.5 + dx * (c.t - 0.5) + -dy * 0.15, fy = c.y + 0.5 + dy * (c.t - 0.5) + dx * 0.15;
      const sx = (fx - fy) * HW, sy = (fx + fy) * HH;
      if (sx < wx0 - 20 || sx > wx1 + 20 || sy < wy0 - 20 || sy > wy1 + 20) continue;
      const bridge = (w.terrain[c.y * w.w + c.x] === T_WATER ? 2 : 0) + (w.maxH ? w.heightAt(fx, fy) * Z : 0);
      const s = c.bus ? this.bank.bus(dx ? 'x' : 'y') : this.carSprite(c.col, dx ? 'x' : 'y');
      const ox = s.ax + (0.5 - 0.5) * HW, oy = s.ay + HH;
      ctx.drawImage(night > 0.6 ? this.bank.night(s) : s.img, sx - ox, sy - oy - bridge, s.w, s.h);
      if (night > 0.3) {
        const hx = sx + (dx - dy) * HW * 0.12, hy = sy + (dx + dy) * HH * 0.12 - 2 - bridge;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = night * 0.8;
        ctx.fillStyle = '#ffe9b0'; ctx.beginPath(); ctx.arc(hx, hy, 1.6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }

  // ---------- Trains ----------
  updateTrains(dt) {
    const w = this.world;
    if (!this.trains) this.trains = [];
    if (this.railVersion !== w.dirty.version) {
      this.railVersion = w.dirty.version;
      this.railList = []; for (let i = 0; i < w.n; i++) if (w.rail[i]) this.railList.push(i);
      this.trains = this.trains.filter((t) => w.railAt(t.x, t.y));
      let st = 0; for (const b of w.buildings.values()) if ((b.kind === 'station' || b.kind === 'freight') && b.active) st++;
      this.trainTarget = Math.min(14, st * 2);
    }
    while (this.trains.length < this.trainTarget && this.railList.length) {
      const i = this.railList[(Math.random() * this.railList.length) | 0];
      const x = i % w.w, y = (i / w.w) | 0;
      const opts = []; for (let d = 0; d < 4; d++) if (w.railAt(x + DIRS[d][0], y + DIRS[d][1])) opts.push(d);
      if (!opts.length) break;
      const freight = Math.random() < 0.35;
      this.trains.push({ x, y, d: opts[0], t: 0, hist: [[x + 0.5, y + 0.5]], sp: freight ? 1.1 : 1.6, freight,
        col: freight ? '#b5452f' : ['#c4473a', '#2e6e8e', '#3d8758'][(Math.random() * 3) | 0], cars: freight ? 4 : 3 });
    }
    for (const t of this.trains) {
      t.t += dt * t.sp;
      while (t.t >= 1) {
        t.t -= 1; t.x += DIRS[t.d][0]; t.y += DIRS[t.d][1];
        t.hist.unshift([t.x + 0.5, t.y + 0.5]); if (t.hist.length > 8) t.hist.pop();
        const opts = [];
        for (let d = 0; d < 4; d++) if (d !== (t.d + 2) % 4 && w.railAt(t.x + DIRS[d][0], t.y + DIRS[d][1])) opts.push(d);
        if (opts.length) t.d = opts.includes(t.d) && Math.random() < 0.75 ? t.d : opts[(Math.random() * opts.length) | 0];
        else t.d = (t.d + 2) % 4; // reverse at the end of the line
      }
    }
  }

  // point along the train's path, s tiles behind the head
  trainPoint(t, s) {
    const head = [t.x + 0.5 + DIRS[t.d][0] * t.t, t.y + 0.5 + DIRS[t.d][1] * t.t];
    const pts = [head, ...t.hist];
    let left = s;
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (left <= L || k === pts.length - 2) { const u = L ? Math.min(1, left / L) : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) ? 'x' : 'y']; }
      left -= L;
    }
    return [head[0], head[1], 'x'];
  }

  drawTrains(night, wx0, wx1, wy0, wy1) {
    if (!this.trains || !this.trains.length || this.cam.zoom < 0.35) return;
    const ctx = this.ctx; const w = this.world;
    for (const t of this.trains) {
      const n = t.cars + 1;
      for (let k = n - 1; k >= 0; k--) {
        const [fx, fy, ax] = this.trainPoint(t, k * 0.46);
        const sx = (fx - fy) * HW, sy = (fx + fy) * HH;
        if (sx < wx0 - 30 || sx > wx1 + 30 || sy < wy0 - 30 || sy > wy1 + 30) continue;
        const z = (w.maxH ? w.heightAt(fx, fy) * Z : 0) + (w.isWater(Math.floor(fx), Math.floor(fy)) ? 2 : 0);
        const kind = k === 0 ? 'loco' : t.freight ? 'box' : 'pax';
        const col = k === 0 ? t.col : t.freight ? ['#8a6a4a', '#5e6b74', '#a0583c'][k % 3] : t.col;
        const s = this.bank.train(ax, kind, col);
        ctx.drawImage(night > 0.6 ? this.bank.night(s) : s.img, sx - s.ax, sy - s.ay - HH - z, s.w, s.h);
        if (night > 0.3 && s.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = night * 0.8; ctx.drawImage(s.glow, sx - s.ax, sy - s.ay - HH - z, s.w, s.h); ctx.restore(); }
      }
    }
  }

  // ---------- Tool feedback ----------
  diamond(x, y, w = 1, h = 1, z = null) {
    const ctx = this.ctx; const W = this.world;
    const ch = (a, b) => (z != null ? z : W.ch(Math.max(0, Math.min(W.w, a)), Math.max(0, Math.min(W.h, b))));
    const p = (a, b) => [(a - b) * HW, (a + b) * HH - ch(a, b) * Z];
    const a = p(x, y), b = p(x + w, y), c = p(x + w, y + h), d = p(x, y + h);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath();
  }

  drawPreview(pv) {
    const ctx = this.ctx;
    ctx.save();
    if (pv.radius) {
      const { cx, cy, r } = pv.radius;
      const hz = this.world.inb(Math.floor(cx), Math.floor(cy)) ? this.world.heightAt(cx, cy) * Z : 0;
      ctx.beginPath();
      for (let k = 0; k <= 48; k++) {
        const a = k / 48 * Math.PI * 2; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const sx = (x - y) * HW, sy = (x + y) * HH - hz; k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
      ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5 / this.cam.zoom * 1.2; ctx.stroke(); ctx.setLineDash([]);
    }
    if (pv.tiles) for (const t of pv.tiles) {
      this.diamond(t.x, t.y);
      ctx.fillStyle = t.ok ? (pv.color || 'rgba(255,255,255,0.35)') : 'rgba(214,64,52,0.45)'; ctx.fill();
      ctx.strokeStyle = t.ok ? 'rgba(255,255,255,0.8)' : 'rgba(214,64,52,0.9)'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (pv.building) {
      const { key, x, y, size, ok } = pv.building;
      const W = this.world;
      const inside = W.inb(x, y) && W.inb(x + size - 1, y + size - 1);
      const base = inside ? W.areaMaxH(x, y, size, size) : 0;
      this.diamond(x, y, size, size, base);
      ctx.fillStyle = ok ? 'rgba(255,255,255,0.25)' : 'rgba(214,64,52,0.4)'; ctx.fill();
      ctx.strokeStyle = ok ? '#ffffff' : '#d64034'; ctx.lineWidth = 2 / this.cam.zoom; ctx.stroke();
      const s = this.bank.service(key, 0);
      ctx.globalAlpha = ok ? 0.85 : 0.5;
      const sx = (x - y) * HW, sy = (x + y) * HH - base * Z;
      ctx.drawImage(s.img, sx - s.ax, sy - s.ay, s.w, s.h);
    }
    ctx.restore();
  }

  drawSelect(b) {
    const ctx = this.ctx;
    const pulse = 0.6 + 0.4 * Math.sin(this.anim * 4);
    ctx.save();
    this.diamond(b.x, b.y, b.w || 1, b.h || 1);
    ctx.strokeStyle = `rgba(255,255,255,${pulse})`; ctx.lineWidth = 2.5 / this.cam.zoom; ctx.stroke();
    ctx.restore();
  }

  // ---------- Minimap ----------
  drawMinimap(canvas) {
    const w = this.world; const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (!this.mmImg || this.mmImg.width !== w.w) this.mmImg = new ImageData(w.w, w.h);
    const d = this.mmImg.data;
    const zc = { 1: [92, 170, 90], 2: [70, 130, 205], 3: [224, 170, 60] };
    for (let i = 0; i < w.n; i++) {
      let c;
      if (w.terrain[i] === T_WATER) c = [63, 135, 160];
      else if (w.rail[i]) c = [120, 100, 82];
      else if (w.road[i]) c = w.road[i] === HIGHWAY ? [40, 42, 46] : [70, 72, 76];
      else if (w.bld[i]) {
        const b = w.buildings.get(w.bld[i]);
        c = b && b.kind === 'zone' ? zc[b.zt].map((v) => v * 0.85) : [190, 186, 176];
      } else if (w.zoneT[i]) c = zc[w.zoneT[i]].map((v) => v * 0.6 + 60);
      else if (w.tree[i]) c = [78, 118, 62];
      else if (w.terrain[i] === T_SAND) c = [222, 208, 164];
      else c = [134, 166, 92];
      if (w.maxH) { const x = i % w.w, y = (i / w.w) | 0; const f = 0.86 + w.tileAvgH(x, y) * 0.03; c = c.map((v) => Math.min(255, v * f)); }
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    if (!this.mmTmp || this.mmTmp.width !== w.w) this.mmTmp = makeCanvas(w.w, w.h);
    this.mmTmp.getContext('2d').putImageData(this.mmImg, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // draw rotated 45deg to match iso view
    const s = Math.min(W / (w.w + w.h), H * 2 / (w.w + w.h)) ;
    ctx.save();
    ctx.translate(W / 2, (H - (w.w + w.h) * s / 2) / 2);
    ctx.transform(s, s / 2, -s, s / 2, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mmTmp, 0, 0);
    ctx.restore();
    // viewport
    const v = this.view; if (!v) return;
    const toMM = (wx, wy) => { const tx = (wx / HW + wy / HH) / 2, ty = (wy / HH - wx / HW) / 2; return [W / 2 + (tx - ty) * s, (H - (w.w + w.h) * s / 2) / 2 + (tx + ty) * s / 2]; };
    const [ax, ay] = toMM(...this.screenToWorld(0, 0)), [bx, by] = toMM(...this.screenToWorld(this.vw, this.vh));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(ax, ay, bx - ax, by - ay);
    this.mmScale = s;
  }

  minimapToTile(canvas, mx, my) {
    const w = this.world; const W = canvas.width, H = canvas.height; const s = this.mmScale || 1;
    const u = (mx - W / 2) / s, v = (my - (H - (w.w + w.h) * s / 2) / 2) / (s / 2);
    return [(u + v) / 2, (v - u) / 2];
  }
}

export { SCALE, Painter, rgba };
