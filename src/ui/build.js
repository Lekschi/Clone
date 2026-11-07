import { h, $, num, icon, coins } from './dom.js';
import { BUILDINGS, BUILD_ORDER, CATEGORIES, maxCount, ROAD_COST, UTIL_NAMES } from '../data/buildings.js';
import { sfx } from '../audio.js';

export class BuildMenu {
  constructor(app) {
    this.app = app;
    this.cat = 'res';
    this.el = null;
  }

  isOpen() { return !!this.el; }

  open() {
    this.close();
    const el = h(`<div class="build-menu"><div class="bm-tabs"></div><div class="bm-list"></div><button class="x bm-x" aria-label="Schließen">${icon('close')}</button></div>`);
    el.addEventListener('click', (e) => {
      if (e.target.closest('.bm-x')) { this.close(); return; }
      const t = e.target.closest('[data-cat]');
      if (t) { this.cat = t.dataset.cat; sfx.tap(); this.render(); return; }
      const c = e.target.closest('[data-type]');
      if (c && !c.classList.contains('locked')) {
        sfx.tap();
        const type = c.dataset.type;
        this.close();
        if (type === 'road') this.app.setMode({ kind: 'road', erase: false });
        else this.app.startPlace(type);
      }
    });
    this.app.root.appendChild(el);
    this.el = el;
    this.render();
    requestAnimationFrame(() => el.classList.add('in'));
  }

  close() {
    if (!this.el) return;
    const el = this.el;
    this.el = null;
    el.classList.remove('in');
    setTimeout(() => el.remove(), 200);
  }

  render() {
    const g = this.app.game, S = g.state;
    const tabs = CATEGORIES.map((c) => {
      const fresh = BUILD_ORDER.some((id) => BUILDINGS[id].cat === c.id && BUILDINGS[id].level <= S.level && BUILDINGS[id].level > 1 && !S.seen[`b:${id}`]);
      return `<button class="bm-tab ${this.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${icon(c.icon)}<span>${c.name}</span>${fresh ? '<i class="dot"></i>' : ''}</button>`;
    }).join('');
    $('.bm-tabs', this.el).innerHTML = tabs;
    let cards = '';
    if (this.cat === 'road') {
      cards = `<button class="bm-card" data-type="road"><div class="bm-img road-img">${icon('road')}</div><b>Straße</b><span class="bm-cost">${coins(ROAD_COST)} <small>pro Feld</small></span><span class="bm-meta">Ziehen zum Bauen</span></button>`;
    } else {
      const ids = BUILD_ORDER.filter((id) => BUILDINGS[id].cat === this.cat).sort((a, b) => BUILDINGS[a].level - BUILDINGS[b].level);
      for (const id of ids) {
        const def = BUILDINGS[id];
        const st = g.buildStatus(id);
        const own = g.countType(id);
        const max = maxCount(def, S.level);
        const locked = def.level > S.level;
        const maxed = own >= max;
        const fresh = !locked && def.level > 1 && !S.seen[`b:${id}`];
        let meta = '';
        if (def.supply) meta = Object.entries(def.supply).map(([k, v]) => `${icon(k)}+${v}`).join(' ');
        else if (def.service) meta = `${icon(def.service.kind)} Radius ${def.service.r}`;
        else if (def.boost) meta = `${icon('people')} +${def.boost.pct}%`;
        else if (def.factory) meta = `${def.factory.slots} Plätze`;
        else if (def.cat === 'res') meta = 'Wohnraum';
        else if (def.shop) meta = 'Waren';
        cards += `<button class="bm-card ${locked ? 'locked' : ''} ${maxed ? 'maxed' : ''} ${!locked && !maxed && !st.ok ? 'poor' : ''}" data-type="${id}">
          ${fresh ? '<i class="new">NEU</i>' : ''}
          <div class="bm-img">${locked ? `<span class="lockov">${icon('lock')}<b>Stufe ${def.level}</b></span>` : ''}<img loading="lazy" src="${this.app.thumb(id)}" alt=""></div>
          <b>${def.name}</b>
          <span class="bm-cost">${locked ? '' : maxed ? `<small>${max === 1 ? 'gebaut' : `${own}/${max}`}</small>` : coins(g.costOf(id))}</span>
          <span class="bm-meta">${meta}${def.pollution ? ' · <em>Abgase</em>' : ''}${max !== Infinity && !locked && !maxed && max > 1 ? ` · ${own}/${max}` : ''}</span>
        </button>`;
      }
    }
    $('.bm-list', this.el).innerHTML = cards;
    $('.bm-list', this.el).scrollLeft = 0;
  }
}

// Bottom action bar while a tool is active.
export class ModeBar {
  constructor(app) {
    this.app = app;
    this.el = h('<div class="modebar hidden"></div>');
    app.root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b || b.disabled) return;
      sfx.tap();
      app.modeAction(b.dataset.m, b.dataset.arg);
    });
  }

  show(html) {
    this.el.innerHTML = html;
    this.el.classList.remove('hidden');
  }

  hide() { this.el.classList.add('hidden'); }

  place(mode, ok, reason) {
    const g = this.app.game;
    const def = BUILDINGS[mode.type];
    const cost = mode.moveId ? 0 : g.costOf(mode.type);
    const canRotate = def.size[0] !== def.size[1];
    this.show(`<div class="mb-info"><b>${mode.moveId ? 'Verschieben' : def.name}</b><span class="${ok ? 'muted' : 'bad'}">${ok ? (mode.moveId ? 'Ziehe das Gebäude an die neue Stelle' : 'Ziehe das Gebäude an die gewünschte Stelle') : reason}</span></div>
      <div class="mb-btns">
        <button class="mbtn cancel" data-m="cancel" aria-label="Abbrechen">${icon('close')}</button>
        ${canRotate ? `<button class="mbtn" data-m="rotate" aria-label="Drehen">${icon('rotate')}</button>` : ''}
        <button class="mbtn ok" data-m="confirm" ${ok ? '' : 'disabled'} aria-label="Bauen">${icon('check')}${cost ? `<small>${num(cost)}</small>` : ''}</button>
      </div>`);
  }

  road(mode, cells) {
    const g = this.app.game;
    const cost = cells ? g.roadPathCost(cells) : 0;
    this.show(`<div class="mb-info"><b>${mode.erase ? 'Straßen entfernen' : 'Straßen bauen'}</b><span class="muted">${cells && cells.length ? (mode.erase ? `${cells.length} Felder` : `${cells.length} Felder · ${num(cost)} Münzen`) : 'Mit dem Finger über die Karte ziehen'}</span></div>
      <div class="mb-btns">
        <div class="segs"><button class="seg ${mode.erase ? '' : 'on'}" data-m="roadBuild">Bauen</button><button class="seg ${mode.erase ? 'on' : ''}" data-m="roadErase">Entfernen</button></div>
        <button class="mbtn ok" data-m="done" aria-label="Fertig">${icon('check')}</button>
      </div>`);
  }

  simple(title, text) {
    this.show(`<div class="mb-info"><b>${title}</b><span class="muted">${text}</span></div><div class="mb-btns"><button class="mbtn ok" data-m="done" aria-label="Fertig">${icon('check')}</button></div>`);
  }

  view(kind) {
    const opts = [['fire', 'Feuer'], ['police', 'Polizei'], ['health', 'Gesundheit'], ['utility', 'Versorgung'], ['pollution', 'Abgase'], ['boost', 'Boni']];
    this.show(`<div class="mb-info"><b>Ansicht</b><span class="muted">Grün = versorgt, rot = fehlt</span></div>
      <div class="mb-btns"><div class="segs wrap">${opts.map(([k, n]) => `<button class="seg ${kind === k ? 'on' : ''}" data-m="view" data-arg="${k}">${n}</button>`).join('')}</div>
      <button class="mbtn ok" data-m="done" aria-label="Fertig">${icon('check')}</button></div>`);
  }
}

export { UTIL_NAMES };
