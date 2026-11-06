// Save system: IndexedDB for cities (each slot = metadata + full world), localStorage for settings.
import { World, u8ToB64, b64ToU8 } from './world/world.js';

const DB = 'meridian-cities', STORE = 'cities', META = 'meta';
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
function tx(store, mode, fn) {
  return open().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store);
    let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}

export function newId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export async function listCities() {
  const all = await tx(META, 'readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => b.updated - a.updated);
}

export async function saveCity(id, world, thumb) {
  const data = world.serialize();
  const meta = { id, name: world.name, pop: world.stats.pop, funds: Math.round(world.funds), day: world.day,
    milestone: world.milestone, mapType: world.mapType, w: world.w, updated: Date.now(), thumb: thumb || null };
  await tx(STORE, 'readwrite', (s) => s.put({ id, data }));
  await tx(META, 'readwrite', (s) => s.put(meta));
  try { localStorage.setItem('meridian.last', id); } catch (e) { /* ignore */ }
  return meta;
}

export async function loadCity(id) {
  const rec = await tx(STORE, 'readonly', (s) => s.get(id));
  if (!rec) return null;
  return World.deserialize(rec.data);
}

export async function deleteCity(id) {
  await tx(STORE, 'readwrite', (s) => s.delete(id));
  await tx(META, 'readwrite', (s) => s.delete(id));
}

export async function exportCity(id) {
  const rec = await tx(STORE, 'readonly', (s) => s.get(id));
  if (!rec) return null;
  const d = { ...rec.data, layers: {} };
  for (const k in rec.data.layers) d.layers[k] = u8ToB64(rec.data.layers[k]);
  return JSON.stringify({ format: 'meridian-city', version: 1, data: d });
}

export async function importCity(text) {
  const j = JSON.parse(text);
  if (j.format !== 'meridian-city') throw new Error('Not a Meridian city file');
  const d = j.data;
  for (const k in d.layers) d.layers[k] = b64ToU8(d.layers[k]);
  const w = World.deserialize(d);
  const id = newId();
  await saveCity(id, w, null);
  return id;
}

export function lastCityId() { try { return localStorage.getItem('meridian.last'); } catch (e) { return null; } }

const DEFAULT_SETTINGS = { lang: 'auto', sound: true, music: false, dayNight: true, autosave: 60, confirmBuild: true, edgeScroll: false, quality: 'high', disasters: true };
export function getSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('meridian.settings') || '{}') }; }
  catch (e) { return { ...DEFAULT_SETTINGS }; }
}
export function setSettings(s) { try { localStorage.setItem('meridian.settings', JSON.stringify(s)); } catch (e) { /* ignore */ } }

export async function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* ignore */ }
  return false;
}
