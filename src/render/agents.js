// Vehicles with a purpose: delivery trucks bring goods from factories and shops to the
// warehouse, fire engines race to burning houses with blue lights and siren, police patrols
// cruise the streets. Routes are found on the road network.
import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings.js';
import { siren } from '../audio.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const LANE = 0.15;

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.mat || new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.4, metalness: opts.metal ?? 0.3 }));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  return m;
}
function wheels(g, xs, z = 0.052, r = 0.024) {
  const mat = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.8 });
  for (const x of xs) for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.018, 10), mat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, r, s * z);
    g.add(w);
  }
}

function makeVehicle(kind) {
  const g = new THREE.Group();
  if (kind === 'truck') {
    g.add(box(0.075, 0.075, 0.1, '#e9edf1', 0.105, 0.025, 0));
    g.add(box(0.012, 0.04, 0.09, '#2a3846', 0.143, 0.06, 0, { rough: 0.15, metal: 0.5 }));
    const cargo = box(0.19, 0.11, 0.11, '#f2b632', -0.04, 0.025, 0);
    cargo.name = 'cargo';
    g.add(cargo);
    wheels(g, [0.1, -0.02, -0.1]);
  } else if (kind === 'fire') {
    g.add(box(0.27, 0.075, 0.105, '#d42a24', 0, 0.025, 0, { rough: 0.35 }));
    g.add(box(0.07, 0.05, 0.1, '#d42a24', 0.1, 0.1, 0, { rough: 0.35 }));
    g.add(box(0.012, 0.035, 0.09, '#2a3846', 0.136, 0.105, 0, { rough: 0.15, metal: 0.5 }));
    g.add(box(0.2, 0.012, 0.03, '#c9ced4', -0.04, 0.105, 0, { metal: 0.6 }));
    g.add(box(0.2, 0.006, 0.05, '#e8e8e8', -0.04, 0.1, 0, { metal: 0.6 }));
    wheels(g, [0.09, -0.09]);
  } else {
    g.add(box(0.2, 0.04, 0.094, '#f4f6f8', 0, 0.025, 0, { rough: 0.3 }));
    g.add(box(0.2, 0.012, 0.096, '#1f4ea8', 0, 0.04, 0));
    g.add(box(0.11, 0.04, 0.084, '#2a3846', -0.01, 0.065, 0, { rough: 0.15, metal: 0.5 }));
    wheels(g, [0.06, -0.06], 0.045, 0.021);
  }
  if (kind !== 'truck') {
    // light bar: two lamps that flash alternately
    const mk = (z, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.016, 0.03), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); m.position.set(kind === 'fire' ? 0.1 : -0.01, kind === 'fire' ? 0.152 : 0.107, z); return m; };
    const a = mk(-0.025, new THREE.Color(0.2, 0.4, 4)), b = mk(0.025, new THREE.Color(0.2, 0.4, 4));
    g.add(a, b);
    g.userData.flash = [a, b];
  }
  return g;
}

export class Agents {
  constructor(scene, game, world) {
    this.scene = scene;
    this.game = game;
    this.world = world;
    this.list = [];
    this.nextPatrol = 20;
    this.uid = 0;
  }

  // road cells next to a building's footprint
  access(b) {
    const g = this.game;
    const [w, d] = g.size(b);
    const out = [];
    for (let i = 0; i < w; i++) { out.push([b.x + i, b.z - 1], [b.x + i, b.z + d]); }
    for (let i = 0; i < d; i++) { out.push([b.x - 1, b.z + i], [b.x + w, b.z + i]); }
    return out.filter(([x, z]) => g.isRoad(x, z));
  }

  // breadth-first search over the road grid
  route(from, to) {
    const g = this.game;
    const key = (x, z) => x * 1000 + z;
    const goals = new Set(to.map(([x, z]) => key(x, z)));
    const prev = new Map();
    const q = [];
    for (const [x, z] of from) { prev.set(key(x, z), null); q.push([x, z]); }
    let head = 0, end = null;
    while (head < q.length && head < 6000) {
      const [x, z] = q[head++];
      if (goals.has(key(x, z))) { end = [x, z]; break; }
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz;
        const k = key(nx, nz);
        if (prev.has(k) || !g.isRoad(nx, nz)) continue;
        prev.set(k, [x, z]);
        q.push([nx, nz]);
      }
    }
    if (!end) return null;
    const path = [];
    for (let c = end; c; c = prev.get(key(c[0], c[1]))) path.push(c);
    return path.reverse();
  }

  dispatch(kind, fromB, toB, opts = {}) {
    if (this.list.length > 14) return null;
    const a = this.access(fromB), b = this.access(toB);
    if (!a.length || !b.length) return null;
    let path = this.route(a, b);
    if (!path) return null;
    if (path.length < 2) path = [path[0], path[0]];
    return this.spawn(kind, path, opts);
  }

  spawn(kind, path, opts = {}) {
    const obj = makeVehicle(kind);
    if (opts.color) obj.getObjectByName('cargo')?.material.color.set(opts.color);
    this.scene.add(obj);
    const v = { id: ++this.uid, kind, path, i: 0, t: 0, v: 0, max: kind === 'truck' ? 0.9 : 1.6, obj, onArrive: opts.onArrive, back: opts.back };
    this.list.push(v);
    return v;
  }

  update(dt) {
    const g = this.game;
    // occasional police patrol between two random road cells
    this.nextPatrol -= dt;
    if (this.nextPatrol <= 0) {
      this.nextPatrol = 40 + Math.random() * 40;
      const st = g.state.buildings.filter((b) => BUILDINGS[b.type].service?.kind === 'police');
      const roads = g.state.roads;
      if (st.length && roads.length > 20 && !this.list.some((x) => x.kind === 'police')) {
        const r = roads[Math.floor(Math.random() * roads.length)];
        const path = this.route(this.access(st[Math.floor(Math.random() * st.length)]), [[r % g.W, Math.floor(r / g.W)]]);
        if (path && path.length > 4) this.spawn('police', path);
      }
    }
    const tgt = this.world.view.target;
    for (const v of this.list) {
      const urgent = v.kind === 'fire' && !v.returning;
      v.v += (v.max - v.v) * Math.min(1, dt * 1.5);
      v.t += dt * v.v;
      while (v.t >= 1 && v.i < v.path.length - 1) { v.t -= 1; v.i++; }
      const p = v.path, i = v.i;
      if (i >= p.length - 1 && v.t >= 0.5) { v.done = true; continue; }
      const cur = p[i], prev = p[Math.max(0, i - 1)], next = p[Math.min(p.length - 1, i + 1)];
      const din = i === 0 ? [next[0] - cur[0], next[1] - cur[1]] : [cur[0] - prev[0], cur[1] - prev[1]];
      const dout = i >= p.length - 1 ? din : [next[0] - cur[0], next[1] - cur[1]];
      const cx = cur[0] + 0.5, cz = cur[1] + 0.5;
      const ax = cx - din[0] * 0.5, az = cz - din[1] * 0.5, bx = cx + dout[0] * 0.5, bz = cz + dout[1] * 0.5;
      const t = v.t, u = 1 - t;
      let px = u * u * ax + 2 * u * t * cx + t * t * bx;
      let pz = u * u * az + 2 * u * t * cz + t * t * bz;
      let tx = 2 * u * (cx - ax) + 2 * t * (bx - cx), tz = 2 * u * (cz - az) + 2 * t * (bz - cz);
      const len = Math.hypot(tx, tz) || 1;
      tx /= len; tz /= len;
      const lane = urgent ? LANE * 0.4 : LANE;
      px += -tz * lane; pz += tx * lane;
      v.obj.position.set(px, 0.012, pz);
      v.obj.rotation.y = Math.atan2(-tz, tx);
      if (v.obj.userData.flash) {
        const on = Math.floor(performance.now() / 160) % 2;
        v.obj.userData.flash[0].visible = on === 0;
        v.obj.userData.flash[1].visible = on === 1;
      }
      if (v.kind === 'fire') {
        const d = Math.hypot(px - tgt.x, pz - tgt.z) + this.world.view.dist * 0.5;
        siren(`fire${v.id}`, urgent, Math.max(0, 0.07 - d * 0.0025));
      }
    }
    for (const v of this.list.filter((x) => x.done)) {
      this.scene.remove(v.obj);
      if (v.kind === 'fire') siren(`fire${v.id}`, false);
      if (v.onArrive) v.onArrive(v);
      if (v.back) this.spawn(v.kind, [...v.path].reverse(), { color: v.back.color }).returning = true;
    }
    this.list = this.list.filter((x) => !x.done);
  }
}
