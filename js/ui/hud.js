// DOM-based heads-up display and panels.
import { icon } from './icons.js';
import { BUILDINGS, MILESTONES, ZONE_NAMES, DENSITY_NAMES, ZONE_COST, DEPTS, MONTHS, DAYS_PER_MONTH,
  ZONE_CAP, TIER_NAMES, ROAD_COST, PLINE_COST, TREE_COST, HIGHWAY_COST, RAIL_COST } from '../data/defs.js';
import { OVERLAYS } from '../render/renderer.js';
import { HW, HH } from '../render/art.js';
import { describeBuilding } from '../world/sim.js';
import { sfx } from '../audio.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const money = (v) => (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
export const fmt = (v) => Math.round(v).toLocaleString('en-US');

export function dateStr(day) {
  const m = Math.floor(day / DAYS_PER_MONTH);
  return `${MONTHS[m % 12]} ${2030 + Math.floor(m / 12)}`;
}

export const LOGO = `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
  <path d="M20 5 L35 13.5 L20 22 L5 13.5 Z" fill="#d4532b"/>
  <path d="M5 13.5 L20 22 L20 35 L5 26.5 Z" fill="#e9e4d8"/>
  <path d="M35 13.5 L20 22 L20 35 L35 26.5 Z" fill="#a9a59a"/>
  <path d="M20 3 V37" stroke="#1d2124" stroke-width="1.6"/>
</svg>`;

const CATS = [
  { id: 'inspect', name: 'Look', icon: 'hand', tool: { kind: 'inspect' } },
  { id: 'bulldoze', name: 'Clear', icon: 'bulldoze', tool: { kind: 'bulldoze' } },
  { id: 'transport', name: 'Transport', icon: 'road', drawer: 'transport' },
  { id: 'zones', name: 'Zone', icon: 'zones', drawer: 'zones' },
  { id: 'utilities', name: 'Utility', icon: 'power', drawer: 'utilities' },
  { id: 'services', name: 'Civic', icon: 'safety', drawer: 'services' },
  { id: 'parks', name: 'Parks', icon: 'parks', drawer: 'parks' },
  { id: 'terrain', name: 'Terrain', icon: 'mountain', drawer: 'terrain' },
  { sep: true },
  { id: 'data', name: 'Data', icon: 'layers', drawer: 'data' },
  { id: 'budget', name: 'Budget', icon: 'budget', panel: 'budget' },
  { id: 'city', name: 'City', icon: 'chart', panel: 'city' },
];
const DRAWERS = {
  transport: { title: 'Transport', items: ['road', 'highway', 'rail', 'busstop', 'busdepot', 'station', 'freight'] },
  terrain: { title: 'Terrain', items: ['raise', 'lower', 'level'] },
  utilities: { title: 'Utilities', items: ['pline', 'wind', 'coal', 'solar', 'gas', 'nuclear', 'pump', 'wtower', 'treatment'] },
  services: { title: 'Civic services', items: ['police', 'fire', 'clinic', 'school', 'library', 'highschool', 'policehq', 'firehq', 'hospital', 'university'] },
  parks: { title: 'Parks & landmarks', items: ['trees', 'park', 'playground', 'plaza', 'pond', 'bigpark', 'sports', 'cityhall', 'museum', 'stadium', 'spire'] },
};

export class Hud {
  constructor(game) {
    this.g = game;
    this.drawerId = null;
    this.thumbs = new Map();
    this.tickerQueue = [];
    this.tickerIdx = 0;
    this.build();
  }

  build() {
    const g = this.g;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="topbar">
        <div class="plate cityplate"><div class="name" id="cityName"></div><div class="cap rank" id="cityRank"></div></div>
        <div class="plate stats">
          <div class="stat"><span class="cap">Date</span><span class="v num" id="sDate"></span></div>
          <div class="stat"><span class="cap">Population</span><span class="v num" id="sPop"></span></div>
          <div class="stat"><span class="cap">Treasury</span><span class="v num" id="sFunds"></span></div>
          <div class="stat hide-s"><span class="cap">Approval</span><span class="v num" id="sAppr"></span></div>
        </div>
        <div class="plate rci" title="Demand">
          ${[1, 2, 3].map((z) => `<div class="bar"><div class="track"><div class="fill" id="d${z}"></div></div><span class="lbl" style="color:var(--z${'rci'[z - 1]})">${'RCI'[z - 1]}</span></div>`).join('')}
        </div>
        <div class="spacer"></div>
        <div class="plate speed" id="speed">
          <button data-s="0" aria-label="Pause">${icon('pause')}</button>
          <button data-s="1" aria-label="Normal speed">${icon('play')}</button>
          <button data-s="2" aria-label="Fast">${icon('ff')}</button>
          <button data-s="3" aria-label="Fastest">${icon('fff')}</button>
        </div>
        <button class="plate iconbtn" id="menuBtn" aria-label="Menu">${icon('menu')}</button>
      </div>
      <nav id="rail"><div class="brand">${LOGO}</div></nav>
      <div id="drawer" class="plate"></div>
      <div id="tip"></div>
      <div id="confirm"><button class="no" aria-label="Cancel">${icon('close')}</button><button class="yes" aria-label="Build">${icon('check')}</button></div>
      <div id="ticker" class="plate"><span class="who" id="tWho"></span><span class="msg" id="tMsg"></span><button id="tNext" aria-label="Advisors">${icon('advisor')}</button></div>
      <div id="mm" class="plate"><canvas id="mmc" width="400" height="224"></canvas>
        <div class="row"><button id="zOut" aria-label="Zoom out">${icon('minus')}</button><button id="zIn" aria-label="Zoom in">${icon('plus')}</button>
        <button id="dn" aria-label="Day and night">${icon('sun')}</button><button id="mmToggle" aria-label="Toggle minimap">${icon('minimap')}</button></div></div>
      <div id="legend" class="plate"></div>
      <div id="insp" class="plate"></div>
      <div id="toasts"></div>
      <div class="scrim" id="scrim"></div>
      <div class="panel" id="panel"></div>
    `);
    const rail = $('#rail');
    for (const c of CATS) {
      if (c.sep) { rail.appendChild(el('div', 'rsep')); continue; }
      const b = el('button', 'rbtn', `${icon(c.icon)}<span>${c.name}</span>`);
      b.dataset.id = c.id; b.setAttribute('aria-label', c.name);
      b.onclick = () => this.onRail(c);
      rail.appendChild(b);
    }
    $('#speed').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { g.setSpeed(+b.dataset.s); sfx.tap(); } });
    $('#menuBtn').onclick = () => this.openPanel('menu');
    $('#scrim').onclick = () => this.closePanel();
    $('#zIn').onclick = () => g.zoomBy(1.25);
    $('#zOut').onclick = () => g.zoomBy(0.8);
    $('#dn').onclick = () => { g.toggleDayNight(); this.syncDN(); };
    $('#mmToggle').onclick = () => $('#mm').classList.toggle('min');
    $('#tNext').onclick = () => this.openPanel('city', 'advisors');
    $('#ticker').addEventListener('click', (e) => { if (e.target.closest('button')) return; const it = this.tickerCur; if (it && it.x != null) g.centerOn(it.x, it.y, true); });
    const mmc = $('#mmc');
    const mmGo = (e) => {
      const r = mmc.getBoundingClientRect();
      const [tx, ty] = g.renderer.minimapToTile(mmc, (e.clientX - r.left) * mmc.width / r.width, (e.clientY - r.top) * mmc.height / r.height);
      g.centerOn(tx, ty);
    };
    mmc.addEventListener('pointerdown', (e) => { mmGo(e); mmc.setPointerCapture(e.pointerId); });
    mmc.addEventListener('pointermove', (e) => { if (e.buttons) mmGo(e); });
    $('#confirm .yes').onclick = () => g.confirmBuild(true);
    $('#confirm .no').onclick = () => g.confirmBuild(false);
    this.syncDN();
    this.refreshStatic();
  }

  syncDN() { $('#dn').innerHTML = icon(this.g.renderer.dayNight ? 'moon' : 'sun'); }

  refreshStatic() {
    const w = this.g.world;
    $('#cityName').textContent = w.name;
    $('#cityRank').textContent = MILESTONES[w.milestone].name;
  }

  onRail(c) {
    sfx.tap();
    if (c.panel) { this.openPanel(c.panel); return; }
    if (c.tool) { this.closeDrawer(); this.g.setTool(c.tool); return; }
    if (c.drawer) {
      if (this.drawerId === c.drawer) { this.closeDrawer(); this.g.setTool({ kind: 'inspect' }); return; }
      this.openDrawer(c.drawer);
    }
  }

  setRailActive(id) {
    document.querySelectorAll('.rbtn').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
  }

  syncTool(t) {
    const map = { inspect: 'inspect', bulldoze: 'bulldoze', road: 'transport', rail: 'transport', terraform: 'terrain', zone: 'zones', dezone: 'zones', pline: 'utilities', trees: 'parks' };
    let id = map[t.kind];
    if (t.kind === 'build') { const cat = BUILDINGS[t.key].cat; id = cat === 'transit' ? 'transport' : cat === 'power' || cat === 'water' ? 'utilities' : cat === 'parks' || cat === 'landmark' ? 'parks' : 'services'; }
    if (this.drawerId === 'data') id = 'data';
    this.setRailActive(id);
    document.querySelectorAll('#drawer .card').forEach((c) => c.classList.toggle('on', c.dataset.key === this.toolKey(t)));
    this.hideConfirm();
  }
  toolKey(t) {
    if (t.kind === 'zone') return `z${t.zt}${t.zd}`;
    if (t.kind === 'build') return t.key;
    if (t.kind === 'overlay') return 'ov' + t.key;
    if (t.kind === 'road') return t.type === 2 ? 'highway' : 'road';
    if (t.kind === 'terraform') return t.op;
    return t.kind;
  }

  // ---------- Drawer ----------
  openDrawer(id) {
    const d = $('#drawer'); const g = this.g; const w = g.world;
    this.drawerId = id;
    d.innerHTML = '';
    const head = el('div', 'dhead');
    const cards = el('div', 'cards');
    if (id === 'zones') {
      head.innerHTML = `<span class="dtitle">Zoning</span><span class="cap">Drag to paint · lots need a road within 3 tiles</span>`;
      for (const zt of [1, 2, 3]) {
        const grp = el('div', 'zgroup');
        for (const zd of [1, 2, 3]) {
          const unlocked = zd === 1 || MILESTONES.slice(0, w.milestone + 1).some((m) => (m.density || 0) >= zd);
          const col = ['', 'var(--zr)', 'var(--zc)', 'var(--zi)'][zt];
          const c = el('button', 'card zcard' + (unlocked ? '' : ' locked'), `
            <div class="zsw" style="background:${col}">${icon(['', 'res', 'com', 'ind'][zt])}
              <span class="dens">${[1, 2, 3].map((k) => `<i class="${k <= zd ? '' : 'off'}"></i>`).join('')}</span></div>
            <div class="t">${DENSITY_NAMES[zd]} ${ZONE_NAMES[zt].toLowerCase()}</div><div class="c num">$${w.cost(ZONE_COST[zd])}/tile</div>
            ${unlocked ? '' : `<span class="lockb">${icon('lock')}${MILESTONES.find((m) => (m.density || 0) >= zd).name}</span>`}`);
          c.dataset.key = `z${zt}${zd}`;
          c.onclick = () => { if (!unlocked) { this.toast(`Unlocks at ${MILESTONES.find((m) => (m.density || 0) >= zd).name}`, true); sfx.error(); return; } sfx.tap(); g.setTool({ kind: 'zone', zt, zd }); };
          grp.appendChild(c);
        }
        cards.appendChild(grp);
      }
      const dz = el('button', 'card zcard', `<div class="zsw" style="background:#8a8781">${icon('close')}</div><div class="t">Remove zoning</div><div class="c">Free</div>`);
      dz.dataset.key = 'dezone'; dz.onclick = () => { sfx.tap(); g.setTool({ kind: 'dezone' }); };
      cards.appendChild(dz);
    } else if (id === 'data') {
      head.innerHTML = `<span class="dtitle">Data views</span><span class="cap">Tap again to hide</span>`;
      for (const [k, o] of Object.entries(OVERLAYS)) {
        const ramp = o.ramp ? `linear-gradient(90deg, ${o.ramp.join(',')})` : k === 'power' ? 'linear-gradient(90deg,#c8423b 50%,#f2c94c 50%)' : 'linear-gradient(90deg,#c8423b 50%,#4aa8d8 50%)';
        const c = el('button', 'card ovcard', `<div class="osw" style="background:${ramp}"></div><div class="t">${o.name}</div>`);
        c.dataset.key = 'ov' + k;
        c.onclick = () => { sfx.tap(); g.setOverlay(g.renderer.overlay === k ? null : k); this.syncOverlay(); };
        cards.appendChild(c);
      }
    } else {
      const def = DRAWERS[id];
      head.innerHTML = `<span class="dtitle">${def.title}</span><span class="cap" id="dhint"></span>`;
      for (const key of def.items) cards.appendChild(this.itemCard(key));
    }
    d.append(head, cards);
    d.classList.add('open');
    document.body.classList.add('drawer-open');
    $('#ticker').classList.add('drawer-open');
    this.setRailActive(id);
    if (id === 'data') this.syncOverlay();
    else document.querySelectorAll('#drawer .card').forEach((c) => c.classList.toggle('on', c.dataset.key === this.toolKey(g.tool)));
  }

  syncOverlay() {
    const k = this.g.renderer.overlay;
    document.querySelectorAll('#drawer .ovcard').forEach((c) => c.classList.toggle('on', c.dataset.key === 'ov' + k));
    const lg = $('#legend');
    if (!k) { lg.classList.remove('show'); return; }
    const o = OVERLAYS[k];
    const ramp = o.ramp ? `linear-gradient(90deg, ${o.ramp.join(',')})` : k === 'power' ? 'linear-gradient(90deg,#c8423b 50%,#f2c94c 50%)' : 'linear-gradient(90deg,#c8423b 50%,#4aa8d8 50%)';
    lg.innerHTML = `<div class="cap">Data view</div><div style="font-weight:700;font-size:17px;margin-top:2px">${o.name}</div><div class="bar" style="background:${ramp}"></div><div class="ends"><span>${o.legend[0]}</span><span>${o.legend[1]}</span></div>`;
    lg.classList.add('show');
  }

  itemCard(key) {
    const g = this.g; const w = g.world;
    let name, cost, unlock = 0, extra = '';
    const SIMPLE = {
      pline: ['Power line', PLINE_COST, 'Drag to place'],
      road: ['Road', ROAD_COST, 'Drag to draw. Power and water run along roads.'],
      highway: ['Highway', HIGHWAY_COST, 'Fast four-lane road. Reach the map edge for regional traffic.'],
      rail: ['Railway', RAIL_COST, 'Drag to lay track. Stations need a line to another station or the map edge.'],
      raise: ['Raise land', null, 'Tap or drag to lift the ground one level'],
      lower: ['Lower land', null, 'Tap or drag to dig down one level'],
      level: ['Level land', null, 'Drag from a tile to flatten the area to its height'],
    };
    if (SIMPLE[key]) { name = SIMPLE[key][0]; cost = SIMPLE[key][1] != null ? `${money(w.cost(SIMPLE[key][1]))}/tile` : `${money(w.cost(20))}/step`; }
    else if (key === 'trees') { name = 'Plant trees'; cost = `$${w.cost(TREE_COST)}/tile`; }
    else {
      const d = BUILDINGS[key]; name = d.name; cost = money(w.cost(d.cost)); unlock = d.unlock;
      if (d.power) extra = ` · ${d.power} MW`; if (d.water) extra = ` · ${d.water} kgal`;
    }
    const locked = unlock > w.milestone;
    const c = el('button', 'card' + (locked ? ' locked' : ''), `<canvas width="200" height="152"></canvas><div class="t">${name}</div><div class="c num">${cost}${extra}</div>
      ${locked ? `<span class="lockb">${icon('lock')}${MILESTONES[unlock].name}</span>` : ''}`);
    c.dataset.key = key;
    this.paintThumb(c.querySelector('canvas'), key);
    c.onclick = () => {
      if (locked) { this.toast(`${name} unlocks at ${MILESTONES[unlock].name} (${fmt(MILESTONES[unlock].pop)} residents)`, true); sfx.error(); return; }
      sfx.tap();
      if (key === 'pline') g.setTool({ kind: 'pline' });
      else if (key === 'trees') g.setTool({ kind: 'trees' });
      else if (key === 'road') g.setTool({ kind: 'road', type: 1 });
      else if (key === 'highway') g.setTool({ kind: 'road', type: 2 });
      else if (key === 'rail') g.setTool({ kind: 'rail' });
      else if (key === 'raise' || key === 'lower' || key === 'level') g.setTool({ kind: 'terraform', op: key });
      else g.setTool({ kind: 'build', key });
      const hint = $('#dhint'); if (hint) hint.textContent = SIMPLE[key] ? SIMPLE[key][2] : key === 'trees' ? 'Drag to place' : BUILDINGS[key].desc;
    };
    return c;
  }

  paintThumb(cv, key) {
    const bank = this.g.bank; const x = cv.getContext('2d');
    let s;
    if (key === 'pline') s = bank.pole(10);
    else if (key === 'trees') s = bank.tree(3, 2);
    else if (key === 'road') s = bank.road(10, false);
    else if (key === 'highway') s = bank.highway(10, 10, false);
    else if (key === 'rail') s = bank.rail(10, 0);
    else if (key === 'raise' || key === 'lower' || key === 'level') { this.paintTerrainThumb(cv, key); return; }
    else s = bank.service(key, 0);
    const pad = 10;
    // crop to the content bounds (footprint + height), not the shadow padding
    const fw = s.fw + s.fd;
    const cw = fw * HW + 4, ch = fw * HH + s.H + 4;
    const sc = Math.min((cv.width - pad * 2) / cw, (cv.height - pad * 2) / ch);
    const dx = (cv.width - cw * sc) / 2, dy = (cv.height - ch * sc) / 2 + 2;
    x.clearRect(0, 0, cv.width, cv.height);
    x.drawImage(s.img, (s.ax - s.fd * HW - 2) * 2, (s.ay - s.H - 2) * 2, cw * 2, ch * 2, dx, dy, cw * sc, ch * sc);
  }

  paintTerrainThumb(cv, op) {
    const x = cv.getContext('2d'); const W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + 34, tw = 40, th = 20;
    const hgt = op === 'raise' ? [0, 1, 2, 1, 0] : op === 'lower' ? [2, 1, 0, 1, 2] : [1, 1, 1, 1, 1];
    for (let k = 0; k < 5; k++) {
      const h = hgt[k] * 14; const px = cx + (k - 2) * tw * 0.5, py = cy;
      x.fillStyle = '#8a6a48'; x.fillRect(px - tw / 2, py - th / 2 - h, tw / 2, h + 8);
      x.fillStyle = '#6e543a'; x.fillRect(px, py - th / 2 - h, tw / 2, h + 8);
      x.fillStyle = ['#7f9f52', '#8aab5c', '#97b765', '#8aab5c', '#7f9f52'][k];
      x.beginPath(); x.moveTo(px, py - th - h); x.lineTo(px + tw / 2, py - th / 2 - h); x.lineTo(px, py - h); x.lineTo(px - tw / 2, py - th / 2 - h); x.closePath(); x.fill();
    }
    x.strokeStyle = '#1c1f22'; x.lineWidth = 4; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath();
    if (op === 'raise') { x.moveTo(cx, 58); x.lineTo(cx, 22); x.moveTo(cx - 10, 32); x.lineTo(cx, 22); x.lineTo(cx + 10, 32); }
    else if (op === 'lower') { x.moveTo(cx, 22); x.lineTo(cx, 58); x.moveTo(cx - 10, 48); x.lineTo(cx, 58); x.lineTo(cx + 10, 48); }
    else { x.moveTo(cx - 40, 34); x.lineTo(cx + 40, 34); x.moveTo(cx - 40, 26); x.lineTo(cx - 40, 42); x.moveTo(cx + 40, 26); x.lineTo(cx + 40, 42); }
    x.stroke();
  }

  closeDrawer() {
    $('#drawer').classList.remove('open');
    document.body.classList.remove('drawer-open');
    $('#ticker').classList.remove('drawer-open');
    if (this.drawerId === 'data') { this.g.setOverlay(null); this.syncOverlay(); }
    this.drawerId = null;
  }

  // ---------- Live stats ----------
  update() {
    const w = this.g.world; const s = w.stats;
    $('#sDate').textContent = dateStr(w.day);
    $('#sPop').textContent = fmt(s.pop);
    const proj = this.g.projected;
    const net = proj ? proj.net : 0;
    $('#sFunds').innerHTML = `${money(w.funds)}<small class="${net >= 0 ? 'up' : 'down'}">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</small>`;
    $('#sFunds').classList.toggle('down', w.funds < 0);
    $('#sAppr').textContent = Math.round(s.approval) + '%';
    for (const z of [1, 2, 3]) {
      const v = Math.max(-1, Math.min(1, w.demand[z]));
      const f = $('#d' + z);
      const col = ['', 'var(--zr)', 'var(--zc)', 'var(--zi)'][z];
      if (v >= 0) { f.style.bottom = '50%'; f.style.top = ''; f.style.height = (v * 50) + '%'; f.style.background = col; }
      else { f.style.top = '50%'; f.style.bottom = ''; f.style.height = (-v * 50) + '%'; f.style.background = 'var(--bad)'; }
    }
    document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.s === this.g.speed));
    if (this.inspected) this.renderInspector(this.inspected);
  }

  // ---------- Ticker ----------
  pushNews(item) {
    this.tickerQueue.push(item);
    if (this.tickerQueue.length > 30) this.tickerQueue.shift();
    this.showTicker(item);
  }
  showTicker(item) {
    if (!item) return;
    this.tickerCur = item;
    const who = $('#tWho');
    who.textContent = item.who || 'News';
    who.className = 'who ' + (item.tone || '');
    $('#tMsg').textContent = item.text;
    this.tickerTime = performance.now();
  }
  rotateTicker(advice) {
    if (performance.now() - (this.tickerTime || 0) < 9000) return;
    if (!advice || !advice.length) return;
    this.tickerIdx = (this.tickerIdx + 1) % advice.length;
    this.showTicker(advice[this.tickerIdx]);
  }

  toast(text, bad) {
    const t = el('div', 'toast' + (bad ? ' bad' : ''), text);
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ---------- Tip & confirm ----------
  tip(x, y, html, bad) {
    const t = $('#tip');
    if (!html) { t.classList.remove('show'); return; }
    t.innerHTML = html; t.classList.add('show'); t.classList.toggle('bad', !!bad);
    t.style.left = x + 'px'; t.style.top = Math.max(100, y - 40) + 'px';
  }
  showConfirm(x, y) {
    const c = $('#confirm');
    c.style.left = x + 'px'; c.style.top = Math.min(window.innerHeight - 80, y + 30) + 'px';
    c.classList.add('show');
  }
  hideConfirm() { $('#confirm').classList.remove('show'); }

  // ---------- Inspector ----------
  inspect(info) {
    this.inspected = info;
    if (!info) { $('#insp').classList.remove('show'); this.g.renderer.select = null; return; }
    this.renderInspector(info);
    $('#insp').classList.add('show');
  }

  renderInspector(info) {
    const g = this.g; const w = g.world;
    const b = info.b && w.buildings.get(info.b.id) ? w.buildings.get(info.b.id) : null;
    if (info.b && !b) { this.inspect(null); return; }
    const x = b ? b.x : info.x, y = b ? b.y : info.y;
    const i = w.idx(x, y);
    const meter = (label, v, col) => `<div class="meter"><span>${label}</span><span class="tr"><i style="width:${Math.round(v / 2.55)}%;background:${col}"></i></span><span class="num" style="text-align:right">${Math.round(v / 2.55)}</span></div>`;
    const chip = (ok, label, ic) => `<span class="chip ${ok ? 'ok' : 'no'}">${icon(ic)}${label}</span>`;
    let title, sub, body = '';
    if (b) {
      const d = describeBuilding(w, b);
      title = d.title; sub = b.kind === 'zone' ? d.sub : (b.def ? b.def.desc : '');
      if (b.kind === 'zone') {
        const cap = ZONE_CAP[b.zt][b.tier];
        body += `<div class="chips">${chip(b.powered, b.powered ? 'Power' : 'No power', 'power')}${chip(b.watered || b.tier < 3, b.watered ? 'Water' : (b.tier < 3 ? 'Well' : 'No water'), 'water')}
          ${b.abandoned ? chip(false, 'Abandoned', 'warn') : ''}${b.fire ? chip(false, 'On fire', 'fire') : ''}${b.built < 1 ? chip(true, 'Under construction', 'info') : ''}</div>`;
        body += `<div class="big"><div><div class="cap">${b.zt === 1 ? 'Residents' : 'Jobs'}</div><div class="v num">${fmt(b.zt === 1 ? b.pop : b.jobs)}<span style="font-size:13px;color:var(--mute)"> / ${fmt(cap)}</span></div></div>
          <div><div class="cap">Desirability</div><div class="v num">${Math.round(g.sim.desirability(i, b.zt) / 2.55)}</div></div></div>`;
      } else if (b.kind !== 'rubble') {
        const dd = b.def;
        body += `<p class="desc">${dd.desc}</p><div class="chips">${dd.power ? chip(b._linked, b._linked ? 'Connected to grid' : 'Not connected — add a road or power line', 'power') : chip(b.powered || dd.cov === 'park', b.powered ? 'Power' : 'No power', 'power')}
          ${dd.cov && dd.cov !== 'park' ? chip((b._roadDist ?? 9) <= 2, (b._roadDist ?? 9) <= 2 ? 'Road access' : 'No road', 'road') : ''}${b.fire ? chip(false, 'On fire', 'fire') : ''}</div>`;
        const stats = [];
        if (dd.power) stats.push(['Output', dd.power + ' MW']);
        if (dd.water) stats.push(['Output', dd.water + ' kgal']);
        if (dd.r) stats.push(['Radius', dd.r + ' tiles']);
        stats.push(['Upkeep', money(dd.upkeep) + '/mo']);
        body += `<div class="big">${stats.map(([k, v]) => `<div><div class="cap">${k}</div><div class="v num" style="font-size:18px">${v}</div></div>`).join('')}</div>`;
      }
    } else {
      const zt = w.zoneT[i];
      title = w.terrain[i] === 1 ? 'Water' : w.road[i] ? 'Road' : zt ? `${DENSITY_NAMES[w.zoneD[i]]} ${ZONE_NAMES[zt].toLowerCase()} lot` : w.tree[i] ? 'Woodland' : 'Open land';
      sub = `Tile ${x}, ${y}`;
      if (zt) {
        const why = [];
        if (w.roadDist[i] > 3) why.push('No road within 3 tiles');
        if (!w.power[i]) why.push('No power');
        if (w.zoneD[i] >= 2 && !w.water[i]) why.push('Needs water');
        if (w.demand[zt] <= 0.03) why.push(`Low ${ZONE_NAMES[zt].toLowerCase()} demand`);
        body += `<div class="chips">${why.length ? why.map((t) => chip(false, t, 'warn')).join('') : chip(true, 'Ready to develop', 'check')}</div>`;
      }
      if (w.road[i]) body += meter('Traffic', w.traffic[i], '#e0a526');
    }
    if (w.terrain[i] !== 1) {
      body += meter('Land value', w.landValue[i], '#3fa35a') + meter('Pollution', w.pollution[i], '#8a3a2e') + meter('Crime', w.crime[i], '#b8312f');
      body += meter('Police', w.covPolice[i], '#2f6fb8') + meter('Fire cover', w.covFire[i], '#c25b2b') + meter('Health', w.covHealth[i], '#2f9e6b') + meter('Education', w.covEdu[i], '#7a5bb8');
    }
    if (b && b.kind !== 'zone') body += `<div class="btnrow" style="margin-top:12px"><button class="btn danger" id="inspDemo">${icon('bulldoze')}Demolish</button></div>`;
    $('#insp').innerHTML = `<div class="ih"><div style="flex:1;min-width:0"><h3>${title}</h3><div class="cap" style="margin-top:4px;text-transform:none;letter-spacing:0;font-family:var(--f-ui);font-weight:500;font-size:12.5px">${b && b.kind !== 'zone' ? '' : sub}</div></div><button class="x" id="inspX">${icon('close')}</button></div><div class="ib">${body}</div>`;
    $('#inspX').onclick = () => { this.inspect(null); g.renderer.preview = null; };
    const dm = $('#inspDemo'); if (dm) dm.onclick = () => { g.demolish(b); this.inspect(null); };
    g.renderer.select = b ? b : { x, y, w: 1, h: 1 };
    if (b && b.def && b.def.r) g.renderer.preview = { radius: { cx: b.x + b.w / 2, cy: b.y + b.h / 2, r: b.def.r } };
  }

  // ---------- Panels ----------
  openPanel(id, tab) {
    const p = $('#panel');
    this.panelId = id;
    if (id === 'budget') this.renderBudget(p);
    else if (id === 'city') this.renderCity(p, tab || 'overview');
    else if (id === 'menu') this.renderMenu(p);
    $('#scrim').classList.add('show');
    requestAnimationFrame(() => p.classList.add('show'));
    sfx.open();
    if (id !== 'menu') this.setRailActive(id);
    this.g.panelOpen(true);
  }
  closePanel() {
    $('#panel').classList.remove('show'); $('#scrim').classList.remove('show');
    this.panelId = null; sfx.close(); this.g.panelOpen(false);
    this.syncTool(this.g.tool);
  }
  head(title, tabs, cur) {
    return `<div class="ph"><h2>${title}</h2><button class="x" data-close>${icon('close')}</button></div>
      ${tabs ? `<div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}`;
  }
  wire(p) { p.querySelector('[data-close]').onclick = () => this.closePanel(); }

  renderBudget(p) {
    const g = this.g; const w = g.world;
    const pr = g.sim.projectedMonth();
    const deptCost = (k) => pr.exp[k] || 0;
    const inc = pr.taxR + pr.taxC + pr.taxI;
    const exp = Object.values(pr.exp).reduce((a, b) => a + b, 0) + pr.loans;
    p.innerHTML = this.head('Budget') + `<div class="pb"><div class="grid2">
      <div class="sec"><div class="cap" style="margin-bottom:6px">Tax rates</div>
        ${[1, 2, 3].map((z) => `<div class="sliderrow"><label><i class="dot" style="background:var(--z${'rci'[z - 1]})"></i>${ZONE_NAMES[z]}</label>
          <input type="range" min="0" max="20" step="1" value="${w.taxes[z]}" data-tax="${z}"><span class="val num" id="tv${z}">${w.taxes[z]}%</span></div>`).join('')}
        <div class="cap" style="margin:20px 0 6px">Department funding</div>
        ${DEPTS.map((d) => `<div class="sliderrow"><label>${d.name}<span class="sub num" id="dc_${d.id}">${money(deptCost(d.id))}</span></label>
          <input type="range" min="0" max="120" step="5" value="${w.funding[d.id]}" data-dept="${d.id}"><span class="val num" id="fv_${d.id}">${w.funding[d.id]}%</span></div>`).join('')}
      </div>
      <div class="sec"><div class="cap" style="margin-bottom:6px">Projected month</div>
        <table class="ledger num" id="ledger"></table>
        <div class="cap" style="margin:22px 0 8px">Loans</div>
        <p style="margin:0 0 10px;font-size:13.5px;color:var(--ink-2)">Borrow now, repay over 5 years at 12% total interest.${w.loans.length ? ` Outstanding: <b>${w.loans.length}</b> loan(s), ${money(w.loans.reduce((a, l) => a + l.payment, 0))}/mo.` : ''}</p>
        <div class="btnrow">${[10000, 25000, 50000].map((a) => `<button class="btn ghost" data-loan="${a}">+${money(a)}</button>`).join('')}</div>
        <div class="cap" style="margin:22px 0 8px">Last month</div>
        <table class="ledger num"><tr><td>Income</td><td class="up">${money(w.ledger.lastIncome)}</td></tr><tr><td>Running costs</td><td class="down">${money(-w.ledger.lastExpense)}</td></tr><tr><td>Construction</td><td class="down">${money(-w.ledger.lastBuild)}</td></tr></table>
      </div></div></div>`;
    this.wire(p);
    const ledger = () => {
      const q = g.sim.projectedMonth();
      const i2 = q.taxR + q.taxC + q.taxI; const e2 = Object.values(q.exp).reduce((a, b) => a + b, 0) + q.loans;
      $('#ledger').innerHTML = `<tr><td>Residential taxes</td><td>${money(q.taxR)}</td></tr><tr><td>Commercial taxes</td><td>${money(q.taxC)}</td></tr><tr><td>Industrial taxes</td><td>${money(q.taxI)}</td></tr>
        <tr><td>Services & upkeep</td><td class="down">${money(-(e2 - q.loans))}</td></tr>${q.loans ? `<tr><td>Loan payments</td><td class="down">${money(-q.loans)}</td></tr>` : ''}
        <tr class="tot"><td>Net per month</td><td class="${i2 - e2 >= 0 ? 'up' : 'down'}">${money(i2 - e2)}</td></tr>`;
      for (const d of DEPTS) { const e = $('#dc_' + d.id); if (e) e.textContent = money(q.exp[d.id] || 0); }
    };
    ledger();
    p.querySelectorAll('[data-tax]').forEach((r) => r.oninput = () => { w.taxes[r.dataset.tax] = +r.value; $('#tv' + r.dataset.tax).textContent = r.value + '%'; ledger(); });
    p.querySelectorAll('[data-dept]').forEach((r) => r.oninput = () => { w.funding[r.dataset.dept] = +r.value; $('#fv_' + r.dataset.dept).textContent = r.value + '%'; ledger(); });
    p.querySelectorAll('[data-loan]').forEach((b) => b.onclick = () => {
      if (w.loans.length >= 3) { this.toast('The bank will not lend more than 3 loans at once.', true); return; }
      const a = +b.dataset.loan; w.funds += a; w.loans.push({ amount: a, payment: Math.round(a * 1.12 / 60), months: 60 });
      sfx.cash(); this.toast(`Borrowed ${money(a)}`); this.renderBudget(p); p.classList.add('show');
    });
    void inc; void exp;
  }

  renderCity(p, tab) {
    const g = this.g; const w = g.world; const s = w.stats;
    p.innerHTML = this.head(esc(w.name), [['overview', 'Overview'], ['advisors', 'Advisors'], ['milestones', 'Milestones']], tab) + '<div class="pb" id="cityBody"></div>';
    this.wire(p);
    p.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { this.renderCity(p, b.dataset.tab); p.classList.add('show'); });
    const body = $('#cityBody');
    if (tab === 'overview') {
      const pct = (v) => Math.round(v * 100) + '%';
      const lvl = (v) => (v < 40 ? 'Low' : v < 90 ? 'Moderate' : 'High');
      body.innerHTML = `<div class="kv num">
        <div><div class="cap">Population</div><div class="v">${fmt(s.pop)}</div></div>
        <div><div class="cap">Jobs</div><div class="v">${fmt(s.jobsC + s.jobsI)}</div></div>
        <div><div class="cap">Unemployment</div><div class="v">${pct(s.unemployment)}</div></div>
        <div><div class="cap">Power</div><div class="v ${s.powerDemand > s.powerSupply ? 'down' : ''}">${fmt(s.powerDemand)}<span style="font-size:13px;color:var(--mute)"> / ${fmt(s.powerSupply)} MW</span></div></div>
        <div><div class="cap">Water</div><div class="v ${s.waterDemand > s.waterSupply ? 'down' : ''}">${fmt(s.waterDemand)}<span style="font-size:13px;color:var(--mute)"> / ${fmt(s.waterSupply)} kgal</span></div></div>
        <div><div class="cap">Approval</div><div class="v">${Math.round(s.approval)}%</div></div>
        <div><div class="cap">Education</div><div class="v">${pct(s.edu)}</div></div>
        <div><div class="cap">Crime</div><div class="v">${lvl(s.crimeAvg)}</div></div>
        <div><div class="cap">Pollution</div><div class="v">${lvl(s.pollAvg)}</div></div>
        <div><div class="cap">Transit riders</div><div class="v">${fmt(s.riders || 0)}</div></div>
        <div><div class="cap">Traffic</div><div class="v">${lvl(s.trafficAvg)}</div></div>
        <div><div class="cap">Region link</div><div class="v" style="font-size:16px">${[s.hwyOut && 'Highway', s.railPax && 'Rail', s.railFreight && 'Freight'].filter(Boolean).join(' · ') || (s.outside ? 'Road' : 'None')}</div></div>
      </div>
      <div class="grid2" style="margin-top:20px"><div><div class="cap" style="margin-bottom:8px">Population</div><canvas class="chart" id="chPop" width="640" height="300"></canvas></div>
      <div><div class="cap" style="margin-bottom:8px">Treasury</div><canvas class="chart" id="chFunds" width="640" height="300"></canvas></div></div>`;
      this.chart($('#chPop'), w.history.map((h) => h.pop), '#4caf50');
      this.chart($('#chFunds'), w.history.map((h) => h.funds), '#1c1f22');
    } else if (tab === 'advisors') {
      body.innerHTML = `<div class="advice">${g.sim.advice.map((a) => `<div class="a"><span class="tag ${a.tone}">${a.who}</span><p>${a.text}</p></div>`).join('')}</div>`;
    } else {
      body.innerHTML = `<div class="advice">${MILESTONES.map((m, k) => {
        const unl = Object.values(BUILDINGS).filter((b) => b.unlock === k).map((b) => b.name);
        if (m.density) unl.unshift(`${DENSITY_NAMES[m.density]}-density zoning`);
        const done = w.milestone >= k;
        return `<div class="a" style="${done ? '' : 'opacity:.65'}"><span class="tag ${done ? 'good' : ''}">${done ? 'Reached' : fmt(m.pop)}</span><p><b>${m.name}</b>${m.grant ? ` · grant ${money(m.grant)}` : ''}<br><span style="color:var(--ink-2)">${unl.join(', ') || 'Starting tools'}</span></p></div>`;
      }).join('')}</div>`;
    }
  }

  chart(cv, data, col) {
    const x = cv.getContext('2d'); const W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H);
    if (data.length < 2) { x.fillStyle = '#86837a'; x.font = '600 24px system-ui'; x.textAlign = 'center'; x.fillText('Data appears after a couple of months', W / 2, H / 2); return; }
    const min = Math.min(0, ...data), max = Math.max(...data, 1);
    const px = (k) => 20 + k / (data.length - 1) * (W - 40), py = (v) => H - 24 - (v - min) / (max - min || 1) * (H - 56);
    x.strokeStyle = 'rgba(28,31,34,.1)'; x.lineWidth = 2;
    for (let k = 0; k <= 3; k++) { const yy = 24 + k * (H - 48) / 3; x.beginPath(); x.moveTo(20, yy); x.lineTo(W - 20, yy); x.stroke(); }
    x.beginPath(); data.forEach((v, k) => (k ? x.lineTo(px(k), py(v)) : x.moveTo(px(k), py(v))));
    x.strokeStyle = col; x.lineWidth = 4; x.lineJoin = 'round'; x.stroke();
    x.lineTo(px(data.length - 1), H - 24); x.lineTo(px(0), H - 24); x.closePath();
    x.globalAlpha = 0.12; x.fillStyle = col; x.fill(); x.globalAlpha = 1;
    x.fillStyle = '#474a4c'; x.font = '600 22px system-ui'; x.textAlign = 'right';
    x.fillText(fmt(max), W - 20, 20);
  }

  renderMenu(p) {
    const g = this.g; const st = g.settings;
    const tg = (k, label, sub) => `<label class="toggle"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span><span class="sw"><input type="checkbox" data-set="${k}" ${st[k] ? 'checked' : ''}><i></i></span></label>`;
    p.innerHTML = this.head(esc(g.world.name)) + `<div class="pb">
      <div class="btnrow" style="margin-bottom:12px"><button class="btn" id="mSave">${icon('save')}Save now</button><button class="btn ghost" id="mExport">${icon('export')}Export file</button><button class="btn ghost" id="mHome">${icon('home')}Save & exit</button></div>
      <p style="margin:0 0 8px;font-size:13px;color:var(--ink-2)" id="mSaved">${g.lastSaved ? 'Last saved ' + new Date(g.lastSaved).toLocaleTimeString() : 'Not saved yet'} · autosaves every ${st.autosave}s and when you leave the app.</p>
      ${tg('sound', 'Sound effects')}
      ${tg('dayNight', 'Day & night cycle', 'Lights come on at dusk. Turn off for permanent daylight.')}
      ${tg('confirmBuild', 'Confirm placements', 'Shows ✓ / ✕ before placing a building with touch.')}
      ${tg('disasters', 'Building fires', 'Random fires; fire stations keep them in check.')}
      <label class="toggle"><span>Autosave interval</span><span class="seg" id="segAuto">${[30, 60, 120, 300].map((v) => `<button data-v="${v}" class="${st.autosave === v ? 'on' : ''}">${v < 60 ? v + 's' : v / 60 + 'm'}</button>`).join('')}</span></label>
      <label class="toggle"><span>Graphics<small>Lower uses fewer effects for older devices.</small></span><span class="seg" id="segQ">${['high', 'low'].map((v) => `<button data-v="${v}" class="${st.quality === v ? 'on' : ''}">${v === 'high' ? 'High' : 'Battery saver'}</button>`).join('')}</span></label>
    </div>`;
    this.wire(p);
    $('#mSave').onclick = async () => { await g.save(); $('#mSaved').textContent = 'Saved ' + new Date().toLocaleTimeString(); this.toast('City saved'); };
    $('#mExport').onclick = () => g.exportFile();
    $('#mHome').onclick = () => g.exit();
    p.querySelectorAll('[data-set]').forEach((c) => c.onchange = () => { st[c.dataset.set] = c.checked; g.applySettings(); this.syncDN(); });
    p.querySelectorAll('#segAuto button').forEach((b) => b.onclick = () => { st.autosave = +b.dataset.v; g.applySettings(); this.renderMenu(p); p.classList.add('show'); });
    p.querySelectorAll('#segQ button').forEach((b) => b.onclick = () => { st.quality = b.dataset.v; g.applySettings(); this.renderMenu(p); p.classList.add('show'); });
  }

  milestone(m) {
    const p = $('#panel');
    const unl = Object.values(BUILDINGS).filter((b) => b.unlock === m.index).map((b) => b.name);
    const def = MILESTONES[m.index];
    if (def.density) unl.unshift(`${DENSITY_NAMES[def.density]}-density zoning`);
    p.innerHTML = `<div class="ms"><div class="seal">${icon('landmark')}</div><div class="cap">${fmt(def.pop)} residents</div><h2>${def.name}</h2>
      <p>Your settlement has grown into a ${def.name.toLowerCase()}.${def.grant ? ` The region awards a development grant of <b>${money(def.grant)}</b>.` : ''}</p>
      ${unl.length ? `<div class="cap" style="margin-top:16px">Now available</div><ul>${unl.map((u) => `<li>${u}</li>`).join('')}</ul>` : '<div style="height:16px"></div>'}
      <button class="btn" data-close>Continue building</button></div>`;
    p.querySelector('[data-close]').onclick = () => this.closePanel();
    $('#scrim').classList.add('show');
    requestAnimationFrame(() => p.classList.add('show'));
    this.panelId = 'milestone';
    this.g.panelOpen(true);
    this.refreshStatic();
    if (this.drawerId && this.drawerId !== 'data') this.openDrawer(this.drawerId);
  }
}
