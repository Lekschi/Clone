// Lena, the town planner: guides new players step by step with speech bubbles, highlights what
// to tap, points at buildings in the city, and later drops in with occasional tips.
import { h, $, esc, icon } from './dom.js';
import { isRes, BUILDINGS } from '../data/buildings.js';
import { sfx } from '../audio.js';

const FACE = `<svg viewBox="0 0 120 120" aria-hidden="true">
  <defs>
    <linearGradient id="advBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#4a9be0"/></linearGradient>
    <linearGradient id="advHair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a4b2a"/><stop offset="1" stop-color="#5e2f18"/></linearGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="url(#advBg)"/>
  <path d="M22 120c2-22 18-34 38-34s36 12 38 34z" fill="#2f6db1"/>
  <path d="M46 88l14 16 14-16" fill="#fff"/>
  <path d="M55 92h10l-5 18z" fill="#f2b632"/>
  <rect x="52" y="74" width="16" height="16" rx="6" fill="#f1c4a3"/>
  <path d="M30 56c0-22 13-36 30-36s30 14 30 36c0 14-4 26-8 30H38c-4-4-8-16-8-30z" fill="url(#advHair)"/>
  <ellipse cx="60" cy="56" rx="21" ry="24" fill="#f6d1b3"/>
  <path d="M38 50c4-16 14-22 24-22 10 0 18 6 21 16-8-2-16-7-21-12-5 9-14 15-24 18z" fill="url(#advHair)"/>
  <ellipse cx="51" cy="58" rx="2.6" ry="3.2" fill="#3a2a22"/>
  <ellipse cx="69" cy="58" rx="2.6" ry="3.2" fill="#3a2a22"/>
  <path d="M46 51c3-2 6-2 9-1M65 50c3-1 6-1 9 1" stroke="#6b3a20" stroke-width="2" fill="none" stroke-linecap="round"/>
  <ellipse cx="45" cy="66" rx="4" ry="2.4" fill="#f2a5a0" opacity=".55"/>
  <ellipse cx="75" cy="66" rx="4" ry="2.4" fill="#f2a5a0" opacity=".55"/>
  <path d="M52 69c4 4 12 4 16 0" stroke="#b5503f" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <circle cx="38" cy="62" r="2.4" fill="#f2b632"/><circle cx="82" cy="62" r="2.4" fill="#f2b632"/>
  <path d="M84 30l14-6 2 6-14 6z" fill="#f2b632"/><path d="M84 30l-3 6 5 0z" fill="#e8a210"/>
</svg>`;

const resCount = (g) => g.state.buildings.filter((b) => isRes(b.type)).length;

// Each step: text, optional highlight selector, optional world target, and when it is done.
function steps(app) {
  const g = app.game;
  const base = { houses: resCount(g) };
  return [
    { id: 'hello', name: true, text: 'Hallo, ich bin <b>Lena</b>, deine Stadtplanerin! Gemeinsam machen wir aus diesem Fleckchen Land eine richtige Stadt. Wie soll sie heißen?', button: 'Los geht\'s' },
    { id: 'build', text: 'Die Leute brauchen ein Zuhause. Tippe unten rechts auf <b>Bauen</b>.', hl: '.build-btn', done: () => app.build.isOpen() },
    { id: 'zone', text: 'Wähle das <b>Wohngebiet</b>.', hl: '.bm-card[data-type="house"]', done: () => app.mode?.kind === 'place', back: () => !app.build.isOpen() && app.mode?.kind !== 'place', backTo: 'build' },
    { id: 'place', text: 'Zieh das Haus an eine <b>Straße</b> – grün heißt, es passt. Dann tippe auf den <b>Haken</b>.', hl: '.mbtn.ok', done: () => resCount(g) > base.houses },
    { id: 'power', text: 'Wunderbar! Ohne <b>Strom</b> zieht aber niemand gern ein. Baue unter <b>Bauen › Versorgung</b> ein <b>Windrad</b>.', hl: () => (app.build.isOpen() ? (app.build.cat === 'util' ? '.bm-card[data-type="wind"]' : '.bm-tab[data-cat="util"]') : app.mode ? '.mbtn.ok' : '.build-btn'), done: () => g.countType('wind') > 0 },
    { id: 'water', text: 'Jetzt noch <b>Wasser</b>: ein <b>Wasserturm</b> versorgt die ersten Häuser.', hl: () => (app.build.isOpen() ? (app.build.cat === 'util' ? '.bm-card[data-type="watertower"]' : '.bm-tab[data-cat="util"]') : app.mode ? '.mbtn.ok' : '.build-btn'), done: () => g.countType('watertower') > 0 },
    { id: 'factory', text: 'In der <b>Fabrik</b> entstehen Rohstoffe. Tippe auf die Fabrik und stelle <b>Stahl</b> her.', point: () => g.findUnique('factory')?.id, hl: () => (app.panels.cur?.kind === 'factory' ? '[data-act="produce"][data-arg="steel"]' : null), done: () => g.state.buildings.some((b) => b.slots?.length) || Object.keys(g.state.stats.produced).length > 0 },
    { id: 'collect', text: 'Wenn der Stahl fertig ist, erscheint über der Fabrik eine <b>Blase</b>. Tippe sie an, um einzusammeln.', point: () => (app.panels.isOpen() ? null : g.findUnique('factory')?.id), done: () => Object.keys(g.state.stats.produced).length > 0 },
    { id: 'wish', text: 'Sind die Bewohner <b>zufrieden</b>, äußern sie Wünsche: Über dem Haus erscheint dann ein <b>Pfeil</b> oder das, was sie sich wünschen. Tippe auf das Haus und baue es aus!', point: () => (app.panels.isOpen() ? null : g.state.buildings.find((b) => isRes(b.type) && b.wish)?.id || g.state.buildings.find((b) => isRes(b.type))?.id), hl: () => (app.panels.cur?.kind === 'house' ? '[data-act="upgrade"]' : null), done: () => g.state.stats.upgrades > 0 },
    { id: 'zones', text: 'Mit jedem Ausbau ziehen mehr Menschen ein. Neue <b>Wohngebiete</b> schaltest du frei, indem du deine Häuser ausbaust – jede zweite Ausbaustufe bringt ein neues.', button: 'Verstanden' },
    { id: 'taxes', text: 'Im <b>Rathaus</b> sammeln sich die Steuern. Sobald dort eine <b>Münze</b> erscheint, tippe sie an.', point: () => g.findUnique('cityhall')?.id, done: () => g.state.stats.taxCollected > 0, button: 'Später' },
    { id: 'bye', text: 'Das war\'s fürs Erste! Links findest du deine <b>Aufgaben</b> mit den nächsten Zielen. Ich melde mich, wenn es etwas Neues gibt. Viel Spaß, Bürgermeister!', hl: '[data-act="quests"]', button: 'Danke, Lena!' },
  ];
}

export class Advisor {
  constructor(app) {
    this.app = app;
    this.el = h(`<div class="advisor" hidden>
      <div class="adv-face">${FACE}</div>
      <div class="adv-bubble"><div class="adv-name">Lena · Stadtplanung</div><p class="adv-text"></p><div class="adv-extra"></div>
        <div class="adv-btns"><button class="adv-skip" data-adv="skip">Tutorial überspringen</button><button class="btn primary small adv-go" data-adv="next"></button></div></div>
    </div>`);
    this.arrow = h(`<div class="tut-arrow" hidden><svg viewBox="0 0 40 52" aria-hidden="true"><path d="M14 2h12v26h10L20 50 4 28h10z" fill="#ffd34d" stroke="#b87a00" stroke-width="2.5" stroke-linejoin="round"/></svg></div>`);
    app.root.appendChild(this.el);
    app.root.appendChild(this.arrow);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-adv]');
      if (!b) return;
      if (this.cur?.tip) return;
      if (b.dataset.adv === 'skip') this.finish();
      else this.next(true);
    });
    this.tips = [];
    this.hlEl = null;
    const g = app.game;
    g.on('levelup', (lvl) => {
      const fresh = Object.values(BUILDINGS).filter((d) => d.level === lvl && d.cat !== 'fixed').map((d) => d.name);
      if (fresh.length && this.state.done) this.tip(`Glückwunsch zu Stufe ${lvl}! Neu im Baumenü: <b>${fresh.slice(0, 3).join(', ')}</b>.`);
    });
    g.on('fire', () => this.tipOnce('fire', 'Oh nein, es brennt! <b>Feuerwachen</b> in der Nähe verhindern Brände und löschen sie automatisch.'));
    g.on('collected', () => { if (g.storageFree() <= 3) this.tipOnce('storage', 'Dein <b>Lager</b> ist fast voll. Verkaufe Waren im Laden oder auf dem Marktplatz – oder vergrößere das Lager mit Schlössern, Riegeln und Ketten.'); });
    g.on('change', () => {
      if (!this.state.done) return;
      const z = g.zoneInfo();
      if (z.used >= z.allowed && z.used >= 4) this.tipOnce('zones', 'Alle Wohngebiete sind belegt. <b>Baue deine Häuser aus</b>, dann darfst du neue bauen.');
      if (g.state.buildings.some((b) => b.customers?.length)) this.tipOnce('customers', 'Im Laden wartet <b>Kundschaft</b>! Sie zahlt mehr als der Marktwert für deine Waren.');
    });
  }

  get state() {
    const s = this.app.game.state;
    s.tutorial ||= { step: 0, done: false, tips: {} };
    s.tutorial.tips ||= {};
    return s.tutorial;
  }

  start() {
    const st = this.state;
    const g = this.app.game;
    // existing cities that are well under way skip the tutorial
    if (!st.done && st.step === 0 && (g.state.level > 2 || g.state.stats.upgrades > 3)) st.done = true;
    if (st.done) return;
    this.list = steps(this.app);
    this.show();
  }

  show() {
    const st = this.state;
    const s = this.list[st.step];
    if (!s) { this.finish(); return; }
    this.cur = s;
    this.el.hidden = false;
    this.el.classList.remove('in');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    const textEl = $('.adv-text', this.el);
    this.type(textEl, s.text);
    $('.adv-extra', this.el).innerHTML = s.name ? `<input class="inp" id="advName" maxlength="28" value="${esc(this.app.game.state.name)}">` : '';
    const go = $('.adv-go', this.el);
    go.hidden = !s.button;
    go.textContent = s.button || '';
    $('.adv-skip', this.el).hidden = st.step === 0 || st.step >= this.list.length - 1;
    sfx.notify();
  }

  // typewriter effect that keeps the HTML tags intact; driven by elapsed time so a busy frame
  // never stalls it
  type(el, html) {
    clearInterval(this.typing);
    const parts = html.split(/(<[^>]+>)/);
    const plain = parts.filter((p) => !p.startsWith('<')).join('').length;
    const t0 = performance.now();
    const render = () => {
      let budget = Math.floor((performance.now() - t0) / 16);
      let out = '';
      for (const p of parts) {
        if (p.startsWith('<')) { out += p; continue; }
        if (budget <= 0) break;
        out += p.slice(0, budget);
        budget -= p.length;
      }
      el.innerHTML = out;
      if (Math.floor((performance.now() - t0) / 16) >= plain) { el.innerHTML = html; clearInterval(this.typing); }
    };
    render();
    this.typing = setInterval(render, 30);
  }

  next(manual = false) {
    const st = this.state;
    const s = this.cur;
    if (s?.name) {
      const v = $('#advName', this.el)?.value.trim();
      if (v) { this.app.game.state.name = v; this.app.game.emit('change'); }
    }
    if (manual && s?.done && !s.button) return;
    st.step++;
    this.app.game.emit('change');
    if (st.step >= this.list.length) { this.finish(); return; }
    this.show();
  }

  finish() {
    const st = this.state;
    st.done = true;
    clearInterval(this.typing);
    this.el.hidden = true;
    this.arrow.hidden = true;
    this.highlight(null);
    this.app.game.emit('change');
    if (this.onFinish) { const f = this.onFinish; this.onFinish = null; f(); }
  }

  tipOnce(key, text) {
    const st = this.state;
    if (!st.done || st.tips[key]) return;
    st.tips[key] = Date.now();
    this.tip(text);
  }

  // a short, self-dismissing hint once the tutorial is over
  tip(text) {
    if (!this.state.done || this.cur?.tip) return;
    this.cur = { tip: true };
    this.el.hidden = false;
    this.el.classList.add('in', 'tip');
    this.type($('.adv-text', this.el), text);
    $('.adv-extra', this.el).innerHTML = '';
    const go = $('.adv-go', this.el);
    go.hidden = false;
    go.textContent = 'OK';
    $('.adv-skip', this.el).hidden = true;
    sfx.notify();
    const close = () => { this.el.hidden = true; this.el.classList.remove('tip'); this.cur = null; };
    go.onclick = (e) => { e.stopPropagation(); close(); go.onclick = null; };
    clearTimeout(this.tipT);
    this.tipT = setTimeout(close, 12000);
  }

  highlight(sel) {
    const el = sel ? document.querySelector(sel) : null;
    if (el === this.hlEl) return;
    if (this.hlEl) this.hlEl.classList.remove('tut-hl');
    this.hlEl = el;
    if (el) el.classList.add('tut-hl');
  }

  update() {
    const s = this.cur;
    if (!s || s.tip || this.state.done) { this.arrow.hidden = true; return; }
    if (s.back && s.back() && s.backTo) {
      const i = this.list.findIndex((x) => x.id === s.backTo);
      if (i >= 0) { this.state.step = i; this.show(); return; }
    }
    if (s.done && s.done()) { this.next(); return; }
    const sel = typeof s.hl === 'function' ? s.hl() : s.hl;
    this.highlight(sel);
    const bid = s.point && s.point();
    const p = bid ? this.app.world.buildingAnchor(bid) : null;
    if (p && p.vis) {
      this.arrow.hidden = false;
      this.arrow.style.transform = `translate(${p.x}px, ${p.y - 70}px)`;
    } else this.arrow.hidden = true;
  }
}
