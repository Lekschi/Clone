// Saving: instant local autosave plus online sync to a save server.
//
// Local: every change is written to localStorage (debounced) and on page hide.
// Online: each device gets an account (random id + secret key). The save is pushed to the server
// whenever it changed; on start the newer of local/online wins. The "Sync-Code" moves an account
// to another device.

const LOCAL_KEY = 'neustadt.save.v1';
const BACKUP_KEY = 'neustadt.save.backup';
const ACCOUNT_KEY = 'neustadt.account';
const SETTINGS_KEY = 'neustadt.settings';

// Short random tokens without easily confused characters (no 0/o, 1/l/i).
const ALPHA = 'abcdefghjkmnpqrstuvwxyz23456789';
function token(n) {
  const buf = new Uint32Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (v) => ALPHA[v % ALPHA.length]).join('');
}

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

export function loadSettings() {
  const def = { sound: true, quality: 'high', shadows: true, daytime: 'cycle', weather: true, server: '' };
  try { return { ...def, ...JSON.parse(safeGet(SETTINGS_KEY) || '{}') }; } catch { return def; }
}
export function saveSettings(s) { safeSet(SETTINGS_KEY, JSON.stringify(s)); }

export function loadLocal() {
  for (const k of [LOCAL_KEY, BACKUP_KEY]) {
    const raw = safeGet(k);
    if (!raw) continue;
    try { const s = JSON.parse(raw); if (s && s.buildings) return s; } catch { /* try backup */ }
  }
  return null;
}

export function clearLocal() {
  try { localStorage.removeItem(LOCAL_KEY); localStorage.removeItem(BACKUP_KEY); } catch { /* ignore */ }
}

export function account() {
  let a = null;
  try { a = JSON.parse(safeGet(ACCOUNT_KEY) || 'null'); } catch { a = null; }
  if (!a || !a.id || !a.key) {
    a = { id: token(10), key: token(14) };
    safeSet(ACCOUNT_KEY, JSON.stringify(a));
  }
  return a;
}

export function syncCode() {
  const a = account();
  return `${a.id}${a.key}`.toUpperCase().match(/.{1,4}/g).join('-');
}

export function useSyncCode(code) {
  const raw = code.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (raw.length !== 24) return false;
  safeSet(ACCOUNT_KEY, JSON.stringify({ id: raw.slice(0, 10), key: raw.slice(10) }));
  return true;
}

export class SaveManager {
  constructor(game, settings) {
    this.game = game;
    this.settings = settings;
    this.dirty = false;
    this.cloudDirty = false;
    this.status = 'offline'; // offline | syncing | synced | error | noserver
    this.lastCloud = 0;
    this.listeners = new Set();
    this.timer = null;
    game.on('change', () => this.mark());
    const flush = () => { this.saveLocal(); this.pushCloud(true); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    setInterval(() => { if (this.dirty) this.saveLocal(); }, 4000);
    setInterval(() => { if (this.cloudDirty) this.pushCloud(); }, 20000);
  }

  onStatus(fn) { this.listeners.add(fn); }
  setStatus(s) { this.status = s; for (const fn of this.listeners) fn(s); }

  mark() { this.dirty = true; this.cloudDirty = true; }

  saveLocal() {
    const s = this.game.state;
    s.updated = Date.now();
    const json = JSON.stringify(s);
    const prev = safeGet(LOCAL_KEY);
    if (prev) safeSet(BACKUP_KEY, prev);
    safeSet(LOCAL_KEY, json);
    this.dirty = false;
  }

  base() {
    const custom = (this.settings.server || '').trim().replace(/\/+$/, '');
    if (custom) return custom;
    if (window.NEUSTADT_SERVER) return window.NEUSTADT_SERVER;
    return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}api`.replace(/\/+api$/, '/api');
  }

  async probe() {
    try {
      const r = await fetch(`${this.base()}/health`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const j = await r.json();
      return j && j.ok;
    } catch { return false; }
  }

  async fetchCloud() {
    const a = account();
    try {
      const r = await fetch(`${this.base()}/save/${encodeURIComponent(a.id)}`, { headers: { 'X-Key': a.key }, cache: 'no-store' });
      if (r.status === 404) return { none: true };
      if (!r.ok) return { error: true };
      return { save: await r.json() };
    } catch { return { error: true }; }
  }

  async pushCloud(beacon = false) {
    if (this.status === 'noserver') return;
    const a = account();
    const s = this.game.state;
    s.updated = Date.now();
    const body = JSON.stringify(s);
    const url = `${this.base()}/save/${encodeURIComponent(a.id)}?key=${encodeURIComponent(a.key)}`;
    if (beacon && navigator.sendBeacon) {
      try { navigator.sendBeacon(url, new Blob([body], { type: 'application/json' })); this.cloudDirty = false; } catch { /* ignore */ }
      return;
    }
    this.setStatus('syncing');
    try {
      const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Key': a.key }, body });
      if (!r.ok) throw new Error(String(r.status));
      this.cloudDirty = false;
      this.lastCloud = Date.now();
      this.setStatus('synced');
    } catch {
      this.setStatus('error');
    }
  }

  // Decide which save to start from. Returns a state object or null.
  static async resolveStart(settings) {
    const local = loadLocal();
    const tmp = { settings, game: { state: local }, base: SaveManager.prototype.base };
    const probe = SaveManager.prototype.probe.bind(tmp);
    const fetchCloud = SaveManager.prototype.fetchCloud.bind(tmp);
    let server = false, cloud = null;
    if (await Promise.race([probe(), new Promise((r) => setTimeout(() => r(false), 2500))])) {
      server = true;
      const c = await fetchCloud();
      if (c.save && c.save.buildings) cloud = c.save;
    }
    let state = local;
    if (cloud && (!local || (cloud.updated || 0) > (local.updated || 0))) state = cloud;
    return { state, server, fromCloud: state === cloud && !!cloud };
  }
}
