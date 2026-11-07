import { ITEMS, fmtTime } from '../data/items.js';
import { icon } from './icons.js';

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function num(n) {
  n = Math.floor(n);
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 2 })} Mio.`;
  return n.toLocaleString('de-DE');
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export { fmtTime, icon };

export function itemIcon(id, cls = '') {
  const it = ITEMS[id];
  return `<span class="item-ic ${it.kind} ${cls}" title="${esc(it.name)}">${it.icon}</span>`;
}

// "have / need" chip for an item requirement
export function reqChip(game, id, need) {
  const have = game.stored(id);
  const ok = have >= need;
  return `<div class="req ${ok ? 'ok' : 'miss'}">${itemIcon(id)}<span class="req-n">${Math.min(have, 999)}/${need}</span></div>`;
}

export function coins(n) { return `<span class="cur coin">${icon('coin')}${num(n)}</span>`; }
export function crystals(n) { return `<span class="cur cry">${icon('crystal')}${num(n)}</span>`; }

export function progressRing(frac, size = 44, stroke = 5, color = '#36c26b') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(0,0,0,.12)" stroke-width="${stroke}" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, frac)))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
