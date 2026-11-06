// Game entry: wires world, simulation, renderer, HUD, input and saving.
import { World } from './world/world.js';
import { Sim } from './world/sim.js';
import { SpriteBank } from './render/sprites.js';
import { Renderer } from './render/renderer.js';
import { Hud, money } from './ui/hud.js';
import { BUILDINGS } from './data/defs.js';
import { ZONE_COLORS } from './render/ground.js';
import { rgba } from './render/art.js';
import * as store from './storage.js';
import { t, t as T, initLang } from './i18n.js';
import { sfx, setSound, unlock, startAmbient, setAmbientLevel } from './audio.js';

const SPEED_MS = [Infinity, 420, 150, 45];

class Game {
  async init() {
    this.settings = store.getSettings();
    initLang(this.settings.lang);
    const params = new URLSearchParams(location.search);
    this.id = params.get('id') || store.lastCityId();
    let world = null;
    if (this.id) { try { world = await store.loadCity(this.id); } catch (e) { console.error(e); } }
    if (!world) {
      world = new World(100, 100);
      world.generate({ seed: (Math.random() * 1e9) | 0, mapType: 'river', difficulty: 'normal', name: 'New City' });
      this.id = store.newId();
    }
    this.world = world;
    this.sim = new Sim(world); this.sim.init();
    this.bank = new SpriteBank();
    this.cv = document.getElementById('view');
    this.renderer = new Renderer(this.cv, world, this.bank);
    this.speed = 1; this.acc = 0;
    this.tool = { kind: 'inspect' };
    this.hud = new Hud(this);
    this.applySettings();
    this.frameCam();
    this.bindInput();
    this.projected = this.calcProjected();
    this.lastHud = 0; this.lastMM = 0; this.lastSave = performance.now();
    this.lastSaved = 0;
    this.hud.syncTool(this.tool);
    this.hud.update();
    this.hud.showTicker(this.sim.advice[0]);
    store.requestPersistence();
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.renderer.resize(), 200));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
    window.addEventListener('pagehide', () => this.save());
    requestAnimationFrame((t) => this.frame(t));
    setTimeout(() => document.getElementById('loading').classList.add('hide'), 150);
    if (!world.buildings.size && !world.day) setTimeout(() => this.hud.toast(t('Start with a road from the edge of the map, then zone along it.')), 900);
  }

  frameCam() {
    const w = this.world; let sx = 0, sy = 0, n = 0;
    for (const b of w.buildings.values()) { sx += b.x; sy += b.y; n++; }
    if (n) this.renderer.centerOn(sx / n, sy / n); else this.renderer.centerOn(w.w / 2, w.h / 2);
    this.renderer.cam.zoom = window.innerWidth < 900 ? 0.75 : 0.95;
  }

  applySettings() {
    const s = this.settings;
    setSound(s.sound);
    this.renderer.dayNight = s.dayNight;
    this.world.settings.disasters = s.disasters;
    this.renderer.quality = s.quality;
    const dpr = s.quality === 'low' ? 1 : Math.min(2, window.devicePixelRatio || 1);
    if (this.renderer.dpr !== dpr) { this.renderer.resize(); this.renderer.dpr = dpr; this.renderer.cv.width = Math.round(this.renderer.vw * dpr); this.renderer.cv.height = Math.round(this.renderer.vh * dpr); }
    store.setSettings(s);
  }
  toggleDayNight() { this.settings.dayNight = !this.settings.dayNight; this.applySettings(); }

  setSpeed(s) { this.speed = s; this.acc = 0; this.hud.update(); }
  panelOpen(open) { this.modal = open; }

  calcProjected() {
    const q = this.sim.projectedMonth();
    const inc = q.taxR + q.taxC + q.taxI; const exp = Object.values(q.exp).reduce((a, b) => a + b, 0) + q.loans;
    return { inc, exp, net: inc - exp };
  }

  // ---------- main loop ----------
  frame(t) {
    const dt = Math.min(250, t - (this.lastT || t)); this.lastT = t;
    if (this.speed > 0) {
      this.acc += dt;
      const ms = SPEED_MS[this.speed];
      let n = 0;
      while (this.acc >= ms && n < 3) { this.sim.tick(); this.acc -= ms; n++; }
      if (n === 3) this.acc = 0;
      if (this.renderer.dayNight) this.renderer.timeOfDay = (this.renderer.timeOfDay + dt / 1000 / 300) % 1;
    }
    this.handleEvents();
    this.renderer.draw(t);
    if (t - this.lastHud > 250) {
      this.lastHud = t; this.hud.update(); this.hud.rotateTicker(this.sim.advice);
      setAmbientLevel(Math.min(0.6, this.world.stats.pop / 8000) * (this.speed ? 1 : 0.3));
    }
    if (t - this.lastMM > 1000) { this.lastMM = t; this.renderer.drawMinimap(document.getElementById('mmc')); this.projected = this.calcProjected(); }
    if (performance.now() - this.lastSave > this.settings.autosave * 1000) { this.lastSave = performance.now(); this.save(); }
    requestAnimationFrame((tt) => this.frame(tt));
  }

  handleEvents() {
    const ev = this.world.events; if (!ev.length) return;
    this.world.events = [];
    for (const e of ev) {
      if (e.type === 'news') { this.hud.pushNews({ who: e.kind === 'fire' ? 'Fire dept.' : 'City news', text: e.text, tone: e.tone === 'bad' ? 'bad' : 'good', x: e.x, y: e.y }); if (e.tone === 'bad') sfx.alert(); }
      else if (e.type === 'milestone') { sfx.milestone(); this.hud.milestone(e); }
      else if (e.type === 'month') {
        this.projected = this.calcProjected();
        const a = this.sim.advice.find((x) => x.tone === 'bad');
        if (a && Math.random() < 0.5) this.hud.showTicker(a);
      }
    }
  }

  // ---------- saving ----------
  thumb() {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    this.renderer.drawMinimap(c);
    try { return c.toDataURL('image/png'); } catch (e) { return null; }
  }
  async save() {
    if (this.saving) return; this.saving = true;
    try { await store.saveCity(this.id, this.world, this.thumb()); this.lastSaved = Date.now(); }
    catch (e) { console.error('save failed', e); this.hud.toast(t('Could not save — storage unavailable'), true); }
    this.saving = false;
  }
  async exit() { await this.save(); location.href = 'index.html'; }
  async exportFile() {
    await this.save();
    const txt = await store.exportCity(this.id);
    const name = this.world.name.replace(/[^\w-]+/g, '_') + '.meridian.json';
    const blob = new Blob([txt], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: this.world.name }); return; } catch (e) { /* fall back */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- camera ----------
  centerOn(tx, ty, select) {
    this.renderer.centerOn(tx + 0.5, ty + 0.5); this.renderer.clampCam();
    if (select) { const b = this.world.buildingAt(tx, ty); if (b) this.hud.inspect({ b }); }
  }
  zoomBy(f, px = this.renderer.vw / 2, py = this.renderer.vh / 2) {
    const r = this.renderer;
    const [bx, by] = r.screenToWorld(px, py);
    r.cam.zoom = Math.max(0.3, Math.min(2.6, r.cam.zoom * f));
    const [ax, ay] = r.screenToWorld(px, py);
    r.cam.x += bx - ax; r.cam.y += by - ay; r.clampCam();
  }

  // ---------- tools ----------
  setTool(t) {
    this.tool = t;
    this.pending = null;
    this.renderer.preview = null;
    this.hud.tip(0, 0, null);
    if (t.kind !== 'inspect') this.hud.inspect(null);
    this.hud.syncTool(t);
  }
  setOverlay(k) { this.renderer.overlay = k; }

  lineTiles(a, b) {
    // L-shaped path: travel the longer axis first, then the shorter one.
    const out = [];
    const [ax, ay] = a, [bx, by] = b;
    const run = (from, to, f) => { const st = to >= from ? 1 : -1; for (let v = from; ; v += st) { f(v); if (v === to) break; } };
    if (Math.abs(bx - ax) >= Math.abs(by - ay)) {
      run(ax, bx, (x) => out.push([x, ay]));
      if (by !== ay) run(ay + (by > ay ? 1 : -1), by, (y) => out.push([bx, y]));
    } else {
      run(ay, by, (y) => out.push([ax, y]));
      if (bx !== ax) run(ax + (bx > ax ? 1 : -1), bx, (x) => out.push([x, by]));
    }
    return out;
  }
  rectTiles(a, b) {
    const out = [];
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
    return out;
  }

  costFn(t) {
    const w = this.world;
    switch (t.kind) {
      case 'road': return (x, y) => w.roadCost(x, y, t.type || 1);
      case 'rail': return (x, y) => w.railCost(x, y);
      case 'pline': return (x, y) => w.plineCost(x, y);
      case 'zone': return (x, y) => w.zoneCost(x, y, t.zt, t.zd);
      case 'dezone': return (x, y) => { if (!w.inb(x, y)) return -1; const i = w.idx(x, y); if (!w.zoneT[i]) return -1; const b = w.buildingAt(x, y); return b && b.kind === 'zone' ? 5 : 0.0001; };
      case 'bulldoze': return (x, y) => w.bulldozeCost(x, y);
      case 'trees': return (x, y) => w.plantCost(x, y);
      default: return () => -1;
    }
  }
  applyFn(t) {
    const w = this.world;
    switch (t.kind) {
      case 'road': return (x, y) => w.buildRoad(x, y, t.type || 1);
      case 'rail': return (x, y) => w.buildRail(x, y);
      case 'pline': return (x, y) => w.buildPline(x, y);
      case 'zone': return (x, y) => w.setZone(x, y, t.zt, t.zd);
      case 'dezone': return (x, y) => {
        if (!w.inb(x, y)) return 0; const i = w.idx(x, y); if (!w.zoneT[i]) return 0;
        const b = w.buildingAt(x, y); let c = 0;
        if (b && b.kind === 'zone') { if (!w.canAfford(5)) return -1; w.removeBuilding(b); w.spend(5); c = 5; }
        w.zoneT[i] = 0; w.zoneD[i] = 0; w.touch(i); return c || 0.0001;
      };
      case 'bulldoze': return (x, y) => w.bulldoze(x, y);
      case 'trees': return (x, y) => w.plant(x, y);
      default: return () => 0;
    }
  }

  isLine(t) { return t.kind === 'road' || t.kind === 'pline' || t.kind === 'rail'; }

  terraPlan(a, b) {
    const w = this.world; const t = this.tool;
    let level = 0;
    if (w.inb(a[0], a[1])) level = Math.round(w.tileAvgH(a[0], a[1]));
    const targets = w.terraformTargets(t.op, a[0], a[1], b[0], b[1], level);
    return w.planTerraform(targets);
  }

  dragPreview(a, b, sx, sy) {
    const t = this.tool;
    if (t.kind === 'terraform') {
      const plan = this.terraPlan(a, b);
      const list = this.rectTiles(a, b).filter(([x, y]) => this.world.inb(x, y)).map(([x, y]) => ({ x, y, ok: plan.ok }));
      this.renderer.preview = { tiles: list, color: 'rgba(196,160,96,0.45)' };
      const name = T({ raise: 'Raise land', lower: 'Lower land', level: 'Level land' }[t.op]);
      this.hud.tip(sx, sy, plan.ok ? `${name} · ${money(plan.cost)}` : T(plan.reason), !plan.ok);
      return;
    }
    const tiles = this.isLine(t) ? this.lineTiles(a, b) : this.rectTiles(a, b);
    const fn = this.costFn(t);
    let total = 0, count = 0;
    const seen = new Set();
    const list = [];
    for (const [x, y] of tiles) {
      if (!this.world.inb(x, y)) continue;
      let c = fn(x, y);
      if (t.kind === 'bulldoze' && c > 0) {
        const bb = this.world.buildingAt(x, y);
        if (bb) { if (seen.has(bb.id)) c = 0; seen.add(bb.id); }
      }
      if (c > 0) { total += c; count++; }
      list.push({ x, y, ok: c >= 0 });
    }
    const col = t.kind === 'zone' ? rgba(ZONE_COLORS[t.zt], 0.55) : t.kind === 'bulldoze' || t.kind === 'dezone' ? 'rgba(214,64,52,0.35)' : t.kind === 'trees' ? 'rgba(80,150,60,0.45)' : 'rgba(255,255,255,0.4)';
    this.renderer.preview = { tiles: list, color: col };
    const label = T({ road: t.type === 2 ? 'Highway' : 'Road', rail: 'Railway', pline: 'Power line', zone: t.zt ? ['', 'Residential', 'Commercial', 'Industrial'][t.zt] : '', dezone: 'Dezone', bulldoze: 'Demolish', trees: 'Trees' }[t.kind]);
    const bad = total > this.world.funds;
    this.hud.tip(sx, sy, `${label} · ${money(Math.ceil(total))}<small>${T(count === 1 ? '{n} tile' : '{n} tiles', { n: count })}</small>`, bad);
  }

  commitDrag(a, b) {
    const t = this.tool;
    if (t.kind === 'terraform') {
      const plan = this.terraPlan(a, b);
      this.renderer.preview = null; this.hud.tip(0, 0, null);
      if (!plan.ok) { this.hud.toast(T(plan.reason), true); sfx.error(); return; }
      this.world.applyTerraform(plan); sfx.bulldoze();
      return;
    }
    const tiles = this.isLine(t) ? this.lineTiles(a, b) : this.rectTiles(a, b);
    const fn = this.applyFn(t);
    let spent = 0, broke = false;
    for (const [x, y] of tiles) {
      const c = fn(x, y);
      if (c === -1) { broke = true; break; }
      spent += c;
    }
    this.renderer.preview = null; this.hud.tip(0, 0, null);
    if (broke) { this.hud.toast(T('Not enough funds'), true); sfx.error(); }
    if (spent > 0) ({ road: sfx.road, rail: sfx.road, pline: sfx.road, zone: sfx.zone, bulldoze: sfx.bulldoze, dezone: sfx.bulldoze, trees: sfx.zone }[t.kind] || sfx.tap)();
  }

  buildPreview(tx, ty, sx, sy) {
    const key = this.tool.key; const d = BUILDINGS[key];
    const off = Math.floor((d.size - 1) / 2);
    const x = tx - off, y = ty - off;
    const chk = this.world.placeCheck(key, x, y);
    this.renderer.preview = { building: { key, x, y, size: d.size, ok: chk.ok }, radius: d.r ? { cx: x + d.size / 2, cy: y + d.size / 2, r: d.r } : null };
    this.hud.tip(sx, sy - 40 * this.renderer.cam.zoom, chk.ok ? `${T(d.name)} · ${money(chk.cost)}` : T(chk.reason), !chk.ok);
    return { x, y, ok: chk.ok };
  }

  placeBuilding(x, y) {
    const key = this.tool.key;
    const r = this.world.place(key, x, y);
    this.renderer.preview = null; this.hud.tip(0, 0, null);
    if (!r.ok) { this.hud.toast(T(r.reason), true); sfx.error(); return; }
    sfx.build();
  }

  confirmBuild(yes) {
    const p = this.pending; this.pending = null; this.hud.hideConfirm();
    if (yes && p) this.placeBuilding(p.x, p.y);
    else { this.renderer.preview = null; this.hud.tip(0, 0, null); }
  }

  demolish(b) {
    if (!b) return;
    this.world.bulldoze(b.x, b.y); sfx.bulldoze();
    this.renderer.preview = null;
  }

  inspectAt(tx, ty) {
    const w = this.world;
    if (!w.inb(tx, ty)) { this.hud.inspect(null); this.renderer.preview = null; return; }
    const b = w.buildingAt(tx, ty);
    this.renderer.preview = null;
    this.hud.inspect(b ? { b } : { x: tx, y: ty });
    sfx.tap();
  }

  // ---------- input ----------
  bindInput() {
    const cv = this.cv; const r = this.renderer;
    const ptrs = new Map();
    let mode = null; // 'pan' | 'tool' | 'pinch' | 'build' | 'idle'
    let start = null, lastTile = null, pinch = null, downAt = 0, moved = 0;
    const tileOf = (e) => { const [tx, ty] = r.screenToTile(e.clientX, e.clientY); return [tx, ty]; };
    const isMouse = (e) => e.pointerType === 'mouse';

    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    cv.addEventListener('pointerdown', (e) => {
      unlock(); if (this.settings.sound) startAmbient();
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pending && !isMouse(e)) this.confirmBuild(false);
      if (ptrs.size === 2) {
        if (mode === 'tool' || mode === 'build') { r.preview = null; this.hud.tip(0, 0, null); }
        const [p1, p2] = [...ptrs.values()];
        pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), cx: (p1.x + p2.x) / 2, cy: (p1.y + p2.y) / 2 };
        mode = 'pinch'; return;
      }
      if (ptrs.size > 2) return;
      downAt = performance.now(); moved = 0;
      start = [e.clientX, e.clientY];
      if (isMouse(e) && (e.button === 1 || e.button === 2)) { mode = 'pan'; return; }
      const t = this.tool.kind;
      if (t === 'inspect') { mode = 'pan'; return; }
      const tile = tileOf(e); lastTile = tile;
      if (t === 'build') { mode = 'build'; this.buildPreview(tile[0], tile[1], e.clientX, e.clientY); return; }
      mode = 'tool'; this.dragStart = tile; this.dragPreview(tile, tile, e.clientX, e.clientY);
    });

    cv.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) {
        // hover preview for mouse
        if (isMouse(e) && this.tool.kind === 'build' && !this.pending) { const t = tileOf(e); this.buildPreview(t[0], t[1], e.clientX, e.clientY); }
        return;
      }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (mode === 'pinch' && ptrs.size >= 2) {
        const [p1, p2] = [...ptrs.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y), cx = (p1.x + p2.x) / 2, cy = (p1.y + p2.y) / 2;
        r.cam.x -= (cx - pinch.cx) / r.cam.zoom; r.cam.y -= (cy - pinch.cy) / r.cam.zoom;
        this.zoomBy(d / (pinch.d || d), cx, cy);
        pinch = { d, cx, cy };
        return;
      }
      if (mode === 'pan') { r.cam.x -= dx / r.cam.zoom; r.cam.y -= dy / r.cam.zoom; r.clampCam(); return; }
      if (mode === 'tool') {
        const t = tileOf(e);
        if (!lastTile || t[0] !== lastTile[0] || t[1] !== lastTile[1]) { lastTile = t; }
        this.dragPreview(this.dragStart, t, e.clientX, e.clientY);
        return;
      }
      if (mode === 'build') { const t = tileOf(e); this.buildPreview(t[0], t[1], e.clientX, e.clientY); }
    });

    const end = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (mode === 'pinch') { if (ptrs.size === 0) mode = null; else mode = 'idle'; return; }
      if (mode === 'idle') { if (ptrs.size === 0) mode = null; return; }
      if (mode === 'pan') {
        if (moved < 10 && performance.now() - downAt < 450 && !(isMouse(e) && e.button !== 0)) { const t = tileOf(e); this.inspectAt(t[0], t[1]); }
      } else if (mode === 'tool') {
        if (e.type === 'pointercancel') { r.preview = null; this.hud.tip(0, 0, null); }
        else this.commitDrag(this.dragStart, tileOf(e));
      } else if (mode === 'build' && e.type !== 'pointercancel') {
        const t = tileOf(e);
        const res = this.buildPreview(t[0], t[1], e.clientX, e.clientY);
        if (!res.ok) { sfx.error(); this.hud.tip(0, 0, null); setTimeout(() => { if (!this.pending) r.preview = null; }, 600); }
        else if (isMouse(e) || !this.settings.confirmBuild) this.placeBuilding(res.x, res.y);
        else {
          this.pending = res; this.hud.tip(0, 0, null);
          const d = BUILDINGS[this.tool.key].size;
          const [sx, sy] = r.tileToScreen(res.x + d / 2, res.y + d / 2);
          this.hud.showConfirm(sx, sy + d * 8 * r.cam.zoom);
        }
      }
      mode = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);

    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey) this.zoomBy(Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY);
      else if (Math.abs(e.deltaY) > 0 && e.deltaMode === 0 && Math.abs(e.deltaX) > 0) { r.cam.x += e.deltaX / r.cam.zoom; r.cam.y += e.deltaY / r.cam.zoom; r.clampCam(); }
      else this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });

    const keys = new Set();
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      keys.add(e.key.toLowerCase());
      if (e.key === ' ') { this.setSpeed(this.speed ? 0 : 1); e.preventDefault(); }
      if (['1', '2', '3'].includes(e.key)) this.setSpeed(+e.key);
      if (e.key === 'Escape') { if (this.hud.panelId) this.hud.closePanel(); else { this.hud.closeDrawer(); this.setTool({ kind: 'inspect' }); this.hud.inspect(null); } }
      if (e.key === '+' || e.key === '=') this.zoomBy(1.2);
      if (e.key === '-') this.zoomBy(0.83);
      if (e.key.toLowerCase() === 'b') this.setTool({ kind: 'bulldoze' });
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) this.setTool({ kind: 'road' });
    });
    window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    const panLoop = () => {
      const s = 14 / r.cam.zoom;
      if (keys.has('arrowleft') || keys.has('a')) r.cam.x -= s;
      if (keys.has('arrowright') || keys.has('d')) r.cam.x += s;
      if (keys.has('arrowup') || keys.has('w')) r.cam.y -= s;
      if (keys.has('arrowdown') || keys.has('s')) r.cam.y += s;
      if (keys.size) r.clampCam();
      requestAnimationFrame(panLoop);
    };
    panLoop();
  }
}

const game = new Game();
window.__game = game;
game.init().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.querySelector('.lw').insertAdjacentHTML('beforeend', `<p style="margin-top:20px;opacity:.8">${t('Something went wrong:')} ${e.message}</p><p><a href="index.html" style="color:#f07a4f">${t('Back to menu')}</a></p>`);
});
