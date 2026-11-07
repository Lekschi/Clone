import { inClaude, claudeBackend, saveDoc, slotsDoc } from './claude.js';
// Saving: instant local autosave plus online sync to a save server.
//
// Local: every change is written to localStorage (debounced) and on page hide.
// Online: each device gets an account (random id + secret key). The save is pushed to the server
// whenever it changed; on start the newer of local/online wins. The "Sync-Code" moves an account
// to another device.

const LOCAL_KEY = 'neustadt.save.v1';
const BACKUP_KEY = 'neustadt.save.backup';
const ACTIVE_KEY = 'neustadt.active';
const SLOTS_KEY = 'neustadt.slots';
export const MAX_SLOTS = 3;
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
  const def = { sound: true, music: true, ambience: true, quality: 'high', shadows: true, daytime: 'cycle', weather: true, server: '' };
  try { return { ...def, ...JSON.parse(safeGet(SETTINGS_KEY) || '{}') }; } catch { return def; }
}
export function saveSettings(s) { safeSet(SETTINGS_KEY, JSON.stringify(s)); }

// ------------------------------------------------------------------ city slots
// Each player can keep several cities. Slot "main" keeps the original storage keys.
export function activeSlot() { return safeGet(ACTIVE_KEY) || 'main'; }
export function setActiveSlot(id) { safeSet(ACTIVE_KEY, id); }
const localKey = (slot) => (slot === 'main' ? LOCAL_KEY : `neustadt.save.${slot}`);
const backupKey = (slot) => (slot === 'main' ? BACKUP_KEY : `neustadt.backup.${slot}`);
export function newSlotId() { return token(6); }

function localSlots() {
  try { return JSON.parse(safeGet(SLOTS_KEY) || '[]'); } catch { return []; }
}
function writeLocalSlots(list) { safeSet(SLOTS_KEY, JSON.stringify(list)); }

export function slotMeta(slot, s) {
  return { id: slot, name: s.name, level: s.level, pop: s.stats?.popRecord || 0, updated: s.updated || Date.now(), seed: s.seed };
}

export function touchSlot(slot, s) {
  const list = localSlots().filter((x) => x.id !== slot);
  list.push(slotMeta(slot, s));
  writeLocalSlots(list);
  return list;
}

// Slots known locally and online (claude.ai), newest first.
export async function listSlots() {
  let list = localSlots();
  // a legacy save without index entry
  if (!list.some((x) => x.id === 'main')) { const m = loadLocal('main'); if (m) list.push(slotMeta('main', m)); }
  if (inClaude()) {
    const b = await claudeBackend();
    if (b.ok) {
      try {
        const snap = await Promise.race([slotsDoc(b).get(), new Promise((_, r) => setTimeout(() => r(new Error('t')), 6000))]);
        const cloud = snap.exists ? snap.data().list || [] : [];
        for (const c of cloud) {
          const l = list.find((x) => x.id === c.id);
          if (!l) list.push(c); else if ((c.updated || 0) > (l.updated || 0)) Object.assign(l, c);
        }
      } catch { /* offline */ }
    }
  }
  const removed = new Set(JSON.parse(safeGet('neustadt.removed') || '[]'));
  list = list.filter((x) => !removed.has(x.id));
  return list.sort((a, b) => (b.updated || 0) - (a.updated || 0));
}

export async function deleteSlot(id) {
  writeLocalSlots(localSlots().filter((x) => x.id !== id));
  try { localStorage.removeItem(localKey(id)); localStorage.removeItem(backupKey(id)); } catch { /* ignore */ }
  const removed = new Set(JSON.parse(safeGet('neustadt.removed') || '[]'));
  removed.add(id);
  safeSet('neustadt.removed', JSON.stringify([...removed]));
  if (inClaude()) {
    const b = await claudeBackend();
    if (b.ok) {
      try {
        await saveDoc(b, id).delete();
        const list = (await listSlots()).filter((x) => x.id !== id);
        await slotsDoc(b).set({ list });
      } catch { /* offline */ }
    }
  }
  if (activeSlot() === id) setActiveSlot('main');
}

export function writeLocalState(slot, s) {
  return safeSet(localKey(slot), JSON.stringify(s));
}

export function loadLocal(slot = activeSlot()) {
  for (const k of [localKey(slot), backupKey(slot)]) {
    const raw = safeGet(k);
    if (!raw) continue;
    try { const s = JSON.parse(raw); if (s && s.buildings) return s; } catch { /* try backup */ }
  }
  return null;
}

export function clearLocal(slot = activeSlot()) {
  try { localStorage.removeItem(localKey(slot)); localStorage.removeItem(backupKey(slot)); } catch { /* ignore */ }
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

export const serverId = (a, slot) => (slot === 'main' ? a.id : `${a.id}-${slot}`);

export class SaveManager {
  constructor(game, settings) {
    this.game = game;
    this.settings = settings;
    this.slot = activeSlot();
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
    setInterval(() => { if (this.cloudDirty) this.pushCloud(); }, this.claude ? 15000 : 20000);
  }

  onStatus(fn) { this.listeners.add(fn); }
  setStatus(s) { this.status = s; for (const fn of this.listeners) fn(s); }

  mark() { this.dirty = true; this.cloudDirty = true; }

  saveLocal() {
    if (this.disabled) return;
    const s = this.game.state;
    s.updated = Date.now();
    const json = JSON.stringify(s);
    const prev = safeGet(localKey(this.slot));
    if (prev) safeSet(backupKey(this.slot), prev);
    safeSet(localKey(this.slot), json);
    touchSlot(this.slot, s);
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

  get claude() { return inClaude(); }

  async fetchCloud() {
    if (this.claude) {
      const b = await claudeBackend();
      if (!b.ok) return { error: true };
      try {
        const snap = await saveDoc(b, this.slot).get();
        if (!snap.exists) return { none: true };
        return { save: JSON.parse(snap.data().json) };
      } catch { return { error: true }; }
    }
    const a = account();
    try {
      const r = await fetch(`${this.base()}/save/${encodeURIComponent(serverId(a, this.slot))}`, { headers: { 'X-Key': a.key }, cache: 'no-store' });
      if (r.status === 404) return { none: true };
      if (!r.ok) return { error: true };
      return { save: await r.json() };
    } catch { return { error: true }; }
  }

  async pushCloud(beacon = false) {
    if (this.status === 'noserver' || this.disabled) return;
    if (this.claude) return this.pushClaude();
    const a = account();
    const s = this.game.state;
    s.updated = Date.now();
    const body = JSON.stringify(s);
    const url = `${this.base()}/save/${encodeURIComponent(serverId(a, this.slot))}?key=${encodeURIComponent(a.key)}`;
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

  // claude.ai: one private document per player, written one at a time.
  async pushClaude() {
    const b = await claudeBackend();
    if (!b.ok || this.inflight) return;
    const s = this.game.state;
    s.updated = Date.now();
    const json = JSON.stringify(s);
    if (json.length > 250000) { this.setStatus('error'); return; }
    this.inflight = true;
    this.cloudDirty = false;
    this.setStatus('syncing');
    try {
      await saveDoc(b, this.slot).set({ v: 1, updated: s.updated, json });
      // keep the online list of cities current (at most once a minute)
      if (Date.now() - (this.lastIndex || 0) > 60000) {
        this.lastIndex = Date.now();
        const list = touchSlot(this.slot, s);
        slotsDoc(b).set({ list: list.slice(-MAX_SLOTS - 2) }).catch(() => {});
      }
      this.lastCloud = Date.now();
      this.setStatus('synced');
    } catch (e) {
      this.cloudDirty = true;
      if (e && e.code === 'invalid_argument') { b.ok = false; this.setStatus('noserver'); } else this.setStatus('error');
    } finally {
      this.inflight = false;
    }
  }

  // Decide which save to start from. Returns a state object or null.
  static async resolveStart(settings) {
    const slot = activeSlot();
    const local = loadLocal(slot);
    if (inClaude()) {
      const b = await claudeBackend();
      let cloud = null;
      if (b.ok) {
        try {
          const snap = await Promise.race([saveDoc(b, slot).get(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 9000))]);
          if (snap.exists) cloud = JSON.parse(snap.data().json);
        } catch { /* offline: start from the local copy */ }
      }
      let state = local;
      if (cloud && cloud.buildings && (!local || (cloud.updated || 0) > (local.updated || 0))) state = cloud;
      return { state, server: b.ok, fromCloud: state === cloud && !!cloud, claude: true };
    }
    const tmp = { settings, slot, game: { state: local }, base: SaveManager.prototype.base };
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
