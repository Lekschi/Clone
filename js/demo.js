// Builds a decorative, fully grown city for the launcher backdrop, and draws map previews.
import { World, T_WATER, T_SAND } from './world/world.js';
import { Sim } from './world/sim.js';
import { mulberry32 } from './util/rng.js';
import { makeCanvas } from './render/art.js';

export function buildDemoCity(seed = 7) {
  const w = new World(56, 56);
  w.generate({ seed, mapType: 'coast', difficulty: 'easy', name: 'Demo' });
  w.funds = 1e9;
  const rng = mulberry32(seed + 1);
  const cx = 30, cy = 28;
  const land = (x, y) => w.inb(x, y) && w.terrain[w.idx(x, y)] !== T_WATER;
  for (let k = -18; k <= 18; k += 5) for (let t = -20; t <= 20; t++) {
    if (land(cx + k, cy + t)) w.buildRoad(cx + k, cy + t);
    if (land(cx + t, cy + k)) w.buildRoad(cx + t, cy + k);
  }
  const place = (key, x, y) => { const c = w.placeCheck(key, x, y); if (c.ok) w.place(key, x, y); };
  place('cityhall', cx + 1, cy + 1); place('bigpark', cx - 4, cy + 1); place('stadium', cx + 6, cy - 9);
  place('hospital', cx - 9, cy - 4); place('school', cx + 11, cy + 6); place('plaza', cx + 1, cy - 4); place('pond', cx - 9, cy + 11);
  place('police', cx + 6, cy + 11); place('fire', cx - 14, cy + 6); place('museum', cx + 6, cy + 1);
  for (let k = 0; k < 6; k++) place('wind', cx - 19 + k * 2, cy - 19);
  for (let y = cy - 20; y <= cy + 20; y++) for (let x = cx - 20; x <= cx + 20; x++) {
    if (!land(x, y)) continue;
    const i = w.idx(x, y); if (w.road[i] || w.bld[i]) continue;
    const d = Math.max(Math.abs(x - cx), Math.abs(y - cy)) + rng() * 3;
    if (d > 21) continue;
    let zt = d < 9 ? (rng() < 0.6 ? 2 : 1) : (rng() < 0.12 ? 2 : 1);
    if (x < cx - 12 && y < cy - 4) zt = 3;
    if (rng() < 0.07) { w.tree[i] = 3; continue; }
    const zd = d < 7 ? 3 : d < 13 ? 2 : 1;
    w.zoneT[i] = zt; w.zoneD[i] = zd;
    let tier = zd === 3 ? 5 : zd === 2 ? 3 + (rng() < 0.5 ? 1 : 0) : 1 + (rng() < 0.6 ? 1 : 0);
    if (zt === 3) tier = Math.min(tier, 2 + Math.floor(rng() * 3));
    w.addBuilding({ kind: 'zone', x, y, w: 1, h: 1, zt, tier, occ: 0.9, built: 1, powered: true, watered: true });
  }
  // a few merged towers downtown
  for (let k = 0; k < 40; k++) {
    const x = cx - 6 + Math.floor(rng() * 12), y = cy - 6 + Math.floor(rng() * 12);
    const ok = [[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => { const b = w.buildingAt(x + dx, y + dy); return b && b.kind === 'zone' && b.w === 1 && b.tier === 5 && b.zt === w.buildingAt(x, y).zt; });
    if (!ok) continue;
    const zt = w.buildingAt(x, y).zt;
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) w.removeBuilding(w.buildingAt(x + dx, y + dy), true);
    w.addBuilding({ kind: 'zone', x, y, w: 2, h: 2, zt, tier: 6, occ: 1, built: 1, powered: true, watered: true });
  }
  const sim = new Sim(w);
  sim.updateNetworks(); sim.updateMaps(); sim.updateStats();
  for (const b of w.buildings.values()) { b.powered = true; b.watered = true; b.abandoned = false; }
  w.stats.pop = 9000; w.stats.jobsC = 3000; w.stats.jobsI = 1500;
  for (let i = 0; i < w.n; i++) if (w.road[i]) w.traffic[i] = 60 + rng() * 80;
  w.events = [];
  return w;
}

export function drawMapPreview(w, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const img = new ImageData(w.w, w.h); const d = img.data;
  for (let i = 0; i < w.n; i++) {
    let c;
    if (w.terrain[i] === T_WATER) c = [70, 140, 165];
    else if (w.terrain[i] === T_SAND) c = [222, 208, 164];
    else if (w.tree[i]) c = w.tree[i] > 2 ? [70, 108, 58] : [92, 128, 70];
    else c = [140, 170, 98];
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
  }
  const tmp = makeCanvas(w.w, w.h); tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const s = Math.min(W / (w.w + w.h), H * 2 / (w.w + w.h)) * 0.92;
  const top = (H - (w.w + w.h) * s / 2) / 2 - 6;
  ctx.save();
  ctx.translate(W / 2, top);
  ctx.transform(s, s / 2, -s, s / 2, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0);
  ctx.restore();
  // diorama base
  const L = [W / 2 - w.h * s, top + w.h * s / 2], B = [W / 2 + (w.w - w.h) * s, top + (w.w + w.h) * s / 2], R = [W / 2 + w.w * s, top + w.w * s / 2];
  const depth = 12;
  ctx.fillStyle = '#7a5b3e'; ctx.beginPath(); ctx.moveTo(...L); ctx.lineTo(...B); ctx.lineTo(B[0], B[1] + depth); ctx.lineTo(L[0], L[1] + depth); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5e4630'; ctx.beginPath(); ctx.moveTo(...R); ctx.lineTo(...B); ctx.lineTo(B[0], B[1] + depth); ctx.lineTo(R[0], R[1] + depth); ctx.closePath(); ctx.fill();
}
