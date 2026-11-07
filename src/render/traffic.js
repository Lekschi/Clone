// Cars driving on the road network (right-hand traffic) plus motorway traffic to the region.
import * as THREE from 'three';
import { PAL } from './kit.js';

const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const MAX = 220;

function carGeometry() {
  const body = new THREE.BoxGeometry(0.2, 0.05, 0.095);
  body.translate(0, 0.035, 0);
  const cab = new THREE.BoxGeometry(0.11, 0.045, 0.085);
  cab.translate(-0.01, 0.08, 0);
  const parts = [body.toNonIndexed(), cab.toNonIndexed()];
  // darken the cabin through a vertex colour attribute
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const len = parts.reduce((a, p) => a + p.attributes[name].array.length, 0);
    const arr = new Float32Array(len);
    let o = 0;
    for (const p of parts) { arr.set(p.attributes[name].array, o); o += p.attributes[name].array.length; }
    g.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  const col = new Float32Array(g.attributes.position.count * 3);
  const nb = parts[0].attributes.position.count;
  for (let i = 0; i < g.attributes.position.count; i++) {
    const v = i < nb ? 1 : 0.22;
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v * 1.15;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function walkerGeometry() {
  const body = new THREE.CylinderGeometry(0.014, 0.017, 0.055, 6);
  body.translate(0, 0.0275, 0);
  const head = new THREE.SphereGeometry(0.012, 6, 4);
  head.translate(0, 0.068, 0);
  const parts = [body.toNonIndexed(), head.toNonIndexed()];
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const len = parts.reduce((a, p) => a + p.attributes[name].array.length, 0);
    const arr = new Float32Array(len);
    let o = 0;
    for (const p of parts) { arr.set(p.attributes[name].array, o); o += p.attributes[name].array.length; }
    g.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  const col = new Float32Array(g.attributes.position.count * 3);
  const nb = parts[0].attributes.position.count;
  for (let i = 0; i < g.attributes.position.count; i++) {
    const skin = i >= nb;
    col[i * 3] = skin ? 1.0 : 1; col[i * 3 + 1] = skin ? 0.82 : 1; col[i * 3 + 2] = skin ? 0.66 : 1;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export class Traffic {
  constructor(scene, game, highwayZ, opts = {}) {
    this.game = game;
    this.hz = highwayZ;
    this.walkers = !!opts.walkers;
    this.lane = this.walkers ? 0.41 : 0.15;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: this.walkers ? 0.8 : 0.35, metalness: this.walkers ? 0 : 0.3 });
    this.mesh = new THREE.InstancedMesh(this.walkers ? walkerGeometry() : carGeometry(), mat, MAX);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    const c = new THREE.Color();
    const shirts = ['#e94b3c', '#2f8fd8', '#f2c230', '#3cae7e', '#8c5ad6', '#ffffff', '#2c2f35', '#e57a2e', '#e46aa4'];
    for (let i = 0; i < MAX; i++) { c.set(this.walkers ? shirts[i % shirts.length] : PAL.cars[i % PAL.cars.length]); this.mesh.setColorAt(i, c); }
    scene.add(this.mesh);
    this.cars = [];
    this.hwCars = [];
    for (let i = 0; i < (this.walkers ? 0 : 14); i++) this.hwCars.push({ x: -240 + Math.random() * 240, dir: i % 2 ? 1 : -1, speed: 2.2 + Math.random() * 1.2 });
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.p = new THREE.Vector3();
    this.s = new THREE.Vector3(1, 1, 1);
    this.up = new THREE.Vector3(0, 1, 0);
    this.roads = [];
  }

  setRoads() {
    const g = this.game;
    this.roads = g.state.roads.map((r) => [r % g.W, Math.floor(r / g.W)]);
    // drop cars that are now off-road
    this.cars = this.cars.filter((c) => g.isRoad(c.x, c.z) && g.isRoad(c.nx, c.nz));
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
      this.cars.push({ x, z, din: d, dout: d, nx: x + DIRS[d][0], nz: z + DIRS[d][1], t: Math.random(), speed: this.walkers ? 0.12 + Math.random() * 0.08 : 0.9 + Math.random() * 0.5, side: Math.random() < 0.5 ? 1 : -1 });
      this.pickNext(this.cars[this.cars.length - 1]);
      return;
    }
  }

  // A car occupies cell (x,z), entered heading `din`, leaving heading `dout`.
  pickNext(c) {
    const nx = c.x + DIRS[c.din][0] * 0, nz = c.z;
    void nx; void nz;
    const ns = this.neighbors(c.x, c.z);
    const back = (c.din + 2) % 4;
    let opts = ns.filter((d) => d !== back);
    if (!opts.length) opts = ns;
    if (!opts.length) { c.dead = true; return; }
    // prefer going straight a bit
    if (opts.includes(c.din) && Math.random() < 0.55) c.dout = c.din;
    else c.dout = opts[Math.floor(Math.random() * opts.length)];
  }

  update(dt, target) {
    const g = this.game;
    const want = this.walkers
      ? Math.min(MAX, Math.floor(this.roads.length * 0.3), Math.floor(g.city.pop / 45))
      : Math.min(MAX - this.hwCars.length, Math.floor(this.roads.length * 0.22), 4 + Math.floor(g.city.pop / 35));
    if (this.cars.length < want && Math.random() < 0.3) this.spawn();
    if (this.cars.length > want + 3) this.cars.pop();
    let i = 0;
    const lane = this.lane;
    for (const c of this.cars) {
      c.t += dt * c.speed;
      while (c.t >= 1 && !c.dead) {
        c.t -= 1;
        const d = DIRS[c.dout];
        const nx = c.x + d[0], nz = c.z + d[1];
        if (!g.isRoad(nx, nz)) { c.dead = true; break; }
        c.x = nx; c.z = nz; c.din = c.dout;
        this.pickNext(c);
      }
      if (c.dead) continue;
      // quadratic bezier from entry edge via cell centre to exit edge
      const di = DIRS[c.din], dout = DIRS[c.dout];
      const cx = c.x + 0.5, cz = c.z + 0.5;
      const ax = cx - di[0] * 0.5, az = cz - di[1] * 0.5;
      const bx = cx + dout[0] * 0.5, bz = cz + dout[1] * 0.5;
      const t = c.t, u = 1 - t;
      let px = u * u * ax + 2 * u * t * cx + t * t * bx;
      let pz = u * u * az + 2 * u * t * cz + t * t * bz;
      let tx = 2 * u * (cx - ax) + 2 * t * (bx - cx);
      let tz = 2 * u * (cz - az) + 2 * t * (bz - cz);
      if (c.dout === (c.din + 2) % 4) { // U-turn at a dead end
        const a = t * Math.PI;
        tx = Math.cos(a) * di[0] - Math.sin(a) * di[1] * -1;
        tz = Math.cos(a) * di[1] + Math.sin(a) * di[0] * -1;
      }
      const len = Math.hypot(tx, tz) || 1;
      tx /= len; tz /= len;
      const ln = this.walkers ? lane * c.side : lane;
      px += -tz * ln; pz += tx * ln;
      this.q.setFromAxisAngle(this.up, Math.atan2(-tz, tx));
      this.p.set(px, this.walkers ? 0.014 + Math.abs(Math.sin(c.t * 40)) * 0.004 : 0.012, pz);
      this.m4.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i++, this.m4);
    }
    this.cars = this.cars.filter((c) => !c.dead);
    for (const h of this.hwCars) {
      h.x += h.dir * h.speed * dt;
      if (h.x > 0.2) { h.x = -240; h.dir = 1; }
      if (h.x < -240) { h.x = 0; h.dir = -1; }
      const z = this.hz + 0.5 + (h.dir > 0 ? lane : -lane);
      this.q.setFromAxisAngle(this.up, h.dir > 0 ? 0 : Math.PI);
      this.p.set(h.x, 0.012, z);
      this.m4.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i++, this.m4);
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    void target;
  }
}
