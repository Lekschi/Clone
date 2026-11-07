// Every building in the game, modelled procedurally. Local space: footprint centred on the origin,
// ground at y = 0, street-facing front towards +z. One world unit = one grid cell (~12 m),
// one storey = 0.25 units.
import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings.js';
import { Builder, M, PAL, lot, tree, car, hedge, bench, lampPost, rooftopUnits, parapet, block } from './kit.js';

const F = 0.25; // storey height
const B0 = 0.03; // top of lot plate

// ============================================================================ housing
function houseL1(b, v) {
  const wall = PAL.walls[v % 8], roofC = PAL.roofs[v % 7];
  lot(b, 2, 2, 'grass');
  const fw = M.facade(v % 3 === 0 ? 'brick' : 'plaster', v % 3 === 0 ? '#ffffff' : wall);
  b.box(0.95, 2 * F, 0.72, fw, -0.28, B0, -0.2);
  b.gable(0.95, 0.72, 0.34, M.roof('tiles', roofC), fw, -0.28, B0 + 2 * F, -0.2);
  b.box(0.08, 0.3, 0.08, M.color('#8d5141'), -0.55, B0 + 0.5, -0.35);
  b.box(0.13, 0.19, 0.02, M.color('#5e3b26'), -0.28, B0, 0.165);
  b.box(0.3, 0.015, 0.14, M.color('#cfc6b6'), -0.28, B0, 0.24);
  b.box(0.06, 0.012, 0.66, M.ground('paving'), -0.28, B0, 0.62);
  // garage + driveway
  b.box(0.42, 0.28, 0.55, M.facade('plaster', wall), 0.5, B0, -0.15);
  b.box(0.44, 0.03, 0.57, M.color('#6f757c'), 0.5, B0 + 0.28, -0.15);
  b.box(0.32, 0.21, 0.015, M.color('#e6e3dc'), 0.5, B0, 0.13);
  b.box(0.38, 0.012, 0.86, M.ground('paving'), 0.5, B0, 0.56);
  car(b, 0.5, 0.55, Math.PI / 2, PAL.cars[v % PAL.cars.length]);
  hedge(b, -0.62, 0.95, 0.72, 0.06);
  hedge(b, -0.97, 0.3, 0.06, 1.3);
  tree(b, 0.65, -0.72, 1.25, 0, v);
  tree(b, -0.75, -0.78, 1.05, v % 3, v + 1);
  tree(b, -0.75, 0.62, 0.8, 1, v + 2);
  // garden details
  b.box(0.22, 0.012, 0.16, M.color('#6aa0c8', { rough: 0.2 }), 0.2, B0, -0.75);
  bench(b, -0.2, -0.75);
}

function houseL2(b, v) {
  lot(b, 2, 2, 'grass');
  const c1 = PAL.walls[v % 8], c2 = PAL.walls[(v + 3) % 8];
  const roof = M.roof('tiles', PAL.roofs[(v + 1) % 7]);
  b.box(0.68, 2 * F, 0.78, M.facade('plaster', c1), -0.34, B0, -0.2);
  b.box(0.68, 2 * F, 0.78, M.facade('plaster', c2), 0.34, B0, -0.2);
  b.gable(1.36, 0.78, 0.38, roof, M.facade('plaster', c1), 0, B0 + 2 * F, -0.2);
  b.box(0.16, 0.1, 0.12, M.color('#6f7880'), -0.34, B0 + 0.68, 0.0);
  b.box(0.16, 0.1, 0.12, M.color('#6f7880'), 0.34, B0 + 0.68, 0.0);
  for (const s of [-1, 1]) {
    b.box(0.12, 0.19, 0.02, M.color(s < 0 ? '#2f4f6f' : '#7a3b2a'), s * 0.2, B0, 0.195);
    b.box(0.3, 0.06, 0.1, M.color('#efefef'), s * 0.2, B0 + 0.22, 0.24);
    b.box(0.3, 0.012, 0.72, M.ground('paving'), s * 0.62, B0, 0.62);
    car(b, s * 0.62, 0.6, Math.PI / 2, PAL.cars[(v + (s > 0 ? 4 : 0)) % PAL.cars.length]);
    b.box(0.07, 0.012, 0.75, M.ground('paving'), s * 0.2, B0, 0.6);
  }
  hedge(b, 0, 0.6, 0.05, 0.7, 0.06);
  b.box(0.28, 0.2, 0.22, M.color('#a6835e'), -0.7, B0, -0.78);
  b.gable(0.28, 0.22, 0.1, M.roof('tiles', '#6f4c3e'), M.color('#a6835e'), -0.7, B0 + 0.2, -0.78);
  tree(b, 0.7, -0.78, 1.2, 0, v);
  tree(b, 0.25, -0.82, 0.9, 2, v + 1);
  tree(b, -0.9, 0.9, 0.7, 1, v);
}

function houseL3(b, v) {
  lot(b, 2, 2, 'grass');
  const n = 4;
  const uw = 0.43;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * uw;
    const col = PAL.walls[(v + i * 3) % 8];
    const brick = (v + i) % 4 === 0;
    const fw = M.facade(brick ? 'brick' : 'plaster', brick ? '#ffffff' : col);
    const h = 3 * F + ((i + v) % 2) * 0.03;
    b.box(uw, h, 0.82, fw, x, B0, -0.25);
    b.gable(uw, 0.82, 0.3, M.roof('tiles', PAL.roofs[(v + i) % 7]), fw, x, B0 + h, -0.25, Math.PI / 2 * 0, 0.02);
    b.box(0.1, 0.19, 0.02, M.color(PAL.accent[(i + v) % 6]), x - 0.08, B0, 0.155);
    b.box(0.07, 0.012, 0.66, M.ground('paving'), x - 0.08, B0, 0.5);
    hedge(b, x + 0.21, 0.5, 0.025, 0.6, 0.05);
    b.box(0.05, 0.08, 0.05, M.color('#3d5a46'), x + 0.12, B0, 0.82);
    tree(b, x, -0.85, 0.75 + ((i + v) % 3) * 0.12, (i + v) % 3, v + i);
  }
  hedge(b, 0, 0.95, 1.76, 0.05, 0.05);
}

function houseL4(b, v) {
  lot(b, 2, 2, 'paving');
  const col = PAL.walls[v % 8];
  const fw = M.facade(v % 2 ? 'plaster' : 'brick', v % 2 ? col : '#ffffff');
  const base = M.facade('shop', '#f0e6d6');
  b.box(1.66, F, 1.06, base, 0, B0, -0.25);
  b.box(1.62, 3 * F, 1.02, fw, 0, B0 + F, -0.25);
  b.box(1.7, 0.03, 1.1, M.color('#e8e2d6'), 0, B0 + F, -0.25);
  b.hip(1.66, 1.06, 0.36, M.roof('tiles', v % 2 ? '#56606b' : '#7a4a3c'), 0, B0 + 4 * F, -0.25);
  for (let i = 0; i < 3; i++) {
    const x = -0.5 + i * 0.5;
    b.box(0.18, 0.13, 0.12, M.facade('plaster', col), x, B0 + 4 * F + 0.06, 0.18);
    for (let f = 1; f < 4; f++) {
      b.box(0.24, 0.02, 0.1, M.color('#dcd6cb'), x, B0 + f * F + 0.02, 0.32);
      b.box(0.24, 0.07, 0.01, M.color('#3f4247', { metal: 0.5 }), x, B0 + f * F + 0.04, 0.37);
    }
  }
  // awning over the shop floor
  b.box(1.5, 0.02, 0.14, M.color(PAL.accent[v % 6]), 0, B0 + 0.2, 0.34);
  for (const x of [-0.75, 0.75]) tree(b, x, 0.8, 0.9, 0, v);
  tree(b, 0, 0.8, 0.8, 2, v);
  bench(b, -0.35, 0.82);
  bench(b, 0.35, 0.82);
}

function houseL5(b, v) {
  lot(b, 2, 2, 'paving');
  const facades = ['modern', 'plaster', 'office'];
  const fac = facades[v % 3];
  const col = ['#f2efe8', '#e4ecf2', '#efe2d0', '#e3eadf'][v % 4];
  const fw = M.facade(fac, col);
  const h = 6 * F;
  b.box(1.75, h, 0.72, { side: fw, top: M.roof('gravel') }, 0, B0, -0.5);
  b.box(0.62, h - F, 0.9, { side: fw, top: M.roof('gravel') }, 0.56, B0, 0.3);
  parapet(b, 1.75, 0.72, B0 + h, M.color('#d5d2cb'), 0.04, 0.03, 0, -0.5);
  parapet(b, 0.62, 0.9, B0 + h - F, M.color('#d5d2cb'), 0.04, 0.03, 0.56, 0.3);
  b.box(0.6, F, 0.42, { side: M.facade('glass', '#ffffff'), top: M.roof('gravel') }, -0.4, B0 + h, -0.55);
  const acc = M.color(PAL.accent[v % 6]);
  for (let f = 1; f < 6; f++) {
    b.box(1.0, 0.02, 0.12, M.color('#f4f4f2'), -0.35, B0 + f * F, -0.08);
    b.box(1.0, 0.05, 0.012, acc, -0.35, B0 + f * F + 0.02, -0.025);
  }
  rooftopUnits(b, 1.2, 0.5, B0 + h, v, 0.3, -0.5);
  tree(b, -0.55, 0.55, 1.1, 0, v);
  tree(b, -0.15, 0.75, 0.9, 0, v + 1);
  bench(b, -0.35, 0.35, Math.PI / 2);
  b.box(0.5, 0.012, 0.5, M.ground('grass'), -0.4, B0, 0.6);
}

function houseL6(b, v) {
  lot(b, 2, 2, 'paving');
  const fac = ['band', 'office', 'modern'][v % 3];
  const facadeName = fac === 'band' ? 'modern' : fac;
  const col = ['#f3f1ec', '#e6e1d6', '#dfe6ec'][v % 3];
  b.box(1.85, F, 1.6, { side: M.facade('shop', '#ffffff'), top: M.roof('gravel') }, 0, B0, -0.15);
  const h = 8 * F;
  const fw = M.facade(facadeName, col);
  b.box(1.65, h, 0.78, { side: fw, top: M.roof('gravel') }, 0, B0 + F, -0.4);
  b.box(0.7, h - 2 * F, 0.72, { side: fw, top: M.roof('gravel') }, -0.5, B0 + F, 0.35);
  parapet(b, 1.65, 0.78, B0 + F + h, M.color('#cfcac0'), 0.05, 0.03, 0, -0.4);
  const acc = M.color(PAL.accent[v % 6]);
  b.box(0.14, h + 0.05, 0.03, acc, 0.45, B0 + F, 0.0);
  b.box(0.14, h + 0.05, 0.03, acc, -0.2, B0 + F, 0.0);
  rooftopUnits(b, 1.2, 0.5, B0 + F + h, v + 3, 0, -0.4);
  b.box(0.5, 0.012, 0.6, M.ground('grass'), 0.45, B0 + F, 0.35);
  tree(b, 0.4, 0.35, 0.6, 0, v);
  tree(b, 0.6, 0.55, 0.5, 2, v);
  b.box(1.85, 0.02, 0.12, M.color(PAL.accent[(v + 2) % 6]), 0, B0 + 0.2, 0.7);
}

function houseL7(b, v) {
  lot(b, 2, 2, 'paving');
  const glass = v % 2 ? 'glass' : 'office';
  const tint = v % 2 ? ['#ffffff', '#cfe0ff', '#d8f0ea'][v % 3] : ['#f1ede4', '#e8eef2'][v % 2];
  b.box(1.85, 2 * F, 1.7, { side: M.facade('shop', '#ffffff'), top: M.roof('field') }, 0, B0, -0.1);
  const h = 12 * F;
  b.box(1.05, h, 1.05, { side: M.facade(glass, tint), top: M.roof('gravel') }, -0.2, B0 + 2 * F, -0.25);
  b.box(0.85, 2 * F, 0.85, { side: M.facade(glass, tint), top: M.roof('gravel') }, -0.2, B0 + 2 * F + h, -0.25);
  b.box(0.95, 0.06, 0.95, M.color('#e7e5df'), -0.2, B0 + 2 * F + h, -0.25);
  parapet(b, 0.85, 0.85, B0 + 4 * F + h, M.color('#c8c8c8'), 0.08, 0.03, -0.2, -0.25);
  for (let f = 3; f < 14; f += 1) {
    b.box(1.09, 0.025, 1.09, M.color('#eeeeec'), -0.2, B0 + f * F, -0.25);
  }
  rooftopUnits(b, 0.5, 0.5, B0 + 4 * F + h, v, -0.2, -0.25);
  tree(b, 0.6, 0.5, 0.55, 0, v);
  tree(b, 0.65, -0.5, 0.55, 0, v + 1);
  tree(b, -0.6, 0.6, 0.5, 2, v);
  b.box(0.4, 0.04, 0.3, M.color('#efefef'), 0.6, B0 + 2 * F, 0.0);
}

function houseL8(b, v) {
  lot(b, 2, 2, 'paving');
  b.box(1.9, 2 * F, 1.8, { side: M.facade('shop', '#ffffff'), top: M.roof('gravel') }, 0, B0, -0.05);
  const glass = ['glass', 'glassdark', 'glass'][v % 3];
  const tint = ['#ffffff', '#ffffff', '#cde8ff'][v % 3];
  const fw = M.facade(glass, tint);
  if (v % 3 === 2) {
    // round tower
    b.cyl(0.62, 0.62, 18 * F, fw, 0, B0 + 2 * F, -0.1, 28, { facade: true });
    for (let f = 0; f < 18; f += 3) b.cyl(0.66, 0.66, 0.03, M.color('#e9edf1'), 0, B0 + 2 * F + f * F, -0.1, 28);
    b.cyl(0.5, 0.5, 2 * F, fw, 0, B0 + 20 * F, -0.1, 28, { facade: true });
    b.cyl(0.52, 0.52, 0.05, M.color('#e9edf1'), 0, B0 + 22 * F, -0.1, 28);
    b.cyl(0.25, 0.3, 0.12, M.color('#c9ced4'), 0, B0 + 22 * F + 0.05, -0.1, 16);
    b.cyl(0.012, 0.02, 0.6, M.color('#d9dde2', { metal: 0.6 }), 0, B0 + 22 * F + 0.17, -0.1, 6);
  } else {
    const h = 18 * F;
    b.box(1.2, h, 1.2, { side: fw, top: M.roof('gravel') }, 0, B0 + 2 * F, -0.1);
    b.box(0.95, 3 * F, 0.95, { side: fw, top: M.roof('gravel') }, 0, B0 + 2 * F + h, -0.1);
    b.box(0.6, 2 * F, 0.6, { side: fw, top: M.roof('gravel') }, 0, B0 + 5 * F + h, -0.1);
    for (const [x, z] of [[-0.6, -0.7], [0.6, -0.7], [-0.6, 0.5], [0.6, 0.5]]) b.box(0.06, h, 0.06, M.color('#d4d9de', { metal: 0.5, rough: 0.3 }), x, B0 + 2 * F, z);
    b.cyl(0.012, 0.025, 0.8, M.color('#d9dde2', { metal: 0.6 }), 0, B0 + 7 * F + h, -0.1, 6);
    b.sphere(0.025, M.glow('#ff4040'), 0, B0 + 7 * F + h + 0.8, -0.1, 1, 1, 1, 0);
  }
  tree(b, -0.75, 0.75, 0.55, 0, v);
  tree(b, 0.75, 0.75, 0.55, 0, v + 1);
  b.box(0.6, 0.06, 0.2, M.color('#efefef'), 0, B0 + 2 * F, 0.75);
}

const HOUSES = [null, houseL1, houseL2, houseL3, houseL4, houseL5, houseL6, houseL7, houseL8];

// ============================================================================ utilities
function windTurbine(b) {
  lot(b, 1, 1, 'grass');
  b.cyl(0.035, 0.07, 1.6, M.color('#f3f4f5', { rough: 0.5 }), 0, B0, 0, 12);
  b.box(0.08, 0.08, 0.2, M.color('#eef0f2', { rough: 0.5 }), 0, B0 + 1.58, -0.02);
  const rotor = new THREE.Group();
  rotor.name = 'rotor';
  rotor.position.set(0, B0 + 1.62, 0.1);
  const bladeMat = M.color('#f7f8f9', { rough: 0.45 });
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), bladeMat);
  hub.castShadow = true;
  rotor.add(hub);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.BoxGeometry(0.035, 0.7, 0.012);
    g.translate(0, 0.36, 0);
    const blade = new THREE.Mesh(g, bladeMat);
    blade.rotation.z = (i * Math.PI * 2) / 3;
    blade.castShadow = true;
    rotor.add(blade);
  }
  rotor.userData.spin = { axis: 'z', speed: 1.6 };
  b.loose.push(rotor);
  b.box(0.18, 0.12, 0.14, M.color('#c9ccd0'), 0.3, B0, 0.3);
}

function coalPlant(b) {
  lot(b, 2, 2, 'concrete');
  const tower = [[0.42, 0], [0.33, 0.45], [0.3, 0.75], [0.34, 1.05]];
  b.lathe(tower, M.color('#c9c6bf', { rough: 0.95 }), -0.45, B0, -0.45, 28);
  b.box(0.95, 0.6, 0.6, { side: M.facade('panel', '#c0b6a8'), top: M.roof('metal', '#8a8f94') }, 0.4, B0, 0.15);
  b.box(0.6, 0.35, 0.4, { side: M.facade('panel', '#a9b2ba'), top: M.roof('metal', '#7b8086') }, 0.45, B0 + 0.6, 0.05);
  b.cyl(0.07, 0.1, 1.7, M.color('#b9b4ad'), 0.75, B0, -0.6, 14);
  b.cyl(0.075, 0.075, 0.08, M.color('#c0392b'), 0.75, B0 + 1.45, -0.6, 14);
  b.cyl(0.075, 0.075, 0.08, M.color('#c0392b'), 0.75, B0 + 1.6, -0.6, 14);
  b.smoke.push(new THREE.Vector3(0.75, B0 + 1.75, -0.6));
  b.smoke.push(new THREE.Vector3(-0.45, B0 + 1.1, -0.45));
  // coal heaps
  b.sphere(0.25, M.color('#2b2b2d', { flat: true }), -0.5, B0, 0.55, 1.2, 0.45, 1, 1);
  b.sphere(0.18, M.color('#2b2b2d', { flat: true }), -0.1, B0, 0.7, 1.2, 0.45, 1, 1);
  b.box(0.08, 0.5, 0.08, M.color('#6c7177'), 0.0, B0, -0.1);
}

function solarPark(b) {
  lot(b, 2, 2, 'grass', '#cfe0b8');
  const panel = M.roof('solar');
  const frame = M.color('#9aa1a8', { metal: 0.6 });
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const x = -0.45 + c * 0.9, z = -0.7 + r * 0.45;
      b.box(0.02, 0.1, 0.02, frame, x - 0.3, B0, z);
      b.box(0.02, 0.1, 0.02, frame, x + 0.3, B0, z);
      const g = new THREE.BoxGeometry(0.8, 0.02, 0.3);
      b.push(g, panel, x, B0 + 0.14, z, 0, -0.45);
    }
  }
  b.box(0.2, 0.15, 0.15, M.color('#e5e5e0'), 0.85, B0, 0.85);
}

function gasPlant(b) {
  lot(b, 2, 2, 'concrete');
  b.box(1.0, 0.55, 0.7, { side: M.facade('panel', '#d9dde0'), top: M.roof('metal', '#7d8a96') }, -0.3, B0, 0.3);
  for (const [x, z] of [[0.55, -0.45], [0.55, 0.15]]) {
    b.sphere(0.25, M.color('#e9ecef', { rough: 0.4, metal: 0.3 }), x, B0 + 0.35, z, 1, 1, 1, 2);
    b.cyl(0.03, 0.03, 0.15, M.color('#8a939b'), x, B0, z, 6);
  }
  for (const x of [-0.6, -0.3]) {
    b.cyl(0.06, 0.07, 1.3, M.color('#cfd3d6'), x, B0, -0.55, 12);
    b.smoke.push(new THREE.Vector3(x, B0 + 1.35, -0.55));
  }
  b.box(0.04, 0.04, 1.2, M.color('#e1b12c', { metal: 0.4 }), 0.2, B0 + 0.3, 0.0);
  b.box(1.0, 0.04, 0.04, M.color('#e1b12c', { metal: 0.4 }), -0.1, B0 + 0.3, -0.25);
}

function nuclearPlant(b) {
  lot(b, 3, 3, 'concrete');
  const tower = [[0.62, 0], [0.48, 0.7], [0.44, 1.15], [0.5, 1.6]];
  b.lathe(tower, M.color('#d0cdc6', { rough: 0.95 }), -0.75, B0, -0.75, 32);
  b.lathe(tower, M.color('#d0cdc6', { rough: 0.95 }), 0.6, B0, -0.85, 32);
  b.smoke.push(new THREE.Vector3(-0.75, B0 + 1.65, -0.75));
  b.smoke.push(new THREE.Vector3(0.6, B0 + 1.65, -0.85));
  b.cyl(0.42, 0.42, 0.55, M.color('#e3e4e6'), -0.4, B0, 0.7, 28);
  b.hemi(0.42, M.color('#e3e4e6'), -0.4, B0 + 0.55, 0.7);
  b.box(1.1, 0.5, 0.7, { side: M.facade('panel', '#dfe3e6'), top: M.roof('metal', '#6d7c8a') }, 0.65, B0, 0.6);
  b.box(0.3, 0.9, 0.3, { side: M.facade('panel', '#c9ced3'), top: M.roof('gravel') }, 0.95, B0, 0.1);
  b.box(2.8, 0.06, 0.04, M.color('#5e6670'), 0, B0, 1.4);
  b.box(0.04, 0.06, 2.8, M.color('#5e6670'), -1.4, B0, 0);
}

function waterTower(b) {
  lot(b, 1, 1, 'grass');
  const leg = M.color('#7d8b96', { metal: 0.5 });
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) b.cyl(0.02, 0.025, 0.85, leg, x, B0, z, 6);
  b.cyl(0.29, 0.29, 0.32, M.color('#4fa3d9', { rough: 0.4, metal: 0.2 }), 0, B0 + 0.85, 0, 24);
  b.cone(0.3, 0.14, M.color('#3c86b7', { rough: 0.4 }), 0, B0 + 1.17, 0, 24);
  b.cyl(0.3, 0.3, 0.04, M.color('#ffffff'), 0, B0 + 1.0, 0, 24);
  b.box(0.18, 0.12, 0.14, M.color('#c9ccd0'), 0.3, B0, 0.32);
}

function pumpStation(b) {
  lot(b, 2, 2, 'grass');
  b.box(0.8, 0.4, 0.6, { side: M.facade('brick', '#ffffff'), top: M.roof('gravel') }, -0.4, B0, 0.35);
  b.gable(0.8, 0.6, 0.2, M.roof('tiles', '#4c5b6b'), M.facade('brick', '#ffffff'), -0.4, B0 + 0.4, 0.35);
  b.cyl(0.42, 0.42, 0.1, M.color('#c8c4bc'), 0.4, B0, -0.4, 28);
  b.cyl(0.38, 0.38, 0.105, M.water(), 0.4, B0, -0.4, 28);
  b.cyl(0.04, 0.04, 0.9, M.color('#3d8ac2', { metal: 0.4 }), 0.0, B0 + 0.1, -0.05, 8, { rz: Math.PI / 2 });
  b.box(0.3, 0.25, 0.3, M.color('#3d8ac2', { metal: 0.3 }), 0.5, B0, 0.5);
}

function waterWorks(b) {
  lot(b, 2, 2, 'concrete');
  for (let i = 0; i < 2; i++) {
    b.box(0.9, 0.12, 0.55, M.color('#c9c6bf'), -0.45 + i * 0.95, B0, -0.55);
    b.box(0.82, 0.125, 0.47, M.water(), -0.45 + i * 0.95, B0, -0.55);
  }
  b.box(1.2, 0.45, 0.55, { side: M.facade('modern', '#dbe9f3'), top: M.roof('gravel') }, -0.3, B0, 0.45);
  b.cyl(0.18, 0.18, 0.5, M.color('#5aa6d6', { metal: 0.3, rough: 0.35 }), 0.65, B0, 0.45, 18);
  b.hemi(0.18, M.color('#5aa6d6', { metal: 0.3, rough: 0.35 }), 0.65, B0 + 0.5, 0.45);
}

function septic(b) {
  lot(b, 1, 1, 'grass');
  b.cyl(0.32, 0.32, 0.1, M.color('#bdb8ae'), 0, B0, -0.08, 24);
  b.cyl(0.28, 0.28, 0.105, M.color('#6f6a3e', { rough: 0.3 }), 0, B0, -0.08, 24);
  b.box(0.04, 0.04, 0.6, M.color('#8f969c', { metal: 0.5 }), 0, B0 + 0.11, -0.08);
  b.box(0.24, 0.16, 0.16, M.facade('panel', '#e0ddd5'), 0.28, B0, 0.33);
}

function sewagePlant(b) {
  lot(b, 2, 2, 'concrete');
  for (const [x, z] of [[-0.5, -0.5], [0.1, -0.55], [-0.5, 0.15]]) {
    b.cyl(0.3, 0.3, 0.1, M.color('#c7c3ba'), x, B0, z, 24);
    b.cyl(0.27, 0.27, 0.105, M.color('#62703f', { rough: 0.3 }), x, B0, z, 24);
    b.box(0.03, 0.03, 0.56, M.color('#9aa0a6'), x, B0 + 0.12, z);
  }
  for (const x of [0.4, 0.7]) {
    b.sphere(0.15, M.color('#c3cdd6', { metal: 0.4, rough: 0.35 }), x, B0 + 0.4, 0.35, 1, 1.6, 1, 2);
    b.cyl(0.05, 0.08, 0.15, M.color('#8e98a2'), x, B0, 0.35, 8);
  }
  b.box(0.5, 0.3, 0.35, { side: M.facade('panel', '#d8d4ca'), top: M.roof('metal') }, 0.2, B0, 0.75);
}

function ecoSewage(b) {
  lot(b, 2, 2, 'grass');
  for (const [x, z] of [[-0.5, -0.45], [0.35, -0.45], [-0.5, 0.35]]) {
    b.box(0.75, 0.06, 0.6, M.color('#bdb8ae'), x, B0, z);
    b.box(0.68, 0.065, 0.53, M.color('#4e9c8e', { rough: 0.2 }), x, B0, z);
    for (let i = 0; i < 5; i++) b.cyl(0.015, 0.015, 0.12, M.color('#5f8f3e'), x - 0.25 + i * 0.12, B0, z + 0.2, 4);
  }
  b.box(0.6, 0.35, 0.55, { side: M.facade('modern', '#e1efe4'), top: M.roof('field') }, 0.45, B0, 0.45);
  tree(b, 0.85, -0.85, 0.9, 0, 3);
}

function dump(b) {
  lot(b, 2, 2, 'sand', '#b9ab88');
  const cols = ['#7b6b55', '#5f6b52', '#8b7f6e', '#6b5f4f', '#7d7466'];
  for (let i = 0; i < 7; i++) {
    const x = -0.6 + (i % 4) * 0.38, z = -0.55 + Math.floor(i / 4) * 0.55;
    b.sphere(0.24, M.color(cols[i % 5], { flat: true }), x, B0, z, 1.1, 0.55, 1, 1);
  }
  for (let i = 0; i < 6; i++) b.box(0.05, 0.05, 0.05, M.color(PAL.accent[i]), -0.6 + i * 0.25, B0 + 0.08, -0.2 + (i % 2) * 0.3);
  b.box(0.2, 0.08, 0.12, M.color('#f2b632'), 0.55, B0, 0.6);
  b.box(0.08, 0.06, 0.1, M.color('#2b2b2b'), 0.66, B0 + 0.08, 0.6);
  const fence = M.color('#8b9399', { metal: 0.4 });
  b.box(1.9, 0.1, 0.01, fence, 0, B0, 0.94);
  b.box(1.9, 0.1, 0.01, fence, 0, B0, -0.94);
  b.box(0.01, 0.1, 1.9, fence, -0.94, B0, 0);
  b.box(0.01, 0.1, 1.9, fence, 0.94, B0, 0);
}

function incinerator(b) {
  lot(b, 2, 2, 'concrete');
  b.box(1.2, 0.65, 0.9, { side: M.facade('panel', '#c8cdd2'), top: M.roof('metal', '#596574') }, -0.2, B0, 0.1);
  b.box(0.7, 0.25, 0.4, { side: M.facade('modern', '#e46a3c'), top: M.roof('metal') }, -0.4, B0 + 0.65, 0.2);
  b.cyl(0.08, 0.1, 1.6, M.color('#d6d6d2'), 0.65, B0, -0.55, 14);
  b.cyl(0.085, 0.085, 0.08, M.color('#d1462f'), 0.65, B0 + 1.45, -0.55, 14);
  b.smoke.push(new THREE.Vector3(0.65, B0 + 1.65, -0.55));
  for (let i = 0; i < 3; i++) b.box(0.18, 0.12, 0.12, M.color(['#3a7d44', '#2f6db1', '#c2452d'][i]), 0.6, B0, 0.15 + i * 0.22);
}

function recyclingCenter(b) {
  lot(b, 2, 2, 'concrete');
  b.box(1.3, 0.5, 0.8, { side: M.facade('panel', '#d7e6d6'), top: M.roof('solar') }, -0.25, B0, -0.4);
  const cols = ['#2e8b57', '#2f6db1', '#f2c230', '#c2452d', '#7b5ea7'];
  for (let i = 0; i < 5; i++) {
    b.box(0.25, 0.16, 0.18, M.color(cols[i]), -0.75 + i * 0.32, B0, 0.45);
  }
  b.box(0.2, 0.25, 0.4, M.color('#e7e3d8'), 0.75, B0, -0.4);
  tree(b, 0.75, 0.75, 0.8, 0, 2);
}

// ============================================================================ services
function fireSmall(b) {
  lot(b, 1, 1, 'paving');
  const brick = M.facade('brick', '#ffffff');
  b.box(0.7, 0.42, 0.6, { side: brick, top: M.roof('gravel') }, -0.08, B0, -0.12);
  for (const x of [-0.25, 0.08]) b.box(0.24, 0.24, 0.02, M.color('#c62f2f'), x, B0, 0.19);
  b.box(0.16, 0.85, 0.16, { side: brick, top: M.roof('tiles', '#7a3b2a') }, 0.32, B0, -0.28);
  b.hip(0.18, 0.18, 0.14, M.roof('tiles', '#7a3b2a'), 0.32, B0 + 0.85, -0.28);
  b.sign('112', 0.22, 0.08, '#c62f2f', '#ffffff', -0.08, B0 + 0.34, 0.191);
  b.box(0.2, 0.08, 0.1, M.color('#d93030', { rough: 0.4 }), -0.08, B0, 0.36);
}

function fireBig(b) {
  lot(b, 2, 2, 'paving');
  const brick = M.facade('brick', '#ffffff');
  b.box(1.5, 0.5, 0.9, { side: brick, top: M.roof('gravel') }, -0.1, B0, -0.35);
  for (let i = 0; i < 4; i++) b.box(0.28, 0.3, 0.02, M.color('#c62f2f'), -0.7 + i * 0.37, B0, 0.105);
  b.box(0.3, 1.2, 0.3, { side: brick, top: M.roof('gravel') }, 0.75, B0, -0.65);
  b.box(0.36, 0.04, 0.36, M.color('#5b2a22'), 0.75, B0 + 1.2, -0.65);
  b.sign('FEUERWEHR', 0.9, 0.12, '#c62f2f', '#ffffff', -0.1, B0 + 0.42, 0.101);
  for (let i = 0; i < 2; i++) {
    b.box(0.32, 0.11, 0.13, M.color('#d93030', { rough: 0.4 }), -0.5 + i * 0.6, B0, 0.55, Math.PI / 2 * 0);
    b.box(0.3, 0.02, 0.1, M.color('#c8cdd2'), -0.5 + i * 0.6, B0 + 0.11, 0.55);
  }
}

function policeSmall(b) {
  lot(b, 1, 1, 'paving');
  b.box(0.72, 0.45, 0.55, { side: M.facade('modern', '#e8eef5'), top: M.roof('gravel') }, 0, B0, -0.15);
  b.box(0.74, 0.07, 0.57, M.color('#1f4ea8'), 0, B0 + 0.3, -0.15);
  b.sign('POLIZEI', 0.42, 0.08, '#1f4ea8', '#ffffff', 0, B0 + 0.2, 0.131);
  b.cyl(0.006, 0.006, 0.6, M.color('#d0d4d8', { metal: 0.6 }), 0.36, B0, 0.3, 6);
  b.box(0.12, 0.07, 0.005, M.color('#2b6fd6'), 0.42, B0 + 0.5, 0.3);
  car(b, -0.2, 0.33, 0, '#f4f6f8');
  b.box(0.06, 0.015, 0.03, M.glow('#2f6dff'), -0.21, B0 + 0.1, 0.33);
}

function policeBig(b) {
  lot(b, 2, 2, 'paving');
  b.box(1.5, 0.95, 0.85, { side: M.facade('office', '#e9eef4'), top: M.roof('gravel') }, 0, B0, -0.4);
  b.box(1.52, 0.06, 0.87, M.color('#1f4ea8'), 0, B0 + 0.25, -0.4);
  b.cyl(0.3, 0.3, 0.03, M.color('#3b3f44'), 0.3, B0 + 0.95, -0.4, 24);
  b.plane(0.3, 0.3, M.sign('H', '#3b3f44', '#ffffff'), 0.3, B0 + 0.985, -0.4);
  b.sign('POLIZEI', 0.7, 0.12, '#1f4ea8', '#ffffff', 0, B0 + 0.12, 0.031);
  for (let i = 0; i < 3; i++) car(b, -0.6 + i * 0.35, 0.55, Math.PI / 2, i === 1 ? '#1f4ea8' : '#f4f6f8');
}

function clinic(b) {
  lot(b, 1, 1, 'paving');
  b.box(0.75, 0.5, 0.55, { side: M.facade('clinic', '#ffffff'), top: M.roof('gravel') }, 0, B0, -0.15);
  b.box(0.18, 0.06, 0.02, M.color('#e03a3a'), 0, B0 + 0.55, 0.13);
  b.box(0.06, 0.18, 0.02, M.color('#e03a3a'), 0, B0 + 0.49, 0.13);
  b.box(0.4, 0.02, 0.18, M.color('#e8e8e8'), 0, B0 + 0.22, 0.2);
  tree(b, 0.35, 0.35, 0.6, 0, 1);
}

function hospital(b) {
  lot(b, 2, 2, 'paving');
  b.box(1.7, 0.5, 1.0, { side: M.facade('clinic', '#ffffff'), top: M.roof('gravel') }, 0, B0, -0.3);
  b.box(0.8, 1.4, 0.8, { side: M.facade('clinic', '#f1f6fa'), top: M.roof('gravel') }, -0.35, B0 + 0.5, -0.4);
  b.cyl(0.3, 0.3, 0.03, M.color('#3b3f44'), 0.45, B0 + 0.5, -0.35, 24);
  b.plane(0.3, 0.3, M.sign('H', '#3b3f44', '#ffffff'), 0.45, B0 + 0.535, -0.35);
  b.box(0.3, 0.1, 0.02, M.color('#e03a3a'), -0.35, B0 + 1.65, 0.01);
  b.box(0.1, 0.3, 0.02, M.color('#e03a3a'), -0.35, B0 + 1.55, 0.01);
  b.box(0.7, 0.03, 0.3, M.color('#e8e8e8'), 0.3, B0 + 0.25, 0.35);
  b.box(0.2, 0.1, 0.1, M.color('#f5f5f5'), 0.55, B0, 0.6);
  b.box(0.2, 0.02, 0.1, M.color('#e03a3a'), 0.55, B0 + 0.06, 0.6);
  tree(b, -0.75, 0.7, 0.7, 0, 2);
  tree(b, -0.35, 0.75, 0.65, 0, 3);
}

// ============================================================================ industry
function sawtoothHall(b, w, d, x, z, wall, h = 0.4) {
  b.box(w, h, d, { side: M.facade('panel', wall), top: M.roof('metal', '#8b9298') }, x, B0, z);
  const n = Math.max(2, Math.round(w / 0.32));
  const tw = w / n;
  for (let i = 0; i < n; i++) {
    const tx = x - w / 2 + tw * (i + 0.5);
    const g = new THREE.BufferGeometry();
    const hh = 0.14;
    const p = [
      -tw / 2, 0, -d / 2, tw / 2, 0, -d / 2, -tw / 2, hh, -d / 2,
      -tw / 2, 0, d / 2, -tw / 2, hh, d / 2, tw / 2, 0, d / 2,
      -tw / 2, 0, -d / 2, -tw / 2, hh, -d / 2, -tw / 2, hh, d / 2, -tw / 2, 0, -d / 2, -tw / 2, hh, d / 2, -tw / 2, 0, d / 2,
      tw / 2, 0, -d / 2, tw / 2, 0, d / 2, -tw / 2, hh, d / 2, tw / 2, 0, -d / 2, -tw / 2, hh, d / 2, -tw / 2, hh, -d / 2,
    ];
    for (let t = 0; t < p.length; t += 9) for (let k = 0; k < 3; k++) { const a = p[t + 3 + k]; p[t + 3 + k] = p[t + 6 + k]; p[t + 6 + k] = a; }
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    b.push(g, M.roof('metal', '#a7aeb5'), tx, B0 + h, z);
    b.box(0.01, hh * 0.8, d - 0.04, M.color('#89b4d4', { rough: 0.2, metal: 0.3 }), tx - tw / 2 + 0.006, B0 + h, z);
  }
}

function factory(b, v) {
  lot(b, 2, 2, 'concrete');
  sawtoothHall(b, 1.3, 1.0, -0.3, -0.35, ['#d9d4c9', '#c8d3dc', '#d7cfc0'][v % 3]);
  b.cyl(0.07, 0.09, 1.25, M.color('#b8b2a9'), 0.65, B0, -0.65, 12);
  b.cyl(0.075, 0.075, 0.07, M.color('#c0392b'), 0.65, B0 + 1.05, -0.65, 12);
  b.smoke.push(new THREE.Vector3(0.65, B0 + 1.3, -0.65));
  for (const z of [-0.2, 0.15]) {
    b.cyl(0.14, 0.14, 0.55, M.color('#d9dde1', { metal: 0.35, rough: 0.4 }), 0.65, B0, z, 16);
    b.cone(0.14, 0.08, M.color('#c3c9cf', { metal: 0.35 }), 0.65, B0 + 0.55, z, 16);
  }
  const cont = ['#c2452d', '#2f6db1', '#3a8d5c', '#d9a531'];
  for (let i = 0; i < 3; i++) b.box(0.32, 0.1, 0.12, M.color(cont[(i + v) % 4], { metal: 0.3, rough: 0.5 }), -0.55 + i * 0.36, B0 + (i === 1 ? 0.1 : 0), 0.65);
  b.box(0.32, 0.1, 0.12, M.color(cont[(v + 3) % 4], { metal: 0.3, rough: 0.5 }), -0.37, B0, 0.65);
  b.box(0.3, 0.12, 0.12, M.color('#e8e8e8'), 0.45, B0, 0.6);
  b.box(0.1, 0.09, 0.11, M.color('#2f6db1'), 0.65, B0, 0.6);
  b.box(0.5, 0.27, 0.02, M.color('#6a737c'), -0.3, B0, 0.155);
}

function bigFactory(b, v) {
  lot(b, 3, 2, 'concrete');
  sawtoothHall(b, 1.8, 1.1, -0.45, -0.3, '#d5d0c5', 0.5);
  b.box(0.7, 0.8, 0.6, { side: M.facade('panel', '#c3ccd4'), top: M.roof('metal') }, 0.95, B0, -0.5);
  for (const x of [0.75, 1.15]) {
    b.cyl(0.07, 0.09, 1.6, M.color('#b8b2a9'), x, B0 + 0.0, -0.2 + (x > 1 ? -0.55 : 0.0) + 0.35, 12);
  }
  b.smoke.push(new THREE.Vector3(0.75, B0 + 1.65, 0.15));
  b.smoke.push(new THREE.Vector3(1.15, B0 + 1.65, -0.4));
  for (let i = 0; i < 3; i++) b.sphere(0.16, M.color('#e3e6ea', { metal: 0.3 }), -1.1 + i * 0.4, B0 + 0.2, 0.6, 1, 1, 1, 2);
  b.box(0.4, 0.12, 0.13, M.color('#2f6db1'), 0.6, B0, 0.6);
  b.box(0.4, 0.12, 0.13, M.color('#c2452d'), 1.05, B0, 0.6);
}

function ecoFactory(b) {
  lot(b, 2, 2, 'grass');
  b.box(1.4, 0.45, 1.0, { side: M.facade('modern', '#e3efe2'), top: M.roof('field') }, -0.2, B0, -0.3);
  for (let i = 0; i < 3; i++) b.push(new THREE.BoxGeometry(0.4, 0.02, 0.25), M.roof('solar'), -0.6 + i * 0.42, B0 + 0.52, -0.3, 0, -0.4);
  b.box(0.12, 0.6, 0.12, M.color('#7fb069'), 0.7, B0, -0.6);
  b.box(0.12, 0.012, 0.12, M.color('#5e8f4e'), 0.7, B0 + 0.6, -0.6);
  tree(b, 0.7, 0.65, 0.9, 0, 4);
  tree(b, 0.35, 0.75, 0.7, 2, 5);
  b.box(0.3, 0.12, 0.12, M.color('#3a8d5c'), -0.4, B0, 0.6);
}

// ============================================================================ shops
function shopBase(b, v, wall, sign, signBg, awning) {
  lot(b, 2, 2, 'asphalt');
  b.box(1.5, 0.5, 0.95, { side: M.facade('shop', wall), top: M.roof('gravel') }, 0, B0, -0.45);
  parapet(b, 1.5, 0.95, B0 + 0.5, M.color('#d7d2c8'), 0.05, 0.03, 0, -0.45);
  b.box(1.3, 0.02, 0.15, M.color(awning), 0, B0 + 0.22, 0.1);
  b.sign(sign, 1.0, 0.14, signBg, '#ffffff', 0, B0 + 0.62, 0.0);
  b.box(0.04, 0.12, 0.04, M.color('#3b3f45'), -0.4, B0 + 0.5, -0.02);
  b.box(0.04, 0.12, 0.04, M.color('#3b3f45'), 0.4, B0 + 0.5, -0.02);
  rooftopUnits(b, 1.0, 0.6, B0 + 0.5, v, 0, -0.55);
  for (let i = 0; i < 3; i++) car(b, -0.55 + i * 0.55, 0.55, Math.PI / 2, PAL.cars[(i * 3 + v) % PAL.cars.length]);
}

function bausupply(b, v) {
  lot(b, 2, 2, 'asphalt');
  b.box(1.6, 0.55, 1.0, { side: M.facade('panel', '#f2a65a'), top: M.roof('metal', '#8f969d') }, -0.1, B0, -0.45);
  b.sign('BAUMARKT', 1.0, 0.16, '#e8731a', '#ffffff', -0.1, B0 + 0.4, 0.052);
  b.box(0.5, 0.3, 0.02, M.color('#5e656d'), -0.4, B0, 0.051);
  const wood = M.color('#c9955c');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2 + (i % 2); j++) b.box(0.3, 0.04, 0.12, wood, 0.55, B0 + j * 0.045, 0.3 + i * 0.18);
  b.box(0.16, 0.12, 0.16, M.color('#d9c3a0'), 0.85, B0, 0.75);
  car(b, -0.3, 0.6, Math.PI / 2, PAL.cars[v % 9]);
  car(b, 0.1, 0.6, Math.PI / 2, PAL.cars[(v + 4) % 9]);
}

function hardware(b, v) {
  lot(b, 2, 2, 'paving');
  const brick = M.facade('brick', '#ffffff');
  b.box(1.3, 2 * F, 0.85, { side: brick, top: M.roof('gravel') }, 0, B0, -0.4);
  b.gable(1.3, 0.85, 0.28, M.roof('tiles', '#5c4a3e'), brick, 0, B0 + 2 * F, -0.4);
  b.box(1.1, 0.015, 0.16, M.color('#2f8f5b'), 0, B0 + 0.2, 0.1);
  for (let i = 0; i < 6; i++) b.box(0.18, 0.015, 0.16, M.color(i % 2 ? '#2f8f5b' : '#f4f1e8'), -0.45 + i * 0.18, B0 + 0.205, 0.1);
  b.sign('WERKZEUG', 0.7, 0.11, '#2f8f5b', '#ffffff', 0, B0 + 0.32, 0.031);
  b.box(0.2, 0.08, 0.1, M.color('#e05a2a'), -0.6, B0, 0.35);
  b.box(0.14, 0.14, 0.14, M.color('#c9955c'), 0.6, B0, 0.35);
  car(b, -0.4, 0.75, 0, PAL.cars[v % 9]);
  car(b, 0.3, 0.75, 0, PAL.cars[(v + 2) % 9]);
}

function farmers(b, v) {
  lot(b, 2, 2, 'paving');
  const red = M.color('#a8382c');
  b.box(0.9, 0.38, 0.7, red, -0.45, B0, -0.5);
  b.gable(0.9, 0.7, 0.3, M.roof('metal', '#5f6266'), red, -0.45, B0 + 0.38, -0.5, Math.PI / 2 * 0);
  b.box(0.3, 0.26, 0.02, M.color('#f1ece2'), -0.45, B0, -0.14);
  b.box(0.02, 0.26, 0.3, M.color('#f1ece2'), -0.45, B0, -0.14);
  b.sign('BAUERNMARKT', 0.8, 0.11, '#4f7d2f', '#ffffff', -0.45, B0 + 0.5, -0.13);
  const stripes = ['#e94b3c', '#f2c230', '#3cae7e'];
  for (let i = 0; i < 3; i++) {
    const x = -0.6 + i * 0.6, z = 0.45;
    for (const [dx, dz] of [[-0.2, -0.12], [0.2, -0.12], [-0.2, 0.12], [0.2, 0.12]]) b.box(0.015, 0.2, 0.015, M.color('#7a5a3a'), x + dx, B0, z + dz);
    b.gable(0.46, 0.32, 0.08, M.roof('metal', stripes[i]), M.color(stripes[i]), x, B0 + 0.2, z);
    b.box(0.4, 0.06, 0.24, M.color('#a57a4f'), x, B0 + 0.04, z);
    const produce = [['#e8532a', '#f2c230', '#4f9a3a'], ['#c7302b', '#7cb342', '#f08c2a'], ['#6a3fa0', '#e8532a', '#a2c94f']][i];
    for (let k = 0; k < 3; k++) b.box(0.11, 0.025, 0.18, M.color(produce[k], { flat: true }), x - 0.13 + k * 0.13, B0 + 0.1, z);
  }
  b.box(0.12, 0.12, 0.12, M.color('#e3c26b'), 0.6, B0, -0.5);
  b.box(0.12, 0.12, 0.12, M.color('#e3c26b'), 0.75, B0, -0.4);
  tree(b, 0.65, -0.75, 1.0, 0, v);
}

function furniture(b, v) {
  lot(b, 2, 2, 'asphalt');
  b.box(1.7, 0.6, 1.0, { side: M.facade('modern', '#d9eef0'), top: M.roof('gravel') }, 0, B0, -0.45);
  b.box(1.72, 0.12, 1.02, M.color('#1d7f86'), 0, B0 + 0.48, -0.45);
  b.sign('MÖBEL', 0.6, 0.12, '#1d7f86', '#ffffff', 0.4, B0 + 0.48, 0.081);
  b.box(0.6, 0.3, 0.02, M.color('#7ea4c2', { rough: 0.15, metal: 0.3 }), -0.35, B0, 0.051);
  for (let i = 0; i < 3; i++) car(b, -0.55 + i * 0.55, 0.6, Math.PI / 2, PAL.cars[(i * 2 + v) % 9]);
  b.box(0.3, 0.1, 0.12, M.color('#f2f2f2'), 0.75, B0, 0.6);
}

function garden(b, v) {
  lot(b, 2, 2, 'paving');
  const glass = M.glass();
  b.box(1.1, 0.32, 0.8, glass, -0.35, B0, -0.45);
  b.gable(1.1, 0.8, 0.2, glass, glass, -0.35, B0 + 0.32, -0.45, 0, 0.0);
  const frame = M.color('#ffffff', { metal: 0.3 });
  for (let i = 0; i <= 4; i++) b.box(0.015, 0.32, 0.8, frame, -0.9 + i * 0.275, B0, -0.45);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.sphere(0.06, M.color(['#4d8f3a', '#e46aa4', '#f2c230', '#3f7f35'][(i + j) % 4], { flat: true }), -0.75 + i * 0.27, B0 + 0.06, -0.65 + j * 0.2, 1, 0.8, 1, 0);
  b.box(0.5, 0.3, 0.6, { side: M.facade('shop', '#e3f2d8'), top: M.roof('gravel') }, 0.6, B0, -0.5);
  b.sign('GARTEN', 0.45, 0.1, '#4c9a3a', '#ffffff', 0.6, B0 + 0.37, -0.19);
  for (let i = 0; i < 6; i++) {
    b.cyl(0.04, 0.03, 0.05, M.color('#b6623e'), -0.75 + i * 0.3, B0, 0.3, 8);
    tree(b, -0.75 + i * 0.3, 0.3, 0.45, i % 3, i + v);
  }
  car(b, 0.4, 0.75, 0, PAL.cars[v % 9]);
}

function bakery(b, v) {
  lot(b, 2, 2, 'paving');
  const fw = M.facade('timber', '#ffffff');
  b.box(1.1, 2 * F, 0.8, fw, -0.25, B0, -0.45);
  b.gable(1.1, 0.8, 0.38, M.roof('tiles', '#9c4b36'), fw, -0.25, B0 + 2 * F, -0.45);
  b.box(0.9, 0.015, 0.14, M.color('#c9862f'), -0.25, B0 + 0.2, 0.02);
  b.sign('BÄCKEREI', 0.6, 0.1, '#8a4e22', '#ffe9c2', -0.25, B0 + 0.33, -0.045);
  b.box(0.08, 0.28, 0.08, M.color('#8d5141'), -0.6, B0 + 0.65, -0.55);
  b.smoke.push(new THREE.Vector3(-0.6, B0 + 0.95, -0.55));
  for (let i = 0; i < 3; i++) {
    const x = -0.6 + i * 0.4, z = 0.5;
    b.cyl(0.08, 0.08, 0.01, M.color('#f4f4f4'), x, B0 + 0.08, z, 12);
    b.cyl(0.01, 0.01, 0.08, M.color('#666'), x, B0, z, 4);
    b.cyl(0.004, 0.004, 0.22, M.color('#666'), x, B0 + 0.08, z, 4);
    b.cone(0.16, 0.06, M.color(i % 2 ? '#e94b3c' : '#f4f1e8'), x, B0 + 0.28, z, 8);
  }
  b.box(0.45, 0.25, 0.4, { side: M.facade('plaster', '#f2e3c9'), top: M.roof('gravel') }, 0.65, B0, -0.55);
  tree(b, 0.7, 0.6, 0.8, 0, v);
}

function fashion(b, v) {
  lot(b, 2, 2, 'paving');
  b.box(1.6, 3 * F, 1.0, { side: M.facade('plaster', '#f3ece4'), top: M.roof('gravel') }, 0, B0, -0.4);
  b.box(1.4, F * 2, 0.02, M.color('#7ea4c2', { rough: 0.1, metal: 0.4 }), 0, B0, 0.105);
  b.box(1.62, 0.04, 1.02, M.color('#2b2b2b'), 0, B0 + 2 * F, -0.4);
  b.hip(1.6, 1.0, 0.25, M.roof('tiles', '#3f454c'), 0, B0 + 3 * F, -0.4);
  b.sign('MODEHAUS', 0.8, 0.12, '#1d1d1f', '#f2d18b', 0, B0 + 2 * F + 0.08, 0.115);
  for (let i = 0; i < 4; i++) b.box(0.05, 0.12, 0.05, M.color('#e8e1d6'), -0.45 + i * 0.3, B0, 0.07);
  tree(b, -0.7, 0.65, 0.7, 2, v);
  tree(b, 0.7, 0.65, 0.7, 2, v);
  bench(b, 0, 0.7);
}

function electro(b, v) {
  lot(b, 2, 2, 'asphalt');
  b.box(1.7, 0.55, 1.0, { side: M.facade('glassdark', '#ffffff'), top: M.roof('gravel') }, 0, B0, -0.45);
  b.box(1.72, 0.06, 1.02, M.glow('#2fb7ff'), 0, B0 + 0.45, -0.45);
  b.sign('ELEKTRO', 0.7, 0.13, '#0e2a47', '#2fd0ff', 0, B0 + 0.62, -0.1);
  b.box(0.04, 0.14, 0.04, M.color('#333'), -0.3, B0 + 0.55, -0.12);
  b.box(0.04, 0.14, 0.04, M.color('#333'), 0.3, B0 + 0.55, -0.12);
  for (let i = 0; i < 3; i++) car(b, -0.55 + i * 0.55, 0.6, Math.PI / 2, PAL.cars[(i + v * 2) % 9]);
}

function marketHall(b, v) {
  lot(b, 3, 2, 'paving');
  const col = M.color('#efe9de');
  for (let i = 0; i < 5; i++) for (const z of [-0.75, -0.05]) b.cyl(0.03, 0.03, 0.4, col, -1.0 + i * 0.5, B0, z, 8);
  b.box(2.2, 0.04, 0.8, M.color('#efe9de'), 0, B0 + 0.4, -0.4);
  b.gable(2.2, 0.8, 0.22, M.roof('tiles', '#3b6f8f'), col, 0, B0 + 0.44, -0.4);
  const stripes = ['#e94b3c', '#2f8fd8', '#f2c230', '#3cae7e', '#e46aa4'];
  for (let i = 0; i < 4; i++) {
    b.box(0.32, 0.08, 0.2, M.color('#a57a4f'), -0.75 + i * 0.5, B0, -0.4);
    for (let k = 0; k < 3; k++) b.box(0.08, 0.02, 0.15, M.color(stripes[(i + k) % 5], { flat: true }), -0.85 + i * 0.5 + k * 0.1, B0 + 0.08, -0.4);
  }
  for (let i = 0; i < 4; i++) {
    const x = -1.05 + i * 0.7, z = 0.55;
    b.box(0.35, 0.08, 0.22, M.color('#a57a4f'), x, B0, z);
    b.box(0.015, 0.22, 0.015, M.color('#7a5a3a'), x - 0.16, B0, z + 0.1);
    b.box(0.015, 0.22, 0.015, M.color('#7a5a3a'), x + 0.16, B0, z + 0.1);
    b.gable(0.42, 0.3, 0.08, M.roof('metal', stripes[i]), M.color(stripes[i]), x, B0 + 0.22, z);
  }
  b.sign('MARKTPLATZ', 0.9, 0.13, '#3b6f8f', '#ffffff', 0, B0 + 0.73, -0.25);
  tree(b, 1.3, 0.75, 0.8, 0, v);
  tree(b, -1.3, -0.8, 0.8, 0, v + 1);
}

function cargoStation(b, v) {
  lot(b, 4, 2, 'concrete');
  const rail = M.color('#6b6f75', { metal: 0.6, rough: 0.4 });
  const sleeper = M.color('#6a5442');
  for (const z of [-0.45, 0.15]) {
    for (let i = 0; i < 38; i++) b.box(0.03, 0.012, 0.2, sleeper, -1.9 + i * 0.1, B0, z);
    b.box(3.9, 0.015, 0.012, rail, 0, B0 + 0.012, z - 0.06);
    b.box(3.9, 0.015, 0.012, rail, 0, B0 + 0.012, z + 0.06);
  }
  b.box(3.4, 0.07, 0.3, M.color('#c9c4b9'), 0, B0, 0.6);
  b.box(1.2, 0.4, 0.3, { side: M.facade('brick', '#ffffff'), top: M.roof('gravel') }, -1.2, B0 + 0.07, 0.62);
  b.gable(1.2, 0.3, 0.12, M.roof('tiles', '#5d6670'), M.facade('brick', '#ffffff'), -1.2, B0 + 0.47, 0.62);
  b.sign('GÜTERBAHNHOF', 0.9, 0.11, '#344150', '#ffffff', -1.2, B0 + 0.33, 0.775);
  // locomotive + wagons
  const loco = M.color('#c6372d', { rough: 0.4, metal: 0.3 });
  b.box(0.42, 0.16, 0.13, loco, 1.45, B0 + 0.03, -0.45);
  b.box(0.12, 0.08, 0.12, M.color('#2a3846'), 1.55, B0 + 0.19, -0.45);
  const cc = ['#2f6db1', '#3a8d5c', '#d9a531', '#c2452d', '#7b5ea7'];
  for (let i = 0; i < 5; i++) b.box(0.48, 0.15, 0.13, M.color(cc[(i + v) % 5], { metal: 0.3, rough: 0.5 }), 0.95 - i * 0.52, B0 + 0.04, -0.45);
  // gantry crane
  const y = M.color('#f2b632', { metal: 0.3 });
  for (const x of [0.4, 1.1]) { b.box(0.04, 0.7, 0.04, y, x, B0, -0.75); b.box(0.04, 0.7, 0.04, y, x, B0, 0.38); b.box(0.04, 0.04, 1.17, y, x, B0 + 0.7, -0.19); }
  b.box(0.74, 0.05, 0.05, y, 0.75, B0 + 0.68, -0.15);
  for (let i = 0; i < 4; i++) b.box(0.3, 0.12, 0.12, M.color(cc[(i + 2) % 5], { metal: 0.3, rough: 0.5 }), 0.4 + (i % 2) * 0.34, B0 + 0.07 + Math.floor(i / 2) * 0.12, 0.7);
}

// ============================================================================ leisure
function park(b, v) {
  lot(b, 1, 1, 'grass', '#d8f0c0');
  b.box(0.95, 0.008, 0.12, M.ground('paving'), 0, B0, 0);
  b.box(0.12, 0.008, 0.95, M.ground('paving'), 0, B0, 0);
  b.cyl(0.12, 0.12, 0.012, M.ground('paving'), 0, B0, 0, 16);
  b.cyl(0.07, 0.07, 0.03, M.color('#e46aa4', { flat: true }), 0, B0, 0, 10);
  tree(b, -0.28, -0.28, 0.9, v % 3, v);
  tree(b, 0.3, 0.28, 0.85, 0, v + 1);
  tree(b, 0.3, -0.3, 0.7, 1, v + 2);
  tree(b, -0.3, 0.3, 0.75, 0, v + 3);
  bench(b, 0.15, 0.09);
  bench(b, -0.15, -0.09);
  lampPost(b, 0.1, -0.12);
}

function playground(b, v) {
  lot(b, 1, 1, 'grass');
  b.box(0.6, 0.01, 0.6, M.ground('sand'), 0, B0, 0);
  b.box(0.08, 0.16, 0.08, M.color('#e94b3c'), -0.15, B0, -0.12);
  b.push(new THREE.BoxGeometry(0.06, 0.008, 0.25), M.color('#f2c230'), -0.15, B0 + 0.09, 0.0, 0, 0.6);
  const s = M.color('#2f8fd8');
  b.box(0.01, 0.18, 0.01, s, 0.1, B0, 0.15); b.box(0.01, 0.18, 0.01, s, 0.3, B0, 0.15);
  b.box(0.21, 0.01, 0.01, s, 0.2, B0 + 0.18, 0.15);
  b.box(0.04, 0.008, 0.03, M.color('#333'), 0.16, B0 + 0.06, 0.15);
  b.box(0.04, 0.008, 0.03, M.color('#333'), 0.25, B0 + 0.06, 0.15);
  b.cyl(0.08, 0.08, 0.02, M.color('#3cae7e'), 0.18, B0, -0.18, 12);
  tree(b, -0.38, 0.38, 0.8, 0, v);
  tree(b, 0.38, -0.4, 0.7, 2, v);
  bench(b, -0.3, 0.1, Math.PI / 2);
}

function plaza(b, v) {
  lot(b, 2, 2, 'paving');
  b.cyl(0.45, 0.45, 0.07, M.color('#d8d2c6'), 0, B0, 0, 32);
  b.cyl(0.4, 0.4, 0.072, M.water(), 0, B0, 0, 32);
  b.cyl(0.08, 0.1, 0.22, M.color('#d8d2c6'), 0, B0, 0, 12);
  b.cyl(0.16, 0.16, 0.03, M.color('#d8d2c6'), 0, B0 + 0.22, 0, 16);
  b.sphere(0.05, M.color('#cfe9f7', { opacity: 0.6, rough: 0.1 }), 0, B0 + 0.3, 0, 1, 1.6, 1, 1);
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) { tree(b, x, z, 1.0, 0, v + x * 10); b.cyl(0.13, 0.13, 0.03, M.color('#cfc8bb'), x, B0, z, 12); }
  for (const a of [0, 1, 2, 3]) bench(b, Math.cos(a * Math.PI / 2) * 0.62, Math.sin(a * Math.PI / 2) * 0.62, a * Math.PI / 2 + Math.PI / 2);
  for (const [x, z] of [[-0.4, 0.75], [0.4, -0.75]]) lampPost(b, x, z);
}

function cityPark(b, v) {
  lot(b, 3, 3, 'grass', '#d9f0c4');
  b.cyl(0.65, 0.6, 0.02, M.color('#8f8c6a'), 0.35, B0, 0.3, 28);
  b.cyl(0.6, 0.6, 0.025, M.water(), 0.35, B0, 0.3, 28);
  b.box(2.9, 0.01, 0.1, M.ground('sand'), 0, B0, -0.7);
  b.box(0.1, 0.01, 2.9, M.ground('sand'), -0.6, B0, 0);
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4, r = 1.0 + (i % 3) * 0.15;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(z + 0.7) < 0.15 || Math.abs(x + 0.6) < 0.15) continue;
    tree(b, x, z, 0.9 + (i % 4) * 0.12, i % 3, v + i);
  }
  b.box(0.3, 0.12, 0.25, M.color('#f3ead6'), -1.1, B0, -1.1);
  b.gable(0.3, 0.25, 0.1, M.roof('tiles', '#7a4a3c'), M.color('#f3ead6'), -1.1, B0 + 0.12, -1.1);
  for (let i = 0; i < 4; i++) bench(b, -0.45, -0.3 + i * 0.4, Math.PI / 2);
  b.box(0.12, 0.03, 0.06, M.color('#ffffff'), 0.3, B0 + 0.03, 0.2);
  lampPost(b, -0.5, -0.8);
  lampPost(b, 0.5, -0.6);
}

function school(b, v) {
  lot(b, 2, 2, 'grass');
  const fw = M.facade('plaster', '#f2d9a8');
  b.box(1.6, 2 * F, 0.55, { side: fw, top: M.roof('gravel') }, 0, B0, -0.6);
  b.box(0.55, 2 * F, 0.8, { side: fw, top: M.roof('gravel') }, -0.55, B0, 0.05);
  b.hip(1.65, 0.6, 0.18, M.roof('tiles', '#a44a3a'), 0, B0 + 2 * F, -0.6);
  b.sign('SCHULE', 0.5, 0.1, '#f08c2a', '#ffffff', 0.35, B0 + 0.37, -0.32);
  b.box(0.9, 0.01, 0.75, M.ground('plain'), 0.4, B0, 0.35);
  b.box(0.06, 0.25, 0.06, M.color('#ffffff'), 0.8, B0, 0.35);
  b.box(0.04, 0.008, 0.6, M.color('#ffffff'), 0.4, B0 + 0.012, 0.35);
  tree(b, -0.8, 0.75, 0.9, 0, v);
}

function library(b, v) {
  lot(b, 2, 2, 'paving');
  const stone = M.color('#e6dfd0');
  b.box(1.4, 0.5, 0.95, { side: M.facade('plaster', '#efe6d4'), top: M.roof('gravel') }, 0, B0 + 0.06, -0.35);
  b.box(1.5, 0.06, 1.1, stone, 0, B0, -0.3);
  for (let i = 0; i < 6; i++) b.cyl(0.04, 0.045, 0.5, stone, -0.5 + i * 0.2, B0 + 0.06, 0.18, 10);
  b.box(1.3, 0.08, 0.2, stone, 0, B0 + 0.56, 0.18);
  b.gable(1.3, 0.25, 0.14, M.color('#cfc6b4'), stone, 0, B0 + 0.64, 0.18, 0, 0);
  b.box(0.8, 0.3, 0.6, { side: M.facade('plaster', '#efe6d4'), top: M.roof('gravel') }, 0, B0 + 0.56, -0.45);
  b.box(1.2, 0.03, 0.4, stone, 0, B0, 0.45);
  tree(b, -0.75, 0.75, 0.8, 1, v);
  tree(b, 0.75, 0.75, 0.8, 1, v);
}

function highschool(b, v) {
  lot(b, 3, 2, 'grass');
  const fw = M.facade('modern', '#efe3cf');
  b.box(1.5, 3 * F, 0.6, { side: fw, top: M.roof('gravel') }, -0.65, B0, -0.55);
  b.box(0.5, 3 * F, 0.7, { side: fw, top: M.roof('gravel') }, -1.15, B0, 0.1);
  b.sign('GYMNASIUM', 0.8, 0.11, '#2f6db1', '#ffffff', -0.65, B0 + 0.6, -0.248);
  // running track
  b.box(1.1, 0.008, 1.4, M.color('#b5533c'), 0.85, B0, 0.05);
  b.box(0.85, 0.01, 1.1, M.roof('field'), 0.85, B0, 0.05);
  b.box(0.85, 0.012, 0.01, M.color('#ffffff'), 0.85, B0, 0.05);
  tree(b, -0.2, 0.7, 0.8, 0, v);
}

function university(b, v) {
  lot(b, 3, 3, 'grass');
  const stone = M.facade('plaster', '#ece3d1');
  b.box(1.6, 0.6, 0.6, { side: stone, top: M.roof('gravel') }, 0, B0, -0.9);
  b.box(0.6, 0.6, 1.4, { side: stone, top: M.roof('gravel') }, -1.0, B0, 0.0);
  b.box(0.6, 0.6, 1.4, { side: stone, top: M.roof('gravel') }, 1.0, B0, 0.0);
  b.cyl(0.32, 0.32, 0.45, M.facade('plaster', '#ece3d1'), 0, B0 + 0.6, -0.9, 24, { facade: true });
  b.hemi(0.32, M.color('#5f8e9e', { metal: 0.4, rough: 0.4 }), 0, B0 + 1.05, -0.9);
  for (let i = 0; i < 6; i++) b.cyl(0.035, 0.035, 0.5, M.color('#efe9de'), -0.5 + i * 0.2, B0, -0.52, 10);
  b.box(1.3, 0.008, 0.12, M.ground('paving'), 0, B0, 0.2);
  b.box(0.12, 0.008, 1.3, M.ground('paving'), 0, B0, 0.6);
  for (const [x, z] of [[-0.5, 0.6], [0.5, 0.6], [-0.5, 1.1], [0.5, 1.1]]) tree(b, x, z, 0.9, 0, v + x * 7 + z);
  b.sign('UNIVERSITÄT', 0.9, 0.11, '#7a2f3a', '#ffffff', 0, B0 + 0.48, -0.595);
}

function cinema(b, v) {
  lot(b, 2, 2, 'paving');
  b.box(1.5, 0.75, 1.1, { side: M.facade('glassdark', '#ffffff'), top: M.roof('gravel') }, 0, B0, -0.4);
  b.box(1.0, 0.25, 0.08, M.glow('#ff3b6b'), 0, B0 + 0.42, 0.19);
  b.sign('KINO', 0.6, 0.2, '#14141a', '#ffd34d', 0, B0 + 0.55, 0.236);
  b.box(1.2, 0.02, 0.3, M.color('#e0b04a'), 0, B0 + 0.3, 0.3);
  for (let i = 0; i < 5; i++) b.sphere(0.012, M.glow('#fff1b0'), -0.5 + i * 0.25, B0 + 0.29, 0.45, 1, 1, 1, 0);
  tree(b, -0.75, 0.75, 0.7, 2, v);
  tree(b, 0.75, 0.75, 0.7, 2, v);
}

function theater(b, v) {
  lot(b, 2, 2, 'paving');
  const stone = M.color('#efe7d7');
  b.box(1.4, 0.65, 1.1, { side: M.facade('plaster', '#f1e7d3'), top: M.roof('gravel') }, 0, B0, -0.4);
  b.cyl(0.38, 0.38, 0.12, stone, 0, B0 + 0.65, -0.45, 24);
  b.hemi(0.38, M.color('#4f8a7c', { metal: 0.5, rough: 0.35 }), 0, B0 + 0.77, -0.45);
  for (let i = 0; i < 6; i++) b.cyl(0.04, 0.045, 0.55, stone, -0.5 + i * 0.2, B0 + 0.05, 0.25, 10);
  b.box(1.35, 0.05, 0.4, stone, 0, B0, 0.25);
  b.box(1.3, 0.08, 0.22, stone, 0, B0 + 0.6, 0.25);
  b.gable(1.3, 0.3, 0.16, M.color('#d9cfbd'), stone, 0, B0 + 0.68, 0.22, 0, 0);
  b.sphere(0.05, M.color('#e0b04a', { metal: 0.8, rough: 0.3 }), 0, B0 + 1.17, -0.45, 1, 1, 1, 1);
  lampPost(b, -0.75, 0.7);
  lampPost(b, 0.75, 0.7);
}

function stadium(b) {
  lot(b, 3, 3, 'paving');
  const pts = [];
  b.cyl(1.35, 1.25, 0.5, M.color('#e3e6ea'), 0, B0, 0, 40, { open: true });
  b.cyl(1.3, 0.85, 0.5, M.color('#c23b3b'), 0, B0, 0, 40, { open: true });
  b.cyl(0.85, 0.85, 0.02, M.roof('field'), 0, B0, 0, 40);
  b.cyl(1.42, 1.42, 0.05, M.color('#f4f4f4'), 0, B0 + 0.55, 0, 40, { open: true });
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    const x = Math.cos(a) * 1.35, z = Math.sin(a) * 1.35;
    b.cyl(0.02, 0.025, 0.9, M.color('#9aa1a8'), x, B0, z, 6);
    b.box(0.16, 0.08, 0.04, M.glow('#fffbe0'), x, B0 + 0.9, z, -a + Math.PI / 2);
  }
  b.box(0.8, 0.008, 0.01, M.color('#ffffff'), 0, B0 + 0.025, 0);
  void pts;
}

function clockTower(b) {
  lot(b, 1, 1, 'paving');
  const stone = M.facade('brick', '#ffffff');
  b.box(0.36, 1.4, 0.36, { side: stone, top: M.roof('gravel') }, 0, B0, 0);
  b.box(0.42, 0.06, 0.42, M.color('#e8e0d0'), 0, B0 + 1.4, 0);
  b.box(0.34, 0.3, 0.34, M.color('#e8e0d0'), 0, B0 + 1.46, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const g = new THREE.CircleGeometry(0.11, 24);
    b.push(g, M.glow('#fff8e6'), Math.sin(a) * 0.172, B0 + 1.61, Math.cos(a) * 0.172, a);
  }
  b.cone(0.28, 0.5, M.color('#4f7f74', { metal: 0.5, rough: 0.4 }), 0, B0 + 1.76, 0, 4, Math.PI / 4);
  b.cyl(0.006, 0.006, 0.16, M.color('#d4af37', { metal: 0.9 }), 0, B0 + 2.26, 0, 6);
}

function tvTower(b) {
  lot(b, 2, 2, 'paving');
  b.cyl(0.08, 0.2, 3.6, M.color('#e7e8ea'), 0, B0, 0, 20);
  b.sphere(0.36, M.facade('glass', '#c9d6e2'), 0, B0 + 3.75, 0, 1, 1, 1, 3);
  b.cyl(0.37, 0.37, 0.05, M.glow('#ff5a5a'), 0, B0 + 3.72, 0, 32);
  b.cyl(0.05, 0.07, 0.6, M.color('#e7e8ea'), 0, B0 + 4.05, 0, 12);
  b.cyl(0.012, 0.02, 0.9, M.color('#d33'), 0, B0 + 4.6, 0, 6);
  b.sphere(0.025, M.glow('#ff2020'), 0, B0 + 5.52, 0, 1, 1, 1, 0);
  b.cyl(0.55, 0.6, 0.12, M.color('#d8d2c6'), 0, B0, 0, 24);
  tree(b, -0.75, 0.75, 0.8, 0, 1);
  tree(b, 0.75, -0.75, 0.8, 0, 2);
}

// ============================================================================ fixed
function cityHall(b) {
  lot(b, 2, 2, 'paving');
  const fw = M.facade('plaster', '#f4ead6');
  const stone = M.color('#ece3d1');
  b.box(1.7, 0.08, 1.2, stone, 0, B0, -0.3);
  b.box(1.6, 3 * F, 1.0, { side: fw, top: M.roof('gravel') }, 0, B0 + 0.08, -0.35);
  b.hip(1.66, 1.06, 0.3, M.roof('tiles', '#4f6a78'), 0, B0 + 0.08 + 3 * F, -0.35);
  for (let i = 0; i < 4; i++) b.cyl(0.04, 0.045, 0.55, stone, -0.3 + i * 0.2, B0 + 0.08, 0.22, 10);
  b.box(0.9, 0.08, 0.2, stone, 0, B0 + 0.63, 0.22);
  b.gable(0.9, 0.24, 0.16, M.color('#d9cfbd'), stone, 0, B0 + 0.71, 0.2, 0, 0);
  b.box(0.36, 0.55, 0.36, { side: fw, top: M.roof('gravel') }, 0, B0 + 0.08 + 3 * F, -0.35);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    b.push(new THREE.CircleGeometry(0.1, 24), M.glow('#fff8e6'), Math.sin(a) * 0.182, B0 + 1.18, -0.35 + Math.cos(a) * 0.182, a);
  }
  b.cone(0.28, 0.35, M.color('#4f6a78', { metal: 0.4, rough: 0.4 }), 0, B0 + 1.38, -0.35, 4, Math.PI / 4);
  b.cyl(0.006, 0.006, 0.45, M.color('#d0d4d8', { metal: 0.6 }), 0.7, B0, 0.6, 6);
  b.box(0.16, 0.1, 0.005, M.color('#2f6db1'), 0.78, B0 + 0.33, 0.6);
  b.box(1.2, 0.012, 0.35, M.ground('paving', '#e8e0d0'), 0, B0, 0.7);
  for (const x of [-0.7, -0.35]) tree(b, x, 0.7, 0.7, 2, 4);
}

function storage(b) {
  lot(b, 2, 2, 'concrete');
  b.box(1.5, 0.5, 1.0, { side: M.facade('panel', '#c9a87c'), top: M.roof('metal', '#7c858d') }, 0, B0, -0.4);
  b.gable(1.5, 1.0, 0.18, M.roof('metal', '#8a5a3c'), M.facade('panel', '#c9a87c'), 0, B0 + 0.5, -0.4);
  b.box(0.5, 0.36, 0.02, M.color('#6f5135'), -0.3, B0, 0.105);
  b.box(0.3, 0.25, 0.02, M.color('#6f5135'), 0.45, B0, 0.105);
  b.sign('LAGER', 0.5, 0.1, '#6f5135', '#ffe9c2', -0.3, B0 + 0.42, 0.115);
  const crate = M.color('#c9955c');
  for (let i = 0; i < 4; i++) b.box(0.14, 0.12, 0.14, crate, -0.7 + i * 0.18, B0, 0.4);
  b.box(0.14, 0.12, 0.14, crate, -0.6, B0 + 0.12, 0.4);
  b.box(0.18, 0.1, 0.1, M.color('#f2b632'), 0.5, B0, 0.5);
  b.box(0.3, 0.12, 0.13, M.color('#2f6db1'), 0.55, B0, 0.78);
}

const MODELS = {
  wind: windTurbine, coal: coalPlant, solar: solarPark, gas: gasPlant, nuclear: nuclearPlant,
  watertower: waterTower, pump: pumpStation, waterworks: waterWorks,
  septic, sewageplant: sewagePlant, ecosewage: ecoSewage,
  dump, incinerator, recycling: recyclingCenter,
  firesmall: fireSmall, firebig: fireBig, policesmall: policeSmall, policebig: policeBig, clinic, hospital,
  factory, bigfactory: bigFactory, ecofactory: ecoFactory,
  bausupply, hardware, farmers, furniture, garden, bakery, fashion, electro, market: marketHall, cargo: cargoStation,
  park, playground, plaza, citypark: cityPark, school, library, highschool, university, cinema, theater, stadium,
  clocktower: clockTower, tvtower: tvTower,
  cityhall: cityHall, storage,
};

const protoCache = new Map();

export function variantsFor(type) {
  return type === 'house' ? 6 : 3;
}

// Returns a fresh instance (shared geometry) of the model for a building.
export function makeModel(type, level = 1, v = 0) {
  const nv = variantsFor(type);
  const vv = ((v % nv) + nv) % nv;
  const key = `${type}:${level}:${vv}`;
  let proto = protoCache.get(key);
  if (!proto) {
    const b = new Builder();
    if (type === 'house') HOUSES[Math.max(1, Math.min(8, level))](b, vv);
    else (MODELS[type] || factory)(b, vv);
    proto = b.build();
    protoCache.set(key, proto);
  }
  const inst = proto.clone(true);
  inst.userData.rotors = [];
  inst.traverse((o) => { if (o.name === 'rotor') inst.userData.rotors.push(o); });
  inst.userData.smoke = proto.userData.smoke;
  return inst;
}

export function footprint(type) {
  return BUILDINGS[type].size;
}
