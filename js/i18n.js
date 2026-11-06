// Localization: English source strings are the keys; German translations live in DE.
// t('Power shortage: {a} MW needed', { a: 5 }) -> localized, with {placeholders} filled in.
import { DE } from './lang/de.js';

let lang = 'en';

export function initLang(setting) {
  if (!setting || setting === 'auto') {
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    lang = nav.toLowerCase().startsWith('de') ? 'de' : 'en';
  } else lang = setting === 'de' ? 'de' : 'en';
  document.documentElement.lang = lang;
  return lang;
}
export function getLang() { return lang; }
export function locale() { return lang === 'de' ? 'de-DE' : 'en-US'; }

export function t(s, vars) {
  let r = (lang === 'de' && DE[s]) || s;
  if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return r;
}

export function fmt(v) { return Math.round(v).toLocaleString(locale()); }
export function money(v) {
  const n = Math.abs(Math.round(v)).toLocaleString(locale());
  if (lang === 'de') return (v < 0 ? '−' : '') + n + ' €';
  return (v < 0 ? '−$' : '$') + n;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
export function monthName(m) { return (lang === 'de' ? MONTHS_DE : MONTHS_EN)[m % 12]; }

// Zone labels need real phrases in German rather than "adjective + noun".
const ZL = { 1: 'residential', 2: 'commercial', 3: 'industrial' };
const DL = { 1: 'Low', 2: 'Medium', 3: 'High' };
export function zoneLabel(zt, zd) { return t(`${DL[zd]} ${ZL[zt]}`); }
export function zoneName(zt) { return t(['', 'Residential', 'Commercial', 'Industrial'][zt]); }
