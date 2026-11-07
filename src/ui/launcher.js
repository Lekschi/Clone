// Title screen and main menu. The player's city keeps running in 3D behind it while the camera
// glides over the skyline. From here the player continues, switches between cities, founds a new
// one (with a landscape preview), opens settings, or watches the credits.
import { h, $, esc, num, icon } from './dom.js';
import { listSlots, deleteSlot, setActiveSlot, activeSlot, newSlotId, writeLocalState, touchSlot, MAX_SLOTS } from '../save/save.js';
import { newState } from '../game/game.js';
import { Terrain } from '../render/terrain.js';
import { TRACKS, MUSIC_LICENSES, sfx, onTrackChange } from '../audio.js';

const LOGO = `<svg class="lg-mark" viewBox="0 0 120 120" aria-hidden="true">
  <defs><linearGradient id="lgS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#f29a1e"/></linearGradient>
  <linearGradient id="lgB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd4ff"/><stop offset="1" stop-color="#2a74c9"/></linearGradient></defs>
  <circle cx="60" cy="60" r="56" fill="url(#lgB)"/>
  <circle cx="82" cy="40" r="13" fill="url(#lgS)"/>
  <path d="M14 92h92v14H14z" fill="#1d3b5c" opacity=".35"/>
  <rect x="22" y="58" width="16" height="40" rx="2" fill="#fff" opacity=".8"/>
  <rect x="42" y="34" width="20" height="64" rx="2" fill="#fff"/>
  <rect x="66" y="50" width="18" height="48" rx="2" fill="#fff" opacity=".9"/>
  <rect x="88" y="66" width="12" height="32" rx="2" fill="#fff" opacity=".75"/>
  <g fill="#2a74c9" opacity=".55"><rect x="47" y="42" width="4" height="5"/><rect x="54" y="42" width="4" height="5"/><rect x="47" y="52" width="4" height="5"/><rect x="54" y="52" width="4" height="5"/><rect x="47" y="62" width="4" height="5"/><rect x="54" y="62" width="4" height="5"/><rect x="71" y="58" width="3" height="5"/><rect x="77" y="58" width="3" height="5"/><rect x="71" y="68" width="3" height="5"/><rect x="77" y="68" width="3" height="5"/></g>
  <path d="M10 98c18-6 36-6 50-2s32 4 50-2v24H10z" fill="#3cae7e"/>
</svg>`;

export class Launcher {
  constructor(app) {
    this.app = app;
    this.active = false;
  }

  show() {
    const app = this.app;
    this.active = true;
    app.root.classList.add('title-mode');
    app.world.cinematic = true;
    this.el = h(`<div class="launcher">
      <div class="lc-vignette"></div>
      <div class="lc-logo">${LOGO}<h1><span>NEU</span>STADT</h1><p>Baue die Stadt deiner Träume</p></div>
      <div class="lc-body"></div>
      <div class="lc-foot"><span>Ohne Echtgeld · ohne Pay-to-win</span><span class="lc-track"></span></div>
    </div>`);
    this.el.addEventListener('click', (e) => this.onClick(e));
    app.root.appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add('in'));
    onTrackChange((t) => { const el = this.el && $('.lc-track', this.el); if (el) el.textContent = `♪ ${t.title} – ${t.artist}`; });
    this.screen('press');
  }

  async screen(name) {
    this.name = name;
    const body = $('.lc-body', this.el);
    this.el.dataset.screen = name;
    if (name === 'press') {
      body.innerHTML = `<button class="lc-press" data-l="menu">Tippen zum Starten</button>`;
      return;
    }
    if (name === 'menu') {
      const g = this.app.game;
      const S = g.state;
      if (this.app.demo) {
        body.innerHTML = `<div class="lc-menu">
          <button class="lc-btn primary" data-l="new"><span class="lb-ic">${icon('home')}</span><span class="lb-t"><b>Neues Spiel</b><small>Gründe deine erste Stadt</small></span></button>
          <div class="lc-row">
            <button class="lc-btn small" data-l="settings">${icon('gear')}<b>Einstellungen</b></button>
            <button class="lc-btn small" data-l="credits">${icon('list')}<b>Mitwirkende</b></button>
          </div>
        </div>`;
        return;
      }
      body.innerHTML = `<div class="lc-menu">
        <button class="lc-btn primary" data-l="play"><span class="lb-ic">${icon('home')}</span><span class="lb-t"><b>Weiterspielen</b><small>${esc(S.name)} · Stufe ${S.level} · ${num(g.city.pop)} Einwohner</small></span></button>
        <button class="lc-btn" data-l="cities"><span class="lb-ic">${icon('land')}</span><span class="lb-t"><b>Meine Städte</b><small>Bis zu ${MAX_SLOTS} Städte gleichzeitig</small></span></button>
        <button class="lc-btn" data-l="new"><span class="lb-ic">${icon('tree')}</span><span class="lb-t"><b>Neue Stadt gründen</b><small>Eigene Landschaft auswählen</small></span></button>
        <div class="lc-row">
          <button class="lc-btn small" data-l="settings">${icon('gear')}<b>Einstellungen</b></button>
          <button class="lc-btn small" data-l="credits">${icon('list')}<b>Mitwirkende</b></button>
        </div>
      </div>`;
      return;
    }
    if (name === 'cities') {
      body.innerHTML = `<div class="lc-panel"><h2>Meine Städte</h2><div class="lc-slots"><p class="muted">Lade…</p></div><button class="lc-link" data-l="menu">‹ Zurück</button></div>`;
      const list = await listSlots();
      if (this.name !== 'cities') return;
      const cur = activeSlot();
      const cards = list.slice(0, MAX_SLOTS).map((c) => `<div class="lc-slot ${c.id === cur ? 'cur' : ''}">
        <div class="ls-ic">${icon('home')}</div>
        <div class="ls-t"><b>${esc(c.name || 'Stadt')}</b><small>Stufe ${c.level || 1} · ${num(c.pop || 0)} Einwohner · ${new Date(c.updated || Date.now()).toLocaleDateString('de-DE')}</small></div>
        ${c.id === cur ? '<span class="pill good">Aktiv</span>' : `<button class="btn primary small" data-l="open" data-id="${c.id}">Spielen</button>`}
        <button class="btn ghost small danger" data-l="del" data-id="${c.id}">${this.confirmDel === c.id ? 'Wirklich löschen?' : 'Löschen'}</button>
      </div>`).join('');
      $('.lc-slots', this.el).innerHTML = cards + (list.length < MAX_SLOTS ? `<button class="lc-slot add" data-l="new">+ Neue Stadt gründen</button>` : `<p class="muted small">Du hast ${MAX_SLOTS} Städte. Lösche eine, um eine neue zu gründen.</p>`);
      return;
    }
    if (name === 'new') {
      const list = await listSlots();
      if (!this.app.demo && list.length >= MAX_SLOTS) {
        this.app.game.toast(`Du hast schon ${MAX_SLOTS} Städte – lösche erst eine.`, 'bad');
        this.screen('cities');
        return;
      }
      this.seed = this.seed || Math.floor(Math.random() * 1e9);
      body.innerHTML = `<div class="lc-panel new">
        <h2>Neue Stadt gründen</h2>
        <div class="lc-new">
          <canvas class="lc-map" width="220" height="220"></canvas>
          <div class="lc-form">
            <label for="lcName">Name der Stadt</label>
            <input class="inp" id="lcName" maxlength="28" value="${esc(this.suggestName())}">
            <button class="btn ghost small" data-l="dice">🎲 Name würfeln</button>
            <label>Landschaft</label>
            <p class="muted small">Hügel, Wälder und Küste werden für jede Stadt neu erzeugt.</p>
            <button class="btn ghost small" data-l="reroll">Andere Landschaft</button>
            <button class="btn primary" data-l="found">Stadt gründen</button>
          </div>
        </div>
        <button class="lc-link" data-l="menu">‹ Zurück</button></div>`;
      this.drawMap();
      return;
    }
    if (name === 'credits') {
      const music = TRACKS.map((t) => `<li><b>„${esc(t.title)}“</b> – ${esc(t.artist)} <small>(${esc(t.license)})</small></li>`).join('');
      body.innerHTML = `<div class="lc-panel credits"><div class="lc-roll">
        <h2>Neustadt</h2>
        <h3>Spielidee, Design & Programmierung</h3><p>Erstellt mit Claude</p>
        <h3>Musik</h3><ul>${music}</ul>
        <p class="small">Kevin MacLeod (incompetech.com), lizenziert unter <a href="${MUSIC_LICENSES['CC BY 3.0']}" target="_blank" rel="noopener">CC BY 3.0</a>.<br>
        Weitere Stücke über filmmusic.io, <a href="${MUSIC_LICENSES['filmmusic.io Standard']}" target="_blank" rel="noopener">Standard-Lizenz</a>.</p>
        <h3>Soundeffekte</h3><p>Kenney (kenney.nl) · UI SFX (uisfx.com) – CC0<br>Umgebungsklänge im Code erzeugt</p>
        <h3>Technik</h3><p>three.js · N8AO · postprocessing</p>
        <h3>Danke fürs Spielen!</h3>
      </div><button class="lc-link" data-l="menu">‹ Zurück</button></div>`;
    }
  }

  suggestName() {
    const a = ['Neu', 'Ober', 'Unter', 'Groß', 'Klein', 'Bad ', 'Sankt ', 'Alt', 'Hohen', 'Sonnen', 'Linden', 'Birken', 'Eichen', 'Rosen', 'Wiesen', 'Bergen', 'Seebrück'];
    const b = ['stadt', 'burg', 'hausen', 'dorf', 'heim', 'feld', 'au', 'tal', 'berg', 'hafen', 'brück', 'ingen', 'stedt', 'walde'];
    for (;;) {
      const x = a[Math.floor(Math.random() * a.length)], y = b[Math.floor(Math.random() * b.length)];
      const n = x.endsWith(' ') ? x + y[0].toUpperCase() + y.slice(1) : x + y;
      if (!/(.)\1\1/.test(n)) return n;
    }
  }

  // top-down preview of the landscape for the chosen seed
  drawMap() {
    const cv = $('.lc-map', this.el);
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const t = new Terrain(64, 64, this.seed, 30);
    const N = 110, S = cv.width / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -40 + (i / N) * 144, z = -40 + (j / N) * 144;
      const hh = t.height(x, z);
      let c;
      if (hh < -0.12) c = `rgb(${40 + hh * 30},${110 + hh * 40},${170 + hh * 20})`;
      else if (hh < 0.06 && z > 65) c = '#d9c48f';
      else if (hh > 9) c = '#e9edf2';
      else if (hh > 4) c = `rgb(${120 - hh * 4},${120 - hh * 4},${110 - hh * 3})`;
      else c = `rgb(${70 + hh * 10},${126 - hh * 6},${58})`;
      ctx.fillStyle = c;
      ctx.fillRect(i * S, j * S, S + 1, S + 1);
    }
    // the city's building land
    const k = cv.width / 144;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect((40 + 16) * k, (40 + 16) * k, 32 * k, 24 * k);
    ctx.setLineDash([]);
    ctx.fillStyle = '#596270';
    ctx.fillRect(0, (40 + 30) * k, (40 + 40) * k, 2);
  }

  async onClick(e) {
    const b = e.target.closest('[data-l]');
    if (!b) return;
    const a = b.dataset.l;
    sfx.tap();
    if (a === 'play') { this.enter(); return; }
    if (a === 'settings') { this.app.panels.open('settings'); return; }
    if (a === 'dice') { $('#lcName', this.el).value = this.suggestName(); return; }
    if (a === 'reroll') { this.seed = Math.floor(Math.random() * 1e9); this.drawMap(); return; }
    if (a === 'open') { this.switchTo(b.dataset.id); return; }
    if (a === 'del') {
      const id = b.dataset.id;
      if (this.confirmDel !== id) { this.confirmDel = id; this.screen('cities'); return; }
      this.confirmDel = null;
      const wasActive = id === activeSlot();
      await deleteSlot(id);
      if (wasActive) { this.app.save.dirty = false; this.app.save.cloudDirty = false; this.app.save.disabled = true; location.reload(); return; }
      this.screen('cities');
      return;
    }
    if (a === 'found') { this.found(); return; }
    this.confirmDel = null;
    this.screen(a);
  }

  switchTo(id) {
    this.app.save.saveLocal();
    this.app.save.pushCloud();
    setActiveSlot(id);
    sessionStorage.setItem('neustadt.skipTitle', '1');
    setTimeout(() => location.reload(), 300);
  }

  found() {
    const name = ($('#lcName', this.el).value || '').trim() || this.suggestName();
    this.app.save.saveLocal();
    this.app.save.pushCloud();
    const id = newSlotId();
    const s = newState(name);
    s.seed = this.seed;
    s.updated = Date.now();
    writeLocalState(id, s);
    touchSlot(id, s);
    setActiveSlot(id);
    sessionStorage.setItem('neustadt.skipTitle', '1');
    sessionStorage.setItem('neustadt.fresh', '1');
    setTimeout(() => location.reload(), 300);
  }

  enter() {
    const app = this.app;
    this.active = false;
    app.world.cinematic = false;
    this.el.classList.remove('in');
    this.el.classList.add('out');
    app.root.classList.remove('title-mode');
    setTimeout(() => this.el.remove(), 900);
    app.enterGame();
  }
}
