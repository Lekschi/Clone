// Long-term goals and variety on top of the core loop:
// - Achievements in tiers, each tier pays crystals (the only premium currency, earned not bought)
// - City events that run for a while and boost one part of the economy
// - A history of key numbers for the statistics charts
import { BUILDINGS } from '../data/buildings.js';

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

export const ACHIEVEMENTS = [
  { id: 'pop', name: 'Großstadt', desc: 'Erreiche {n} Einwohner', tiers: [500, 2500, 10000, 40000, 100000], value: (g) => g.state.stats.popRecord || 0 },
  { id: 'level', name: 'Karriere', desc: 'Erreiche Spielerstufe {n}', tiers: [5, 10, 15, 20, 30], value: (g) => g.state.level },
  { id: 'upgrades', name: 'Architekt', desc: 'Baue {n} Häuser aus', tiers: [5, 25, 75, 200, 500], value: (g) => g.state.stats.upgrades || 0 },
  { id: 'produced', name: 'Industrie', desc: 'Produziere {n} Rohstoffe', tiers: [25, 150, 600, 2000, 6000], value: (g) => sum(g.state.stats.produced) },
  { id: 'crafted', name: 'Handwerk', desc: 'Stelle {n} Waren her', tiers: [10, 75, 300, 1000, 3000], value: (g) => sum(g.state.stats.crafted) },
  { id: 'customers', name: 'Kundenliebling', desc: 'Bediene {n} Kunden', tiers: [5, 30, 100, 300, 800], value: (g) => g.state.stats.customers || 0 },
  { id: 'sold', name: 'Händler', desc: 'Verkaufe {n} Angebote am Markt', tiers: [5, 25, 100, 300, 800], value: (g) => g.state.stats.sold || 0 },
  { id: 'cargo', name: 'Güterverkehr', desc: 'Belade {n} Waggons', tiers: [3, 15, 60, 200, 500], value: (g) => g.state.stats.cargoWagons || 0 },
  { id: 'land', name: 'Landvermesser', desc: 'Erschließe {n} Bauland-Flächen', tiers: [2, 5, 10, 20, 35], value: (g) => g.state.stats.expansions || 0 },
  { id: 'taxes', name: 'Kämmerer', desc: 'Nimm {n} Münzen Steuern ein', tiers: [5000, 50000, 250000, 1000000, 5000000], value: (g) => g.state.stats.taxCollected || 0 },
  { id: 'fires', name: 'Brandschutz', desc: 'Lass {n} Brände von der Feuerwehr löschen', tiers: [1, 5, 20, 60, 150], value: (g) => g.state.stats.firesOut || 0 },
  { id: 'events', name: 'Festkalender', desc: 'Erlebe {n} Stadtereignisse', tiers: [1, 5, 15, 40, 100], value: (g) => g.state.stats.events || 0 },
  { id: 'landmarks', name: 'Wahrzeichen', desc: 'Errichte {n} Wahrzeichen', tiers: [1, 2, 4, 7, 10], value: (g) => g.state.buildings.filter((b) => BUILDINGS[b.type].boost?.kind === 'landmark').length },
];
export const ACH_REWARD = [2, 3, 5, 8, 12]; // crystals per tier
export const ACH_TIER_NAMES = ['Bronze', 'Silber', 'Gold', 'Platin', 'Diamant'];

export function achState(g, a) {
  const done = g.state.ach?.[a.id] || 0; // claimed tiers
  const v = a.value(g);
  const target = a.tiers[Math.min(done, a.tiers.length - 1)];
  return { done, v, target, max: done >= a.tiers.length, ready: done < a.tiers.length && v >= target, reward: ACH_REWARD[Math.min(done, ACH_REWARD.length - 1)] };
}

export function achClaimable(g) { return ACHIEVEMENTS.filter((a) => achState(g, a).ready).length; }

// ---------------------------------------------------------------- events
export const EVENTS = {
  fest: { name: 'Stadtfest', icon: 'party', text: 'Die ganze Stadt feiert! Doppelte Steuereinnahmen und Feuerwerk am Abend.', mul: { tax: 2 } },
  flohmarkt: { name: 'Einkaufsnacht', icon: 'shop', text: 'Lange Einkaufsnacht: Kunden kommen viel häufiger und zahlen 25 % mehr.', mul: { customers: 3, pay: 1.25 } },
  bauboom: { name: 'Bauboom', icon: 'factory', text: 'Die Fabriken laufen auf Hochtouren: Produktion 30 % schneller.', mul: { factory: 0.7 } },
  handwerk: { name: 'Handwerkerwoche', icon: 'shop', text: 'Läden arbeiten 30 % schneller.', mul: { shop: 0.7 } },
};
export const EVENT_MIN_LEVEL = 4;
export const EVENT_DURATION = 10 * 60 * 1000;
export const EVENT_GAP = [25 * 60 * 1000, 45 * 60 * 1000];

// ---------------------------------------------------------------- history
export const HISTORY_EVERY = 2 * 60 * 1000;
export const HISTORY_MAX = 360; // 12 hours of play
