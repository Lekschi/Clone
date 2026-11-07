// A finished-looking showcase city for the title screen of first-time players. It is never saved.
import { Game, newState } from './game.js';
import { mulberry32 } from './emitter.js';

export function demoState() {
  const s = newState('Neustadt');
  s.seed = 4242;
  const g = new Game(s);
  const S = g.state;
  const rnd = mulberry32(99);
  S.level = 22;
  S.coins = 1e9;
  for (let ci = 0; ci < 64; ci++) if (!g.unlocked.has(ci)) { S.chunks.push(ci); g.unlocked.add(ci); }
  // street grid around the existing avenue
  const cells = [];
  for (const z of [14, 22, 38, 46]) for (let x = 10; x <= 52; x++) cells.push([x, z]);
  for (const x of [10, 18, 34, 42, 50]) for (let z = 14; z <= 46; z++) cells.push([x, z]);
  g.placeRoads(cells);
  const place = (t, x, z, level) => {
    if (!g.canPlace(t, x, z, 0).ok) return null;
    const b = g.place(t, x, z, 0);
    if (b && level) b.level = level;
    return b;
  };
  const tryNear = (t, x, z, level) => {
    for (let r = 0; r < 6; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const b = place(t, x + dx, z + dz, level);
      if (b) return b;
    }
    return null;
  };
  // downtown: towers near the centre, houses towards the edges
  const specials = [['stadium', 44, 40], ['citypark', 20, 40], ['tvtower', 36, 24], ['university', 12, 16], ['hospital', 30, 40], ['firebig', 20, 24], ['policebig', 44, 16],
    ['theater', 36, 32], ['plaza', 28, 24], ['library', 12, 32], ['cinema', 44, 32], ['school', 14, 24], ['trainstation', 22, 16], ['market', 30, 16], ['bausupply', 36, 16],
    ['furniture', 46, 24], ['bakery', 12, 40], ['clocktower', 33, 27], ['coal', 52, 18], ['waterworks', 52, 40], ['sewageplant', 52, 30], ['incinerator', 52, 24]];
  for (const [t, x, z] of specials) tryNear(t, x, z);
  const res = ['house', 'house', 'house', 'workers', 'villa', 'eco'];
  for (let i = 0; i < 700; i++) {
    const x = 11 + Math.floor(rnd() * 41), z = 15 + Math.floor(rnd() * 31);
    const d = Math.hypot(x - 32, z - 30);
    const level = Math.max(1, Math.min(8, Math.round(8 - d / 3.2 + (rnd() - 0.5) * 2.5)));
    const t = level >= 6 ? (rnd() < 0.8 ? 'house' : 'villa') : res[Math.floor(rnd() * res.length)];
    place(t, x, z, level);
    if (rnd() < 0.05) place('park', x + 2, z, 0);
  }
  for (const b of S.buildings) b.built = 0;
  S.tutorial = { step: 99, done: true, tips: {} };
  g.recompute();
  return S;
}
