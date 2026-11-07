import './style.css';
import { Game, newState } from './game/game.js';
import { BUILDINGS } from './data/buildings.js';
import { ITEMS } from './data/items.js';
import { World } from './render/world.js';
import { thumb } from './render/thumbs.js';
import { Hud } from './ui/hud.js';
import { Panels } from './ui/panels.js';
import { BuildMenu, ModeBar } from './ui/build.js';
import { Bubbles } from './ui/bubbles.js';
import { Input } from './ui/input.js';
import { h, num, icon, esc } from './ui/dom.js';
import { SaveManager, loadSettings, account } from './save/save.js';
import { setSound, sfx } from './audio.js';

const OPEN_PANEL = { house: 'house', storage: 'storage', cityhall: 'cityhall', market: 'market', cargo: 'cargo' };

class App {
  constructor() {
    this.root = document.getElementById('app');
    this.settings = loadSettings();
    setSound(this.settings.sound);
    this.mode = null;
  }

  thumb(type, level) { return thumb(type, level ?? 1); }

  async boot() {
    const splash = document.getElementById('splash');
    const res = await SaveManager.resolveStart(this.settings);
    let state = res.state;
    const fresh = !state;
    if (!state) state = newState();
    this.start(state, res.server);
    splash.classList.add('out');
    setTimeout(() => splash.remove(), 600);
    if (fresh) this.welcome(() => this.daily());
    else { this.welcomeBack(); this.daily(); }
  }

  daily() {
    const r = this.game.dailyBonus();
    if (!r) return;
    const days = [1, 2, 3, 4, 5, 6, 7].map((d) => `<div class="dd ${d < r.day ? 'got' : d === r.day ? 'now' : ''}">${icon(d === 7 ? 'crystal' : d === 5 ? 'box' : 'coin')}Tag ${d}</div>`).join('');
    const m = h(`<div class="modal daily"><div class="card">
      <h2 class="center">Tagesbonus</h2>
      <p class="muted center">Schön, dass du da bist! Komm jeden Tag wieder – am 7. Tag gibt es mehr Kristalle.</p>
      <div class="days">${days}</div>
      <div class="lu-rew"><span class="cur">${icon('coin')}+${num(r.coins)}</span><span class="cur">${icon('crystal')}+${r.crystals}</span>${r.partId ? `<span class="cur">${ITEMS[r.partId].icon} ${ITEMS[r.partId].name}</span>` : ''}</div>
      <button class="btn primary wide" data-close>Einsammeln</button>
    </div></div>`);
    m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) { sfx.coin(); m.remove(); } });
    this.root.appendChild(m);
  }

  start(state, server) {
    const offline = Math.min(3 * 86400, Math.max(0, (Date.now() - (state.updated || Date.now())) / 1000));
    const game = new Game(state);
    this.game = game;
    if (offline > 5) game.tick(offline);
    this.offline = offline;
    const view = document.getElementById('view');
    this.world = new World(view, game, this.settings);
    this.save = new SaveManager(game, this.settings);
    this.hud = new Hud(this);
    this.save.setStatus(server ? 'synced' : 'noserver');
    if (server) this.save.pushCloud();
    this.panels = new Panels(this);
    this.build = new BuildMenu(this);
    this.modebar = new ModeBar(this);
    this.bubbles = new Bubbles(this);
    this.input = new Input(this);

    const hall = game.findUnique('cityhall');
    if (hall) this.world.focus(hall.x + 2, hall.z + 1, 22);

    game.on('collected', (b, got, part) => { if (part) this.foundPart(part); });
    game.on('upgraded', (b, r) => {
      const p = this.world.buildingAnchor(b.id);
      if (p) this.hud.float(p.x, p.y, `+${num(r.coins)} ${icon('coin')}`);
      if (r.part) this.foundPart(r.part);
    });
    game.on('built', () => sfx.build());
    game.on('train', (r) => { sfx.train(); this.hud.toast(`Der Zug ist abgefahren! Bonus +${num(r.bonus)} Münzen${r.crystal ? ' und 1 Kristall' : ''}`, 'good'); if (r.part) this.foundPart(r.part); });
    game.on('questClaimed', (q, part) => { this.hud.toast(`Aufgabe erledigt: ${q.text}`, 'good'); if (part) this.foundPart(part); });
    game.on('expanded', () => this.hud.toast('Neues Bauland gekauft!', 'good'));
    game.on('sold', (s) => this.hud.toast(`${s.qty}× ${ITEMS[s.item].name} verkauft`, 'good'));
    game.on('fire', () => this.hud.toast('Feuer in einem Wohngebiet! Feuerwachen schützen vor Bränden.', 'bad'));

    window.addEventListener('resize', () => this.world.resize());
    let last = performance.now();
    let tickAcc = 0;
    const loop = (t) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      tickAcc += dt;
      if (tickAcc >= 1) { game.tick(tickAcc); tickAcc = 0; }
      this.input.update(dt);
      if (this.mode?.kind === 'place') this.updateGhost();
      this.world.update(dt);
      this.bubbles.update(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  foundPart(id) {
    this.hud.toast(`Gefunden: ${ITEMS[id].icon} ${ITEMS[id].name}`, 'good');
  }

  welcome(after) {
    const m = h(`<div class="modal welcome"><div class="card">
      <div class="w-hero">${icon('home', 'xl')}</div>
      <h2>Willkommen, Bürgermeister!</h2>
      <p>Hier entsteht <b>deine</b> Stadt. Ein paar Tipps für den Anfang:</p>
      <ul>
        <li>${icon('road')}<span>Wohngebiete, Läden und Fabriken brauchen eine <b>Straße</b> daneben.</span></li>
        <li>${icon('power')}<span>Häuser brauchen <b>Strom</b> und <b>Wasser</b>, später auch Abwasser und Müllabfuhr.</span></li>
        <li>${icon('factory')}<span>Die <b>Fabrik</b> stellt Rohstoffe her – damit baust du Häuser aus.</span></li>
        <li>${icon('coin')}<span>Im <b>Rathaus</b> sammelst du Steuern ein.</span></li>
        <li>${icon('list')}<span>Die <b>Aufgaben</b> links führen dich durch die ersten Schritte.</span></li>
      </ul>
      <p class="muted small">Alles wird automatisch gespeichert. Kristalle verdienst du nur durchs Spielen – es gibt keine Echtgeld-Käufe.</p>
      <div class="kv"><span>Name deiner Stadt</span><input class="inp" id="wName" value="${esc(this.game.state.name)}" maxlength="28"></div>
      <button class="btn primary wide" data-close>Los geht's</button>
    </div></div>`);
    m.addEventListener('click', (e) => {
      if (!e.target.closest('[data-close]')) return;
      const v = m.querySelector('#wName').value.trim();
      if (v) { this.game.state.name = v; this.game.emit('change'); }
      m.remove();
      sfx.tap();
      if (after) after();
    });
    this.root.appendChild(m);
  }

  welcomeBack() {
    if (this.offline < 120) return;
    const taxes = Math.floor(this.game.state.taxes.acc);
    this.hud.toast(`Willkommen zurück! ${taxes > 0 ? `Im Rathaus warten ${num(taxes)} Münzen.` : ''}`, 'info');
  }

  // ---------------------------------------------------------------- HUD actions
  action(act) {
    switch (act) {
      case 'build':
        this.setMode(null);
        this.panels.close();
        if (this.build.isOpen()) this.build.close(); else this.build.open();
        break;
      case 'quests': case 'storage': case 'overview': case 'settings': case 'progress':
        this.build.close();
        this.panels.open(act);
        break;
      case 'tool-move': this.build.close(); this.panels.close(); this.setMode({ kind: 'move' }); break;
      case 'tool-bulldoze': this.build.close(); this.panels.close(); this.setMode({ kind: 'bulldoze' }); break;
      case 'tool-view': this.build.close(); this.panels.close(); this.setMode({ kind: 'view', overlay: 'utility' }); break;
      default: break;
    }
  }

  openBuilding(bid) {
    const b = this.game.byId.get(bid);
    if (!b) return;
    const def = BUILDINGS[b.type];
    let kind = OPEN_PANEL[b.type];
    if (!kind) kind = def.factory ? 'factory' : def.shop ? 'shop' : 'info';
    this.panels.open(kind, bid);
  }

  escape() {
    if (this.panels.isOpen()) this.panels.close();
    else if (this.build.isOpen()) this.build.close();
    else this.setMode(null);
  }

  // ---------------------------------------------------------------- modes
  setMode(m) {
    const prev = this.mode;
    if (prev?.kind === 'place') {
      this.world.clearGhost();
      if (prev.moveId) { const o = this.world.objs.get(prev.moveId); if (o) o.obj.visible = true; }
    }
    if (prev?.kind === 'road') this.world.setRoadPreview(null);
    if (prev?.kind === 'view') this.world.setOverlay(null);
    this.mode = m;
    this.world.showGrid(!!m && (m.kind === 'place' || m.kind === 'road'));
    if (!m) { this.modebar.hide(); this.hud.el.classList.remove('moding'); return; }
    this.hud.el.classList.add('moding');
    if (m.kind === 'place') this.updateGhost(true);
    else if (m.kind === 'road') this.modebar.road(m, null);
    else if (m.kind === 'bulldoze') this.modebar.simple('Abreißen', 'Tippe auf ein Gebäude oder eine Straße');
    else if (m.kind === 'move') this.modebar.simple('Verschieben', 'Tippe auf das Gebäude, das du verschieben möchtest');
    else if (m.kind === 'view') { this.world.setOverlay(m.overlay); this.modebar.view(m.overlay); }
  }

  findSpot(type, rot, cx, cz, ignore = 0) {
    const g = this.game;
    for (let r = 0; r < 14; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (g.canPlace(type, cx + dx, cz + dz, rot, ignore).ok) return [cx + dx, cz + dz];
      }
    }
    return [cx, cz];
  }

  startPlace(type) {
    const g = this.game;
    g.markSeen(`b:${type}`);
    g.emit('change');
    const st = g.buildStatus(type);
    if (!st.ok) { g.toast(st.reason, 'bad'); return; }
    const center = this.world.pickCell(window.innerWidth / 2, window.innerHeight / 2) || [32, 30];
    const def = BUILDINGS[type];
    const [x, z] = this.findSpot(type, 0, center[0] - Math.floor(def.size[0] / 2), center[1] - Math.floor(def.size[1] / 2));
    this.setMode({ kind: 'place', type, x, z, rot: 0 });
  }

  startMove(bid) {
    const b = this.game.byId.get(bid);
    if (!b) return;
    const o = this.world.objs.get(bid);
    if (o) o.obj.visible = false;
    this.setMode({ kind: 'place', type: b.type, x: b.x, z: b.z, rot: b.rot || 0, moveId: bid, level: b.level, v: b.v });
  }

  ghostSize(m) {
    const s = BUILDINGS[m.type].size;
    return m.rot % 2 ? [s[1], s[0]] : s;
  }

  ghostContains([x, z]) {
    const m = this.mode;
    const [w, d] = this.ghostSize(m);
    return x >= m.x - 1 && x < m.x + w + 1 && z >= m.z - 1 && z < m.z + d + 1;
  }

  moveGhost(x, z) {
    const m = this.mode;
    if (!m || m.kind !== 'place') return;
    const [w, d] = this.ghostSize(m);
    m.x = Math.max(0, Math.min(this.game.W - w, x));
    m.z = Math.max(0, Math.min(this.game.H - d, z));
    this.updateGhost(true);
  }

  placementCheck(m) {
    const g = this.game;
    const c = g.canPlace(m.type, m.x, m.z, m.rot, m.moveId || 0);
    if (!c.ok) return c;
    if (!m.moveId) {
      const st = g.buildStatus(m.type);
      if (!st.ok) return st;
    }
    return { ok: true };
  }

  updateGhost(bar = false) {
    const m = this.mode;
    const c = this.placementCheck(m);
    this.world.setGhost(m.type, m.x, m.z, m.rot, c.ok, m.level || 1, m.v || 0);
    if (bar || m._ok !== c.ok) { this.modebar.place(m, c.ok, c.reason); m._ok = c.ok; }
  }

  modeAction(a, arg) {
    const m = this.mode;
    const g = this.game;
    if (!m) return;
    if (a === 'cancel' || a === 'done') { this.setMode(null); return; }
    if (m.kind === 'place') {
      if (a === 'rotate') {
        const def = BUILDINGS[m.type];
        if (def.size[0] === def.size[1]) return;
        m.rot = (m.rot + 1) % 4;
        this.world.clearGhost();
        this.updateGhost(true);
      } else if (a === 'confirm') {
        if (m.moveId) {
          if (g.move(m.moveId, m.x, m.z, m.rot)) { sfx.build(); this.setMode(null); }
          return;
        }
        const b = g.place(m.type, m.x, m.z, m.rot);
        if (!b) return;
        const def = BUILDINGS[m.type];
        if (m.type === 'house' || (def.cat === 'leisure' && def.size[0] === 1) || m.type === 'wind' || m.type === 'watertower') {
          if (g.buildStatus(m.type).ok) {
            const [x, z] = this.findSpot(m.type, m.rot, m.x, m.z);
            m.x = x; m.z = z;
            this.updateGhost(true);
            return;
          }
        }
        this.setMode(null);
        if (def.factory || def.shop || def.unique === 'market' || def.unique === 'cargo') setTimeout(() => this.openBuilding(b.id), 700);
      }
    } else if (m.kind === 'road') {
      if (a === 'roadBuild') { m.erase = false; this.modebar.road(m, null); }
      if (a === 'roadErase') { m.erase = true; this.modebar.road(m, null); }
    } else if (m.kind === 'view' && a === 'view') {
      m.overlay = arg;
      this.world.setOverlay(arg);
      this.modebar.view(arg);
    }
  }

  roadPath(a, b) {
    const span = (from, to) => {
      const s = Math.sign(to - from);
      const out = [];
      for (let v = from; ; v += s) { out.push(v); if (v === to) break; }
      return out;
    };
    const [x0, z0] = a, [x1, z1] = b;
    const cells = [];
    if (Math.abs(x1 - x0) >= Math.abs(z1 - z0)) {
      for (const x of span(x0, x1)) cells.push([x, z0]);
      for (const z of span(z0, z1).slice(1)) cells.push([x1, z]);
    } else {
      for (const z of span(z0, z1)) cells.push([x0, z]);
      for (const x of span(x0, x1).slice(1)) cells.push([x, z1]);
    }
    return cells;
  }

  roadPreview(a, b) {
    const m = this.mode;
    if (!a) { this.world.setRoadPreview(null); this.modebar.road(m, null); return; }
    const g = this.game;
    let cells = this.roadPath(a, b);
    if (m.erase) cells = cells.filter(([x, z]) => g.isRoad(x, z) && g.isUnlocked(x, z));
    else cells = cells.filter(([x, z]) => g.isUnlocked(x, z) && g.at(x, z) === 0);
    const ok = m.erase || g.state.coins >= g.roadPathCost(cells);
    this.world.setRoadPreview(cells, ok, m.erase);
    this.modebar.road(m, cells);
  }

  finishRoad(a, b) {
    const m = this.mode;
    const g = this.game;
    const cells = this.roadPath(a, b);
    let n;
    if (m.erase) { n = g.removeRoads(cells); if (n) sfx.remove(); }
    else { n = g.placeRoads(cells); if (n) sfx.road(); }
    this.world.setRoadPreview(null);
    this.modebar.road(m, null);
  }

  tap(x, y) {
    const m = this.mode;
    const g = this.game;
    const bid = this.world.pickBuilding(x, y);
    const cell = this.world.pickCell(x, y);
    if (m?.kind === 'place') {
      if (cell) {
        const [w, d] = this.ghostSize(m);
        this.moveGhost(cell[0] - Math.floor(w / 2), cell[1] - Math.floor(d / 2));
      }
      return;
    }
    if (m?.kind === 'bulldoze') {
      if (bid) this.confirmDemolish(bid);
      else if (cell && g.isRoad(cell[0], cell[1])) { if (g.removeRoads([cell])) sfx.remove(); }
      return;
    }
    if (m?.kind === 'move') {
      if (bid) this.startMove(bid);
      return;
    }
    if (m?.kind === 'road' || m?.kind === 'view') return;
    this.build.close();
    if (bid) { sfx.tap(); this.openBuilding(bid); return; }
    if (cell && g.inMap(cell[0], cell[1]) && !g.isUnlocked(cell[0], cell[1])) {
      const ci = g.chunkOf(cell[0], cell[1]);
      if (g.chunkUnlockable(ci)) { this.panels.open('expand', ci); return; }
      g.toast('Kaufe zuerst das angrenzende Land', 'info');
      return;
    }
    this.panels.close();
  }

  confirmDemolish(bid) {
    const g = this.game;
    const b = g.byId.get(bid);
    const def = BUILDINGS[b.type];
    if (def.cat === 'fixed') { g.toast('Dieses Gebäude kann nicht abgerissen werden', 'bad'); return; }
    this.world.select(bid);
    const m = h(`<div class="modal"><div class="card small">
      <img class="m-img" src="${this.thumb(b.type, b.level)}" alt="">
      <h2>${def.name} abreißen?</h2>
      <p class="muted">Du bekommst ein Viertel der Baukosten zurück.${def.factory || def.shop ? ' Laufende Produktion geht verloren.' : ''}</p>
      <div class="row center"><button class="btn ghost" data-no>Abbrechen</button><button class="btn danger" data-yes>Abreißen</button></div>
    </div></div>`);
    m.addEventListener('click', (e) => {
      if (e.target.closest('[data-yes]')) { g.demolish(bid); sfx.remove(); m.remove(); }
      else if (e.target.closest('[data-no]') || e.target === m) { this.world.select(null); m.remove(); }
    });
    this.root.appendChild(m);
  }

  // ---------------------------------------------------------------- save management
  async replaceState(s) {
    s.updated = Date.now();
    localStorage.setItem('neustadt.save.v1', JSON.stringify(s));
    await this.pushRaw(s);
    location.reload();
  }

  async newGame() {
    const s = newState();
    await this.replaceState(s);
  }

  async pushRaw(s) {
    const a = account();
    try {
      await fetch(`${this.save.base()}/save/${encodeURIComponent(a.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Key': a.key }, body: JSON.stringify(s) });
    } catch { /* offline */ }
  }

  async loadFromCloud() {
    const r = await this.save.fetchCloud();
    if (r.save && r.save.buildings) {
      localStorage.setItem('neustadt.save.v1', JSON.stringify(r.save));
      location.reload();
    } else this.game.toast(r.none ? 'Für diesen Code gibt es keinen Spielstand' : 'Server nicht erreichbar', 'bad');
  }
}

const app = new App();
window.__app = app;
app.boot().catch((e) => {
  console.error(e);
  const s = document.getElementById('splash');
  if (s) s.querySelector('p').textContent = `Fehler beim Start: ${e.message}`;
});
