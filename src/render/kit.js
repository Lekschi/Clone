// Modelling kit: materials and a Builder that collects primitives and merges them per material,
// so every building becomes a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { facadeTextures, roofTexture, signTexture, grassTexture, pavingTexture, asphaltTexture, concreteTexture, sandTexture, plainAsphalt, roofNormal, groundNormal } from './textures.js';
import { waterMaterial, addWind } from './shared.js';

const matCache = new Map();
export const nightMaterials = new Set();

export function forEachMaterial(fn) {
  for (const m of matCache.values()) fn(m);
}

function cached(key, make) {
  let m = matCache.get(key);
  if (!m) { m = make(); m.userData.key = key; matCache.set(key, m); }
  return m;
}

export const M = {
  color(hex, opts = {}) {
    const { rough = 0.85, metal = 0, emissive = null, flat = false, opacity = 1, double = false } = opts;
    return cached(`c${hex}-${rough}-${metal}-${emissive}-${flat}-${opacity}-${double}`, () => {
      const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, flatShading: flat, side: double ? THREE.DoubleSide : THREE.FrontSide });
      if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 1; }
      if (opacity < 1) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; m.userData.noShadow = true; }
      return m;
    });
  },
  facade(name, tint = '#ffffff') {
    return cached(`f${name}-${tint}`, () => {
      const t = facadeTextures(name);
      const m = new THREE.MeshStandardMaterial({
        color: tint, map: t.map, emissive: 0xffffff, emissiveMap: t.emissive, emissiveIntensity: 0,
        normalMap: t.normal, normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: t.orm, metalnessMap: t.orm, roughness: 1, metalness: 1, envMapIntensity: 1.1,
      });
      nightMaterials.add(m);
      return m;
    });
  },
  roof(kind, tint = '#ffffff') {
    return cached(`r${kind}-${tint}`, () => {
      const m = new THREE.MeshStandardMaterial({ color: tint, map: roofTexture(kind), roughness: kind === 'solar' ? 0.22 : kind === 'metal' ? 0.45 : 0.88, metalness: kind === 'solar' ? 0.5 : kind === 'metal' ? 0.35 : 0 });
      const n = roofNormal(kind);
      if (n && kind !== 'solar') { m.normalMap = n; m.normalScale = new THREE.Vector2(0.8, 0.8); }
      return m;
    });
  },
  ground(kind, tint = '#ffffff') {
    return cached(`g${kind}-${tint}`, () => {
      const map = { grass: grassTexture, paving: pavingTexture, asphalt: asphaltTexture, concrete: concreteTexture, sand: sandTexture, plain: plainAsphalt }[kind]();
      const m = new THREE.MeshStandardMaterial({ color: tint, map, roughness: kind === 'asphalt' || kind === 'plain' ? 0.82 : 0.95 });
      const n = groundNormal(kind);
      if (n) { m.normalMap = n; m.normalScale = new THREE.Vector2(0.7, 0.7); }
      m.userData.ground = kind;
      return m;
    });
  },
  sign(text, bg, fg) {
    return cached(`s${text}-${bg}-${fg}`, () => {
      const t = signTexture(text, bg, fg);
      const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.15, roughness: 0.6 });
      m.userData.sign = true;
      nightMaterials.add(m);
      return m;
    });
  },
  glow(hex) {
    return cached(`glow${hex}`, () => {
      const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.2, roughness: 0.4 });
      m.userData.glow = true;
      nightMaterials.add(m);
      return m;
    });
  },
  water(kind = 'pool') {
    return waterMaterial(kind);
  },
  glass() {
    return cached('glassclear', () => {
      const m = new THREE.MeshStandardMaterial({ color: '#cfe8f5', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false });
      m.userData.noShadow = true;
      return m;
    });
  },
};

// UVs in world units so that facade textures keep a constant window size on any box.
function worldBoxUV(geo, w, h, d) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + w / 2, y = pos.getY(i) + h / 2, z = pos.getZ(i) + d / 2;
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    if (Math.abs(nx) > 0.5) uv.setXY(i, nx > 0 ? d - z : z, y);
    else if (Math.abs(nz) > 0.5) uv.setXY(i, nz > 0 ? x : w - x, y);
    else uv.setXY(i, x, z);
  }
  uv.needsUpdate = true;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();

export class Builder {
  constructor() {
    this.parts = new Map();
    this.loose = [];
    this.rotors = [];
    this.smoke = [];
    this.fountain = [];
    this.water = [];
  }

  push(geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    tmpE.set(rx, ry, rz);
    tmpQ.setFromEuler(tmpE);
    tmpP.set(x, y, z);
    tmpS.set(sx, sy, sz);
    tmpM.compose(tmpP, tmpQ, tmpS);
    if (this.matMap) mat = this.matMap(mat);
    let g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(tmpM);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const key = mat.userData.key || mat.uuid;
    if (!this.parts.has(key)) this.parts.set(key, { mat, geos: [] });
    this.parts.get(key).geos.push(g);
    return g;
  }

  // Box with its base at y. `mats` may be a single material or {side, top}.
  box(w, h, d, mats, x = 0, y = 0, z = 0, ry = 0) {
    const side = mats.isMaterial ? mats : mats.side, top = mats.isMaterial ? mats : mats.top;
    const g = new THREE.BoxGeometry(w, h, d);
    worldBoxUV(g, w, h, d);
    if (side === top) { this.push(g, side, x, y + h / 2, z, ry); return; }
    // split by groups: 0:+x 1:-x 2:+y 3:-y 4:+z 5:-z
    const gi = g.toNonIndexed();
    const sides = new THREE.BufferGeometry(), tops = new THREE.BufferGeometry();
    const split = (target, ranges) => {
      for (const name of ['position', 'normal', 'uv']) {
        const src = gi.attributes[name];
        const parts = [];
        for (const [s, c] of ranges) parts.push(src.array.slice(s * src.itemSize, (s + c) * src.itemSize));
        const len = parts.reduce((a, p) => a + p.length, 0);
        const arr = new Float32Array(len);
        let o = 0;
        for (const p of parts) { arr.set(p, o); o += p.length; }
        target.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
      }
    };
    split(sides, [[0, 12], [24, 12]]);
    split(tops, [[12, 6]]);
    this.push(sides, side, x, y + h / 2, z, ry);
    this.push(tops, top, x, y + h / 2, z, ry);
  }

  cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 16, opts = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!opts.open);
    if (opts.facade) {
      const uv = g.attributes.uv;
      const circ = Math.PI * 2 * Math.max(rt, rb);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
    }
    this.push(g, mat, x, y + h / 2, z, opts.ry || 0, opts.rx || 0, opts.rz || 0);
  }

  sphere(r, mat, x, y, z, sx = 1, sy = 1, sz = 1, detail = 1) {
    this.push(new THREE.IcosahedronGeometry(r, detail), mat, x, y, z, 0, 0, 0, sx, sy, sz);
  }

  hemi(r, mat, x, y, z) {
    this.push(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat, x, y, z);
  }

  cone(r, h, mat, x, y, z, seg = 8, ry = 0) {
    this.push(new THREE.ConeGeometry(r, h, seg), mat, x, y + h / 2, z, ry);
  }

  lathe(points, mat, x, y, z, seg = 24) {
    this.push(new THREE.LatheGeometry(points.map(([a, b]) => new THREE.Vector2(a, b)), seg), mat, x, y, z);
  }

  // Pitched roof with the ridge along local x. Gable ends use `wall`.
  gable(w, d, h, roof, wall, x = 0, y = 0, z = 0, ry = 0, ov = 0.05) {
    const W = w / 2 + ov, D = d / 2 + ov;
    const hh = h * (D / (d / 2));
    const yb = -(hh - h);
    const p = [];
    const uv = [];
    const quad = (a, b, c, e) => { p.push(...a, ...b, ...c, ...a, ...c, ...e); };
    const sl = Math.hypot(D, hh);
    quad([-W, yb, D], [W, yb, D], [W, h, 0], [-W, h, 0]);
    uv.push(0, 0, w, 0, w, sl, 0, 0, w, sl, 0, sl);
    quad([W, yb, -D], [-W, yb, -D], [-W, h, 0], [W, h, 0]);
    uv.push(0, 0, w, 0, w, sl, 0, 0, w, sl, 0, sl);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    this.push(g, roof, x, y, z, ry);
    // gable triangles
    const t = [];
    const tuv = [];
    const hw = w / 2, hd = d / 2;
    t.push(-hw, 0, -hd, -hw, 0, hd, -hw, h, 0);
    tuv.push(0, 0, d, 0, d / 2, h);
    t.push(hw, 0, hd, hw, 0, -hd, hw, h, 0);
    tuv.push(0, 0, d, 0, d / 2, h);
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(t, 3));
    g2.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
    g2.computeVertexNormals();
    this.push(g2, wall, x, y, z, ry);
    // a slim fascia under the eaves to give the overhang some depth
  }

  hip(w, d, h, mat, x, y, z, ry = 0) {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    this.push(g, mat, x, y + h / 2, z, ry + Math.PI / 4, 0, 0, 1, 1, 1);
    // scale after rotation: rebuild via matrix
    const mm = this.matMap ? this.matMap(mat) : mat;
    const last = this.parts.get(mm.userData.key || mm.uuid).geos;
    const gg = last[last.length - 1];
    gg.translate(-x, -(y + h / 2), -z);
    gg.rotateY(-ry);
    gg.scale(w, h, d);
    gg.rotateY(ry);
    gg.translate(x, y + h / 2, z);
    gg.computeVertexNormals();
  }

  plane(w, d, mat, x, y, z, ry = 0) {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
    this.push(g, mat, x, y, z, ry, -Math.PI / 2);
  }

  // Upright sign facing +z (before ry).
  sign(text, w, h, bg, fg, x, y, z, ry = 0) {
    const g = new THREE.PlaneGeometry(w, h);
    this.push(g, M.sign(text, bg, fg), x, y, z, ry);
    this.box(w + 0.02, h + 0.02, 0.02, M.color('#2b2f35'), x - Math.sin(ry) * 0.012, y - h / 2 - 0.01, z - Math.cos(ry) * 0.012, ry);
  }

  build() {
    const group = new THREE.Group();
    for (const { mat, geos } of this.parts.values()) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = !mat.userData.noShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const o of this.loose) group.add(o);
    group.userData.rotors = this.rotors;
    group.userData.smoke = this.smoke;
    group.userData.fountain = this.fountain;
    return group;
  }
}

// ---------------------------------------------------------------------- shared props
export const PAL = {
  walls: ['#f3e9d8', '#e9dcc6', '#f6f3ec', '#dde7ee', '#f1dfd2', '#e9e4cf', '#dbe6d8', '#f3e3c3'],
  roofs: ['#b5573f', '#8f4b3b', '#5c6772', '#7d5b47', '#a44a3a', '#4d5c6d', '#6f4c3e'],
  cars: ['#d93b3b', '#2f6fdc', '#f2f2f2', '#2c2f35', '#f2c230', '#3aa66b', '#9aa3ad', '#e57a2e', '#7a4fd1'],
  accent: ['#e2574c', '#2f8fd8', '#f0a43a', '#3cae7e', '#8c5ad6', '#e46aa4'],
};

export function lot(b, w, d, kind = 'grass', tint = '#ffffff') {
  b.box(w - 0.04, 0.03, d - 0.04, M.ground(kind, tint), 0, 0, 0);
}

export function tree(b, x, z, s = 1, kind = 0, seed = 0) {
  const trunk = M.color('#6b4a32', { flat: true });
  const greens = ['#2f6b2a', '#3b7d2f', '#4a8a34', '#2a5f2b', '#57953c'];
  const leaf = addWind(M.color(greens[Math.abs(Math.round(seed + kind)) % greens.length], { flat: true, rough: 0.9 }), 1);
  if (kind === 1) {
    b.cyl(0.025 * s, 0.03 * s, 0.12 * s, trunk, x, 0.02, z, 5);
    b.cone(0.16 * s, 0.32 * s, leaf, x, 0.1 * s, z, 7);
    b.cone(0.12 * s, 0.26 * s, leaf, x, 0.26 * s, z, 7);
  } else if (kind === 2) {
    b.cyl(0.02 * s, 0.025 * s, 0.1 * s, trunk, x, 0.02, z, 5);
    b.sphere(0.1 * s, leaf, x, 0.3 * s, z, 1, 2.2, 1, 0);
  } else {
    b.cyl(0.025 * s, 0.032 * s, 0.16 * s, trunk, x, 0.02, z, 5);
    b.sphere(0.15 * s, leaf, x, 0.26 * s, z, 1, 0.9, 1, 1);
    b.sphere(0.11 * s, leaf, x + 0.08 * s, 0.33 * s, z - 0.04 * s, 1, 1, 1, 1);
    b.sphere(0.1 * s, leaf, x - 0.07 * s, 0.31 * s, z + 0.05 * s, 1, 1, 1, 1);
    b.sphere(0.08 * s, leaf, x + 0.01 * s, 0.4 * s, z + 0.01 * s, 1, 1, 1, 0);
  }
}

export function car(b, x, z, ry, color) {
  const body = M.color(color, { rough: 0.35, metal: 0.3 });
  const glass = M.color('#2a3846', { rough: 0.2, metal: 0.4 });
  b.box(0.2, 0.05, 0.095, body, x, 0.025, z, ry);
  b.box(0.11, 0.045, 0.085, glass, x - Math.cos(ry) * 0.01, 0.075, z + Math.sin(ry) * 0.01, ry);
}

export function hedge(b, x, z, w, d, h = 0.07) {
  b.box(w, h, d, M.color('#3e7434', { flat: true }), x, 0.02, z);
}

export function bench(b, x, z, ry = 0) {
  b.box(0.12, 0.025, 0.04, M.color('#8a5a3a'), x, 0.03, z, ry);
}

export function lampPost(b, x, z) {
  b.cyl(0.006, 0.008, 0.2, M.color('#3a3f45', { metal: 0.5 }), x, 0.02, z, 5);
  b.sphere(0.018, M.glow('#ffe7a8'), x, 0.225, z, 1, 1, 1, 0);
}

export function rooftopUnits(b, w, d, y, seed = 0, ox = 0, oz = 0) {
  const m = M.color('#a9adb2', { metal: 0.3, rough: 0.5 });
  const n = 2 + (seed % 3);
  for (let i = 0; i < n; i++) {
    const x = ((i * 0.37 + seed * 0.13) % 1 - 0.5) * w * 0.6;
    const z = ((i * 0.61 + seed * 0.29) % 1 - 0.5) * d * 0.6;
    b.box(0.12, 0.07, 0.1, m, ox + x, y, oz + z);
  }
}

export function parapet(b, w, d, y, mat, h = 0.04, t = 0.03, ox = 0, oz = 0) {
  b.box(w, h, t, mat, ox, y, oz + d / 2 - t / 2);
  b.box(w, h, t, mat, ox, y, oz - d / 2 + t / 2);
  b.box(t, h, d - 2 * t, mat, ox + w / 2 - t / 2, y, oz);
  b.box(t, h, d - 2 * t, mat, ox - w / 2 + t / 2, y, oz);
}

export function block(b, w, h, d, facade, tint, x, y, z, roof = 'gravel', roofTint = '#ffffff') {
  b.box(w, h, d, { side: M.facade(facade, tint), top: M.roof(roof, roofTint) }, x, y, z);
}
