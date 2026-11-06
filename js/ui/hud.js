// DOM-based heads-up display and panels.
import { icon } from './icons.js';
import { BUILDINGS, MILESTONES, ZONE_COST, DEPTS, DAYS_PER_MONTH,
  ZONE_CAP, ROAD_COST, PLINE_COST, TREE_COST, HIGHWAY_COST, RAIL_COST } from '../data/defs.js';
import { OVERLAYS } from '../render/renderer.js';
import { HW, HH } from '../render/art.js';
import { describeBuilding } from '../world/sim.js';
import { sfx } from '../audio.js';
import { t, fmt as fmtL, money as moneyL, monthName, zoneLabel, zoneName, getLang } from '../i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const money = moneyL;
export const fmt = fmtL;

export function dateStr(day) {
  const m = Math.floor(day / DAYS_PER_MONTH);
  return `${monthName(m)} ${2030 + Math.floor(m / 12)}`;
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
const SIMPLE = {
  pline: ['Power line', PLINE_COST, 'Drag to place'],
  trees: ['Plant trees', TREE_COST, 'Drag to place'],
  road: ['Road', ROAD_COST, 'Drag to draw. Power and water run along roads.'],
  highway: ['Highway', HIGHWAY_COST, 'Fast four-lane road. Reach the map edge for regional traffic.'],
  rail: ['Railway', RAIL_COST, 'Drag to lay track. Stations need a line to another station or the map edge.'],
  raise: ['Raise land', null, 'Tap or drag to lift the ground one level'],
  lower: ['Lower land', null, 'Tap or drag to dig down one level'],
  level: ['Level land', null, 'Drag from a tile to flatten the area to its height'],
};
const RCI = () => [t('R'), t('C'), t('I')];
const densityUnlock = (zd) => MILESTONES.find((m) => (m.density || 0) >= zd);
const densityZoningName = (zd) => t(['', 'Low-density zoning', 'Medium-density zoning', 'High-density zoning'][zd]);

export class Hud {
  constructor(game) {
    this.g = game;
    this.drawerId = null;
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
          <div class="stat"><span class="cap">${t('Date')}</span><span class="v num" id="sDate"></span></div>
          <div class="stat"><span class="cap">${t('Population')}</span><span class="v num" id="sPop"></span></div>
          <div class="stat"><span class="cap">${t('Treasury')}</span><span class="v num" id="sFunds"></span></div>
          <div class="stat hide-s"><span class="cap">${t('Approval')}</span><span class="v num" id="sAppr"></span></div>
        </div>
        <div class="plate rci" title="${t('Demand')}">
          ${[1, 2, 3].map((z) => `<div class="bar"><div class="track"><div class="fill" id="d${z}"></div></div><span class="lbl" style="color:var(--z${'rci'[z - 1]})">${RCI()[z - 1]}</span></div>`).join('')}
        </div>
        <div class="spacer"></div>
        <div class="plate speed" id="speed">
          <button data-s="0" aria-label="${t('Pause')}">${icon('pause')}</button>
          <button data-s="1" aria-label="${t('Normal speed')}">${icon('play')}</button>
          <button data-s="2" aria-label="${t('Fast')}">${icon('ff')}</button>
          <button data-s="3" aria-label="${t('Fastest')}">${icon('fff')}</button>
        </div>
        <button class="plate iconbtn" id="menuBtn" aria-label="${t('Menu')}">${icon('menu')}</button>
      </div>
      <nav id="rail"><div class="brand">${LOGO}</div></nav>
      <div id="drawer" class="plate"></div>
      <div id="tip"></div>
      <div id="confirm"><button class="no" aria-label="${t('Cancel')}">${icon('close')}</button><button class="yes" aria-label="${t('Build')}">${icon('check')}</button></div>
      <div id="ticker" class="plate"><span class="who" id="tWho"></span><span class="msg" id="tMsg"></span><button id="tNext" aria-label="${t('Advisors')}">${icon('advisor')}</button></div>
      <div id="mm" class="plate"><canvas id="mmc" width="400" height="224"></canvas>
        <div class="row"><button id="zOut" aria-label="${t('Zoom out')}">${icon('minus')}</button><button id="zIn" aria-label="${t('Zoom in')}">${icon('plus')}</button>
        <button id="dn" aria-label="${t('Day and night')}">${icon('sun')}</button><button id="mmToggle" aria-label="${t('Toggle minimap')}">${icon('minimap')}</button></div></div>
      <div id="legend" class="plate"></div>
      <div id="insp" class="plate"></div>
      <div id="toasts"></div>
      <div class="scrim" id="scrim"></div>
      <div class="panel" id="panel"></div>
    `);
    const rail = $('#rail');
    for (const c of CATS) {
      if (c.sep) { rail.appendChild(el('div', 'rsep')); continue; }
      const b = el('button', 'rbtn', `${icon(c.icon)}<span>${t(c.name)}</span>`);
      b.dataset.id = c.id; b.setAttribute('aria-label', t(c.name));
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
    $('#cityRank').textContent = t(MILESTONES[w.milestone].name);
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

  syncTool(tl) {
    const map = { inspect: 'inspect', bulldoze: 'bulldoze', road: 'transport', rail: 'transport', terraform: 'terrain', zone: 'zones', dezone: 'zones', pline: 'utilities', trees: 'parks' };
    let id = map[tl.kind];
    if (tl.kind === 'build') { const cat = BUILDINGS[tl.key].cat; id = cat === 'transit' ? 'transport' : cat === 'power' || cat === 'water' ? 'utilities' : cat === 'parks' || cat === 'landmark' ? 'parks' : 'services'; }
    if (this.drawerId === 'data') id = 'data';
    this.setRailActive(id);
    document.querySelectorAll('#drawer .card').forEach((c) => c.classList.toggle('on', c.dataset.key === this.toolKey(tl)));
    this.hideConfirm();
  }
  toolKey(tl) {
    if (tl.kind === 'zone') return `z${tl.zt}${tl.zd}`;
    if (tl.kind === 'build') return tl.key;
    if (tl.kind === 'road') return tl.type === 2 ? 'highway' : 'road';
    if (tl.kind === 'terraform') return tl.op;
    return tl.kind;
  }

  // ---------- Drawer ----------
  openDrawer(id) {
    const d = $('#drawer'); const g = this.g; const w = g.world;
    this.drawerId = id;
    d.innerHTML = '';
    const head = el('div', 'dhead');
    const cards = el('div', 'cards');
    if (id === 'zones') {
      head.innerHTML = `<span class="dtitle">${t('Zoning')}</span><span class="cap">${t('Drag to paint · lots need a road within 3 tiles')}</span>`;
      for (const zt of [1, 2, 3]) {
        const grp = el('div', 'zgroup');
        for (const zd of [1, 2, 3]) {
          const unlocked = zd === 1 || MILESTONES.slice(0, w.milestone + 1).some((m) => (m.density || 0) >= zd);
          const col = ['', 'var(--zr)', 'var(--zc)', 'var(--zi)'][zt];
          const c = el('button', 'card zcard' + (unlocked ? '' : ' locked'), `
            <div class="zsw" style="background:${col}">${icon(['', 'res', 'com', 'ind'][zt])}
              <span class="dens">${[1, 2, 3].map((k) => `<i class="${k <= zd ? '' : 'off'}"></i>`).join('')}</span></div>
            <div class="t">${zoneLabel(zt, zd)}</div><div class="c num">${t('{c}/tile', { c: money(w.cost(ZONE_COST[zd])) })}</div>
            ${unlocked ? '' : `<span class="lockb">${icon('lock')}${t(densityUnlock(zd).name)}</span>`}`);
          c.dataset.key = `z${zt}${zd}`;
          c.onclick = () => {
            if (!unlocked) { this.toast(t('Unlocks at {m}', { m: t(densityUnlock(zd).name) }), true); sfx.error(); return; }
            sfx.tap(); g.setTool({ kind: 'zone', zt, zd });
          };
          grp.appendChild(c);
        }
        cards.appendChild(grp);
      }
      const dz = el('button', 'card zcard', `<div class="zsw" style="background:#8a8781">${icon('close')}</div><div class="t">${t('Remove zoning')}</div><div class="c">${t('Free')}</div>`);
      dz.dataset.key = 'dezone'; dz.onclick = () => { sfx.tap(); g.setTool({ kind: 'dezone' }); };
      cards.appendChild(dz);
    } else if (id === 'data') {
      head.innerHTML = `<span class="dtitle">${t('Data views')}</span><span class="cap">${t('Tap again to hide')}</span>`;
      for (const [k, o] of Object.entries(OVERLAYS)) {
        const c = el('button', 'card ovcard', `<div class="osw" style="background:${this.rampCss(k)}"></div><div class="t">${t(o.name)}</div>`);
        c.dataset.key = 'ov' + k;
        c.onclick = () => { sfx.tap(); g.setOverlay(g.renderer.overlay === k ? null : k); this.syncOverlay(); };
        cards.appendChild(c);
      }
    } else {
      const def = DRAWERS[id];
      head.innerHTML = `<span class="dtitle">${t(def.title)}</span><span class="cap" id="dhint"></span>`;
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

  rampCss(k) {
    const o = OVERLAYS[k];
    if (o.ramp) return `linear-gradient(90deg, ${o.ramp.join(',')})`;
    return k === 'power' ? 'linear-gradient(90deg,#c8423b 50%,#f2c94c 50%)' : 'linear-gradient(90deg,#c8423b 50%,#4aa8d8 50%)';
  }

  syncOverlay() {
    const k = this.g.renderer.overlay;
    document.querySelectorAll('#drawer .ovcard').forEach((c) => c.classList.toggle('on', c.dataset.key === 'ov' + k));
    const lg = $('#legend');
    if (!k) { lg.classList.remove('show'); return; }
    const o = OVERLAYS[k];
    lg.innerHTML = `<div class="cap">${t('Data view')}</div><div style="font-weight:700;font-size:17px;margin-top:2px">${t(o.name)}</div><div class="bar" style="background:${this.rampCss(k)}"></div><div class="ends"><span>${t(o.legend[0])}</span><span>${t(o.legend[1])}</span></div>`;
    lg.classList.add('show');
  }

  itemCard(key) {
    const g = this.g; const w = g.world;
    let name, cost, unlock = 0, extra = '';
    if (SIMPLE[key]) {
      name = t(SIMPLE[key][0]);
      cost = SIMPLE[key][1] != null ? t('{c}/tile', { c: money(w.cost(SIMPLE[key][1])) }) : t('{c}/step', { c: money(w.cost(20)) });
    } else {
      const d = BUILDINGS[key]; name = t(d.name); cost = money(w.cost(d.cost)); unlock = d.unlock;
      if (d.power) extra = ` · ${d.power} MW`; if (d.water) extra = ` · ${fmt(d.water)} ${t('kgal')}`;
    }
    const locked = unlock > w.milestone;
    const c = el('button', 'card' + (locked ? ' locked' : ''), `<canvas width="200" height="152"></canvas><div class="t">${name}</div><div class="c num">${cost}${extra}</div>
      ${locked ? `<span class="lockb">${icon('lock')}${t(MILESTONES[unlock].name)}</span>` : ''}`);
    c.dataset.key = key;
    this.paintThumb(c.querySelector('canvas'), key);
    c.onclick = () => {
      if (locked) { this.toast(t('{n} unlocks at {m} ({p} residents)', { n: name, m: t(MILESTONES[unlock].name), p: fmt(MILESTONES[unlock].pop) }), true); sfx.error(); return; }
      sfx.tap();
      if (key === 'pline') g.setTool({ kind: 'pline' });
      else if (key === 'trees') g.setTool({ kind: 'trees' });
      else if (key === 'road') g.setTool({ kind: 'road', type: 1 });
      else if (key === 'highway') g.setTool({ kind: 'road', type: 2 });
      else if (key === 'rail') g.setTool({ kind: 'rail' });
      else if (key === 'raise' || key === 'lower' || key === 'level') g.setTool({ kind: 'terraform', op: key });
      else g.setTool({ kind: 'build', key });
      const hint = $('#dhint'); if (hint) hint.textContent = SIMPLE[key] ? t(SIMPLE[key][2]) : t(BUILDINGS[key].desc);
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
    who.textContent = t(item.who || 'News');
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
    const n = el('div', 'toast' + (bad ? ' bad' : ''));
    n.textContent = text;
    $('#toasts').appendChild(n);
    setTimeout(() => n.remove(), 3000);
  }

  // ---------- Tip & confirm ----------
  tip(x, y, html, bad) {
    const n = $('#tip');
    if (!html) { n.classList.remove('show'); return; }
    n.innerHTML = html; n.classList.add('show'); n.classList.toggle('bad', !!bad);
    n.style.left = x + 'px'; n.style.top = Math.max(100, y - 40) + 'px';
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
    const meter = (label, v, col) => `<div class="meter"><span>${t(label)}</span><span class="tr"><i style="width:${Math.round(v / 2.55)}%;background:${col}"></i></span><span class="num" style="text-align:right">${Math.round(v / 2.55)}</span></div>`;
    const chip = (ok, label, ic) => `<span class="chip ${ok ? 'ok' : 'no'}">${icon(ic)}${label}</span>`;
    let title, sub, body = '';
    if (b) {
      const d = describeBuilding(w, b);
      title = d.title; sub = d.sub;
      if (b.kind === 'zone') {
        const cap = ZONE_CAP[b.zt][b.tier];
        body += `<div class="chips">${chip(b.powered, b.powered ? t('Power') : t('No power'), 'power')}${chip(b.watered || b.tier < 3, b.watered ? t('Water') : (b.tier < 3 ? t('Well') : t('No water')), 'water')}
          ${b.abandoned ? chip(false, t('Abandoned'), 'warn') : ''}${b.fire ? chip(false, t('On fire'), 'fire') : ''}${b.built < 1 ? chip(true, t('Under construction'), 'info') : ''}</div>`;
        body += `<div class="big"><div><div class="cap">${b.zt === 1 ? t('Residents') : t('Jobs')}</div><div class="v num">${fmt(b.zt === 1 ? b.pop : b.jobs)}<span style="font-size:13px;color:var(--mute)"> / ${fmt(cap)}</span></div></div>
          <div><div class="cap">${t('Desirability')}</div><div class="v num">${Math.round(g.sim.desirability(i, b.zt) / 2.55)}</div></div></div>`;
      } else if (b.kind !== 'rubble') {
        const dd = b.def;
        const transit = dd.cat === 'transit';
        let status = '';
        if (dd.power) status = chip(b._linked, b._linked ? t('Connected to grid') : t('Not connected — add a road or power line'), 'power');
        else status = chip(b.powered || dd.cov === 'park', b.powered ? t('Power') : t('No power'), 'power');
        if (transit) status += chip(!!b.active, b.active ? t('In service') : t('Not in service'), b.active ? 'check' : 'warn');
        body += `<p class="desc">${t(dd.desc)}</p><div class="chips">${status}
          ${dd.cov && dd.cov !== 'park' && !transit ? chip((b._roadDist ?? 9) <= 2, (b._roadDist ?? 9) <= 2 ? t('Road access') : t('No road'), 'road') : ''}${b.fire ? chip(false, t('On fire'), 'fire') : ''}</div>`;
        const stats = [];
        if (dd.power) stats.push([t('Output'), dd.power + ' MW']);
        if (dd.water) stats.push([t('Output'), fmt(dd.water) + ' ' + t('kgal')]);
        if (dd.r) stats.push([t('Radius'), t('{n} tiles', { n: dd.r })]);
        stats.push([t('Upkeep'), t('{c}/mo', { c: money(dd.upkeep) })]);
        body += `<div class="big">${stats.map(([k, v]) => `<div><div class="cap">${k}</div><div class="v num" style="font-size:18px">${v}</div></div>`).join('')}</div>`;
      }
    } else {
      const zt = w.zoneT[i];
      title = w.terrain[i] === 1 ? t('Water') : w.rail[i] ? t('Railway') : w.road[i] === 2 ? t('Highway') : w.road[i] ? t('Road')
        : zt ? t('{zone} lot', { zone: zoneLabel(zt, w.zoneD[i]) }) : w.tree[i] ? t('Woodland') : t('Open land');
      sub = t('Tile {x}, {y} · height {h}', { x, y, h: Math.round(w.tileAvgH(x, y)) });
      if (zt) {
        const why = [];
        if (w.roadDist[i] > 3) why.push(t('No road within 3 tiles'));
        if (!w.power[i]) why.push(t('No power'));
        if (w.zoneD[i] >= 2 && !w.water[i]) why.push(t('Needs water'));
        if (w.demand[zt] <= 0.03) why.push(t('Low demand for {z}', { z: zoneName(zt) }));
        body += `<div class="chips">${why.length ? why.map((r) => chip(false, r, 'warn')).join('') : chip(true, t('Ready to develop'), 'check')}</div>`;
      }
      if (w.road[i]) body += meter('Traffic', w.traffic[i], '#e0a526');
    }
    if (w.terrain[i] !== 1) {
      body += meter('Land value', w.landValue[i], '#3fa35a') + meter('Pollution', w.pollution[i], '#8a3a2e') + meter('Crime', w.crime[i], '#b8312f');
      body += meter('Police', w.covPolice[i], '#2f6fb8') + meter('Fire cover', w.covFire[i], '#c25b2b') + meter('Health', w.covHealth[i], '#2f9e6b')
        + meter('Education', w.covEdu[i], '#7a5bb8') + meter('Transit', w.covTransit[i], '#b8862f');
    }
    if (b && b.kind !== 'zone') body += `<div class="btnrow" style="margin-top:12px"><button class="btn danger" id="inspDemo">${icon('bulldoze')}${t('Demolish')}</button></div>`;
    const showSub = !(b && b.kind !== 'zone');
    $('#insp').innerHTML = `<div class="ih"><div style="flex:1;min-width:0"><h3>${title}</h3><div class="cap" style="margin-top:4px;text-transform:none;letter-spacing:0;font-family:var(--f-ui);font-weight:500;font-size:12.5px">${showSub ? sub : ''}</div></div><button class="x" id="inspX">${icon('close')}</button></div><div class="ib">${body}</div>`;
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
    return `<div class="ph"><h2>${title}</h2><button class="x" data-close aria-label="${t('Close')}">${icon('close')}</button></div>
      ${tabs ? `<div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('')}</div>` : ''}`;
  }
  wire(p) { p.querySelector('[data-close]').onclick = () => this.closePanel(); }

  renderBudget(p) {
    const g = this.g; const w = g.world;
    const pr = g.sim.projectedMonth();
    const deptCost = (k) => pr.exp[k] || 0;
    const owed = w.loans.reduce((a, l) => a + l.payment, 0);
    p.innerHTML = this.head(t('Budget')) + `<div class="pb"><div class="grid2">
      <div class="sec"><div class="cap" style="margin-bottom:6px">${t('Tax rates')}</div>
        ${[1, 2, 3].map((z) => `<div class="sliderrow"><label><i class="dot" style="background:var(--z${'rci'[z - 1]})"></i>${zoneName(z)}</label>
          <input type="range" min="0" max="20" step="1" value="${w.taxes[z]}" data-tax="${z}"><span class="val num" id="tv${z}">${w.taxes[z]}%</span></div>`).join('')}
        <div class="cap" style="margin:20px 0 6px">${t('Department funding')}</div>
        ${DEPTS.map((d) => `<div class="sliderrow"><label>${t(d.name)}<span class="sub num" id="dc_${d.id}">${money(deptCost(d.id))}</span></label>
          <input type="range" min="0" max="120" step="5" value="${w.funding[d.id] ?? 100}" data-dept="${d.id}"><span class="val num" id="fv_${d.id}">${w.funding[d.id] ?? 100}%</span></div>`).join('')}
      </div>
      <div class="sec"><div class="cap" style="margin-bottom:6px">${t('Projected month')}</div>
        <table class="ledger num" id="ledger"></table>
        <div class="cap" style="margin:22px 0 8px">${t('Loans')}</div>
        <p style="margin:0 0 10px;font-size:13.5px;color:var(--ink-2)">${t('Borrow now, repay over 5 years at 12% total interest.')}${w.loans.length ? ' ' + t('Outstanding: {n} loan(s), {c}/mo.', { n: w.loans.length, c: money(owed) }) : ''}</p>
        <div class="btnrow">${[10000, 25000, 50000].map((a) => `<button class="btn ghost" data-loan="${a}">+${money(a)}</button>`).join('')}</div>
        <div class="cap" style="margin:22px 0 8px">${t('Last month')}</div>
        <table class="ledger num"><tr><td>${t('Income')}</td><td class="up">${money(w.ledger.lastIncome)}</td></tr><tr><td>${t('Running costs')}</td><td class="down">${money(-w.ledger.lastExpense)}</td></tr><tr><td>${t('Construction')}</td><td class="down">${money(-w.ledger.lastBuild)}</td></tr></table>
      </div></div></div>`;
    this.wire(p);
    const ledger = () => {
      const q = g.sim.projectedMonth();
      const i2 = q.taxR + q.taxC + q.taxI; const e2 = Object.values(q.exp).reduce((a, b2) => a + b2, 0) + q.loans;
      $('#ledger').innerHTML = `<tr><td>${t('Residential taxes')}</td><td>${money(q.taxR)}</td></tr><tr><td>${t('Commercial taxes')}</td><td>${money(q.taxC)}</td></tr><tr><td>${t('Industrial taxes')}</td><td>${money(q.taxI)}</td></tr>
        <tr><td>${t('Services & upkeep')}</td><td class="down">${money(-(e2 - q.loans))}</td></tr>${q.loans ? `<tr><td>${t('Loan payments')}</td><td class="down">${money(-q.loans)}</td></tr>` : ''}
        <tr class="tot"><td>${t('Net per month')}</td><td class="${i2 - e2 >= 0 ? 'up' : 'down'}">${money(i2 - e2)}</td></tr>`;
      for (const d of DEPTS) { const e = $('#dc_' + d.id); if (e) e.textContent = money(q.exp[d.id] || 0); }
    };
    ledger();
    p.querySelectorAll('[data-tax]').forEach((r) => r.oninput = () => { w.taxes[r.dataset.tax] = +r.value; $('#tv' + r.dataset.tax).textContent = r.value + '%'; ledger(); });
    p.querySelectorAll('[data-dept]').forEach((r) => r.oninput = () => { w.funding[r.dataset.dept] = +r.value; $('#fv_' + r.dataset.dept).textContent = r.value + '%'; ledger(); });
    p.querySelectorAll('[data-loan]').forEach((b) => b.onclick = () => {
      if (w.loans.length >= 3) { this.toast(t('The bank will not lend more than 3 loans at once.'), true); return; }
      const a = +b.dataset.loan; w.funds += a; w.loans.push({ amount: a, payment: Math.round(a * 1.12 / 60), months: 60 });
      sfx.cash(); this.toast(t('Borrowed {c}', { c: money(a) })); this.renderBudget(p); p.classList.add('show');
    });
  }

  renderCity(p, tab) {
    const g = this.g; const w = g.world; const s = w.stats;
    p.innerHTML = this.head(esc(w.name), [['overview', t('Overview')], ['advisors', t('Advisors')], ['milestones', t('Milestones')]], tab) + '<div class="pb" id="cityBody"></div>';
    this.wire(p);
    p.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { this.renderCity(p, b.dataset.tab); p.classList.add('show'); });
    const body = $('#cityBody');
    if (tab === 'overview') {
      const pct = (v) => Math.round(v * 100) + '%';
      const lvl = (v) => (v < 40 ? t('Low') : v < 90 ? t('Moderate') : t('High'));
      const link = [s.hwyOut && t('Highway'), s.railPax && t('Rail'), s.railFreight && t('Freight')].filter(Boolean).join(' · ') || (s.outside ? t('Road') : t('None'));
      const kv = (label, v, cls = '') => `<div><div class="cap">${t(label)}</div><div class="v ${cls}">${v}</div></div>`;
      body.innerHTML = `<div class="kv num">
        ${kv('Population', fmt(s.pop))}${kv('Jobs', fmt(s.jobsC + s.jobsI))}${kv('Unemployment', pct(s.unemployment))}
        ${kv('Power', `${fmt(s.powerDemand)}<span style="font-size:13px;color:var(--mute)"> / ${fmt(s.powerSupply)} MW</span>`, s.powerDemand > s.powerSupply ? 'down' : '')}
        ${kv('Water', `${fmt(s.waterDemand)}<span style="font-size:13px;color:var(--mute)"> / ${fmt(s.waterSupply)} ${t('kgal')}</span>`, s.waterDemand > s.waterSupply ? 'down' : '')}
        ${kv('Approval', Math.round(s.approval) + '%')}${kv('Education', pct(s.edu))}${kv('Crime', lvl(s.crimeAvg))}${kv('Pollution', lvl(s.pollAvg))}
        ${kv('Transit riders', fmt(s.riders || 0))}${kv('Traffic', lvl(s.trafficAvg))}
        <div><div class="cap">${t('Region link')}</div><div class="v" style="font-size:16px">${link}</div></div>
      </div>
      <div class="grid2" style="margin-top:20px"><div><div class="cap" style="margin-bottom:8px">${t('Population')}</div><canvas class="chart" id="chPop" width="640" height="300"></canvas></div>
      <div><div class="cap" style="margin-bottom:8px">${t('Treasury')}</div><canvas class="chart" id="chFunds" width="640" height="300"></canvas></div></div>`;
      this.chart($('#chPop'), w.history.map((h) => h.pop), '#4caf50');
      this.chart($('#chFunds'), w.history.map((h) => h.funds), '#1c1f22');
    } else if (tab === 'advisors') {
      body.innerHTML = `<div class="advice">${g.sim.advice.map((a) => `<div class="a"><span class="tag ${a.tone}">${t(a.who)}</span><p>${a.text}</p></div>`).join('')}</div>`;
    } else {
      body.innerHTML = `<div class="advice">${MILESTONES.map((m, k) => {
        const unl = Object.values(BUILDINGS).filter((b) => b.unlock === k).map((b) => t(b.name));
        if (m.density) unl.unshift(densityZoningName(m.density));
        const done = w.milestone >= k;
        return `<div class="a" style="${done ? '' : 'opacity:.65'}"><span class="tag ${done ? 'good' : ''}">${done ? t('Reached') : fmt(m.pop)}</span><p><b>${t(m.name)}</b>${m.grant ? ' · ' + t('grant {c}', { c: money(m.grant) }) : ''}<br><span style="color:var(--ink-2)">${unl.join(', ') || t('Starting tools')}</span></p></div>`;
      }).join('')}</div>`;
    }
  }

  chart(cv, data, col) {
    const x = cv.getContext('2d'); const W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H);
    if (data.length < 2) { x.fillStyle = '#86837a'; x.font = '600 24px system-ui'; x.textAlign = 'center'; x.fillText(t('Data appears after a couple of months'), W / 2, H / 2); return; }
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
    const tg = (k, label, sub) => `<label class="toggle"><span>${t(label)}${sub ? `<small>${t(sub)}</small>` : ''}</span><span class="sw"><input type="checkbox" data-set="${k}" ${st[k] ? 'checked' : ''}><i></i></span></label>`;
    const savedTxt = g.lastSaved ? t('Last saved {t}', { t: new Date(g.lastSaved).toLocaleTimeString(getLang()) }) : t('Not saved yet');
    const langNow = st.lang || 'auto';
    p.innerHTML = this.head(esc(g.world.name)) + `<div class="pb">
      <div class="btnrow" style="margin-bottom:12px"><button class="btn" id="mSave">${icon('save')}${t('Save now')}</button><button class="btn ghost" id="mExport">${icon('export')}${t('Export file')}</button><button class="btn ghost" id="mHome">${icon('home')}${t('Save & exit')}</button></div>
      <p style="margin:0 0 8px;font-size:13px;color:var(--ink-2)" id="mSaved">${savedTxt} · ${t('autosaves every {s}s and when you leave the app.', { s: st.autosave })}</p>
      <label class="toggle"><span>${t('Language')}</span><span class="seg" id="segLang">${[['auto', t('Automatic')], ['en', 'English'], ['de', 'Deutsch']].map(([v, n]) => `<button data-v="${v}" class="${langNow === v ? 'on' : ''}">${n}</button>`).join('')}</span></label>
      ${tg('sound', 'Sound effects')}
      ${tg('dayNight', 'Day & night cycle', 'Lights come on at dusk. Turn off for permanent daylight.')}
      ${tg('confirmBuild', 'Confirm placements', 'Shows ✓ / ✕ before placing a building with touch.')}
      ${tg('disasters', 'Building fires', 'Random fires; fire stations keep them in check.')}
      <label class="toggle"><span>${t('Autosave interval')}</span><span class="seg" id="segAuto">${[30, 60, 120, 300].map((v) => `<button data-v="${v}" class="${st.autosave === v ? 'on' : ''}">${v < 60 ? v + 's' : v / 60 + ' min'}</button>`).join('')}</span></label>
      <label class="toggle"><span>${t('Graphics')}<small>${t('Lower uses fewer effects for older devices.')}</small></span><span class="seg" id="segQ">${['high', 'low'].map((v) => `<button data-v="${v}" class="${st.quality === v ? 'on' : ''}">${v === 'high' ? t('High') : t('Battery saver')}</button>`).join('')}</span></label>
    </div>`;
    this.wire(p);
    $('#mSave').onclick = async () => { await g.save(); $('#mSaved').textContent = t('Saved {t}', { t: new Date().toLocaleTimeString(getLang()) }); this.toast(t('City saved')); };
    $('#mExport').onclick = () => g.exportFile();
    $('#mHome').onclick = () => g.exit();
    p.querySelectorAll('[data-set]').forEach((c) => c.onchange = () => { st[c.dataset.set] = c.checked; g.applySettings(); this.syncDN(); });
    p.querySelectorAll('#segAuto button').forEach((b) => b.onclick = () => { st.autosave = +b.dataset.v; g.applySettings(); this.renderMenu(p); p.classList.add('show'); });
    p.querySelectorAll('#segQ button').forEach((b) => b.onclick = () => { st.quality = b.dataset.v; g.applySettings(); this.renderMenu(p); p.classList.add('show'); });
    p.querySelectorAll('#segLang button').forEach((b) => b.onclick = async () => {
      if ((st.lang || 'auto') === b.dataset.v) return;
      st.lang = b.dataset.v; g.applySettings();
      await g.save(); location.reload(); // rebuild every label in the new language
    });
  }

  milestone(m) {
    const p = $('#panel');
    const unl = Object.values(BUILDINGS).filter((b) => b.unlock === m.index).map((b) => t(b.name));
    const def = MILESTONES[m.index];
    if (def.density) unl.unshift(densityZoningName(def.density));
    p.innerHTML = `<div class="ms"><div class="seal">${icon('landmark')}</div><div class="cap">${t('{p} residents', { p: fmt(def.pop) })}</div><h2>${t(def.name)}</h2>
      <p>${t('Your settlement has grown into a new rank: {r}.', { r: t(def.name) })}${def.grant ? ' ' + t('The region awards a development grant of {c}.', { c: `<b>${money(def.grant)}</b>` }) : ''}</p>
      ${unl.length ? `<div class="cap" style="margin-top:16px">${t('Now available')}</div><ul>${unl.map((u) => `<li>${u}</li>`).join('')}</ul>` : '<div style="height:16px"></div>'}
      <button class="btn" data-close>${t('Continue building')}</button></div>`;
    p.querySelector('[data-close]').onclick = () => this.closePanel();
    $('#scrim').classList.add('show');
    requestAnimationFrame(() => p.classList.add('show'));
    this.panelId = 'milestone';
    this.g.panelOpen(true);
    this.refreshStatic();
    if (this.drawerId && this.drawerId !== 'data') this.openDrawer(this.drawerId);
  }
}
