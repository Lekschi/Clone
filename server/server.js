// Neustadt save server: serves the built game (dist/) and stores online saves.
// No dependencies. Run: `npm run build && npm run server` (PORT env var, default 8080).
//
// API
//   GET  /api/health                → { ok: true }
//   GET  /api/save/:id   (X-Key)    → saved state
//   PUT  /api/save/:id   (X-Key)    → store state; the first write claims the id for that key
//   POST /api/save/:id?key=…        → same as PUT (used by sendBeacon when the tab closes)
//   GET  /api/market?id=…           → other players' open offers
//   GET  /api/market/mine?id=…      → own offers (X-Key)
//   POST /api/market/list           → { id, name, item, qty, price } (X-Key)
//   POST /api/market/buy/:lid       → { id } (X-Key)
//   POST /api/market/collect/:lid   → { id } (X-Key) seller collects the payment
//   POST /api/market/cancel/:lid    → { id } (X-Key) take an unsold offer back

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(ROOT, '..', 'dist');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 8080);
const MAX_BODY = 4 * 1024 * 1024;

fs.mkdirSync(DATA, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

const hashKey = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
const validId = (id) => /^[a-zA-Z0-9-]{8,64}$/.test(id);
const file = (id) => path.join(DATA, `${id}.json`);

// small per-IP rate limit
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip) || { n: 0, t: now };
  if (now - h.t > 60000) { h.n = 0; h.t = now; }
  h.n++;
  hits.set(ip, h);
  return h.n > 120;
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Key',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ------------------------------------------------------------------ global market
const MARKET = path.join(DATA, 'market.json');
let market = { listings: [], next: 1 };
try { market = JSON.parse(fs.readFileSync(MARKET, 'utf8')); } catch { /* fresh */ }
let marketTimer = null;
function saveMarket() {
  clearTimeout(marketTimer);
  marketTimer = setTimeout(() => {
    const tmp = `${MARKET}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(market));
    fs.renameSync(tmp, MARKET);
  }, 200);
}
function pruneMarket() {
  const now = Date.now();
  for (const l of market.listings) if (!l.buyer && !l.expired && now - l.created > 3 * 864e5) l.expired = true;
  // finished trades and long-expired offers are forgotten after 30 days
  market.listings = market.listings.filter((l) => !((l.paid || l.expired) && now - (l.boughtAt || l.created) > 30 * 864e5));
}
function accountOk(id, key) {
  if (!validId(id) || !key) return false;
  const f = file(id);
  if (!fs.existsSync(f)) return false;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')).key === hashKey(key); } catch { return false; }
}
const pub = (l) => ({ id: l.id, sellerName: l.sellerName, item: l.item, qty: l.qty, price: l.price, created: l.created, sold: !!l.buyer, paid: !!l.paid, expired: !!l.expired });

async function marketApi(req, res, url) {
  const key = req.headers['x-key'];
  const parts = url.pathname.split('/').filter(Boolean); // api, market, ...
  const action = parts[2] || '';
  const lid = Number(parts[3]);
  let body = {};
  if (req.method === 'POST') { try { body = JSON.parse((await readBody(req)) || '{}'); } catch { return send(res, 400, { error: 'bad body' }); } }
  const me = body.id || url.searchParams.get('id');
  if (req.method === 'GET' && action === '') {
    pruneMarket();
    const list = market.listings.filter((l) => !l.buyer && !l.expired && l.seller !== me).sort((a, b) => b.created - a.created).slice(0, 60).map(pub);
    return send(res, 200, { listings: list });
  }
  if (!accountOk(me, key)) return send(res, 403, { error: 'account' });
  if (req.method === 'GET' && action === 'mine') {
    pruneMarket();
    return send(res, 200, { listings: market.listings.filter((l) => l.seller === me && !l.paid).map(pub) });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  if (action === 'list') {
    const { item, qty, price, name } = body;
    if (!/^[a-z]{2,16}$/.test(item || '') || !(qty >= 1 && qty <= 10) || !(price >= 1 && price <= 1e6)) return send(res, 400, { error: 'invalid' });
    if (market.listings.filter((l) => l.seller === me && !l.paid && !l.expired).length >= 10) return send(res, 429, { error: 'too many' });
    const l = { id: market.next++, seller: me, sellerName: String(name || 'Stadt').slice(0, 28), item, qty: Math.floor(qty), price: Math.floor(price), created: Date.now(), buyer: null, boughtAt: 0, paid: false };
    market.listings.push(l);
    saveMarket();
    return send(res, 200, { listing: pub(l) });
  }
  const l = market.listings.find((x) => x.id === lid);
  if (!l) return send(res, 404, { error: 'gone' });
  if (action === 'buy') {
    if (l.buyer || l.expired) return send(res, 409, { error: 'sold' });
    if (l.seller === me) return send(res, 400, { error: 'own' });
    l.buyer = me; l.boughtAt = Date.now();
    saveMarket();
    return send(res, 200, { listing: pub(l) });
  }
  if (l.seller !== me) return send(res, 403, { error: 'not yours' });
  if (action === 'collect') {
    if (!l.buyer || l.paid) return send(res, 409, { error: 'not sold' });
    l.paid = true;
    saveMarket();
    return send(res, 200, { price: l.price });
  }
  if (action === 'cancel') {
    if (l.buyer) return send(res, 409, { error: 'sold' });
    market.listings = market.listings.filter((x) => x !== l);
    saveMarket();
    return send(res, 200, { item: l.item, qty: l.qty });
  }
  return send(res, 404, { error: 'unknown' });
}

async function api(req, res, url) {
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, market: true });
  if (url.pathname.startsWith('/api/market')) return marketApi(req, res, url);
  const m = url.pathname.match(/^\/api\/save\/([^/]+)$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const id = m[1];
  if (!validId(id)) return send(res, 400, { error: 'bad id' });
  const key = req.headers['x-key'] || url.searchParams.get('key');
  if (!key) return send(res, 401, { error: 'no key' });
  const f = file(id);
  let rec = null;
  if (fs.existsSync(f)) {
    try { rec = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { rec = null; }
  }
  if (rec && rec.key !== hashKey(key)) return send(res, 403, { error: 'wrong key' });
  if (req.method === 'GET') {
    if (!rec) return send(res, 404, { error: 'no save' });
    return send(res, 200, rec.state);
  }
  if (req.method === 'PUT' || req.method === 'POST') {
    let state;
    try { state = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: 'bad body' }); }
    if (!state || !Array.isArray(state.buildings)) return send(res, 400, { error: 'not a save' });
    // never overwrite a newer save with an older one
    if (rec && (rec.state.updated || 0) > (state.updated || 0)) return send(res, 409, { error: 'older', updated: rec.state.updated });
    const out = { key: rec ? rec.key : hashKey(key), saved: Date.now(), state };
    const tmp = `${f}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(out));
    fs.renameSync(tmp, f);
    return send(res, 200, { ok: true, updated: state.updated });
  }
  return send(res, 405, { error: 'method' });
}

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const full = path.join(DIST, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(DIST)) return send(res, 403, 'forbidden', 'text/plain');
  fs.readFile(full, (err, data) => {
    if (err) {
      fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => (e2 ? send(res, 404, 'Not found – run "npm run build" first.', 'text/plain') : send(res, 200, d2, TYPES['.html'])));
      return;
    }
    const type = TYPES[path.extname(full)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': full.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(data);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (url.pathname.startsWith('/api/')) {
    if (limited(req.socket.remoteAddress)) return send(res, 429, { error: 'slow down' });
    try { return await api(req, res, url); } catch (e) { return send(res, 500, { error: String(e.message || e) }); }
  }
  serveStatic(req, res, url);
}).listen(PORT, () => console.log(`Neustadt läuft auf http://localhost:${PORT}`));
