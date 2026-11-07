// Thought-bubbles above buildings: finished goods, upgrade-ready houses, taxes, problems.
import { h, icon, num } from './dom.js';
import { ITEMS } from '../data/items.js';
import { BUILDINGS } from '../data/buildings.js';
import { sfx } from '../audio.js';

export class Bubbles {
  constructor(app) {
    this.app = app;
    this.layer = h('<div id="bubbles"></div>');
    app.root.appendChild(this.layer);
    this.items = new Map(); // key -> {el, kind, bid, chunk}
    this.layer.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.layer.addEventListener('click', (e) => {
      const b = e.target.closest('.bub');
      if (!b) return;
      this.tap(b.dataset.key, b);
    });
    this.acc = 1;
  }

  compute() {
    const g = this.app.game;
    const now = Date.now();
    const want = new Map();
    for (const b of g.state.buildings) {
      const def = BUILDINGS[b.type];
      const inf = g.info.get(b.id);
      let kind = null, html = '', cls = '';
      if (def.factory) {
        const done = b.slots.filter((s) => s.end <= now);
        if (done.length) { kind = 'collectF'; html = `<span class="bi">${ITEMS[done[0].item].icon}</span>${done.length > 1 ? `<i>${done.length}</i>` : ''}`; cls = 'ready'; }
        else if (!b.slots.length) { kind = 'open'; html = icon('zzz'); cls = 'idle'; }
      } else if (def.shop) {
        const done = b.queue.filter((s) => s.end <= now);
        const servable = (b.customers || []).some((c) => c.leaveAt > now && g.stored(c.item) >= c.qty);
        if (done.length) { kind = 'collectS'; html = `<span class="bi">${ITEMS[done[0].item].icon}</span>${done.length > 1 ? `<i>${done.length}</i>` : ''}`; cls = 'ready'; }
        else if (servable) { kind = 'open'; html = icon('people'); cls = 'ready'; }
        else if (!b.queue.length) { kind = 'open'; html = icon('zzz'); cls = 'idle'; }
      } else if (def.cat === 'res' && inf) {
        if (b.fire) { kind = 'fire'; html = icon('fire'); cls = 'alert fire'; }
        else if (!inf.road) { kind = 'open'; html = icon('road'); cls = 'alert'; }
        else if (inf.missing.length) { kind = 'open'; html = icon(inf.missing[0]); cls = 'alert'; }
        else if (b.wish) {
          // residents voice their wish: an arrow when everything is in stock, otherwise what they want
          if (!g.houseUpgradeBlock(b) && g.hasItems(b.req)) { kind = 'open'; html = icon('up'); cls = 'up'; }
          else {
            const want = Object.keys(b.req).find((k) => g.stored(k) < b.req[k]) || Object.keys(b.req)[0];
            kind = 'open'; html = `<span class="bi">${ITEMS[want].icon}</span>`; cls = 'wish';
          }
        } else if (inf.happy < 50 && b.level < 8) { kind = 'open'; html = icon(inf.happy < 30 ? 'sad' : 'meh'); cls = 'idle mood'; }
      } else if (b.type === 'cityhall') {
        const acc = g.state.taxes.acc;
        if (acc >= Math.max(15, g.taxCap() * 0.2)) { kind = 'taxes'; html = icon('coin'); cls = 'ready'; }
      } else if (b.type === 'market') {
        if (g.state.market.sales.some((s) => s.soldAt <= now) || this.app.gm?.soldWaiting()) { kind = 'open'; html = icon('coin'); cls = 'ready'; }
      } else if (b.type === 'cargo') {
        const c = g.state.cargo;
        if (!c.returnAt && c.wagons.some((w) => !w.done && g.stored(w.item) >= w.qty)) { kind = 'open'; html = icon('train'); cls = 'ready'; }
      } else if (b.type === 'storage') {
        if (g.storageFree() <= 0) { kind = 'open'; html = icon('box'); cls = 'alert'; }
      } else if (inf && !inf.road && !def.noRoad) { kind = 'open'; html = icon('road'); cls = 'alert'; }
      if (kind) want.set(`b${b.id}`, { kind, html, cls, bid: b.id });
    }
    // land for sale
    if (!this.app.mode || this.app.mode.kind === 'none') {
      for (let ci = 0; ci < g.CW * g.CW; ci++) {
        if (g.chunkUnlockable(ci)) want.set(`c${ci}`, { kind: 'land', html: icon('land'), cls: 'land', chunk: ci });
      }
    }
    for (const [k, it] of this.items) {
      if (!want.has(k)) { it.el.remove(); this.items.delete(k); }
    }
    for (const [k, w] of want) {
      let it = this.items.get(k);
      if (!it) {
        const el = h(`<button class="bub" data-key="${k}"></button>`);
        this.layer.appendChild(el);
        it = { el };
        this.items.set(k, it);
      }
      if (it.html !== w.html) { it.el.innerHTML = `<span class="bc">${w.html}</span>`; it.html = w.html; }
      if (it.cls !== w.cls) { it.el.className = `bub ${w.cls}`; it.cls = w.cls; }
      Object.assign(it, w);
    }
  }

  update(dt) {
    this.acc += dt;
    if (this.acc > 0.4) { this.acc = 0; this.compute(); }
    const w = this.app.world;
    const far = w.cam.dist > 48;
    this.layer.classList.toggle('far', far);
    this.layer.style.display = this.app.mode?.kind && this.app.mode.kind !== 'none' && this.app.mode.kind !== 'view' ? 'none' : '';
    for (const it of this.items.values()) {
      let p;
      if (it.chunk != null) {
        const C = 8, cx = it.chunk % w.game.CW, cz = Math.floor(it.chunk / w.game.CW);
        p = w.pointToScreen(cx * C + C / 2, 0.5, cz * C + C / 2);
      } else p = w.buildingAnchor(it.bid);
      if (!p || !p.vis || (far && it.cls === 'idle')) { it.el.style.display = 'none'; continue; }
      it.el.style.display = '';
      it.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }

  tap(key, el) {
    const it = this.items.get(key);
    if (!it) return;
    const g = this.app.game;
    const r = el.getBoundingClientRect();
    switch (it.kind) {
      case 'collectF': {
        const b = g.byId.get(it.bid);
        const items = b.slots.filter((s) => s.end <= Date.now()).map((s) => s.item);
        if (g.collectFactory(it.bid)) { sfx.collect(); this.app.hud.float(r.left, r.top, items.map((i) => ITEMS[i].icon).join('')); }
        break;
      }
      case 'collectS': {
        const b = g.byId.get(it.bid);
        const items = b.queue.filter((s) => s.end <= Date.now()).map((s) => s.item);
        if (g.collectShop(it.bid)) { sfx.collect(); this.app.hud.float(r.left, r.top, items.map((i) => ITEMS[i].icon).join('')); }
        break;
      }
      case 'taxes': {
        const n = g.collectTaxes();
        if (n) { sfx.coin(); this.app.hud.float(r.left, r.top, `+${num(n)} ${icon('coin')}`); }
        break;
      }
      case 'land': this.app.panels.open('expand', it.chunk); break;
      case 'fire': this.app.panels.open('house', it.bid); break;
      default: this.app.openBuilding(it.bid);
    }
    this.acc = 1;
  }
}
