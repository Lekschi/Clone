import { h, $, num, esc, icon, itemIcon, reqChip, coins, crystals, progressRing, fmtTime } from './dom.js';
import { ITEMS, RAW_IDS, GOOD_IDS, STORAGE_PARTS, EXPAND_PARTS, SHOPS } from '../data/items.js';
import { BUILDINGS, UTIL_NAMES, SERVICE_NAMES, BOOST_NAMES, BUILD_ORDER } from '../data/buildings.js';
import { HOUSE_POP, HOUSE_NAMES, xpForNext, maxHouseLevelFor, skipPrice } from '../data/progress.js';
import { questProgress } from '../game/quests.js';
import { syncCode, useSyncCode, saveSettings, clearLocal } from '../save/save.js';
import { setSound, sfx } from '../audio.js';

const CAT_COLOR = { res: '#ff8a5b', util: '#f2b024', service: '#4d8de6', industry: '#8c9aab', commerce: '#ff6a5c', leisure: '#53b04c', fixed: '#7b6cd9' };

export class Panels {
  constructor(app) {
    this.app = app;
    this.cur = null;
    app.game.on('change', () => this.refresh());
    setInterval(() => this.refresh(), 1000);
  }

  get game() { return this.app.game; }

  open(kind, arg) {
    this.close(true);
    const st = { kind, arg, tab: 0, form: null, sel: null };
    const el = h(`<div class="sheet-wrap"><div class="sheet" role="dialog">
      <header class="sh-head"></header>
      <div class="sh-body"></div>
      <footer class="sh-foot"></footer>
    </div></div>`);
    el.addEventListener('pointerdown', (e) => { if (e.target === el) this.close(); });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a || a.disabled) return;
      this.act(a.dataset.act, a.dataset.arg, a);
    });
    el.addEventListener('change', (e) => this.onInput(e));
    this.app.root.appendChild(el);
    st.el = el;
    this.cur = st;
    if (arg && typeof arg === 'number') this.app.world.select(arg);
    this.refresh(true);
    requestAnimationFrame(() => el.classList.add('in'));
  }

  close(instant = false) {
    const c = this.cur;
    if (!c) return;
    this.cur = null;
    this.app.world.select(null);
    if (instant) c.el.remove();
    else { c.el.classList.remove('in'); setTimeout(() => c.el.remove(), 220); }
  }

  isOpen() { return !!this.cur; }

  refresh(force = false) {
    const c = this.cur;
    if (!c) return;
    if (!force && c.el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    const fn = this[`r_${c.kind}`];
    if (!fn) return;
    const out = fn.call(this, c);
    if (!out) { this.close(); return; }
    const sheet = $('.sheet', c.el);
    sheet.style.setProperty('--accent', out.color || '#4d8de6');
    sheet.classList.toggle('wide', !!out.wide);
    const head = `${out.img ? `<img class="sh-img" src="${out.img}" alt="">` : out.icon ? `<span class="sh-ic">${out.icon}</span>` : ''}
      <div class="sh-title"><h2>${out.title}</h2>${out.sub ? `<p>${out.sub}</p>` : ''}</div>
      <button class="x" data-act="close" aria-label="Schließen">${icon('close')}</button>`;
    const parts = [['.sh-head', head], ['.sh-body', out.body], ['.sh-foot', out.foot || '']];
    for (const [sel, html] of parts) {
      const node = $(sel, c.el);
      if (node._html !== html) { node.innerHTML = html; node._html = html; }
    }
    $('.sh-foot', c.el).style.display = out.foot ? '' : 'none';
  }

  // -------------------------------------------------------------- helpers
  bFoot(b) {
    const def = BUILDINGS[b.type];
    if (def.cat === 'fixed') return `<button class="btn ghost" data-act="move" data-arg="${b.id}">${icon('move')} Verschieben</button>`;
    return `<button class="btn ghost" data-act="move" data-arg="${b.id}">${icon('move')} Verschieben</button>
      <button class="btn ghost danger" data-act="demolish" data-arg="${b.id}">${icon('bulldoze')} Abreißen</button>`;
  }

  // -------------------------------------------------------------- house
  r_house(c) {
    const g = this.game, b = g.byId.get(c.arg);
    if (!b) return null;
    const inf = g.info.get(b.id) || { missing: [], services: {}, boost: {}, pop: 0, happy: 0 };
    const L = b.level;
    const lvl = g.state.level;
    const utilRow = Object.keys(UTIL_NAMES).map((k) => {
      const relevant = !((k === 'sewage' || k === 'waste') && lvl < 2);
      if (!relevant) return '';
      const miss = inf.missing.includes(k);
      return `<span class="pill ${miss ? 'bad' : 'good'}">${icon(k)}${UTIL_NAMES[k]}</span>`;
    }).join('');
    const svcRow = ['fire', 'police', 'health'].map((k) => {
      const avail = lvl >= BUILDINGS[{ fire: 'firesmall', police: 'policesmall', health: 'clinic' }[k]].level;
      const ok = inf.services?.[k];
      return `<span class="pill ${!avail ? 'na' : ok ? 'good' : 'bad'}">${icon(k)}${SERVICE_NAMES[k]}</span>`;
    }).join('');
    const boosts = Object.entries(inf.boost || {}).map(([k, v]) => `<span class="pill good">${BOOST_NAMES[k]} +${v}%</span>`).join('') || '<span class="muted small">Parks, Bildung, Unterhaltung und Wahrzeichen in der Nähe steigern die Einwohnerzahl.</span>';
    let up = '';
    const block = g.houseUpgradeBlock(b);
    if (L >= 8) up = `<div class="note good">Dieses Hochhaus hat die höchste Stufe erreicht.</div>`;
    else {
      const has = g.hasItems(b.req);
      const reqs = Object.entries(b.req).map(([k, n]) => reqChip(g, k, n)).join('');
      const gainPop = Math.round((HOUSE_POP[L + 1] - HOUSE_POP[L]) * (1 + (inf.boostPct || 0) / 100));
      let value = 0, xp = 0;
      for (const [k, n] of Object.entries(b.req)) { value += ITEMS[k].value * n; xp += ITEMS[k].xp * n; }
      const coinR = Math.round(value * 0.45 + 20 * (L + 1));
      const xpR = Math.round(xp * 1.5 + 8 * (L + 1));
      const wait = (b.reqAt || 0) + 5 * 60 * 1000 - Date.now();
      const missP = g.missingCrystals(b.req);
      up = `<h3>Ausbau auf Stufe ${L + 1} <span class="muted">· ${HOUSE_NAMES[L + 1]}</span></h3>
        <div class="reqs">${reqs}</div>
        <div class="rewards"><span class="muted">Belohnung</span> <span class="cur">${icon('people')}+${num(gainPop)}</span> ${coins(coinR)} <span class="cur xp">${icon('xp')}${xpR}</span></div>
        ${block ? `<div class="note bad">${block}${block === 'Erreiche eine höhere Spielerstufe' ? ` (Stufe ${L + 1} ab Spielerstufe ${(L + 1 - 2) * 2})` : ''}</div>` : ''}
        <div class="row">
          <button class="btn primary" data-act="upgrade" ${!has || block ? 'disabled' : ''}>${icon('up')} Ausbauen</button>
          ${!has && !block ? `<button class="btn cry" data-act="upgradeBuy">Fehlendes kaufen ${crystals(missP)}</button>` : ''}
          <button class="btn ghost small" data-act="reroll" ${wait > 0 ? 'disabled' : ''}>Andere Wünsche${wait > 0 ? ` (${fmtTime(wait / 1000)})` : ''}</button>
        </div>`;
    }
    return {
      title: HOUSE_NAMES[L], sub: `Wohngebiet · Stufe ${L} von ${maxHouseLevelFor(lvl)}`, img: this.app.thumb('house', L), color: CAT_COLOR.res,
      body: `<div class="stats">
          <div class="stat">${icon('people')}<b>${num(inf.pop)}</b><span>Einwohner</span></div>
          <div class="stat">${icon(inf.happy >= 65 ? 'smile' : inf.happy >= 40 ? 'meh' : 'sad')}<b>${inf.happy}%</b><span>Zufriedenheit</span></div>
          <div class="stat">${icon('tree')}<b>+${inf.boostPct || 0}%</b><span>Bonus</span></div>
        </div>
        ${!inf.road ? '<div class="note bad">Keine Straße! Ohne Anbindung zieht niemand ein.</div>' : ''}
        ${b.fire ? `<div class="box fire-box">${icon('fire', 'xl')}<div><b>Es brennt!</b><p class="muted small">Die Bewohner sind geflohen. Eine Feuerwache in der Nähe löscht automatisch – oder du rufst die freiwillige Feuerwehr.</p></div><button class="btn danger" data-act="extinguish">Löschen ${coins(g.extinguishCost(b))}</button></div>` : ''}
        <div class="kv"><span>Versorgung</span><div class="pills">${utilRow}</div></div>
        <div class="kv"><span>Dienste</span><div class="pills">${svcRow}</div></div>
        <div class="kv"><span>Umwelt</span><div class="pills">${inf.polluted ? '<span class="pill bad">Luftverschmutzung</span>' : '<span class="pill good">Saubere Luft</span>'}</div></div>
        <div class="kv"><span>Boni</span><div class="pills">${boosts}</div></div>
        <div class="box">${up}</div>`,
      foot: this.bFoot(b),
    };
  }

  // -------------------------------------------------------------- factory
  r_factory(c) {
    const g = this.game, b = g.byId.get(c.arg);
    if (!b) return null;
    const def = BUILDINGS[b.type];
    const now = Date.now();
    const n = g.factorySlots(b);
    let slots = '';
    for (let i = 0; i < n; i++) {
      const s = b.slots[i];
      if (!s) { slots += `<div class="slot empty"><span>frei</span></div>`; continue; }
      const it = ITEMS[s.item];
      const done = s.end <= now;
      const frac = (now - s.start) / (s.end - s.start);
      slots += `<button class="slot ${done ? 'done' : ''}" data-act="${done ? 'collectF' : 'skipF'}" data-arg="${i}">
        ${done ? '' : progressRing(frac, 58, 5)}<span class="slot-ic">${it.icon}</span>
        <span class="slot-t">${done ? '✓' : fmtTime((s.end - now) / 1000)}</span></button>`;
    }
    const slotPrice = g.factorySlotPrice(b);
    if (slotPrice != null) slots += `<button class="slot add" data-act="buyFSlot">+<small>${num(slotPrice)}</small></button>`;
    const full = b.slots.length >= n;
    const items = RAW_IDS.map((id) => {
      const it = ITEMS[id];
      const locked = it.level > g.state.level;
      return `<button class="card item-card ${locked ? 'locked' : ''}" data-act="produce" data-arg="${id}" ${locked || full ? 'disabled' : ''}>
        ${itemIcon(id, 'lg')}<b>${it.name}</b><span class="muted">${locked ? `Stufe ${it.level}` : fmtTime(it.time)}</span>
        <span class="have">${g.stored(id)}</span></button>`;
    }).join('');
    const anyDone = b.slots.some((s) => s.end <= now);
    return {
      title: def.name, sub: `Rohstoffe · ${n} Produktionsplätze`, img: this.app.thumb(b.type), color: CAT_COLOR.industry,
      body: `<div class="slots">${slots}</div>
        ${anyDone ? '<button class="btn primary wide" data-act="collectF">Einsammeln</button>' : ''}
        <p class="muted small">Tippe auf einen Rohstoff, um ihn herzustellen. Laufende Plätze kannst du mit Kristallen beschleunigen.</p>
        <div class="grid items">${items}</div>
        ${c.skip != null ? this.skipBox(b, c.skip) : ''}`,
      foot: this.bFoot(b),
    };
  }

  skipBox(b, i) {
    const list = b.slots || b.queue;
    const e = list[i];
    if (!e || e.end <= Date.now()) return '';
    const p = this.game.skipPriceFor(b, i);
    return `<div class="box skip">${itemIcon(e.item)} <span>${ITEMS[e.item].name} sofort fertigstellen?</span>
      <button class="btn cry" data-act="doSkip" data-arg="${i}">${crystals(p)}</button>
      <button class="btn ghost small" data-act="noSkip">Nein</button></div>`;
  }

  // -------------------------------------------------------------- shop
  r_shop(c) {
    const g = this.game, b = g.byId.get(c.arg);
    if (!b) return null;
    const def = BUILDINGS[b.type];
    const now = Date.now();
    let q = '';
    for (let i = 0; i < b.qslots; i++) {
      const e = b.queue[i];
      if (!e) { q += `<div class="slot empty"><span>frei</span></div>`; continue; }
      const it = ITEMS[e.item];
      const done = e.end <= now;
      const running = !done && e.start <= now;
      const frac = running ? (now - e.start) / (e.end - e.start) : 0;
      q += `<button class="slot ${done ? 'done' : running ? '' : 'wait'}" data-act="${done ? 'collectS' : 'skipS'}" data-arg="${i}">
        ${running ? progressRing(frac, 58, 5, '#ff8a3d') : ''}<span class="slot-ic">${it.icon}</span>
        <span class="slot-t">${done ? '✓' : running ? fmtTime((e.end - now) / 1000) : fmtTime(it.time)}</span></button>`;
    }
    const sp = g.shopSlotPrice(b);
    if (sp != null) q += `<button class="slot add" data-act="buySSlot">+<small>${num(sp)}</small></button>`;
    const full = b.queue.length >= b.qslots;
    const recipes = SHOPS[def.shop].items.map((id) => {
      const it = ITEMS[id];
      const locked = it.level > g.state.level;
      const can = !locked && !full && g.hasItems(it.req);
      return `<button class="card recipe ${locked ? 'locked' : ''} ${can ? 'can' : ''}" data-act="craft" data-arg="${id}" ${locked || full ? 'disabled' : ''}>
        <div class="rc-top">${itemIcon(id, 'lg')}<div><b>${it.name}</b><span class="muted">${locked ? `ab Stufe ${it.level}` : `${fmtTime(it.time)} · Lager ${g.stored(id)}`}</span></div></div>
        <div class="reqs sm">${Object.entries(it.req).map(([k, n]) => reqChip(g, k, n)).join('')}</div></button>`;
    }).join('');
    const anyDone = b.queue.some((e) => e.end <= now);
    return {
      title: def.name, sub: 'Waren herstellen · Warteschlange', img: this.app.thumb(b.type), color: CAT_COLOR.commerce, wide: true,
      body: `<div class="slots">${q}</div>
        ${anyDone ? '<button class="btn primary wide" data-act="collectS">Einsammeln</button>' : ''}
        ${c.skip != null ? this.skipBox(b, c.skip) : ''}
        <div class="grid recipes">${recipes}</div>`,
      foot: this.bFoot(b),
    };
  }

  // -------------------------------------------------------------- storage
  r_storage(c) {
    const g = this.game, S = g.state;
    const used = g.storageUsed();
    const tabs = ['Rohstoffe', 'Waren', 'Teile'];
    const lists = [RAW_IDS, GOOD_IDS, [...STORAGE_PARTS, ...EXPAND_PARTS]];
    const ids = lists[c.tab].filter((id) => g.stored(id) > 0);
    const tiles = ids.map((id) => `<button class="tile ${c.sel === id ? 'sel' : ''}" data-act="selItem" data-arg="${id}">${itemIcon(id, 'lg')}<b>${g.stored(id)}</b><span>${ITEMS[id].name}</span></button>`).join('') || '<p class="muted center">Hier ist noch nichts gelagert.</p>';
    const up = g.storageUpgradeInfo();
    const sel = c.sel && g.stored(c.sel) > 0 && ITEMS[c.sel].kind !== 'special' ? `<div class="box row sel-box">${itemIcon(c.sel, 'lg')}<div><b>${ITEMS[c.sel].name}</b><p class="muted small">Wert ca. ${num(ITEMS[c.sel].value)} Münzen. Auf dem Marktplatz bekommst du mehr.</p></div>
      <button class="btn ghost small" data-act="scrap">1× abgeben ${coins(Math.max(1, Math.round(ITEMS[c.sel].value * 0.3)))}</button></div>` : '';
    return {
      title: 'Lagerhaus', sub: `${used} von ${S.storage.cap} Plätzen belegt`, img: this.app.thumb('storage'), color: CAT_COLOR.fixed,
      body: `<div class="bar"><i style="width:${Math.min(100, (used / S.storage.cap) * 100)}%" class="${used >= S.storage.cap ? 'full' : ''}"></i></div>
        <div class="tabs">${tabs.map((t, i) => `<button class="tab ${c.tab === i ? 'on' : ''}" data-act="tab" data-arg="${i}">${t}</button>`).join('')}</div>
        <div class="grid tiles">${tiles}</div>${sel}
        <div class="box"><h3>Lager vergrößern <span class="muted">+${up.add} Plätze</span></h3>
          <div class="reqs">${STORAGE_PARTS.map((p) => reqChip(g, p, up.parts)).join('')}</div>
          <p class="muted small">Schlösser, Riegel und Ketten findest du beim Einsammeln von Waren, im Güterbahnhof und auf dem Marktplatz.</p>
          <button class="btn primary" data-act="upStorage" ${STORAGE_PARTS.every((p) => g.stored(p) >= up.parts) ? '' : 'disabled'}>Vergrößern</button></div>`,
      foot: this.bFoot(g.findUnique('storage')),
    };
  }

  // -------------------------------------------------------------- city hall
  r_cityhall(c) {
    const g = this.game, S = g.state;
    const cap = g.taxCap();
    const acc = Math.floor(S.taxes.acc);
    return {
      title: 'Rathaus', sub: `${esc(S.name)} · Stufe ${S.level}`, img: this.app.thumb('cityhall'), color: CAT_COLOR.fixed,
      body: `<div class="box tax">
          <div class="tax-top">${icon('coin', 'xl')}<div><b class="big">${num(acc)}</b><span class="muted"> / ${num(cap)} Münzen</span><p class="muted small">${num(g.city.taxRate * 60)} Münzen pro Stunde aus Steuern</p></div></div>
          <div class="bar"><i style="width:${Math.min(100, (acc / cap) * 100)}%"></i></div>
          <button class="btn primary wide" data-act="taxes" ${acc < 1 ? 'disabled' : ''}>Steuern einsammeln</button>
          <p class="muted small">Zufriedene Bürger zahlen mehr. Häuser ohne Strom, Wasser, Abwasser oder Müllabfuhr zahlen nichts.</p>
        </div>
        ${this.cityStats()}`,
      foot: this.bFoot(c.arg ? g.byId.get(c.arg) : g.findUnique('cityhall')),
    };
  }

  cityStats() {
    const g = this.game, S = g.state;
    const houses = S.buildings.filter((b) => b.type === 'house');
    const cov = (k) => houses.length ? Math.round(houses.filter((b) => g.info.get(b.id)?.services?.[k]).length / houses.length * 100) : 0;
    const pol = houses.length ? Math.round(houses.filter((b) => g.info.get(b.id)?.polluted).length / houses.length * 100) : 0;
    const util = Object.keys(UTIL_NAMES).map((k) => {
      const sup = g.city.supply[k], dem = g.city.demand[k];
      const ok = sup >= dem;
      return `<div class="ubar ${ok ? '' : 'bad'}">${icon(k)}<div class="ub"><div class="ub-t"><span>${UTIL_NAMES[k]}</span><b>${dem} / ${sup}</b></div><div class="bar"><i style="width:${sup ? Math.min(100, dem / sup * 100) : dem ? 100 : 0}%"></i></div></div></div>`;
    }).join('');
    const tips = [];
    for (const k of Object.keys(UTIL_NAMES)) if (g.city.demand[k] > g.city.supply[k] && !((k === 'sewage' || k === 'waste') && S.level < 2)) tips.push(`${UTIL_NAMES[k]}: Der Bedarf ist größer als die Kapazität – baue mehr unter „Bauen › Versorgung“.`);
    if (pol > 30) tips.push('Viele Häuser leiden unter Abgasen. Halte Fabriken und Kraftwerke von Wohngebieten fern.');
    if (S.level >= 3 && cov('fire') < 70) tips.push('Nicht alle Häuser sind vor Feuer geschützt.');
    if (g.storageFree() < 5) tips.push('Dein Lager ist fast voll. Verkaufe Waren oder baue Häuser damit aus.');
    return `<div class="stats">
        <div class="stat">${icon('people')}<b>${num(g.city.pop)}</b><span>Einwohner</span></div>
        <div class="stat">${icon(g.city.happy >= 65 ? 'smile' : g.city.happy >= 40 ? 'meh' : 'sad')}<b>${g.city.happy}%</b><span>Zufriedenheit</span></div>
        <div class="stat">${icon('home')}<b>${houses.length}</b><span>Wohngebiete</span></div>
      </div>
      <h3>Versorgung <span class="muted">Bedarf / Kapazität</span></h3>
      <div class="ubars">${util}</div>
      <h3>Abdeckung der Wohngebiete</h3>
      <div class="pills">
        <span class="pill ${cov('fire') >= 90 ? 'good' : 'bad'}">${icon('fire')}Feuer ${cov('fire')}%</span>
        <span class="pill ${cov('police') >= 90 ? 'good' : 'bad'}">${icon('police')}Polizei ${cov('police')}%</span>
        <span class="pill ${cov('health') >= 90 ? 'good' : 'bad'}">${icon('health')}Gesundheit ${cov('health')}%</span>
        <span class="pill ${pol <= 10 ? 'good' : 'bad'}">Smog ${pol}%</span>
      </div>
      ${tips.length ? `<div class="tips">${tips.map((t) => `<div class="note">${t}</div>`).join('')}</div>` : '<div class="note good">Alles im grünen Bereich. Weiter so, Bürgermeister!</div>'}`;
  }

  r_overview() {
    return { title: 'Stadtübersicht', sub: esc(this.game.state.name), icon: icon('stats'), color: '#4d9de6', body: this.cityStats() };
  }

  // -------------------------------------------------------------- market
  r_market(c) {
    const g = this.game, m = g.state.market;
    const now = Date.now();
    const gm = this.app.gm;
    const tabs = `<div class="tabs"><button class="tab ${c.tab === 0 ? 'on' : ''}" data-act="tab" data-arg="0">Händler</button><button class="tab ${c.tab === 1 ? 'on' : ''}" data-act="tab" data-arg="1">Verkaufen</button>${gm.available ? `<button class="tab ${c.tab === 2 ? 'on' : ''}" data-act="tab" data-arg="2">Weltmarkt${gm.soldWaiting() ? ' •' : ''}</button>` : ''}</div>`;
    let body = '';
    if (c.tab === 0) {
      const offers = m.offers.map((o, i) => o.sold
        ? `<div class="card offer sold"><span class="muted">Ausverkauft</span><small class="muted">neue Ware in ${fmtTime((o.restock - now) / 1000)}</small></div>`
        : `<button class="card offer" data-act="buyOffer" data-arg="${i}">${itemIcon(o.item, 'lg')}<b>${o.qty}× ${ITEMS[o.item].name}</b>${coins(o.price)}<span class="muted small">Lager: ${g.stored(o.item)}</span></button>`).join('');
      const wait = m.refreshAt - now;
      body = `${tabs}<div class="grid offers">${offers}</div>
        <div class="row center"><span class="muted small">Händler aus der Region liefern regelmäßig neue Ware.</span>
        <button class="btn ghost small" data-act="refreshMarket">${wait > 0 ? `Neu laden ${crystals(2)}` : 'Neue Angebote'}</button></div>`;
    } else if (c.tab === 2 && !c.form && !c.picking) {
      if (!gm.loaded || Date.now() - gm.loaded > 20000) { if (!gm.loading) { gm.loading = true; gm.refresh().finally(() => { gm.loading = false; }); } }
      const offers = gm.offers.map((o) => `<button class="card offer" data-act="gBuy" data-arg="${o.id}">${itemIcon(o.item, 'lg')}<b>${o.qty}× ${ITEMS[o.item]?.name || o.item}</b>${coins(o.price)}<span class="muted small">von ${esc(o.sellerName)}</span></button>`).join('');
      const mine = gm.mine.map((o) => `<div class="card sale ${o.sold ? 'sold' : ''}">${itemIcon(o.item, 'lg')}<b>${o.qty}× ${ITEMS[o.item]?.name || o.item}</b>${coins(o.price)}
        ${o.sold ? `<button class="btn primary small" data-act="gCollect" data-arg="${o.id}">Einnehmen</button>` : `<span class="muted small">${o.expired ? 'abgelaufen' : 'im Weltmarkt'}</span><button class="btn ghost small" data-act="gCancel" data-arg="${o.id}">${o.expired ? 'Zurücknehmen' : 'Zurückziehen'}</button>`}</div>`).join('');
      body = `${tabs}${gm.error ? `<div class="note bad">${gm.error}</div>` : ''}
        <h3>Angebote anderer Städte</h3>
        <div class="grid offers">${offers || `<p class="muted">${gm.loaded ? 'Gerade bietet niemand etwas an. Schau später wieder vorbei!' : 'Lade…'}</p>`}</div>
        <h3>Deine Angebote</h3>
        <div class="grid sales">${mine}<button class="card sale empty" data-act="gNew">+<span>Im Weltmarkt anbieten</span></button></div>
        <p class="muted small">Hier handelst du mit echten Spielern. Angebotene Waren verlassen sofort dein Lager; sobald jemand kauft, nimmst du die Münzen hier ein. Unverkaufte Angebote laufen nach drei Tagen ab.</p>`;
    } else if (c.form) {
      const f = c.form;
      const it = ITEMS[f.item];
      const fair = g.fairPrice(f.item, f.qty);
      const ratio = f.price / fair;
      const speed = ratio <= 0.85 ? 'sehr schnell' : ratio <= 1.05 ? 'schnell' : ratio <= 1.25 ? 'normal' : ratio <= 1.45 ? 'langsam' : 'sehr langsam';
      body = `${tabs}<div class="box sellform">
          <div class="row">${itemIcon(f.item, 'xl')}<div><b>${it.name}</b><p class="muted small">Auf Lager: ${g.stored(f.item)}</p></div></div>
          <div class="stepper"><span>Menge</span><button class="btn round-s" data-act="qty" data-arg="-1">−</button><b>${f.qty}</b><button class="btn round-s" data-act="qty" data-arg="1">+</button></div>
          <div class="stepper"><span>Preis</span><button class="btn round-s" data-act="price" data-arg="-1">−</button><b>${coins(f.price)}</b><button class="btn round-s" data-act="price" data-arg="1">+</button></div>
          <p class="muted small">Marktwert ${num(fair)} · Käufer finden sich <b>${speed}</b></p>
          <div class="row"><button class="btn ghost" data-act="cancelForm">Zurück</button><button class="btn primary" data-act="listSale">${f.global ? 'Im Weltmarkt anbieten' : 'Anbieten'}</button></div>
        </div>`;
    } else if (c.picking) {
      const ids = [...RAW_IDS, ...GOOD_IDS].filter((id) => g.stored(id) > 0);
      body = `${tabs}<p class="muted">Was möchtest du verkaufen?</p><div class="grid tiles">${ids.map((id) => `<button class="tile" data-act="pickSell" data-arg="${id}">${itemIcon(id, 'lg')}<b>${g.stored(id)}</b><span>${ITEMS[id].name}</span></button>`).join('') || '<p class="muted center">Dein Lager ist leer.</p>'}</div>
        <button class="btn ghost" data-act="cancelForm">Zurück</button>`;
    } else {
      let slots = '';
      for (let i = 0; i < m.slots; i++) {
        const s = m.sales[i];
        if (!s) { slots += `<button class="card sale empty" data-act="newSale">+<span>Angebot erstellen</span></button>`; continue; }
        const sold = s.soldAt <= now;
        slots += `<div class="card sale ${sold ? 'sold' : ''}">${itemIcon(s.item, 'lg')}<b>${s.qty}× ${ITEMS[s.item].name}</b>${coins(s.price)}
          ${sold ? `<button class="btn primary small" data-act="collectSale" data-arg="${i}">Einnehmen</button>` : `<span class="muted small">wartet auf Käufer…</span><button class="btn ghost small" data-act="cancelSale" data-arg="${i}">Zurückziehen</button>`}</div>`;
      }
      const sp = g.salesSlotPrice();
      body = `${tabs}<div class="grid sales">${slots}${sp != null ? `<button class="card sale add" data-act="buySaleSlot">+ Platz<span>${coins(sp)}</span></button>` : ''}</div>`;
    }
    return { title: 'Marktplatz', sub: 'Handel mit der Region', img: this.app.thumb('market'), color: '#3cae7e', wide: true, body, foot: this.bFoot(g.findUnique('market')) };
  }

  // -------------------------------------------------------------- cargo
  r_cargo() {
    const g = this.game, cg = g.state.cargo;
    const now = Date.now();
    let body;
    if (cg.returnAt) {
      const left = (cg.returnAt - now) / 1000;
      body = `<div class="box center">${icon('train', 'xl')}<h3>Der Zug ist unterwegs</h3><p class="muted">Zurück in ${fmtTime(left)} mit neuen Aufträgen.</p>
        <button class="btn cry" data-act="skipCargo">Sofort zurückholen ${crystals(skipPrice(left))}</button></div>`;
    } else {
      body = `<p class="muted">Belade alle drei Wagen – der volle Zug bringt einen Bonus und ein Bauteil.</p><div class="grid wagons">${cg.wagons.map((w, i) => `
        <div class="card wagon ${w.done ? 'done' : ''}">
          <div class="wg-top">${itemIcon(w.item, 'xl')}<b>${w.qty}× ${ITEMS[w.item].name}</b></div>
          ${w.done ? '<span class="pill good">Beladen ✓</span>' : `${reqChip(g, w.item, w.qty)}<div class="rewards">${coins(w.coins)} <span class="cur xp">${icon('xp')}${w.xp}</span></div>
          <button class="btn primary small" data-act="loadWagon" data-arg="${i}" ${g.stored(w.item) >= w.qty ? '' : 'disabled'}>Beladen</button>`}
        </div>`).join('')}</div>`;
    }
    return { title: 'Güterbahnhof', sub: 'Lieferaufträge', img: this.app.thumb('cargo'), color: '#e2574c', body, foot: this.bFoot(g.findUnique('cargo')) };
  }

  // -------------------------------------------------------------- generic info
  r_info(c) {
    const g = this.game, b = g.byId.get(c.arg);
    if (!b) return null;
    const def = BUILDINGS[b.type];
    const lines = [];
    if (def.supply) for (const [k, v] of Object.entries(def.supply)) lines.push(`<span class="pill good">${icon(k)}+${v} ${UTIL_NAMES[k]}</span>`);
    if (def.service) lines.push(`<span class="pill good">${icon(def.service.kind)}${SERVICE_NAMES[def.service.kind]} · Radius ${def.service.r}</span>`);
    if (def.boost) lines.push(`<span class="pill good">${icon('people')}+${def.boost.pct}% Einwohner · Radius ${def.boost.r}</span>`);
    if (def.pollution) lines.push(`<span class="pill bad">Abgase · Radius ${def.pollution}</span>`);
    const inf = g.info.get(b.id);
    const connected = def.noRoad || inf?.road;
    return {
      title: def.name, sub: '', img: this.app.thumb(b.type), color: CAT_COLOR[def.cat],
      body: `<p>${def.desc}</p><div class="pills">${lines.join('')}</div>${connected ? '' : '<div class="note bad">Keine Straßenanbindung – das Gebäude arbeitet nicht.</div>'}
        ${def.supply ? this.utilShort(def) : ''}`,
      foot: this.bFoot(b),
    };
  }

  utilShort(def) {
    const g = this.game;
    return Object.keys(def.supply).map((k) => `<div class="ubar">${icon(k)}<div class="ub"><div class="ub-t"><span>${UTIL_NAMES[k]} in der Stadt</span><b>${g.city.demand[k]} / ${g.city.supply[k]}</b></div><div class="bar"><i style="width:${g.city.supply[k] ? Math.min(100, g.city.demand[k] / g.city.supply[k] * 100) : 0}%"></i></div></div></div>`).join('');
  }

  // -------------------------------------------------------------- land
  r_expand(c) {
    const g = this.game;
    const p = g.expansionPrice();
    const can = g.state.coins >= p.coins && EXPAND_PARTS.every((x) => g.stored(x) >= p.parts);
    return {
      title: 'Bauland kaufen', sub: '8 × 8 Felder', icon: icon('land'), color: '#53b04c',
      body: `<p>Erweitere deine Stadt um ein neues Grundstück. Die Bäume werden dabei gerodet.</p>
        <div class="reqs">${EXPAND_PARTS.map((x) => reqChip(g, x, p.parts)).join('')}</div>
        <div class="rewards"><span class="muted">Preis</span> ${coins(p.coins)}</div>
        <p class="muted small">Vermessungspflöcke, Baupläne und Grundbuchauszüge bekommst du beim Ausbauen von Häusern, als Aufgabenbelohnung, im Güterbahnhof und auf dem Marktplatz.</p>
        <button class="btn primary wide" data-act="buyLand" ${can ? '' : 'disabled'}>Kaufen</button>`,
    };
  }

  // -------------------------------------------------------------- quests
  r_quests() {
    const g = this.game;
    const cards = g.state.quests.active.map((q) => {
      const p = Math.min(q.n, Math.max(0, questProgress(g, q)));
      const done = p >= q.n;
      return `<div class="card quest ${done ? 'done' : ''}">
        <div class="q-text"><b>${q.text}</b><div class="bar"><i style="width:${(p / q.n) * 100}%"></i></div><span class="muted small">${num(p)} / ${num(q.n)}</span></div>
        <div class="q-rew">${q.coins ? coins(q.coins) : ''}<span class="cur xp">${icon('xp')}${q.xp}</span>${q.crystals ? crystals(q.crystals) : ''}${q.part ? '<span class="cur">🎁 Bauteil</span>' : ''}</div>
        <button class="btn ${done ? 'primary' : 'ghost'} small" data-act="claim" data-arg="${q.uid}" ${done ? '' : 'disabled'}>${done ? 'Abholen' : 'Läuft'}</button>
      </div>`;
    }).join('');
    return { title: 'Aufgaben', sub: 'Ziele des Bürgermeisters', icon: icon('list'), color: '#c99a4e', body: `<div class="quests">${cards}</div>` };
  }

  // -------------------------------------------------------------- progress
  r_progress() {
    const g = this.game, S = g.state;
    const need = xpForNext(S.level);
    const next = [S.level + 1, S.level + 2].map((L) => {
      const bs = BUILD_ORDER.filter((id) => BUILDINGS[id].level === L && BUILDINGS[id].cat !== 'fixed');
      const its = Object.values(ITEMS).filter((it) => it.level === L && it.kind !== 'special');
      if (!bs.length && !its.length) return `<div class="kv"><span>Stufe ${L}</span><div class="muted small">Höhere Häuser (Stufe ${Math.min(8, 2 + Math.floor(L / 2))})</div></div>`;
      return `<div class="kv"><span>Stufe ${L}</span><div class="pills">${bs.map((id) => `<span class="pill">${BUILDINGS[id].name}</span>`).join('')}${its.map((it) => `<span class="pill">${it.icon} ${it.name}</span>`).join('')}</div></div>`;
    }).join('');
    return {
      title: `Stufe ${S.level}`, sub: `${num(S.xp)} / ${num(need)} Erfahrung`, icon: icon('xp'), color: '#e8a210',
      body: `<div class="bar xpbar"><i style="width:${(S.xp / need) * 100}%"></i></div>
        <p class="muted small">Erfahrung gibt es für Produktion, Hausausbau, Aufgaben, Handel und Lieferungen.</p>
        <h3>Als Nächstes</h3>${next}`,
    };
  }

  // -------------------------------------------------------------- settings
  r_settings(c) {
    const st = this.app.settings, g = this.game;
    const sv = this.app.save;
    const statusText = { synced: 'Online gesichert', syncing: 'Synchronisiere…', error: 'Server nicht erreichbar – lokal gesichert', noserver: 'Kein Speicher-Server gefunden – lokal gesichert', offline: 'Lokal gesichert' }[sv.status];
    const opt = (key, val, label) => `<button class="seg ${st[key] === val ? 'on' : ''}" data-act="set" data-arg="${key}:${val}">${label}</button>`;
    return {
      title: 'Einstellungen', icon: icon('gear'), color: '#5a6b7d',
      body: `<div class="kv"><span>Stadtname</span><input class="inp" id="cityName" value="${esc(g.state.name)}" maxlength="28"></div>
        <div class="kv"><span>Ton</span><div class="segs">${opt('sound', true, 'An')}${opt('sound', false, 'Aus')}</div></div>
        <div class="kv"><span>Grafik</span><div class="segs">${opt('quality', 'high', 'Hoch')}${opt('quality', 'low', 'Schnell')}</div></div>
        <div class="kv"><span>Schatten</span><div class="segs">${opt('shadows', true, 'An')}${opt('shadows', false, 'Aus')}</div></div>
        <div class="kv"><span>Tageszeit</span><div class="segs">${opt('daytime', 'cycle', 'Tag & Nacht')}${opt('daytime', 'day', 'Immer Tag')}${opt('daytime', 'real', 'Echtzeit')}</div></div>
        <div class="box"><h3>${icon('cloud')} Online-Speicherung</h3>
          <p class="small">${statusText}${sv.lastCloud ? ` · zuletzt ${new Date(sv.lastCloud).toLocaleTimeString('de-DE')}` : ''}</p>
          <p class="muted small">Dein Spielstand wird automatisch gespeichert. Mit dem Sync-Code spielst du auf einem anderen Gerät weiter.</p>
          <div class="kv"><span>Dein Sync-Code</span><code class="code">${syncCode()}</code><button class="btn ghost small" data-act="copyCode">Kopieren</button></div>
          <div class="kv"><span>Code eingeben</span><input class="inp" id="codeIn" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off" spellcheck="false"><button class="btn ghost small" data-act="useCode">Laden</button></div>
          <div class="kv"><span>Server</span><input class="inp" id="serverIn" placeholder="automatisch" value="${esc(st.server || '')}"></div>
          <button class="btn primary small" data-act="syncNow">Jetzt sichern</button>
        </div>
        <div class="box"><h3>Spielstand</h3><div class="row">
          <button class="btn ghost small" data-act="export">Exportieren</button>
          <label class="btn ghost small">Importieren<input type="file" id="importFile" accept=".json,application/json" hidden></label>
          <button class="btn ghost small danger" data-act="reset">${c.confirmReset ? 'Wirklich alles löschen?' : 'Neues Spiel'}</button>
        </div></div>
        <p class="muted small center">Neustadt · ein Städtebauspiel ohne Echtgeld-Käufe</p>`,
    };
  }

  // -------------------------------------------------------------- inputs & actions
  onInput(e) {
    const t = e.target;
    const g = this.game;
    if (t.id === 'cityName') { g.state.name = t.value.trim() || 'Neustadt'; g.emit('change'); }
    if (t.id === 'serverIn') { this.app.settings.server = t.value.trim(); saveSettings(this.app.settings); }
    if (t.id === 'importFile' && t.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try {
          const s = JSON.parse(r.result);
          if (!s.buildings) throw new Error();
          this.app.replaceState(s);
        } catch { g.toast('Diese Datei ist kein Spielstand', 'bad'); }
      };
      r.readAsText(t.files[0]);
    }
  }

  act(a, arg, el) {
    const g = this.game, c = this.cur;
    const app = this.app;
    const bid = c?.arg;
    switch (a) {
      case 'close': this.close(); return;
      case 'tab': c.tab = Number(arg); c.form = null; c.picking = false; c.sel = null; if (c.kind === 'market' && c.tab === 2) app.gm.refresh(); break;
      case 'move': this.close(); app.startMove(Number(arg)); return;
      case 'demolish': {
        if (c.confirmDemolish) { g.demolish(Number(arg)); sfx.remove(); this.close(); return; }
        c.confirmDemolish = true;
        el.innerHTML = 'Wirklich abreißen?';
        return;
      }
      case 'upgrade': case 'upgradeBuy': {
        if (g.upgradeHouse(bid, a === 'upgradeBuy')) { sfx.upgrade(); }
        break;
      }
      case 'reroll': g.rerollRequest(bid); break;
      case 'extinguish': if (g.extinguish(bid)) sfx.collect(); break;
      case 'produce': if (g.produce(bid, arg)) sfx.tap(); break;
      case 'collectF': if (g.collectFactory(bid)) sfx.collect(); break;
      case 'skipF': case 'skipS': c.skip = Number(arg); break;
      case 'noSkip': c.skip = null; break;
      case 'doSkip': if (g.skip(bid, Number(arg))) sfx.coin(); c.skip = null; break;
      case 'buyFSlot': if (g.buyFactorySlot(bid)) sfx.coin(); break;
      case 'craft': if (g.queueGood(bid, arg)) sfx.tap(); break;
      case 'collectS': if (g.collectShop(bid)) sfx.collect(); break;
      case 'buySSlot': if (g.buyShopSlot(bid)) sfx.coin(); break;
      case 'selItem': c.sel = c.sel === arg ? null : arg; break;
      case 'scrap': g.sellToScrap(c.sel, 1); sfx.coin(); break;
      case 'upStorage': if (g.upgradeStorage()) sfx.upgrade(); break;
      case 'taxes': { const n = g.collectTaxes(); if (n) { sfx.coin(); app.hud.float(el.getBoundingClientRect().left + 60, el.getBoundingClientRect().top, `+${num(n)} ${icon('coin')}`); } break; }
      case 'buyOffer': if (g.buyOffer(Number(arg))) sfx.coin(); break;
      case 'refreshMarket': g.refreshMarket(); break;
      case 'newSale': c.picking = true; c.global = false; break;
      case 'pickSell': c.picking = false; c.form = { item: arg, qty: Math.min(g.stored(arg), ITEMS[arg].kind === 'raw' ? 5 : 1), price: 0, global: !!c.global }; c.form.price = Math.round(g.fairPrice(arg, c.form.qty) * 1.1); break;
      case 'qty': {
        const f = c.form; const r = f.price / g.fairPrice(f.item, f.qty);
        f.qty = Math.max(1, Math.min(g.stored(f.item), 10, f.qty + Number(arg)));
        f.price = Math.max(1, Math.round(g.fairPrice(f.item, f.qty) * r));
        break;
      }
      case 'price': {
        const f = c.form; const fair = g.fairPrice(f.item, f.qty);
        f.price = Math.max(Math.round(fair * 0.5), Math.min(Math.round(fair * 1.7), f.price + Math.max(1, Math.round(fair * 0.05)) * Number(arg)));
        break;
      }
      case 'cancelForm': c.form = null; c.picking = false; break;
      case 'listSale':
        if (c.form.global) { const f = c.form; c.form = null; app.gm.list(f.item, f.qty, f.price); sfx.coin(); break; }
        if (g.listSale(c.form.item, c.form.qty, c.form.price)) { sfx.coin(); c.form = null; }
        break;
      case 'gNew': c.picking = true; c.global = true; break;
      case 'gBuy': { const o = app.gm.offers.find((x) => x.id === Number(arg)); if (o) { app.gm.buy(o); sfx.coin(); } break; }
      case 'gCollect': { const o = app.gm.mine.find((x) => x.id === Number(arg)); if (o) { app.gm.collect(o); sfx.coin(); } break; }
      case 'gCancel': { const o = app.gm.mine.find((x) => x.id === Number(arg)); if (o) app.gm.cancel(o); break; }
      case 'collectSale': if (g.collectSale(Number(arg))) sfx.coin(); break;
      case 'cancelSale': g.cancelSale(Number(arg)); break;
      case 'buySaleSlot': if (g.buySalesSlot()) sfx.coin(); break;
      case 'loadWagon': if (g.loadWagon(Number(arg))) sfx.collect(); break;
      case 'skipCargo': g.skipCargo(); break;
      case 'buyLand': if (g.expand(c.arg)) { sfx.level(); this.close(); return; } break;
      case 'claim': if (g.claimQuest(Number(arg))) sfx.coin(); break;
      case 'set': {
        const [k, v] = arg.split(':');
        app.settings[k] = v === 'true' ? true : v === 'false' ? false : v;
        saveSettings(app.settings);
        if (k === 'sound') setSound(app.settings.sound);
        app.world.applyQuality();
        break;
      }
      case 'copyCode': navigator.clipboard?.writeText(syncCode()).then(() => g.toast('Sync-Code kopiert', 'good')); return;
      case 'useCode': {
        const v = $('#codeIn', c.el).value;
        if (!useSyncCode(v)) { g.toast('Ungültiger Code', 'bad'); return; }
        g.toast('Lade Spielstand…', 'info');
        app.loadFromCloud();
        return;
      }
      case 'syncNow': app.save.saveLocal(); app.save.pushCloud(); g.toast('Gespeichert', 'good'); break;
      case 'export': {
        const blob = new Blob([JSON.stringify(g.state)], { type: 'application/json' });
        const a2 = document.createElement('a');
        a2.href = URL.createObjectURL(blob);
        a2.download = `${g.state.name.replace(/[^\wäöüÄÖÜß-]+/g, '_')}.json`;
        a2.click();
        return;
      }
      case 'reset': {
        if (!c.confirmReset) { c.confirmReset = true; break; }
        clearLocal();
        app.newGame();
        return;
      }
      default: break;
    }
    this.refresh(true);
  }
}
