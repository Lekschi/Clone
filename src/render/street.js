// Street furniture: lamps with light pools, street trees, traffic lights that cycle (and that
// cars obey), bus shelters, benches, bins and hydrants. Everything is instanced per kind.
import * as THREE from 'three';
import { M } from './kit.js';
import { addWind } from './shared.js';

const CYCLE = 9; // seconds for a full traffic light cycle
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };

function merge(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
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
const bx = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; };
const cy = (r1, r2, h, x, y, z, seg = 8) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); g.translate(x, y + h / 2, z); return g; };

export class StreetFurniture {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.meshes = [];
    this.junctions = new Map();
    this.t = 0;
    const metal = new THREE.MeshStandardMaterial({ color: '#4a5058', metalness: 0.55, roughness: 0.45 });
    this.mats = {
      metal,
      glow: M.glow('#ffe2a0'),
      trunk: new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9, flatShading: true }),
      leaf: addWind(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, flatShading: true, envMapIntensity: 0.4 }), 0.8),
      glass: M.glass(),
      shelter: new THREE.MeshStandardMaterial({ color: '#2f6db1', metalness: 0.3, roughness: 0.4 }),
      bench: new THREE.MeshStandardMaterial({ color: '#8a5a3a', roughness: 0.8 }),
      bin: new THREE.MeshStandardMaterial({ color: '#2f5d43', roughness: 0.6, metalness: 0.2 }),
      hydrant: new THREE.MeshStandardMaterial({ color: '#c62f2f', roughness: 0.5 }),
      lamp: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      tlHead: new THREE.MeshStandardMaterial({ color: '#23272c', roughness: 0.6 }),
    };
    // light pool texture
    const pc = document.createElement('canvas');
    pc.width = pc.height = 64;
    const pctx = pc.getContext('2d');
    const pg = pctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    pg.addColorStop(0, 'rgba(255,214,150,0.9)'); pg.addColorStop(0.45, 'rgba(255,200,130,0.35)'); pg.addColorStop(1, 'rgba(255,190,120,0)');
    pctx.fillStyle = pg; pctx.fillRect(0, 0, 64, 64);
    const pt = new THREE.CanvasTexture(pc);
    pt.colorSpace = THREE.SRGBColorSpace;
    this.poolMat = new THREE.MeshBasicMaterial({ map: pt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 });
    // geometries (local: +x points towards the road)
    const pool = new THREE.PlaneGeometry(0.62, 0.62); pool.rotateX(-Math.PI / 2); pool.translate(0.09, 0.022, 0);
    const crown = merge([[0, 0.34, 0, 0.13], [0.07, 0.4, -0.03, 0.09], [-0.06, 0.39, 0.05, 0.09], [0.01, 0.47, 0.01, 0.08]].map(([x, y, z, r]) => { const g = new THREE.DodecahedronGeometry(r, 0); g.translate(x, y, z); return g; }));
    this.geo = {
      lamp: merge([cy(0.008, 0.011, 0.26, 0, 0, 0, 5), bx(0.09, 0.008, 0.01, 0.04, 0.251, 0)]),
      lampHead: bx(0.05, 0.012, 0.028, 0.075, 0.242, 0),
      pool,
      trunk: cy(0.016, 0.022, 0.28, 0, 0, 0, 5),
      crown,
      tlPole: merge([cy(0.009, 0.011, 0.3, 0, 0, 0, 6), bx(0.16, 0.009, 0.009, 0.08, 0.29, 0)]),
      tlHead: bx(0.026, 0.07, 0.026, 0.15, 0.225, 0),
      tlLamp: new THREE.SphereGeometry(0.0085, 8, 6),
      shelterFrame: merge([bx(0.3, 0.012, 0.12, 0, 0.17, 0), bx(0.012, 0.17, 0.012, -0.14, 0, -0.05), bx(0.012, 0.17, 0.012, 0.14, 0, -0.05), bx(0.012, 0.17, 0.012, -0.14, 0, 0.05), bx(0.012, 0.17, 0.012, 0.14, 0, 0.05), bx(0.04, 0.12, 0.004, 0.17, 0.03, 0.05)]),
      shelterGlass: bx(0.28, 0.14, 0.004, 0, 0.02, -0.055),
      bench: merge([bx(0.2, 0.012, 0.04, 0, 0.04, 0), bx(0.2, 0.04, 0.008, 0, 0.05, -0.02), bx(0.01, 0.04, 0.035, -0.09, 0, 0), bx(0.01, 0.04, 0.035, 0.09, 0, 0)]),
      bin: cy(0.014, 0.012, 0.05, 0, 0, 0, 8),
      hydrant: merge([cy(0.011, 0.013, 0.045, 0, 0, 0, 8), cy(0.013, 0.011, 0.012, 0, 0.045, 0, 8), bx(0.035, 0.008, 0.008, 0, 0.026, 0)]),
    };
  }

  // groups: Map(mask -> [[x,z]...]) from the road builder
  rebuild(groups) {
    for (const m of this.meshes) { this.group.remove(m); m.dispose(); }
    this.meshes = [];
    this.junctions.clear();
    const lists = { lamp: [], tree: [], tl: [], shelter: [], bench: [], bin: [], hydrant: [] };
    const g = this.game;
    for (const [mask, cells] of groups) {
      const n = ((mask & 1) ? 1 : 0) + ((mask & 2) ? 1 : 0) + ((mask & 4) ? 1 : 0) + ((mask & 8) ? 1 : 0);
      const ns = mask === 5, ew = mask === 10;
      for (const [x, z] of cells) {
        if (n >= 3) {
          // traffic lights on two opposite corners
          this.junctions.set(x * 1000 + z, { x, z, off: hash(x, z) * CYCLE });
          lists.tl.push([x + 0.5 - 0.42, z + 0.5 - 0.42, -Math.PI / 4, x, z, 0]);
          lists.tl.push([x + 0.5 + 0.42, z + 0.5 + 0.42, (3 * Math.PI) / 4, x, z, 1]);
          continue;
        }
        if (!ns && !ew) continue;
        const r = hash(x, z);
        const side = (x + z) % 2 ? 1 : -1;
        // facing the road: rotation such that local +x points to the road centre
        const pos = (off) => (ns ? [x + 0.5 + side * off, z + 0.5] : [x + 0.5, z + 0.5 + side * off]);
        const rot = ns ? (side > 0 ? Math.PI : 0) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        if ((x + z) % 3 === 0) lists.lamp.push([...pos(0.41), rot]);
        else if ((x + z) % 3 === 1 && g.inMap(x, z)) {
          // trees on the opposite pavement
          const o = -side;
          lists.tree.push([ns ? x + 0.5 + o * 0.43 : x + 0.5 + (r - 0.5) * 0.3, ns ? z + 0.5 + (r - 0.5) * 0.3 : z + 0.5 + o * 0.43, r * 6.28, 0.75 + r * 0.35]);
        }
        if (r < 0.07) { lists.shelter.push([...pos(0.42), rot + Math.PI / 2]); continue; }
        if (r > 0.88) lists.bench.push([...pos(0.43), rot + Math.PI / 2]);
        else if (r > 0.8) lists.bin.push([...pos(0.44), 0]);
        else if (r > 0.76) lists.hydrant.push([...pos(0.44), 0]);
      }
    }
    const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const inst = (geo, mat, list, shadow = true, scaleOf = () => 1) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((e, i) => { q.setFromAxisAngle(up, e[2]); p.set(e[0], 0.012, e[1]); sc.setScalar(scaleOf(e)); m4.compose(p, q, sc); im.setMatrixAt(i, m4); });
      im.castShadow = shadow;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.group.add(im);
      this.meshes.push(im);
      return im;
    };
    const G = this.geo, Mt = this.mats;
    inst(G.lamp, Mt.metal, lists.lamp);
    inst(G.lampHead, Mt.glow, lists.lamp, false);
    inst(G.pool, this.poolMat, lists.lamp, false);
    inst(G.trunk, Mt.trunk, lists.tree, true, (e) => e[3]);
    const crowns = inst(G.crown, Mt.leaf, lists.tree, true, (e) => e[3]);
    if (crowns) {
      const c = new THREE.Color();
      lists.tree.forEach((e, i) => { c.setHSL(0.25 + hash(e[0], e[1]) * 0.07, 0.5, 0.22 + hash(e[1], e[0]) * 0.08); crowns.setColorAt(i, c); });
      crowns.instanceColor.needsUpdate = true;
    }
    inst(G.tlPole, Mt.metal, lists.tl);
    inst(G.tlHead, Mt.tlHead, lists.tl);
    // three lamps per head: red top, amber middle, green bottom
    this.tlLamps = null;
    if (lists.tl.length) {
      const im = new THREE.InstancedMesh(G.tlLamp, Mt.lamp, lists.tl.length * 3);
      let i = 0;
      for (const e of lists.tl) {
        q.setFromAxisAngle(up, e[2]);
        for (let k = 0; k < 3; k++) {
          const local = new THREE.Vector3(0.15, 0.247 - k * 0.022, 0.014).applyQuaternion(q);
          p.set(e[0] + local.x, 0.012 + local.y, e[1] + local.z);
          m4.compose(p, q, sc.setScalar(1));
          im.setMatrixAt(i++, m4);
        }
      }
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.group.add(im);
      this.meshes.push(im);
      this.tlLamps = { im, list: lists.tl };
    }
    inst(G.shelterFrame, Mt.shelter, lists.shelter);
    inst(G.shelterGlass, Mt.glass, lists.shelter, false);
    inst(G.bench, Mt.bench, [...lists.bench, ...lists.shelter.map((e) => [e[0], e[1], e[2]])]);
    inst(G.bin, Mt.bin, lists.bin);
    inst(G.hydrant, Mt.hydrant, lists.hydrant);
    this.lastPhase = null;
  }

  // Which axis may drive at junction (x,z): 'ns' | 'ew' | null (amber/all red)
  phase(x, z) {
    const j = this.junctions.get(x * 1000 + z);
    if (!j) return 'all';
    const t = (this.t + j.off) % CYCLE;
    if (t < 3.6) return 'ns';
    if (t < 4.5) return null;
    if (t < 8.1) return 'ew';
    return null;
  }

  isJunction(x, z) { return this.junctions.has(x * 1000 + z); }

  update(dt, night) {
    this.t += dt;
    this.poolMat.opacity = Math.max(0, Math.min(1, (night - 0.4) / 0.45)) * 0.75;
    const L = this.tlLamps;
    if (!L) return;
    const c = new THREE.Color();
    const on = [new THREE.Color(3, 0.15, 0.1), new THREE.Color(3, 1.6, 0.1), new THREE.Color(0.2, 3, 0.6)];
    const off = new THREE.Color(0.12, 0.12, 0.12);
    let i = 0;
    for (const e of L.list) {
      const ph = this.phase(e[3], e[4]);
      // head 0 controls north–south traffic, head 1 east–west
      const mine = e[5] === 0 ? 'ns' : 'ew';
      const state = ph === mine ? 2 : ph === null ? 1 : 0;
      for (let k = 0; k < 3; k++) L.im.setColorAt(i++, k === state ? on[k] : c.copy(off));
    }
    L.im.instanceColor.needsUpdate = true;
  }
}
