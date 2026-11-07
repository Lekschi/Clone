// Global market: trade with other players through the save server.
import { account } from './save.js';
import { ITEMS } from '../data/items.js';

export class GlobalMarket {
  constructor(app) {
    this.app = app;
    this.offers = [];
    this.mine = [];
    this.loaded = 0;
    this.error = null;
    this.available = false;
    setInterval(() => { if (this.available) this.refresh(true); }, 60000);
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
      await this.req(`/buy/${l.id}`, { method: 'POST' });
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
      await this.req('/list', { method: 'POST', body: { item, qty, price, name: g.state.name } });
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
      const r = await this.req(`/collect/${l.id}`, { method: 'POST' });
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
      const r = await this.req(`/cancel/${l.id}`, { method: 'POST' });
      g.addItem(r.item, r.qty);
      g.emit('change');
    } catch { g.toast('Zurückziehen nicht möglich', 'bad'); }
    this.refresh();
    return true;
  }
}
