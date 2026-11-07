// Neustadt save server: serves the built game (dist/) and stores online saves.
// No dependencies. Run: `npm run build && npm run server` (PORT env var, default 8080).
//
// API
//   GET  /api/health                → { ok: true }
//   GET  /api/save/:id   (X-Key)    → saved state
//   PUT  /api/save/:id   (X-Key)    → store state; the first write claims the id for that key
//   POST /api/save/:id?key=…        → same as PUT (used by sendBeacon when the tab closes)

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

async function api(req, res, url) {
  if (url.pathname === '/api/health') return send(res, 200, { ok: true });
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
