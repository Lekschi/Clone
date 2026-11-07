// Landscape around the city: flat building land, rolling hills and mountains in the distance,
// a coastline to the south, a forest, and the motorway that links the city to the region.
import * as THREE from 'three';
import { mulberry32 } from '../game/emitter.js';
import { grassTexture, sandTexture, roadTexture, waterTexture } from './textures.js';

export const SEA_LEVEL = -0.14;

function hash(x, z, seed) {
  const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z, seed) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed), c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, seed) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 5; i++) { s += vnoise(x * f, z * f, seed + i) * amp; f *= 2; amp *= 0.5; }
  return s;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Terrain {
  constructor(W, H, seed, highwayZ) {
    this.W = W; this.H = H; this.seed = seed % 1000; this.hz = highwayZ;
    this.group = new THREE.Group();
    this.coast = H + 6;
  }

  height(x, z) {
    const W = this.W, H = this.H;
    const dx = Math.max(-2 - x, 0, x - (W + 2));
    const dzN = Math.max(-2 - z, 0);
    const d = Math.hypot(dx, dzN);
    let h = 0;
    if (d > 0) {
      const n = fbm(x * 0.035, z * 0.035, this.seed);
      h = Math.pow(Math.max(0, d - 1), 1.35) * 0.06 * (0.35 + n * 1.3);
      h += Math.max(0, d - 40) * 0.12 * fbm(x * 0.08, z * 0.08, this.seed + 3);
      // keep a valley open for the motorway to the west
      if (x < 0) h *= smooth(1.5, 8, Math.abs(z - this.hz - 0.5));
    }
    if (z > H + 1) {
      const coastLine = H + 6 + (fbm(x * 0.05, 3.3, this.seed + 9) - 0.5) * 5;
      h *= 1 - smooth(H + 1, coastLine, z);
      h += Math.min(0, -(z - coastLine) * 0.1);
    }
    return h;
  }

  build() {
    const g = this.group;
    const size = 460, seg = 240;
    const cx = this.W / 2, cz = this.H / 2;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const uv = geo.attributes.uv;
    const cGrass = new THREE.Color('#ffffff');
    const cDry = new THREE.Color('#d9d2a6');
    const cRock = new THREE.Color('#8f8a82');
    const cSnow = new THREE.Color('#f4f6fa');
    const cSand = new THREE.Color('#f3e2b0');
    const cDark = new THREE.Color('#9fb98a');
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
      // keep the city area perfectly flat on exact cell borders
      const h = this.height(x, z);
      pos.setXYZ(i, x, h, z);
      uv.setXY(i, x / 3, z / 3);
      if (h < 0.06 && z > this.H + 1) col.copy(cSand);
      else if (h > 9) col.copy(cRock).lerp(cSnow, smooth(11, 14, h));
      else if (h > 4) col.copy(cDark).lerp(cRock, smooth(4, 9, h));
      else col.copy(cGrass).lerp(cDry, smooth(1.5, 4, h) * 0.5).lerp(cDark, smooth(0.5, 3, h) * 0.6);
      // large-scale tint variation so the grass never looks tiled
      const m = fbm(x * 0.06, z * 0.06, this.seed + 21) - 0.5;
      const m2 = fbm(x * 0.21, z * 0.21, this.seed + 33) - 0.5;
      const k = 1 + m * 0.34 + m2 * 0.14;
      colors[i * 3] = col.r * (k + m * 0.08); colors[i * 3 + 1] = col.g * k; colors[i * 3 + 2] = col.b * (k - m * 0.1);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: grassTexture(), vertexColors: true, roughness: 0.95 });
    const land = new THREE.Mesh(geo, mat);
    land.receiveShadow = true;
    land.name = 'land';
    g.add(land);
    this.land = land;

    // beach texture blend: sand plane along the coast
    const sandMat = new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1, transparent: true, opacity: 0.0 });
    void sandMat;

    // sea
    const wt = waterTexture();
    const waterTex = wt.clone();
    waterTex.needsUpdate = true;
    waterTex.repeat.set(40, 40);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 500),
      new THREE.MeshStandardMaterial({ color: '#2f86b8', map: waterTex, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.93 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, SEA_LEVEL, this.H + 250);
    water.receiveShadow = true;
    g.add(water);
    this.water = water;

    // motorway to the west
    const t = roadTexture(false, true, false, true).clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    const len = 240;
    t.repeat.set(len, 1);
    const hw = new THREE.Mesh(new THREE.PlaneGeometry(len, 1), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    hw.rotation.x = -Math.PI / 2;
    hw.position.set(-len / 2, 0.012, this.hz + 0.5);
    hw.receiveShadow = true;
    g.add(hw);
    // guard rails
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.02), new THREE.MeshStandardMaterial({ color: '#b8bec4', metalness: 0.6, roughness: 0.4 }));
    for (const dz of [0.02, 0.98]) {
      const r = rail.clone();
      r.position.set(-len / 2 - 2, 0.04, this.hz + dz);
      g.add(r);
    }
    return g;
  }

  // Positions for decorative trees: around the map and inside locked chunks.
  treeSpots(isLockedCell, count = 9000) {
    const rnd = mulberry32(this.seed + 17);
    const spots = [];
    let guard = 0;
    while (spots.length < count && guard++ < count * 8) {
      const x = -70 + rnd() * (this.W + 140), z = -70 + rnd() * (this.H + 110);
      const inMap = x >= 0 && z >= 0 && x < this.W && z < this.H;
      if (inMap) {
        const cx = Math.floor(x), cz = Math.floor(z);
        if (!isLockedCell(cx, cz)) continue;
        const fm = fbm(x * 0.09, z * 0.09, this.seed + 5);
        if (fm < 0.42 && rnd() < 0.85) continue;
        spots.push({ x, z, y: 0, cell: [cx, cz], s: 0.8 + rnd() * 0.7, k: rnd() < 0.4 ? 1 : 0, r: rnd() });
        continue;
      }
      if (x < 2 && Math.abs(z - this.hz - 0.5) < 2.5) continue;
      const h = this.height(x, z);
      if (h < 0.08 || h > 8.5) continue;
      // forest clumps
      const f = fbm(x * 0.06, z * 0.06, this.seed + 5);
      if (f < 0.47 && rnd() < 0.9) continue;
      spots.push({ x, z, y: h, cell: null, s: 0.8 + rnd() * 0.8 + h * 0.03, k: h > 3 || rnd() < 0.45 ? 1 : 0, r: rnd() });
    }
    return spots;
  }
}

// Instanced forest. Rebuilt when land is bought so trees in the new plot disappear.
export class Forest {
  constructor(scene) {
    this.scene = scene;
    const trunkGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.2, 5);
    trunkGeo.translate(0, 0.1, 0);
    const pine = new THREE.ConeGeometry(0.2, 0.55, 6);
    pine.translate(0, 0.42, 0);
    const pine2 = new THREE.ConeGeometry(0.15, 0.4, 6);
    pine2.translate(0, 0.62, 0);
    const pineGeo = mergeSimple([pine, pine2]);
    const roundGeo = new THREE.DodecahedronGeometry(0.22, 0);
    roundGeo.scale(1, 0.95, 1);
    roundGeo.translate(0, 0.38, 0);
    this.geos = { trunk: trunkGeo, pine: pineGeo, round: roundGeo };
    this.mats = {
      trunk: new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9, flatShading: true }),
      leaf: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true, envMapIntensity: 0.35 }),
    };
    this.meshes = [];
  }

  set(spots) {
    for (const m of this.meshes) { this.scene.remove(m); m.dispose(); }
    this.meshes = [];
    // split into regions so that the camera and the shadow pass can skip trees that are out of view
    const R = 32;
    const regions = new Map();
    for (const s of spots) {
      const k = `${Math.floor(s.x / R)},${Math.floor(s.z / R)}`;
      if (!regions.has(k)) regions.set(k, []);
      regions.get(k).push(s);
    }
    for (const list of regions.values()) this.addRegion(list);
  }

  addRegion(spots) {
    const pines = spots.filter((s) => s.k === 1), rounds = spots.filter((s) => s.k === 0);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    const make = (geo, mat, list, colorFn) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((s, i) => {
        q.setFromAxisAngle(up, s.r * 6.28);
        p.set(s.x, s.y, s.z);
        sc.setScalar(s.s);
        m4.compose(p, q, sc);
        im.setMatrixAt(i, m4);
        if (colorFn) { colorFn(s, c); im.setColorAt(i, c); }
      });
      im.castShadow = true;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      this.scene.add(im);
      this.meshes.push(im);
    };
    make(this.geos.trunk, this.mats.trunk, spots);
    make(this.geos.pine, this.mats.leaf, pines, (s, col) => col.setHSL(0.36 + s.r * 0.05, 0.5, 0.16 + s.r * 0.07));
    make(this.geos.round, this.mats.leaf, rounds, (s, col) => col.setHSL(0.24 + s.r * 0.08, 0.55, 0.2 + s.r * 0.09));
  }
}

function mergeSimple(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const len = parts.reduce((a, g) => a + g.attributes[name].array.length, 0);
    const arr = new Float32Array(len);
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, parts[0].attributes[name].itemSize));
  }
  return out;
}
