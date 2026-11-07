export class Emitter {
  constructor() {
    this._h = new Map();
  }
  on(ev, fn) {
    if (!this._h.has(ev)) this._h.set(ev, new Set());
    this._h.get(ev).add(fn);
    return () => this._h.get(ev).delete(fn);
  }
  emit(ev, ...args) {
    const s = this._h.get(ev);
    if (s) for (const fn of [...s]) fn(...args);
  }
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(arr, rnd = Math.random) {
  return arr[Math.floor(rnd() * arr.length)];
}
