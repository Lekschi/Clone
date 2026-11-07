// Global market: trade with other players through the save server.
import { account } from './save.js';
import { inClaude, claudeBackend } from './claude.js';
import { ITEMS } from '../data/items.js';

const EXPIRE = 3 * 864e5;

// World market on the claude.ai artifact database: one document per offer in `market`.
class ClaudeMarket {
  constructor(gm) {
    this.gm = gm;
    this.b = null;
    this.unsub = null;
  }

  async start() {
    this.b = await claudeBackend();
    if (!this.b.ok) return false;
    this.col = this.b.db.collection('market');
    const timer = setTimeout(() => { if (!this.gm.loaded) { this.gm.error = 'Der Weltmarkt antwortet gerade nicht.'; this.gm.notify(); } }, 10000);
    this.unsub = this.col.orderBy('created', 'desc').limit(400).onSnapshot((snap) => {
      clearTimeout(timer);
      const now = Date.now();
      const uid = this.b.uid;
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      this.gm.offers = all.filter((o) => !o.buyer && o.seller !== uid && now - o.created < EXPIRE).slice(0, 60);
      this.gm.mine = all.filter((o) => o.seller === uid && !o.paid).map((o) => ({ ...o, sold: !!o.buyer, expired: !o.buyer && now - o.created >= EXPIRE }));
      this.gm.error = null;
      this.gm.loaded = Date.now();
      this.gm.notify();
    }, () => { clearTimeout(timer); this.gm.error = 'Der Weltmarkt ist gerade nicht erreichbar.'; this.gm.notify(); });
    return true;
  }

  // Claim an offer under a short lease so two buyers cannot both get it.
  async claim(id, fn) {
    const ref = this.col.doc(String(id));
    const lease = await ref.acquire({ holder: this.b.uid, ttlMs: 4000 });
    if (!lease.acquired) { const e = new Error('busy'); e.code = 'sold'; throw e; }
    const snap = await ref.get();
    if (!snap.exists) { const e = new Error('gone'); e.code = 'gone'; throw e; }
    return fn(ref, snap.data());
  }

  async buy(o) {
    await this.claim(o.id, async (ref, d) => {
      if (d.buyer) { const e = new Error('sold'); e.code = 'sold'; throw e; }
      await ref.update({ buyer: this.b.uid, boughtAt: Date.now() });
    });
  }

  async list(item, qty, price, name) {
    const mine = this.gm.mine.filter((o) => !o.expired).length;
    if (mine >= 10) { const e = new Error('too many'); e.code = 'too many'; throw e; }
    await this.col.add({ seller: this.b.uid, sellerName: String(name).slice(0, 28), item, qty, price, created: Date.now(), buyer: null, boughtAt: 0, paid: false });
  }

  async collect(o) {
    return this.claim(o.id, async (ref, d) => {
      if (!d.buyer || d.paid || d.seller !== this.b.uid) { const e = new Error('not sold'); e.code = 'not sold'; throw e; }
      await ref.update({ paid: true });
      return { price: d.price };
    });
  }

  async cancel(o) {
    return this.claim(o.id, async (ref, d) => {
      if (d.buyer || d.seller !== this.b.uid) { const e = new Error('sold'); e.code = 'sold'; throw e; }
      await ref.delete();
      return { item: d.item, qty: d.qty };
    });
  }
}
export class GlobalMarket {
  constructor(app) {
    this.app = app;
    this.offers = [];
    this.mine = [];
    this.loaded = 0;
    this.error = null;
    this.available = false;
    this.cm = inClaude() ? new ClaudeMarket(this) : null;
    if (!this.cm) setInterval(() => { if (this.available) this.refresh(true); }, 60000);
  }

  async enable() {
    if (this.cm) { this.available = await this.cm.start(); this.notify(); return; }
    this.available = true;
    this.refresh(true);
  }

  notify() {
    if (this.app.panels?.cur?.kind === 'market') this.app.panels.refresh(true);
  }

  get game() { return this.app.game; }

  async req(path, opts = {}) {
    const a = account();
    const r = await fetch(`${this.app.save.base()}/market${path}`, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Key': a.key },
      body: opts.method === 'POST' ? JSON.stringify({ id: a.id, ...(opts.body || {}) }) : undefined,
      cache: 'no-store',
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || String(r.status)); e.code = j.error; throw e; }
    return j;
  }

  async refresh(quiet = false) {
    if (this.cm) { this.notify(); return; }
    const a = account();
    try {
      const [o, m] = await Promise.all([this.req(`?id=${encodeURIComponent(a.id)}`), this.req(`/mine?id=${encodeURIComponent(a.id)}`)]);
      this.offers = o.listings || [];
      this.mine = m.listings || [];
      this.error = null;
    } catch (e) {
      this.error = e.code === 'account' ? 'Dein Spielstand ist noch nicht online gesichert.' : 'Der Weltmarkt ist gerade nicht erreichbar.';
    }
    this.loaded = Date.now();
    if (!quiet || this.app.panels.cur?.kind === 'market') this.app.panels.refresh(true);
  }

  soldWaiting() { return this.mine.some((l) => l.sold && !l.paid); }

  async buy(l) {
    const g = this.game;
    if (g.state.coins < l.price) return g.fail('Nicht genug Münzen');
    if (g.storageFree() < l.qty) return g.fail('Nicht genug Platz im Lager');
    try {
      if (this.cm) await this.cm.buy(l);
      else await this.req(`/buy/${l.id}`, { method: 'POST' });
      g.state.coins -= l.price;
      g.addItem(l.item, l.qty);
      g.toast(`${l.qty}× ${ITEMS[l.item].name} von ${l.sellerName} gekauft`, 'good');
      g.emit('change');
    } catch (e) {
      g.toast(e.code === 'sold' || e.code === 'gone' ? 'Schon verkauft – jemand war schneller' : 'Kauf nicht möglich', 'bad');
    }
    this.refresh();
    return true;
  }

  async list(item, qty, price) {
    const g = this.game;
    if (g.stored(item) < qty) return g.fail('Nicht genug auf Lager');
    g.takeItems({ [item]: qty });
    g.emit('change');
    try {
      if (this.cm) await this.cm.list(item, qty, price, g.state.name);
      else await this.req('/list', { method: 'POST', body: { item, qty, price, name: g.state.name } });
      g.toast('Im Weltmarkt angeboten', 'good');
    } catch (e) {
      g.addItem(item, qty);
      g.emit('change');
      g.toast(e.code === 'too many' ? 'Du hast schon 10 Angebote im Weltmarkt' : 'Angebot konnte nicht erstellt werden', 'bad');
    }
    this.refresh();
    return true;
  }

  async collect(l) {
    const g = this.game;
    try {
      const r = this.cm ? await this.cm.collect(l) : await this.req(`/collect/${l.id}`, { method: 'POST' });
      g.state.coins += r.price;
      g.state.stats.sold++;
      g.addXP(Math.max(1, Math.round(r.price / 60)));
      g.emit('sold', { item: l.item, qty: l.qty });
      g.questCheck();
      g.emit('change');
    } catch { g.toast('Einnahme nicht möglich', 'bad'); }
    this.refresh();
  }

  async cancel(l) {
    const g = this.game;
    if (g.storageFree() < l.qty) return g.fail('Nicht genug Platz im Lager');
    try {
      const r = this.cm ? await this.cm.cancel(l) : await this.req(`/cancel/${l.id}`, { method: 'POST' });
      g.addItem(r.item, r.qty);
      g.emit('change');
    } catch { g.toast('Zurückziehen nicht möglich', 'bad'); }
    this.refresh();
    return true;
  }
}
