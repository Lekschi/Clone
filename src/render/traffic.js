// Vehicles and pedestrians on the road network (right-hand traffic) plus motorway traffic.
// Cars accelerate, brake behind other cars, slow down at junctions and switch on their lights at night.
import * as THREE from 'three';
import { PAL } from './kit.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const MAX = 220;

// Merge boxes/cylinders into one geometry with a per-vertex brightness (1 = paint, <1 = fixed colour).
function build(parts) {
  const geos = [];
  for (const [g, col] of parts) {
    const gi = g.index ? g.toNonIndexed() : g;
    const n = gi.attributes.position.count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    gi.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geos.push(gi);
  }
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const len = geos.reduce((a, g) => a + g.attributes[name].array.length, 0);
    const arr = new Float32Array(len);
    let o = 0;
    for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}
const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const wheel = (x, z, r = 0.022) => { const g = new THREE.CylinderGeometry(r, r, 0.018, 10); g.rotateX(Math.PI / 2); g.translate(x, r, z); return g; };
const PAINT = [1, 1, 1], GLASS = [0.08, 0.1, 0.13], TYRE = [0.05, 0.05, 0.05], TRIM = [0.35, 0.36, 0.38], WHITE = [0.95, 0.95, 0.93];

function carGeo() {
  return build([
    [box(0.2, 0.035, 0.092, 0, 0.033, 0), PAINT],
    [box(0.06, 0.012, 0.088, 0.065, 0.055, 0), PAINT], // hood
    [box(0.105, 0.038, 0.084, -0.012, 0.069, 0), GLASS],
    [box(0.095, 0.008, 0.08, -0.014, 0.091, 0), PAINT], // roof
    [box(0.006, 0.02, 0.09, 0.101, 0.03, 0), TRIM],
    [box(0.006, 0.02, 0.09, -0.101, 0.03, 0), TRIM],
    [wheel(0.062, 0.045), TYRE], [wheel(0.062, -0.045), TYRE], [wheel(-0.062, 0.045), TYRE], [wheel(-0.062, -0.045), TYRE],
  ]);
}
function vanGeo() {
  return build([
    [box(0.24, 0.1, 0.1, -0.015, 0.072, 0), PAINT],
    [box(0.05, 0.05, 0.096, 0.1, 0.052, 0), PAINT],
    [box(0.012, 0.036, 0.09, 0.12, 0.076, 0), GLASS],
    [box(0.004, 0.03, 0.1, 0.05, 0.085, 0), GLASS],
    [wheel(0.08, 0.05, 0.025), TYRE], [wheel(0.08, -0.05, 0.025), TYRE], [wheel(-0.08, 0.05, 0.025), TYRE], [wheel(-0.08, -0.05, 0.025), TYRE],
  ]);
}
function busGeo() {
  return build([
    [box(0.4, 0.11, 0.11, 0, 0.08, 0), PAINT],
    [box(0.38, 0.035, 0.112, 0, 0.1, 0), GLASS],
    [box(0.4, 0.008, 0.106, 0, 0.139, 0), WHITE],
    [wheel(0.13, 0.055, 0.026), TYRE], [wheel(0.13, -0.055, 0.026), TYRE], [wheel(-0.12, 0.055, 0.026), TYRE], [wheel(-0.12, -0.055, 0.026), TYRE],
  ]);
}
function lightsGeo() {
  const HEAD = [1, 0.95, 0.8], TAIL = [1, 0.08, 0.05];
  return build([
    [box(0.006, 0.012, 0.018, 0.102, 0.04, 0.03), HEAD], [box(0.006, 0.012, 0.018, 0.102, 0.04, -0.03), HEAD],
    [box(0.006, 0.012, 0.018, -0.102, 0.045, 0.032), TAIL], [box(0.006, 0.012, 0.018, -0.102, 0.045, -0.032), TAIL],
  ]);
}
function walkerGeo() {
  const SKIN = [1, 0.82, 0.66], LEGS = [0.25, 0.27, 0.32];
  const body = new THREE.CylinderGeometry(0.013, 0.016, 0.034, 6); body.translate(0, 0.045, 0);
  const legs = new THREE.CylinderGeometry(0.011, 0.009, 0.03, 6); legs.translate(0, 0.015, 0);
  const head = new THREE.SphereGeometry(0.011, 6, 4); head.translate(0, 0.072, 0);
  return build([[body, PAINT], [legs, LEGS], [head, SKIN]]);
}

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(8, 32, 2, 8, 32, 120);
  g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(0.5, 'rgba(255,230,180,0.25)'); g.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 26); ctx.lineTo(128, 0); ctx.lineTo(128, 64); ctx.lineTo(0, 38); ctx.closePath(); ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Traffic {
  constructor(scene, game, highwayZ, opts = {}) {
    this.game = game;
    this.hz = highwayZ;
    this.walkers = !!opts.walkers;
    this.lane = this.walkers ? 0.41 : 0.15;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: this.walkers ? 0.8 : 0.28, metalness: this.walkers ? 0 : 0.45, envMapIntensity: 1.2 });
    this.types = this.walkers ? [walkerGeo()] : [carGeo(), vanGeo(), busGeo()];
    this.meshes = this.types.map((g) => {
      const m = new THREE.InstancedMesh(g, mat, MAX);
      m.castShadow = !this.walkers;
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return m;
    });
    const c = new THREE.Color();
    const shirts = ['#e94b3c', '#2f8fd8', '#f2c230', '#3cae7e', '#8c5ad6', '#ffffff', '#2c2f35', '#e57a2e', '#e46aa4'];
    const busCols = ['#f2c230', '#e2574c', '#2f8fd8'];
    this.meshes.forEach((m, ti) => {
      for (let i = 0; i < MAX; i++) {
        c.set(this.walkers ? shirts[i % shirts.length] : ti === 2 ? busCols[i % 3] : PAL.cars[(i * 7) % PAL.cars.length]);
        m.setColorAt(i, c);
      }
    });
    if (!this.walkers) {
      this.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
      this.lights = new THREE.InstancedMesh(lightsGeo(), this.lightMat, MAX);
      this.lights.frustumCulled = false;
      this.lights.count = 0;
      scene.add(this.lights);
      const bg = new THREE.PlaneGeometry(0.42, 0.2);
      bg.rotateX(-Math.PI / 2);
      bg.translate(0.31, 0.016, 0);
      this.beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
      this.beams = new THREE.InstancedMesh(bg, this.beamMat, MAX);
      this.beams.frustumCulled = false;
      this.beams.count = 0;
      scene.add(this.beams);
    }
    this.cars = [];
    this.hwCars = [];
    for (let i = 0; i < (this.walkers ? 0 : 16); i++) this.hwCars.push({ x: -240 + Math.random() * 240, dir: i % 2 ? 1 : -1, speed: 2.2 + Math.random() * 1.2, type: i % 5 === 0 ? 1 : 0, v: 2 });
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.roads = [];
    this.occ = new Map();
  }

  setRoads() {
    const g = this.game;
    this.roads = g.state.roads.map((r) => [r % g.W, Math.floor(r / g.W)]);
    this.cars = this.cars.filter((c) => g.isRoad(c.x, c.z));
  }

  neighbors(x, z) {
    const g = this.game;
    const out = [];
    for (let d = 0; d < 4; d++) if (g.isRoad(x + DIRS[d][0], z + DIRS[d][1])) out.push(d);
    return out;
  }

  spawn() {
    if (!this.roads.length) return;
    for (let t = 0; t < 10; t++) {
      const [x, z] = this.roads[Math.floor(Math.random() * this.roads.length)];
      const ns = this.neighbors(x, z);
      if (!ns.length) continue;
      const d = ns[Math.floor(Math.random() * ns.length)];
      const r = Math.random();
      const max = this.walkers ? 0.12 + Math.random() * 0.08 : 0.9 + Math.random() * 0.5;
      const car = { x, z, din: d, dout: d, t: Math.random(), max, v: max * 0.5, side: Math.random() < 0.5 ? 1 : -1, type: this.walkers ? 0 : r < 0.72 ? 0 : r < 0.93 ? 1 : 2 };
      this.pickNext(car);
      this.cars.push(car);
      return;
    }
  }

  pickNext(c) {
    const ns = this.neighbors(c.x, c.z);
    const back = (c.din + 2) % 4;
    let opts = ns.filter((d) => d !== back);
    if (!opts.length) opts = ns;
    if (!opts.length) { c.dead = true; return; }
    if (opts.includes(c.din) && Math.random() < 0.55) c.dout = c.din;
    else c.dout = opts[Math.floor(Math.random() * opts.length)];
    c.junction = ns.length >= 3;
  }

  // Is another vehicle close ahead in my lane?
  blocked(c) {
    const here = this.occ.get(c.x * 1000 + c.z);
    if (here) for (const o of here) if (o !== c && o.din === c.din && o.t > c.t && o.t - c.t < 0.42) return true;
    const d = DIRS[c.dout];
    const next = this.occ.get((c.x + d[0]) * 1000 + (c.z + d[1]));
    if (next) for (const o of next) if (o.din === c.dout && 1 - c.t + o.t < 0.42) return true;
    return false;
  }

  update(dt, night = 0, wet = 0) {
    const g = this.game;
    const want = this.walkers
      ? Math.min(MAX, Math.floor(this.roads.length * 0.3), Math.floor(g.city.pop / 45))
      : Math.min(MAX - this.hwCars.length, Math.floor(this.roads.length * 0.22), 4 + Math.floor(g.city.pop / 35));
    if (this.cars.length < want && Math.random() < 0.3) this.spawn();
    if (this.cars.length > want + 3) this.cars.pop();
    if (!this.walkers) {
      this.occ.clear();
      for (const c of this.cars) {
        const k = c.x * 1000 + c.z;
        if (!this.occ.has(k)) this.occ.set(k, []);
        this.occ.get(k).push(c);
      }
    }
    const counts = this.meshes.map(() => 0);
    let li = 0;
    const lane = this.lane;
    const place = (type, px, pz, ang, lit) => {
      this.q.setFromAxisAngle(this.up, ang);
      this.p.set(px, this.walkers ? 0.012 : 0.012, pz);
      this.m4.compose(this.p, this.q, this.s);
      const m = this.meshes[type];
      m.setMatrixAt(counts[type]++, this.m4);
      if (!this.walkers && lit) {
        if (type === 2) { this.m4.scale(new THREE.Vector3(1.9, 1.6, 1.15)); }
        else if (type === 1) this.m4.scale(new THREE.Vector3(1.2, 1.5, 1.08));
        this.lights.setMatrixAt(li, this.m4);
        this.beams.setMatrixAt(li, this.m4);
        li++;
      }
    };
    const speedK = 1 - wet * 0.25;
    for (const c of this.cars) {
      if (!this.walkers) {
        let target = c.max * speedK;
        if (c.junction && c.t > 0.05 && c.t < 0.6) target *= 0.6;
        if (this.blocked(c)) target = 0;
        c.v += Math.max(-dt * 4, Math.min(dt * 1.6, target - c.v));
        c.t += dt * Math.max(0, c.v);
      } else c.t += dt * c.max;
      while (c.t >= 1 && !c.dead) {
        c.t -= 1;
        const d = DIRS[c.dout];
        const nx = c.x + d[0], nz = c.z + d[1];
        if (!g.isRoad(nx, nz)) { c.dead = true; break; }
        c.x = nx; c.z = nz; c.din = c.dout;
        this.pickNext(c);
      }
      if (c.dead) continue;
      const di = DIRS[c.din], dout = DIRS[c.dout];
      const cx = c.x + 0.5, cz = c.z + 0.5;
      const t = c.t, u = 1 - t;
      let px, pz, tx, tz;
      if (c.dout === (c.din + 2) % 4) {
        // U-turn: half circle around the cell centre
        const a = t * Math.PI;
        const rx = -di[1], rz = di[0]; // right of travel
        const r = lane;
        px = cx + di[0] * 0.1 * Math.sin(a) - rx * r * Math.cos(a);
        pz = cz + di[1] * 0.1 * Math.sin(a) - rz * r * Math.cos(a);
        tx = di[0] * Math.cos(a) + rx * Math.sin(a);
        tz = di[1] * Math.cos(a) + rz * Math.sin(a);
        const len = Math.hypot(tx, tz) || 1;
        tx /= len; tz /= len;
      } else {
        const ax = cx - di[0] * 0.5, az = cz - di[1] * 0.5;
        const bx = cx + dout[0] * 0.5, bz = cz + dout[1] * 0.5;
        px = u * u * ax + 2 * u * t * cx + t * t * bx;
        pz = u * u * az + 2 * u * t * cz + t * t * bz;
        tx = 2 * u * (cx - ax) + 2 * t * (bx - cx);
        tz = 2 * u * (cz - az) + 2 * t * (bz - cz);
        const len = Math.hypot(tx, tz) || 1;
        tx /= len; tz /= len;
        const ln = this.walkers ? lane * c.side : lane;
        px += -tz * ln; pz += tx * ln;
      }
      place(c.type, px, pz, Math.atan2(-tz, tx), true);
    }
    this.cars = this.cars.filter((c) => !c.dead);
    for (const h of this.hwCars) {
      h.x += h.dir * h.speed * dt;
      if (h.x > 0.2) { h.x = -240; h.dir = 1; }
      if (h.x < -240) { h.x = 0; h.dir = -1; }
      const z = this.hz + 0.5 + (h.dir > 0 ? lane : -lane);
      place(h.type, h.x, z, h.dir > 0 ? 0 : Math.PI, true);
    }
    this.meshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
    if (!this.walkers) {
      const k = Math.max(0, night - 0.25) / 0.75;
      this.lights.count = k > 0.02 ? li : 0;
      this.beams.count = this.lights.count;
      this.lightMat.color.setScalar(0.6 + k * 4);
      this.beamMat.opacity = k * 0.55;
      this.lights.instanceMatrix.needsUpdate = true;
      this.beams.instanceMatrix.needsUpdate = true;
    }
  }
}
