import { h, $, num, icon, itemIcon, coins, crystals } from './dom.js';
import { xpForNext } from '../data/progress.js';
import { ITEMS } from '../data/items.js';
import { BUILDINGS, BUILD_ORDER } from '../data/buildings.js';
import { UTIL_NAMES } from '../data/buildings.js';
import { sfx } from '../audio.js';
import { questProgress } from '../game/quests.js';
import { achClaimable } from '../game/meta.js';
import { inClaude as inClaudeHud } from '../save/claude.js';

export class Hud {
  constructor(app) {
    this.app = app;
    const g = app.game;
    this.el = h(`<div id="hud">
      <div class="hud-tl">
        <button class="lvl" data-act="progress" aria-label="Stufe">
          <svg class="lvl-ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" class="bg"/><circle cx="32" cy="32" r="28" class="fg"/></svg>
          <span class="lvl-n">1</span>
        </button>
        <div class="stack">
          <div class="chip big" data-act="overview">${icon('people')}<b class="pop">0</b></div>
          <div class="chip" data-act="overview"><span class="mood">${icon('smile')}</span><b class="happy">0%</b><span class="warn-utils"></span></div>
        </div>
      </div>
      <div class="hud-tr">
        <div class="chip money">${icon('coin')}<b class="coins">0</b></div>
        <div class="chip cry">${icon('crystal')}<b class="crys">0</b></div>
        <button class="round" data-act="settings" aria-label="Einstellungen">${icon('gear')}</button>
      </div>
      <div class="hud-left">
        <button class="side" data-act="storage">${icon('box')}<span class="lbl stor">0/0</span></button>
        <button class="side" data-act="quests">${icon('list')}<span class="lbl">Aufgaben</span><i class="badge q-badge"></i></button>
        <button class="side" data-act="overview">${icon('stats')}<span class="lbl">Stadt</span></button>
        <button class="side" data-act="achievements">${icon('trophy')}<span class="lbl">Erfolge</span><i class="badge a-badge"></i></button>
        <div class="sync" title="Speicherstatus"></div>
      </div>
      <div class="hud-bl">
        <button class="tool" data-act="tool-move" aria-label="Verschieben">${icon('move')}<span>Verschieben</span></button>
        <button class="tool" data-act="tool-bulldoze" aria-label="Abreißen">${icon('bulldoze')}<span>Abreißen</span></button>
        <button class="tool" data-act="tool-view" aria-label="Ansicht">${icon('eye')}<span>Ansicht</span></button>
      </div>
      <div class="hud-br">
        <button class="build-btn" data-act="build"><span class="bb-ic">${icon('home')}</span><span>Bauen</span><i class="badge new-badge"></i></button>
      </div>
      <button class="ticker hidden" data-act="quests"></button>
      <button class="event-chip hidden" data-act="event"></button>
      <div class="view-bar hidden"></div>
      <div id="toasts"></div>
    </div>`);
    app.root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      sfx.tap();
      app.action(b.dataset.act, b);
    });
    g.on('change', () => this.update());
    setInterval(() => this.eventChip(), 1000);
    g.on('city', () => this.update());
    g.on('quests', () => this.update());
    g.on('toast', (m, k) => this.toast(m, k));
    g.on('levelup', (lvl, r) => this.levelUp(lvl, r));
    app.save.onStatus((s) => this.syncStatus(s));
    this.update();
  }

  update() {
    const g = this.app.game, S = g.state;
    $('.lvl-n', this.el).textContent = S.level;
    const need = xpForNext(S.level);
    const fg = $('.lvl-ring .fg', this.el);
    const c = 2 * Math.PI * 28;
    fg.style.strokeDasharray = c;
    fg.style.strokeDashoffset = c * (1 - Math.min(1, S.xp / need));
    $('.pop', this.el).textContent = num(g.city.pop);
    $('.happy', this.el).textContent = `${g.city.happy}%`;
    $('.mood', this.el).innerHTML = icon(g.city.happy >= 65 ? 'smile' : g.city.happy >= 40 ? 'meh' : 'sad');
    $('.coins', this.el).textContent = num(S.coins);
    $('.crys', this.el).textContent = num(S.crystals);
    const used = g.storageUsed();
    const st = $('.stor', this.el);
    st.textContent = `${used}/${S.storage.cap}`;
    st.classList.toggle('full', used >= S.storage.cap);
    const done = S.quests.active.filter((q) => g.questDone(q)).length;
    const qb = $('.q-badge', this.el);
    qb.textContent = done || '';
    qb.style.display = done ? '' : 'none';
    // next task ticker
    const tk = $('.ticker', this.el);
    const qs = S.quests.active;
    const ready = qs.find((q) => g.questDone(q));
    const next = ready || qs[0];
    if (next) {
      const p = Math.min(next.n, Math.max(0, questProgress(g, next)));
      tk.innerHTML = ready ? `${icon('xp')}<span><b>Aufgabe erledigt!</b> ${next.text}</span><em>Abholen</em>` : `${icon('list')}<span>${next.text}</span><em>${num(p)}/${num(next.n)}</em>`;
      tk.classList.toggle('done', !!ready);
      tk.classList.remove('hidden');
    } else tk.classList.add('hidden');
    // utility shortages
    const short = Object.keys(UTIL_NAMES).filter((k) => g.city.demand[k] > g.city.supply[k] && g.city.demand[k] > 0 && (k !== 'sewage' || S.level >= 2) && (k !== 'waste' || S.level >= 2));
    $('.warn-utils', this.el).innerHTML = short.map((k) => `<span class="warn">${icon(k)}</span>`).join('');
    const ac = achClaimable(g);
    const ab = $('.a-badge', this.el);
    ab.textContent = ac || '';
    ab.style.display = ac ? '' : 'none';
    this.eventChip();
    const fresh = BUILD_ORDER.filter((id) => BUILDINGS[id].cat !== 'fixed' && BUILDINGS[id].level <= S.level && BUILDINGS[id].level > 1 && !S.seen[`b:${id}`]).length;
    const nb = $('.new-badge', this.el);
    nb.textContent = fresh ? 'NEU' : '';
    nb.style.display = fresh ? '' : 'none';
  }

  // running city event with countdown
  eventChip() {
    const ev = this.app.game.activeEvent();
    const el = $('.event-chip', this.el);
    if (!ev) { el.classList.add('hidden'); return; }
    const left = Math.max(0, Math.ceil((ev.until - Date.now()) / 1000));
    el.innerHTML = `${icon(ev.icon)}<span><b>${ev.name}</b><em>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</em></span>`;
    el.classList.remove('hidden');
  }

  syncStatus(s) {
    const el = $('.sync', this.el);
    const map = { synced: ['ok', inClaudeHud() ? 'Im Claude-Konto gesichert' : 'Online gesichert'], syncing: ['busy', 'Synchronisiere…'], error: ['err', 'Offline – lokal gesichert'], noserver: ['local', 'Lokal gesichert'], offline: ['local', 'Lokal gesichert'] };
    const [cls, text] = map[s] || map.offline;
    el.className = `sync ${cls}`;
    el.innerHTML = `${icon('cloud')}<span>${text}</span>`;
  }

  toast(msg, kind = 'info') {
    if (kind === 'bad') sfx.error();
    const box = $('#toasts', this.el);
    const t = h(`<div class="toast ${kind}">${msg}</div>`);
    box.appendChild(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2300);
    setTimeout(() => t.remove(), 2700);
  }

  // Floating reward text from a screen point towards the HUD.
  float(x, y, html) {
    const f = h(`<div class="floater">${html}</div>`);
    f.style.left = `${x}px`;
    f.style.top = `${y}px`;
    this.app.root.appendChild(f);
    setTimeout(() => f.remove(), 1500);
  }

  levelUp(lvl, r) {
    sfx.level();
    const unlocked = BUILD_ORDER.filter((id) => BUILDINGS[id].level === lvl && BUILDINGS[id].cat !== 'fixed');
    const items = Object.values(ITEMS).filter((it) => it.level === lvl && it.kind !== 'special');
    const m = h(`<div class="modal levelup">
      <div class="card">
        <div class="burst"></div>
        <div class="lu-badge"><span>${lvl}</span></div>
        <h2>Stufe ${lvl} erreicht!</h2>
        <div class="lu-rew">${coins(r.coins)} ${crystals(r.crystals)}</div>
        ${unlocked.length || items.length ? `<p class="muted">Neu freigeschaltet</p><div class="lu-new">
          ${unlocked.map((id) => `<div class="lu-item"><img src="${this.app.thumb(id)}" alt=""><span>${BUILDINGS[id].name}</span></div>`).join('')}
          ${items.map((it) => `<div class="lu-item">${itemIcon(it.id, 'xl')}<span>${it.name}</span></div>`).join('')}
        </div>` : ''}
        <button class="btn primary wide" data-close>Weiter</button>
      </div></div>`);
    m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) m.remove(); });
    this.app.root.appendChild(m);
  }
}
