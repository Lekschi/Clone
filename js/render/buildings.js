// Building art generators. Each returns { fw, fd, H, draw(P), meta } where meta carries
// animation anchors (smoke stacks, beacons, rotor hubs) in tile-local coordinates.
import { shade, mix, rgba, LIGHT } from './art.js';
import { mulberry32, pick } from '../util/rng.js';

const RES_WALL = ['#e8ddc6', '#d8c3a0', '#c8805f', '#a9b89e', '#d4ae6c', '#efe9dd', '#b8c3c9', '#c9a48c', '#e2c6ab', '#9fa9b5'];
const ROOF = ['#a54d37', '#8a3e2d', '#4d5761', '#5c4436', '#6e7a82', '#b4683f', '#3f4a52'];
const COMM_WALL = ['#e6e0d3', '#cdd4d8', '#d8c5aa', '#bcc8c2', '#d9d2c8'];
const GLASS = ['#3f6378', '#3b5a68', '#4a6c84', '#557780', '#36536a'];
const AWN = [['#c4473a', '#f2ede4'], ['#2e6e8e', '#f2ede4'], ['#3d8758', '#f2ede4'], ['#d6a034', '#40403e'], ['#7a4f8a', '#f2ede4']];
const IND_WALL = ['#9aa3a8', '#b2a993', '#a7a39b', '#8f9b94', '#b9b4aa'];
const LAWN = '#8cb060', PAVE = '#c9c3b6', ASPH = '#6b6e72';

function lot(P, w, d, col, inset = 0.03) {
  P.poly([[inset, inset], [w - inset, inset], [w - inset, d - inset], [inset, d - inset]], col);
}
function hedge(P, pts, col = '#5e8a40') {
  for (let k = 0; k < pts.length - 1; k++) {
    const [a, b] = [pts[k], pts[k + 1]];
    const x0 = Math.min(a[0], b[0]) - 0.025, x1 = Math.max(a[0], b[0]) + 0.025;
    const y0 = Math.min(a[1], b[1]) - 0.025, y1 = Math.max(a[1], b[1]) + 0.025;
    P.box(x0, y0, x1, y1, 0, 2.6, col, { edge: false, ao: false });
  }
}
function parkingLines(P, x0, y0, x1, y1, axis, n) {
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    if (axis === 'x') { const x = x0 + (x1 - x0) * t; P.line3([x, y0, 0], [x, y0 + (y1 - y0) * 0.45, 0], 'rgba(255,255,255,0.7)', 0.5); }
    else { const y = y0 + (y1 - y0) * t; P.line3([x0, y, 0], [x0 + (x1 - x0) * 0.45, y, 0], 'rgba(255,255,255,0.7)', 0.5); }
  }
}
const CAR_COLS = ['#c7413a', '#2f5d8a', '#e7e3da', '#3a3d42', '#d9b443', '#6b8e5a', '#8b93a0'];
function parkedCar(P, x, y, axis, rng) { P.car(x, y, axis, pick(rng, CAR_COLS)); }

function roofStuff(P, x0, y0, x1, y1, z, rng, n = 2) {
  for (let k = 0; k < n; k++) {
    const w = 0.08 + rng() * 0.1, d = 0.08 + rng() * 0.08;
    const x = x0 + 0.05 + rng() * Math.max(0.01, (x1 - x0) - w - 0.1), y = y0 + 0.05 + rng() * Math.max(0.01, (y1 - y0) - d - 0.1);
    P.box(x, y, x + w, y + d, z, z + 2 + rng() * 3, '#a6a8a8', { edge: false, ao: false });
  }
}
function parapet(P, x0, y0, x1, y1, z, col, roofCol = '#8d8f8f') {
  P.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], roofCol);
  const t = 0.035;
  P.box(x0, y0, x1, y0 + t, z, z + 1.6, col, { edge: false, ao: false });
  P.box(x0, y0, x0 + t, y1, z, z + 1.6, col, { edge: false, ao: false });
  P.box(x0, y1 - t, x1, y1, z, z + 1.6, col, { edge: false, ao: false });
  P.box(x1 - t, y0, x1, y1, z, z + 1.6, col, { edge: false, ao: false });
}
function frontFace(facing) { return facing === 'R' ? 'R' : 'L'; }

// ======================= RESIDENTIAL =======================
function resTier(tier, rng, facing) {
  const wall = pick(rng, RES_WALL), roof = pick(rng, ROOF), wall2 = pick(rng, RES_WALL);
  const ff = frontFace(facing);
  switch (tier) {
    case 1: return {
      fw: 1, fd: 1, H: 34, draw(P) {
        lot(P, 1, 1, LAWN);
        hedge(P, [[0.06, 0.94], [0.06, 0.06], [0.94, 0.06]]);
        const axis = ff === 'L' ? 'x' : 'y';
        const [x0, y0, x1, y1] = ff === 'L' ? [0.22, 0.2, 0.74, 0.6] : [0.2, 0.22, 0.6, 0.74];
        // path to street
        if (facing === 'L') P.ground(0.42, y1, 0.54, 1, PAVE); else if (facing === 'R') P.ground(x1, 0.42, 1, 0.54, PAVE);
        const bx = P.house(x0, y0, x1, y1, 12, 9, wall, roof, axis);
        P.windows(bx, 'L', { floors: 1, density: 3.5, base: 2, fh: 8, wf: 0.45, sill: true, skip: (f, c) => ff === 'L' && c === 1 });
        P.windows(bx, 'R', { floors: 1, density: 3.5, base: 2, fh: 8, wf: 0.45, sill: true, skip: (f, c) => ff === 'R' && c === 1 });
        if (ff === 'L') P.door('L', y1, 0.43, 0.53, 7.5); else P.door('R', x1, 0.43, 0.53, 7.5);
        // chimney
        P.box(x0 + 0.08, y0 + 0.08, x0 + 0.16, y0 + 0.16, 14, 23, '#8e5a45', { edge: false, ao: false });
        P.tree(0.82, 0.8, 4.6, 4, pick(rng, ['#5e8f3d', '#6a9844', '#4f7f36']));
        if (rng() < 0.5) P.tree(0.2, 0.84, 3.4, 3, '#7a9e47');
      },
    };
    case 2: return {
      fw: 1, fd: 1, H: 40, draw(P) {
        lot(P, 1, 1, LAWN);
        hedge(P, [[0.06, 0.94], [0.06, 0.06], [0.94, 0.06]], '#57833c');
        if (ff === 'L') { P.ground(0.66, 0.6, 0.86, 1, PAVE); } else { P.ground(0.6, 0.66, 1, 0.86, PAVE); }
        const main = ff === 'L' ? [0.14, 0.16, 0.62, 0.62] : [0.16, 0.14, 0.62, 0.62];
        const bx = P.house(main[0], main[1], main[2], main[3], 18, 10, wall, roof, ff === 'L' ? 'x' : 'y');
        P.windows(bx, 'L', { floors: 2, density: 4, base: 1, wf: 0.5, sill: true });
        P.windows(bx, 'R', { floors: 2, density: 4, base: 1, wf: 0.5, sill: true });
        // garage wing
        const g = ff === 'L' ? [0.64, 0.24, 0.9, 0.58] : [0.24, 0.64, 0.58, 0.9];
        P.shadow(g[0], g[1], g[2], g[3], 9);
        const gb = P.box(g[0], g[1], g[2], g[3], 0, 9, wall2);
        P.poly([[g[0], g[1], 9], [g[2], g[1], 9], [g[2], g[3], 9], [g[0], g[3], 9]], shade(roof, 0.9));
        if (ff === 'L') P.door('L', g[3], g[0] + 0.04, g[2] - 0.04, 6.5, '#d7d2c6'); else P.door('R', g[2], g[1] + 0.04, g[3] - 0.04, 6.5, '#d7d2c6');
        void gb;
        if (rng() < 0.6) parkedCar(P, ff === 'L' ? 0.76 : 0.8, ff === 'L' ? 0.8 : 0.76, ff === 'L' ? 'y' : 'x', rng);
        P.tree(0.16, 0.82, 4.4, 4, '#5e8f3d');
      },
    };
    case 3: return {
      fw: 1, fd: 1, H: 50, draw(P) {
        lot(P, 1, 1, LAWN);
        const cols = [wall, wall2, pick(rng, RES_WALL)];
        if (ff === 'L') {
          P.ground(0, 0.66, 1, 1, PAVE);
          for (let k = 0; k < 3; k++) {
            const x0 = 0.08 + k * 0.28, x1 = x0 + 0.28;
            const bx = P.house(x0, 0.22, x1, 0.68, 24, 9, cols[k], roof, 'x');
            P.windows(bx, 'L', { floors: 2, cols: 2, base: 1, wf: 0.5, sill: true, skip: (f, c) => f === 0 && c === 0 });
            P.door('L', 0.68, x0 + 0.05, x0 + 0.12, 8);
            if (k === 2) P.windows(bx, 'R', { floors: 2, cols: 2, base: 1, wf: 0.45 });
          }
        } else {
          P.ground(0.66, 0, 1, 1, PAVE);
          for (let k = 0; k < 3; k++) {
            const y0 = 0.08 + k * 0.28, y1 = y0 + 0.28;
            const bx = P.house(0.22, y0, 0.68, y1, 24, 9, cols[k], roof, 'y');
            P.windows(bx, 'R', { floors: 2, cols: 2, base: 1, wf: 0.5, sill: true, skip: (f, c) => f === 0 && c === 0 });
            P.door('R', 0.68, y0 + 0.05, y0 + 0.12, 8);
            if (k === 2) P.windows(bx, 'L', { floors: 2, cols: 2, base: 1, wf: 0.45 });
          }
        }
      },
    };
    case 4: {
      const floors = 4 + Math.floor(rng() * 3), h = floors * 9 + 3;
      return {
        fw: 1, fd: 1, H: h + 16, draw(P) {
          lot(P, 1, 1, PAVE);
          P.ground(0.05, 0.05, 0.3, 0.3, LAWN);
          P.shadow(0.16, 0.16, 0.86, 0.8, h);
          const bx = P.box(0.16, 0.16, 0.86, 0.8, 0, h, wall);
          // balconies: slabs on left face
          for (let f = 1; f < floors; f++) {
            const z = 3 + f * 9;
            for (let cI = 0; cI < 3; cI++) {
              const u0 = 0.2 + cI * 0.22;
              P.box(u0, 0.8, u0 + 0.14, 0.86, z - 0.6, z, shade(wall, 1.05), { edge: false, ao: false });
              P.line3([u0, 0.86, z + 2.4], [u0 + 0.14, 0.86, z + 2.4], 'rgba(60,60,60,0.6)', 0.5);
            }
          }
          P.windows(bx, 'L', { floors, density: 5, base: 3, wf: 0.5, hf: 0.6, sill: true });
          P.windows(bx, 'R', { floors, density: 5, base: 3, wf: 0.5, hf: 0.6 });
          P.box(0.16, 0.16, 0.86, 0.8, 0, 3, shade(wall, 0.8), { noTop: true, edge: false, ao: false });
          parapet(P, 0.16, 0.16, 0.86, 0.8, h, shade(wall, 1.02), '#8f8d88');
          roofStuff(P, 0.2, 0.2, 0.8, 0.74, h, rng, 2);
          P.tree(0.16, 0.92, 3.8, 4, '#5e8f3d'); P.tree(0.92, 0.16, 3.8, 4, '#4f7f36');
        },
      };
    }
    case 5: {
      const floors = 10 + Math.floor(rng() * 5), h = floors * 8 + 8;
      const style = rng() < 0.5;
      return {
        fw: 1, fd: 1, H: h + 20, meta: { beacon: [[0.5, 0.5, h + 9]] }, draw(P) {
          lot(P, 1, 1, PAVE);
          P.shadow(0.08, 0.08, 0.92, 0.92, 8);
          P.box(0.08, 0.08, 0.92, 0.92, 0, 8, shade(wall, 0.85));
          P.windows({ x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.92, z0: 0, z1: 8 }, 'L', { floors: 1, density: 3, wf: 0.75, hf: 0.7, glass: '#2f3e48' });
          P.windows({ x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.92, z0: 0, z1: 8 }, 'R', { floors: 1, density: 3, wf: 0.75, hf: 0.7, glass: '#2f3e48' });
          P.poly([[0.08, 0.08, 8], [0.92, 0.08, 8], [0.92, 0.92, 8], [0.08, 0.92, 8]], '#7fa25a');
          P.shadow(0.2, 0.2, 0.8, 0.8, h);
          const bx = P.box(0.2, 0.2, 0.8, 0.8, 8, h, wall);
          if (style) {
            P.windows(bx, 'L', { floors: floors - 1, density: 6, base: 1, wf: 0.6, hf: 0.6 });
            P.windows(bx, 'R', { floors: floors - 1, density: 6, base: 1, wf: 0.6, hf: 0.6 });
            for (let f = 1; f < floors - 1; f += 1) P.line3([0.2, 0.8, 8 + f * 8], [0.8, 0.8, 8 + f * 8], rgba('#ffffff', 0.35), 0.6);
          } else {
            P.windows(bx, 'L', { floors: floors - 1, band: true, density: 5, base: 1, hf: 0.5, glass: pick(rng, GLASS) });
            P.windows(bx, 'R', { floors: floors - 1, band: true, density: 5, base: 1, hf: 0.5, glass: pick(rng, GLASS) });
          }
          parapet(P, 0.2, 0.2, 0.8, 0.8, h, shade(wall, 1.05));
          P.box(0.36, 0.36, 0.6, 0.6, h, h + 6, shade(wall, 0.95), { edge: false });
          P.line3([0.5, 0.5, h + 6], [0.5, 0.5, h + 9], '#555', 0.6);
          P.tree(0.06, 0.94, 3.4, 3, '#5e8f3d');
        },
      };
    }
    case 6: {
      const h1 = 150 + Math.floor(rng() * 40), h2 = 100 + Math.floor(rng() * 30);
      const glass = pick(rng, GLASS);
      return {
        fw: 2, fd: 2, H: h1 + 22, meta: { beacon: [[0.65, 0.65, h1 + 16], [1.4, 1.4, h2 + 4]] }, draw(P) {
          lot(P, 2, 2, PAVE);
          P.shadow(0.1, 0.1, 1.9, 1.9, 14);
          const pod = P.box(0.1, 0.1, 1.9, 1.9, 0, 14, shade(wall, 0.85));
          P.windows(pod, 'L', { floors: 1, density: 4, wf: 0.8, hf: 0.65, glass: '#2f3e48', base: 1 });
          P.windows(pod, 'R', { floors: 1, density: 4, wf: 0.8, hf: 0.65, glass: '#2f3e48', base: 1 });
          P.poly([[0.1, 0.1, 14], [1.9, 0.1, 14], [1.9, 1.9, 14], [0.1, 1.9, 14]], '#7ea35a');
          for (const [x, y] of [[1.6, 0.4], [0.4, 1.6], [1.0, 1.0]]) { P.c.save(); P.oy -= 14 * P.s; P.tree(x, y, 4, 3, '#5e8f3d'); P.oy += 14 * P.s; P.c.restore(); }
          // tower A (back)
          P.shadow(0.25, 0.25, 1.05, 1.05, h1);
          const a = P.box(0.25, 0.25, 1.05, 1.05, 14, h1, wall);
          P.windows(a, 'L', { floors: Math.floor((h1 - 14) / 8), band: true, density: 6, hf: 0.55, glass });
          P.windows(a, 'R', { floors: Math.floor((h1 - 14) / 8), band: true, density: 6, hf: 0.55, glass });
          P.box(0.4, 0.4, 0.9, 0.9, h1, h1 + 10, shade(wall, 0.95));
          P.line3([0.65, 0.65, h1 + 10], [0.65, 0.65, h1 + 16], '#555', 0.7);
          // tower B (front)
          P.shadow(1.1, 1.1, 1.75, 1.75, h2);
          const b = P.box(1.1, 1.1, 1.75, 1.75, 14, h2, shade(wall, 1.03));
          P.windows(b, 'L', { floors: Math.floor((h2 - 14) / 8), density: 5, wf: 0.6, hf: 0.6 });
          P.windows(b, 'R', { floors: Math.floor((h2 - 14) / 8), density: 5, wf: 0.6, hf: 0.6 });
          parapet(P, 1.1, 1.1, 1.75, 1.75, h2, shade(wall, 1.05));
        },
      };
    }
  }
}

// ======================= COMMERCIAL =======================
function awning(P, face, k, u0, u1, z, cols) {
  const n = Math.max(3, Math.round((u1 - u0) * 14));
  const out = 0.1;
  for (let i = 0; i < n; i++) {
    const a = u0 + (u1 - u0) * i / n, b = u0 + (u1 - u0) * (i + 1) / n;
    const col = cols[i % 2];
    if (face === 'L') P.poly([[a, k, z], [b, k, z], [b, k + out, z - 3], [a, k + out, z - 3]], shade(col, i % 2 ? 1 : 0.98));
    else P.poly([[k, a, z], [k, b, z], [k + out, b, z - 3], [k + out, a, z - 3]], shade(col, 0.82));
  }
}
function storefront(P, bx, face, z1, rng) {
  P.windows({ ...bx, z1 }, face, { floors: 1, density: 3.2, wf: 0.78, hf: 0.7, glass: '#4b5f6b', lit: 0.95, glowCol: '#ffe2a6', base: 0.5 });
}

function comTier(tier, rng, facing) {
  const wall = pick(rng, COMM_WALL), glass = pick(rng, GLASS), aw = pick(rng, AWN);
  const ff = frontFace(facing);
  switch (tier) {
    case 1: return {
      fw: 1, fd: 1, H: 30, draw(P) {
        lot(P, 1, 1, ASPH);
        const col = pick(rng, RES_WALL);
        if (ff === 'L') parkingLines(P, 0.1, 0.72, 0.9, 0.98, 'x', 4); else parkingLines(P, 0.72, 0.1, 0.98, 0.9, 'y', 4);
        const b = ff === 'L' ? [0.12, 0.12, 0.88, 0.66] : [0.12, 0.12, 0.66, 0.88];
        P.shadow(...b, 13);
        const bx = P.box(b[0], b[1], b[2], b[3], 0, 13, col);
        storefront(P, bx, 'L', 9, rng); storefront(P, bx, 'R', 9, rng);
        parapet(P, b[0], b[1], b[2], b[3], 13, shade(col, 1.04));
        if (ff === 'L') awning(P, 'L', b[3], b[0] + 0.04, b[2] - 0.04, 10, aw); else awning(P, 'R', b[2], b[1] + 0.04, b[3] - 0.04, 10, aw);
        // sign
        const sc = aw[0];
        if (ff === 'L') P.box(b[0] + 0.2, b[3] - 0.03, b[2] - 0.2, b[3], 13, 17, sc, { edge: false, ao: false });
        else P.box(b[2] - 0.03, b[1] + 0.2, b[2], b[3] - 0.2, 13, 17, sc, { edge: false, ao: false });
        roofStuff(P, b[0], b[1], b[2], b[3], 13, rng, 1);
        if (rng() < 0.7) parkedCar(P, ff === 'L' ? 0.3 : 0.84, ff === 'L' ? 0.84 : 0.3, ff === 'L' ? 'y' : 'x', rng);
      },
    };
    case 2: return {
      fw: 1, fd: 1, H: 34, draw(P) {
        lot(P, 1, 1, PAVE);
        P.shadow(0.06, 0.1, 0.94, 0.78, 22);
        const bx = P.box(0.06, 0.1, 0.94, 0.78, 0, 22, wall);
        storefront(P, bx, 'L', 9, rng); storefront(P, bx, 'R', 9, rng);
        P.windows({ ...bx, z0: 10 }, 'L', { floors: 1, density: 5, wf: 0.5, hf: 0.6, sill: true });
        P.windows({ ...bx, z0: 10 }, 'R', { floors: 1, density: 5, wf: 0.5, hf: 0.6 });
        const segs = 3;
        for (let k = 0; k < segs; k++) {
          const u0 = 0.08 + k * 0.29, u1 = u0 + 0.26;
          awning(P, 'L', 0.78, u0, u1, 9.5, AWN[(k + Math.floor(rng() * 5)) % AWN.length]);
        }
        awning(P, 'R', 0.94, 0.14, 0.74, 9.5, aw);
        parapet(P, 0.06, 0.1, 0.94, 0.78, 22, shade(wall, 1.04));
        roofStuff(P, 0.1, 0.14, 0.9, 0.74, 22, rng, 3);
      },
    };
    case 3: {
      const floors = 4 + Math.floor(rng() * 2), h = floors * 9 + 4;
      return {
        fw: 1, fd: 1, H: h + 12, draw(P) {
          lot(P, 1, 1, PAVE);
          P.ground(0.04, 0.04, 0.96, 0.18, LAWN);
          P.shadow(0.14, 0.14, 0.86, 0.84, h);
          const bx = P.box(0.14, 0.14, 0.86, 0.84, 0, h, wall);
          P.windows(bx, 'L', { floors, band: true, density: 5, base: 4, hf: 0.55, glass });
          P.windows(bx, 'R', { floors, band: true, density: 5, base: 4, hf: 0.55, glass });
          storefront(P, { ...bx }, 'L', 4.5, rng);
          parapet(P, 0.14, 0.14, 0.86, 0.84, h, shade(wall, 1.04));
          roofStuff(P, 0.2, 0.2, 0.8, 0.78, h, rng, 2);
          P.tree(0.9, 0.9, 3.4, 3, '#5e8f3d'); P.tree(0.06, 0.9, 3.4, 3, '#4f7f36');
        },
      };
    }
    case 4: {
      const floors = 7 + Math.floor(rng() * 3), h = floors * 8 + 6;
      return {
        fw: 1, fd: 1, H: h + 16, meta: { beacon: [[0.5, 0.5, h + 8]] }, draw(P) {
          lot(P, 1, 1, PAVE);
          P.shadow(0.12, 0.12, 0.88, 0.88, h);
          const bx = P.box(0.12, 0.12, 0.88, 0.88, 0, h, shade(glass, 1.2), { left: shade(glass, 1.1), right: shade(glass, 0.75) });
          // curtain wall mullions
          const c = P.c;
          for (let i = 1; i < 7; i++) {
            const u = 0.12 + i * 0.76 / 7;
            P.line3([u, 0.88, 6], [u, 0.88, h], rgba('#dfe7ea', 0.45), 0.5);
            P.line3([0.88, u, 6], [0.88, u, h], rgba('#dfe7ea', 0.3), 0.5);
          }
          for (let f = 0; f < floors; f++) {
            const z = 6 + f * 8;
            P.line3([0.12, 0.88, z], [0.88, 0.88, z], rgba('#e8edef', 0.55), 0.6);
            P.line3([0.88, 0.12, z], [0.88, 0.88, z], rgba('#e8edef', 0.4), 0.6);
          }
          P.glassSheen(P.fq('L', 0.881, 0.12, 0.88, 6, h), 'L');
          P.windows({ ...bx, z0: 6 }, 'L', { floors: floors - 1, density: 7, wf: 0.9, hf: 0.8, glass: null, lit: 0.35, glowCol: '#f7d58e' });
          P.windows({ ...bx, z0: 6 }, 'R', { floors: floors - 1, density: 7, wf: 0.9, hf: 0.8, glass: null, lit: 0.35, glowCol: '#f7d58e' });
          P.box(0.12, 0.12, 0.88, 0.88, 0, 6, '#5d6064', { noTop: true, edge: false });
          storefront(P, bx, 'L', 5.5, rng);
          parapet(P, 0.12, 0.12, 0.88, 0.88, h, '#d9dcdd', '#8a8d8f');
          P.box(0.3, 0.3, 0.7, 0.7, h, h + 5, '#b8bcbe', { edge: false });
          void c;
        },
      };
    }
    case 5: {
      const h = 120 + Math.floor(rng() * 50);
      const crown = rng() < 0.5;
      return {
        fw: 1, fd: 1, H: h + 34, meta: { beacon: [[0.5, 0.5, h + (crown ? 28 : 16)]] }, draw(P) {
          lot(P, 1, 1, PAVE);
          P.shadow(0.12, 0.12, 0.88, 0.88, 10);
          P.box(0.08, 0.08, 0.92, 0.92, 0, 10, '#d4d0c8');
          storefront(P, { x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.92, z0: 0, z1: 10 }, 'L', 8, rng);
          storefront(P, { x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.92, z0: 0, z1: 10 }, 'R', 8, rng);
          P.shadow(0.18, 0.18, 0.82, 0.82, h);
          const bx = P.box(0.18, 0.18, 0.82, 0.82, 10, h, shade(glass, 1.15), { left: shade(glass, 1.08), right: shade(glass, 0.7) });
          const floors = Math.floor((h - 10) / 7);
          for (let f = 0; f <= floors; f++) {
            const z = 10 + f * 7;
            P.line3([0.18, 0.82, z], [0.82, 0.82, z], rgba('#e8eef0', 0.4), 0.5);
            P.line3([0.82, 0.18, z], [0.82, 0.82, z], rgba('#e8eef0', 0.3), 0.5);
          }
          P.glassSheen(P.fq('L', 0.821, 0.18, 0.82, 10, h), 'L');
          P.glassSheen(P.fq('R', 0.821, 0.18, 0.82, 10, h), 'R');
          P.windows({ ...bx }, 'L', { floors, density: 8, wf: 0.9, hf: 0.75, glass: null, lit: 0.32, glowCol: '#f7d58e' });
          P.windows({ ...bx }, 'R', { floors, density: 8, wf: 0.9, hf: 0.75, glass: null, lit: 0.32, glowCol: '#f7d58e' });
          // vertical fins at corners
          P.box(0.78, 0.78, 0.84, 0.84, 10, h + 3, '#dfe3e4', { edge: false, ao: false });
          if (crown) {
            P.box(0.26, 0.26, 0.74, 0.74, h, h + 10, shade(glass, 1.25), { right: shade(glass, 0.8) });
            P.box(0.36, 0.36, 0.64, 0.64, h + 10, h + 18, '#cfd4d6');
            P.line3([0.5, 0.5, h + 18], [0.5, 0.5, h + 28], '#6b6f73', 0.7);
          } else {
            parapet(P, 0.18, 0.18, 0.82, 0.82, h, '#dfe3e4');
            P.groundEllipse(0.5, 0.5, 0.18, 0.18, '#5e6468', h + 0.1);
            P.groundEllipse(0.5, 0.5, 0.12, 0.12, '#e7d65a', h + 0.2);
            P.line3([0.3, 0.3, h], [0.3, 0.3, h + 16], '#6b6f73', 0.6);
          }
        },
      };
    }
    case 6: {
      const h = 200 + Math.floor(rng() * 50);
      return {
        fw: 2, fd: 2, H: h + 34, meta: { beacon: [[0.75, 0.75, h + 30]] }, draw(P) {
          lot(P, 2, 2, PAVE);
          // plaza pattern
          for (let k = 1; k < 8; k++) { P.line3([k * 0.25, 0.05, 0], [k * 0.25, 1.95, 0], rgba('#ffffff', 0.25), 0.4); P.line3([0.05, k * 0.25, 0], [1.95, k * 0.25, 0], rgba('#ffffff', 0.25), 0.4); }
          P.groundEllipse(1.55, 1.55, 0.22, 0.22, '#9aa6ab'); P.groundEllipse(1.55, 1.55, 0.17, 0.17, '#5fa7c0');
          for (const [x, y] of [[1.15, 1.85], [1.85, 1.15], [0.2, 1.85], [1.85, 0.2]]) P.tree(x, y, 4, 4, '#5e8f3d');
          // low wing
          P.shadow(1.1, 0.15, 1.85, 0.95, 30);
          const w = P.box(1.1, 0.15, 1.85, 0.95, 0, 30, '#d8d4cc');
          P.windows(w, 'L', { floors: 3, band: true, density: 5, base: 2, hf: 0.55, glass });
          P.windows(w, 'R', { floors: 3, band: true, density: 5, base: 2, hf: 0.55, glass });
          parapet(P, 1.1, 0.15, 1.85, 0.95, 30, '#e4e1da');
          // main tower with stepped top
          P.shadow(0.2, 0.2, 1.3, 1.3, h);
          const t = P.box(0.25, 0.25, 1.25, 1.25, 0, h, shade(glass, 1.12), { left: shade(glass, 1.05), right: shade(glass, 0.68) });
          const floors = Math.floor(h / 7);
          for (let f = 1; f <= floors; f++) {
            const z = f * 7;
            P.line3([0.25, 1.25, z], [1.25, 1.25, z], rgba('#e8eef0', 0.35), 0.5);
            P.line3([1.25, 0.25, z], [1.25, 1.25, z], rgba('#e8eef0', 0.25), 0.5);
          }
          for (let i = 1; i < 6; i++) { const u = 0.25 + i / 6; P.line3([u, 1.25, 0], [u, 1.25, h], rgba('#dfe6e8', 0.3), 0.5); P.line3([1.25, u, 0], [1.25, u, h], rgba('#dfe6e8', 0.2), 0.5); }
          P.glassSheen(P.fq('L', 1.251, 0.25, 1.25, 0, h), 'L');
          P.windows(t, 'L', { floors, density: 9, wf: 0.9, hf: 0.75, glass: null, lit: 0.32, glowCol: '#f7d58e' });
          P.windows(t, 'R', { floors, density: 9, wf: 0.9, hf: 0.75, glass: null, lit: 0.32, glowCol: '#f7d58e' });
          P.box(0.35, 0.35, 1.15, 1.15, h, h + 10, shade(glass, 1.25), { right: shade(glass, 0.8) });
          P.box(0.5, 0.5, 1.0, 1.0, h + 10, h + 20, '#d6dadc');
          P.line3([0.75, 0.75, h + 20], [0.75, 0.75, h + 30], '#6b6f73', 0.8);
        },
      };
    }
  }
}

// ======================= INDUSTRIAL =======================
function sawtooth(P, x0, y0, x1, y1, z, n, col, glassCol = '#a8c2cc') {
  const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const a = x0 + i * w, b = a + w;
    // vertical glazed face (faces +x) then slope
    P.poly([[a, y0, z], [a + w * 0.15, y0, z + 7], [a + w * 0.15, y1, z + 7], [a, y1, z]], shade(col, 0.9));
    P.poly([[a + w * 0.15, y0, z + 7], [b, y0, z], [b, y1, z], [a + w * 0.15, y1, z + 7]], shade(col, 0.72));
    P.poly([[a + w * 0.15, y1, z + 7], [b, y1, z], [a + w * 0.15, y1, z]], shade(col, LIGHT.left));
    P.poly([[b, y0 + 0.02, z], [b, y1 - 0.02, z], [b, y1 - 0.02, z + 0.1], [b, y0 + 0.02, z + 0.1]], glassCol);
  }
}
function corrugate(P, bx, face, col) {
  const { x0, y0, x1, y1, z0, z1 } = bx;
  const n = Math.round(((face === 'L' ? x1 - x0 : y1 - y0)) * 22);
  for (let i = 1; i < n; i++) {
    const u = (face === 'L' ? x0 : y0) + (face === 'L' ? x1 - x0 : y1 - y0) * i / n;
    if (face === 'L') P.line3([u, y1, z0], [u, y1, z1], rgba('#000000', 0.08), 0.4);
    else P.line3([x1, u, z0], [x1, u, z1], rgba('#000000', 0.1), 0.4);
  }
  void col;
}
function stack(P, x, y, r, h, col = '#9b5a45') {
  P.cyl(x, y, r, 0, h, col, { bands: [[h - 10, h - 6, '#e8e3da'], [h - 4, h, '#c64634']], hollow: true });
}
function tank(P, x, y, r, h, col = '#c9c6bd') {
  P.cyl(x, y, r, 0, h, col, { top: shade(col, 1.08) });
}

function indTier(tier, rng, facing) {
  const wall = pick(rng, IND_WALL), accent = pick(rng, ['#c9772f', '#3f6e8c', '#5d8a4f', '#b6413a', '#d1a73a']);
  const ff = frontFace(facing);
  switch (tier) {
    case 1: return {
      fw: 1, fd: 1, H: 30, draw(P) {
        lot(P, 1, 1, '#a69d8c');
        P.line3([0.05, 0.05, 2.5], [0.95, 0.05, 2.5], '#7d8287', 0.5); P.line3([0.05, 0.05, 2.5], [0.05, 0.95, 2.5], '#7d8287', 0.5);
        const b = [0.14, 0.14, 0.7, 0.62];
        const bx = P.house(b[0], b[1], b[2], b[3], 12, 6, wall, '#7f878c', 'x');
        corrugate(P, bx, 'L', wall); corrugate(P, bx, 'R', wall);
        P.door('L', b[3], 0.3, 0.52, 9, '#55595d');
        P.windows(bx, 'R', { floors: 1, density: 4, base: 5, wf: 0.5, hf: 0.4 });
        // crates & pallets
        for (let k = 0; k < 4; k++) {
          const x = 0.72 + (k % 2) * 0.12, y = 0.66 + Math.floor(k / 2) * 0.12;
          P.box(x, y, x + 0.09, y + 0.09, 0, 4 + (k % 2) * 3, pick(rng, ['#b88a52', '#a07646', '#c2995c']), { edge: false, ao: false });
        }
        if (rng() < 0.6) parkedCar(P, 0.84, 0.3, 'y', rng);
      },
    };
    case 2: return {
      fw: 1, fd: 1, H: 30, draw(P) {
        lot(P, 1, 1, ASPH);
        P.shadow(0.08, 0.1, 0.92, 0.7, 18);
        const bx = P.box(0.08, 0.1, 0.92, 0.7, 0, 18, wall);
        corrugate(P, bx, 'L', wall); corrugate(P, bx, 'R', wall);
        P.poly([[0.08, 0.1, 18], [0.92, 0.1, 18], [0.92, 0.7, 18], [0.08, 0.7, 18]], '#878d91');
        for (let k = 0; k < 3; k++) P.door('L', 0.7, 0.14 + k * 0.27, 0.32 + k * 0.27, 11, '#4e5357');
        P.box(0.08, 0.66, 0.92, 0.7, 14, 18, accent, { edge: false, ao: false });
        // truck
        const tx = 0.3 + rng() * 0.4;
        P.box(tx, 0.76, tx + 0.12, 0.96, 0, 7, '#e8e4dc', { edge: false });
        P.box(tx + 0.01, 0.92, tx + 0.11, 0.98, 0, 5, accent, { edge: false });
        roofStuff(P, 0.12, 0.14, 0.88, 0.66, 18, rng, 2);
      },
    };
    case 3: return {
      fw: 1, fd: 1, H: 62, meta: { smoke: [[0.82, 0.22, 54]] }, draw(P) {
        lot(P, 1, 1, '#a39b8b');
        P.shadow(0.08, 0.2, 0.7, 0.9, 16);
        const bx = P.box(0.08, 0.2, 0.7, 0.9, 0, 12, '#a85d45');
        P.windows(bx, 'L', { floors: 1, density: 6, base: 3, wf: 0.6, hf: 0.6, glass: '#3e4a52' });
        P.windows(bx, 'R', { floors: 1, density: 6, base: 3, wf: 0.6, hf: 0.6, glass: '#3e4a52' });
        sawtooth(P, 0.08, 0.2, 0.7, 0.9, 12, 4, '#7d858a');
        tank(P, 0.84, 0.66, 0.1, 18, '#c7c3b8');
        stack(P, 0.82, 0.22, 0.07, 54);
      },
    };
    case 4: return {
      fw: 1, fd: 1, H: 66, meta: { smoke: [[0.18, 0.18, 60]] }, draw(P) {
        lot(P, 1, 1, ASPH);
        stack(P, 0.18, 0.18, 0.08, 60, '#8f8f8a');
        P.shadow(0.3, 0.08, 0.94, 0.62, 24);
        const bx = P.box(0.3, 0.08, 0.94, 0.62, 0, 24, wall);
        corrugate(P, bx, 'L', wall); corrugate(P, bx, 'R', wall);
        P.poly([[0.3, 0.08, 24], [0.94, 0.08, 24], [0.94, 0.62, 24], [0.3, 0.62, 24]], '#82898d');
        P.box(0.3, 0.58, 0.94, 0.62, 19, 24, accent, { edge: false, ao: false });
        P.door('L', 0.62, 0.42, 0.62, 14, '#4b5054');
        roofStuff(P, 0.34, 0.12, 0.9, 0.58, 24, rng, 3);
        tank(P, 0.2, 0.78, 0.12, 22, '#d6d2c6'); tank(P, 0.48, 0.82, 0.1, 18, '#c2beb2');
        P.line3([0.2, 0.78, 16], [0.48, 0.82, 14], '#7a7f84', 1);
        P.line3([0.48, 0.82, 12], [0.6, 0.62, 12], '#7a7f84', 1);
      },
    };
    case 5: return {
      fw: 1, fd: 1, H: 78, meta: { smoke: [[0.16, 0.2, 70], [0.34, 0.14, 62]] }, draw(P) {
        lot(P, 1, 1, '#9e9686');
        stack(P, 0.16, 0.2, 0.07, 70); stack(P, 0.34, 0.14, 0.06, 62, '#8d8d88');
        for (let k = 0; k < 3; k++) tank(P, 0.62 + (k % 2) * 0.2, 0.2 + k * 0.17, 0.09, 38, '#cfcabe');
        P.shadow(0.12, 0.44, 0.6, 0.92, 30);
        const bx = P.box(0.12, 0.44, 0.6, 0.92, 0, 30, wall);
        corrugate(P, bx, 'L', wall); corrugate(P, bx, 'R', wall);
        P.poly([[0.12, 0.44, 30], [0.6, 0.44, 30], [0.6, 0.92, 30], [0.12, 0.92, 30]], '#868c90');
        P.windows(bx, 'L', { floors: 2, density: 5, base: 4, wf: 0.6, hf: 0.4, glass: '#3e4a52' });
        // pipe rack
        P.box(0.6, 0.7, 0.96, 0.74, 14, 16, '#c9772f', { edge: false, ao: false });
        P.box(0.6, 0.78, 0.96, 0.82, 10, 12, '#6d7b85', { edge: false, ao: false });
      },
    };
    case 6: return {
      fw: 2, fd: 2, H: 92, meta: { smoke: [[0.3, 0.3, 84], [1.75, 0.3, 64]], steam: [[1.45, 1.45, 60]] }, draw(P) {
        lot(P, 2, 2, '#a1998a');
        P.line3([0.05, 0.05, 2.5], [1.95, 0.05, 2.5], '#7d8287', 0.5); P.line3([0.05, 0.05, 2.5], [0.05, 1.95, 2.5], '#7d8287', 0.5);
        stack(P, 0.3, 0.3, 0.1, 84); stack(P, 1.75, 0.3, 0.08, 64, '#8d8d88');
        P.shadow(0.2, 0.7, 1.1, 1.8, 26);
        const bx = P.box(0.2, 0.7, 1.1, 1.8, 0, 22, wall);
        corrugate(P, bx, 'L', wall); corrugate(P, bx, 'R', wall);
        sawtooth(P, 0.2, 0.7, 1.1, 1.8, 22, 5, '#7d858a');
        for (let k = 0; k < 4; k++) tank(P, 0.75 + (k % 2) * 0.32, 0.25 + Math.floor(k / 2) * 0.3, 0.13, 32, '#d4d0c4');
        // cooling tower
        coolingTower(P, 1.45, 1.45, 0.42, 58);
      },
    };
  }
}

function coolingTower(P, cx, cy, r, h) {
  const c = P.c; const s = P.s;
  const [sx, sy0] = P.pt(cx, cy, 0); const [, sy1] = P.pt(cx, cy, h);
  const rx = r * Math.SQRT2 * 32 * s, ry = r * Math.SQRT2 * 16 * s;
  const waist = 0.68, top = 0.78;
  const gr = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
  gr.addColorStop(0, '#c9c5bb'); gr.addColorStop(0.35, '#e6e2d9'); gr.addColorStop(1, '#8f8b83');
  c.beginPath();
  c.moveTo(sx - rx, sy0);
  c.quadraticCurveTo(sx - rx * waist * 0.9, sy0 + (sy1 - sy0) * 0.7, sx - rx * top, sy1);
  c.lineTo(sx + rx * top, sy1);
  c.quadraticCurveTo(sx + rx * waist * 0.9, sy0 + (sy1 - sy0) * 0.7, sx + rx, sy0);
  c.ellipse(sx, sy0, rx, ry, 0, 0, Math.PI);
  c.closePath(); c.fillStyle = gr; c.fill();
  c.beginPath(); c.ellipse(sx, sy1, rx * top, ry * top, 0, 0, Math.PI * 2); c.fillStyle = '#d9d5cc'; c.fill();
  c.beginPath(); c.ellipse(sx, sy1, rx * top * 0.86, ry * top * 0.86, 0, 0, Math.PI * 2); c.fillStyle = '#4a4a48'; c.fill();
  // base supports
  c.strokeStyle = 'rgba(60,60,60,0.35)'; c.lineWidth = 0.6 * s;
  for (let k = -4; k <= 4; k++) { c.beginPath(); c.moveTo(sx + rx * k / 4.5, sy0 + ry * Math.sqrt(1 - (k / 4.5) ** 2)); c.lineTo(sx + rx * k / 4.5, sy0 + ry * Math.sqrt(1 - (k / 4.5) ** 2) - 3 * s); c.stroke(); }
}

// ======================= SERVICES =======================
function flag(P, x, y, h, col) {
  P.line3([x, y, 0], [x, y, h], '#d8d8d8', 0.6);
  P.poly([[x, y, h], [x + 0.12, y, h - 1], [x + 0.12, y, h - 4], [x, y, h - 3]], col);
}
function crossSign(P, face, k, u, z, col) {
  const s = 0.05;
  if (face === 'L') {
    P.poly([[u - s * 3, k + 0.002, z - 1.5], [u + s * 3, k + 0.002, z - 1.5], [u + s * 3, k + 0.002, z + 1.5], [u - s * 3, k + 0.002, z + 1.5]], col);
    P.poly([[u - s, k + 0.002, z - 4.5], [u + s, k + 0.002, z - 4.5], [u + s, k + 0.002, z + 4.5], [u - s, k + 0.002, z + 4.5]], col);
  }
}
function vehicle(P, x, y, axis, body, stripe) {
  const L = 0.3, W = 0.14;
  const [x0, x1, y0, y1] = axis === 'x' ? [x - L / 2, x + L / 2, y - W / 2, y + W / 2] : [x - W / 2, x + W / 2, y - L / 2, y + L / 2];
  P.box(x0, y0, x1, y1, 0.5, 6, body, { edge: false, ao: false });
  if (stripe) P.box(x0, y0, x1, y1, 3, 3.8, stripe, { edge: false, ao: false, noTop: true });
  P.box(x0 + 0.03, y0 + 0.03, x1 - 0.03, y1 - 0.03, 6, 6.8, '#d24a3a', { edge: false, ao: false });
}

const SERVICES = {
  coal: (rng) => ({
    fw: 3, fd: 3, H: 104, meta: { smoke: [[0.55, 0.55, 96], [1.05, 0.5, 96]] }, draw(P) {
      lot(P, 3, 3, '#8f887b');
      // coal heaps
      for (const [x, y, r] of [[2.25, 2.3, 0.45], [2.4, 1.5, 0.35]]) {
        const [sx, sy] = P.pt(x, y); const c = P.c; const rx = r * 45 * P.s, ry = r * 22 * P.s;
        const gr = c.createRadialGradient(sx - rx * 0.3, sy - ry * 1.4, 1, sx, sy - ry * 0.5, rx);
        gr.addColorStop(0, '#5a5856'); gr.addColorStop(1, '#232322');
        c.fillStyle = gr; c.beginPath(); c.ellipse(sx, sy, rx, ry, 0, 0, Math.PI); c.ellipse(sx, sy, rx, ry * 1.8, 0, Math.PI, 0); c.fill();
      }
      stack(P, 0.55, 0.55, 0.14, 96); stack(P, 1.05, 0.5, 0.14, 96);
      P.shadow(0.3, 1.0, 1.9, 2.7, 46);
      const boil = P.box(0.3, 1.0, 1.4, 2.7, 0, 46, '#9c9f9e');
      corrugate(P, boil, 'L', '#9c9f9e'); corrugate(P, boil, 'R', '#9c9f9e');
      P.windows(boil, 'L', { floors: 4, band: true, density: 4, base: 4, hf: 0.3, glass: '#4b5a63' });
      P.poly([[0.3, 1.0, 46], [1.4, 1.0, 46], [1.4, 2.7, 46], [0.3, 2.7, 46]], '#7c8184');
      const t = P.box(1.4, 1.5, 2.0, 2.7, 0, 26, '#b2a894');
      P.windows(t, 'R', { floors: 2, density: 4, base: 3, wf: 0.5, hf: 0.5 });
      P.windows(t, 'L', { floors: 2, density: 4, base: 3, wf: 0.5, hf: 0.5 });
      // conveyor
      P.line3([1.4, 1.3, 30], [2.25, 2.0, 6], '#5d5f61', 2);
      P.line3([1.4, 1.3, 32], [2.25, 2.0, 8], '#a8a28f', 0.6);
    },
  }),
  wind: () => ({
    fw: 1, fd: 1, H: 70, meta: { rotor: [0.5, 0.5, 56] }, draw(P) {
      lot(P, 1, 1, LAWN, 0.2);
      P.box(0.4, 0.4, 0.6, 0.6, 0, 2, '#b9b6ad', { edge: false });
      const c = P.c; const [sx, sy] = P.pt(0.5, 0.5, 0), [, ty] = P.pt(0.5, 0.5, 56);
      const gr = c.createLinearGradient(sx - 2 * P.s, 0, sx + 2 * P.s, 0);
      gr.addColorStop(0, '#d9dcdc'); gr.addColorStop(0.4, '#f6f6f2'); gr.addColorStop(1, '#a7aaa9');
      c.fillStyle = gr; c.beginPath(); c.moveTo(sx - 2.2 * P.s, sy); c.lineTo(sx - 1 * P.s, ty); c.lineTo(sx + 1 * P.s, ty); c.lineTo(sx + 2.2 * P.s, sy); c.fill();
      P.box(0.44, 0.47, 0.6, 0.53, 55, 59, '#ecece6', { edge: false, ao: false });
    },
  }),
  solar: (rng) => ({
    fw: 3, fd: 3, H: 20, draw(P) {
      lot(P, 3, 3, '#a8a493');
      for (let r = 0; r < 5; r++) for (let k = 0; k < 2; k++) {
        const y0 = 0.25 + r * 0.52, x0 = 0.2 + k * 1.35, x1 = x0 + 1.2;
        P.poly([[x0, y0 + 0.32, 2], [x1, y0 + 0.32, 2], [x1, y0, 7], [x0, y0, 7]], '#25415c');
        const c = P.c;
        for (let i = 1; i < 6; i++) { const x = x0 + (x1 - x0) * i / 6; P.line3([x, y0 + 0.32, 2], [x, y0, 7], rgba('#9fc0d8', 0.45), 0.4); }
        P.line3([x0, y0 + 0.16, 4.5], [x1, y0 + 0.16, 4.5], rgba('#9fc0d8', 0.45), 0.4);
        P.poly([[x0, y0 + 0.32, 2], [x1, y0 + 0.32, 2], [x1, y0, 7], [x0, y0, 7]], null, '#c9d3d8', 0.5);
        void c;
      }
      P.box(2.6, 2.55, 2.9, 2.9, 0, 8, '#d7d3c8');
    },
  }),
  gas: (rng) => ({
    fw: 2, fd: 2, H: 70, meta: { smoke: [[0.4, 0.4, 64]] }, draw(P) {
      lot(P, 2, 2, ASPH);
      stack(P, 0.4, 0.4, 0.09, 64, '#a4a7a6');
      // spheres
      for (const [x, y] of [[1.45, 0.45], [1.5, 1.05]]) {
        P.line3([x - 0.15, y, 0], [x - 0.1, y, 10], '#6e7276', 0.9); P.line3([x + 0.15, y, 0], [x + 0.1, y, 10], '#6e7276', 0.9);
        const [sx, sy] = P.pt(x, y, 14); const c = P.c; const r = 11 * P.s;
        const gr = c.createRadialGradient(sx - r * 0.4, sy - r * 0.4, 1, sx, sy, r);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#e3e1db'); gr.addColorStop(1, '#a3a19b');
        c.fillStyle = gr; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill();
      }
      P.shadow(0.15, 0.85, 1.2, 1.85, 30);
      const h = P.box(0.15, 0.85, 1.2, 1.85, 0, 28, '#c8c4ba');
      P.windows(h, 'L', { floors: 2, band: true, density: 4, base: 3, hf: 0.35, glass: '#4b5a63' });
      P.windows(h, 'R', { floors: 2, band: true, density: 4, base: 3, hf: 0.35, glass: '#4b5a63' });
      P.poly([[0.15, 0.85, 28], [1.2, 0.85, 28], [1.2, 1.85, 28], [0.15, 1.85, 28]], '#8e9396');
      P.box(0.15, 1.8, 1.2, 1.85, 22, 28, '#2f7fd1', { edge: false, ao: false });
      roofStuff(P, 0.2, 0.9, 1.15, 1.8, 28, rng, 3);
    },
  }),
  nuclear: (rng) => ({
    fw: 4, fd: 4, H: 96, meta: { steam: [[0.9, 0.9, 80], [2.0, 0.75, 80]] }, draw(P) {
      lot(P, 4, 4, '#b4afa2');
      P.line3([0.05, 0.05, 3], [3.95, 0.05, 3], '#7d8287', 0.6); P.line3([0.05, 0.05, 3], [0.05, 3.95, 3], '#7d8287', 0.6);
      coolingTower(P, 0.9, 0.9, 0.75, 80); coolingTower(P, 2.0, 0.75, 0.7, 76);
      P.shadow(0.4, 2.0, 2.0, 3.6, 30);
      P.cyl(1.2, 2.8, 0.6, 0, 26, '#d8d4ca', { noTop: true });
      P.dome(1.2, 2.8, 0.6, 26, '#e0ddd5', 0.6);
      const t = P.box(2.1, 1.9, 3.7, 3.4, 0, 30, '#c2c6c8');
      P.windows(t, 'L', { floors: 2, band: true, density: 4, base: 4, hf: 0.3, glass: '#4b5a63' });
      P.windows(t, 'R', { floors: 2, band: true, density: 4, base: 4, hf: 0.3, glass: '#4b5a63' });
      P.poly([[2.1, 1.9, 30], [3.7, 1.9, 30], [3.7, 3.4, 30], [2.1, 3.4, 30]], '#8e9396');
      P.box(2.1, 3.34, 3.7, 3.4, 24, 30, '#e0a526', { edge: false, ao: false });
      roofStuff(P, 2.2, 2.0, 3.6, 3.3, 30, rng, 4);
    },
  }),
  pump: () => ({
    fw: 1, fd: 1, H: 30, draw(P) {
      lot(P, 1, 1, PAVE);
      const bx = P.house(0.2, 0.24, 0.72, 0.7, 13, 6, '#b9c7cc', '#3f6e8c', 'x');
      P.door('L', 0.7, 0.4, 0.52, 9, '#3f4b52');
      P.windows(bx, 'R', { floors: 1, density: 4, base: 4, wf: 0.5, hf: 0.5 });
      P.cyl(0.84, 0.3, 0.07, 0, 9, '#3f6e8c');
      P.line3([0.84, 0.3, 6], [0.84, 0.0, 2], '#3f6e8c', 2);
      P.line3([0.84, 0.3, 6], [1.0, 0.3, 2], '#3f6e8c', 2);
    },
  }),
  wtower: () => ({
    fw: 1, fd: 1, H: 60, draw(P) {
      lot(P, 1, 1, LAWN, 0.12);
      for (const [x, y] of [[0.32, 0.32], [0.68, 0.32], [0.68, 0.68], [0.32, 0.68]]) P.line3([x, y, 0], [0.5 + (x - 0.5) * 0.7, 0.5 + (y - 0.5) * 0.7, 36], '#7d8a90', 1);
      P.line3([0.5, 0.5, 0], [0.5, 0.5, 36], '#6f7c82', 1.2);
      P.cyl(0.5, 0.5, 0.26, 36, 50, '#4f88a8', { top: '#6aa0bd' });
      const [sx, sy] = P.pt(0.5, 0.5, 50);
      const c = P.c; c.fillStyle = '#3f7898'; c.beginPath(); c.moveTo(sx - 0.26 * 45 * P.s, sy); c.lineTo(sx, sy - 7 * P.s); c.lineTo(sx + 0.26 * 45 * P.s, sy); c.fill();
    },
  }),
  treatment: () => ({
    fw: 3, fd: 3, H: 34, draw(P) {
      lot(P, 3, 3, '#a7a597');
      for (const [x, y] of [[0.75, 0.75], [1.9, 0.7], [0.75, 1.9]]) {
        P.cyl(x, y, 0.5, 0, 5, '#b8b5aa', { top: '#5b9fb6' });
        P.groundEllipse(x, y, 0.38, 0.38, '#4a90a8', 5.1);
        P.line3([x - 0.4, y, 6], [x + 0.4, y, 6], '#d8d5cd', 0.8);
      }
      const b = P.box(1.6, 1.6, 2.8, 2.7, 0, 22, '#cfd3d0');
      P.windows(b, 'L', { floors: 2, density: 4, base: 3, wf: 0.6, hf: 0.5 });
      P.windows(b, 'R', { floors: 2, density: 4, base: 3, wf: 0.6, hf: 0.5 });
      parapet(P, 1.6, 1.6, 2.8, 2.7, 22, '#e1e3df');
      P.box(1.6, 2.64, 2.8, 2.7, 16, 22, '#3a86d4', { edge: false, ao: false });
    },
  }),
  busstop: () => ({
    fw: 1, fd: 1, H: 26, draw(P) {
      lot(P, 1, 1, PAVE, 0.02);
      P.ground(0.04, 0.04, 0.96, 0.3, LAWN);
      // shelter: back wall, roof, bench
      P.box(0.22, 0.42, 0.78, 0.46, 0, 11, '#8fb3c4', { edge: false, ao: false, left: 'rgba(160,200,215,0.85)', right: '#6f93a4' });
      P.box(0.2, 0.4, 0.8, 0.66, 11, 12.5, '#3c4a52', { edge: false });
      P.line3([0.22, 0.64, 0], [0.22, 0.64, 11], '#4a555c', 0.8); P.line3([0.78, 0.64, 0], [0.78, 0.64, 11], '#4a555c', 0.8);
      P.box(0.3, 0.47, 0.7, 0.55, 3, 4, '#8a6a4a', { edge: false, ao: false });
      // sign
      P.line3([0.88, 0.86, 0], [0.88, 0.86, 15], '#4a555c', 0.7);
      P.box(0.84, 0.84, 0.92, 0.88, 13, 18, '#e0a526', { edge: false, ao: false });
      P.glowDot(0.5, 0.55, 10, 6, 'rgba(255,230,170,0.85)');
      P.tree(0.15, 0.15, 3.8, 3, '#5e8f3d');
    },
  }),
  busdepot: (rng) => ({
    fw: 2, fd: 2, H: 34, draw(P) {
      lot(P, 2, 2, ASPH);
      parkingLines(P, 0.1, 1.45, 1.9, 1.95, 'x', 7);
      P.shadow(0.15, 0.15, 1.85, 1.3, 20);
      const bx = P.box(0.15, 0.15, 1.85, 1.3, 0, 18, '#c9c6bc');
      for (let k = 0; k < 4; k++) P.door('L', 1.3, 0.22 + k * 0.41, 0.52 + k * 0.41, 12, '#53595e');
      P.windows(bx, 'R', { floors: 1, density: 3, base: 9, wf: 0.6, hf: 0.5 });
      P.poly([[0.15, 0.15, 18], [1.85, 0.15, 18], [1.85, 1.3, 18], [0.15, 1.3, 18]], '#8b9094');
      for (let k = 0; k < 5; k++) P.box(0.3 + k * 0.34, 0.25, 0.42 + k * 0.34, 1.2, 18, 19.5, '#9fa5a8', { edge: false, ao: false });
      P.box(0.15, 1.25, 1.85, 1.3, 14, 18, '#e0a526', { edge: false, ao: false, noTop: true });
      for (let k = 0; k < 4; k++) {
        const x = 0.35 + k * 0.42;
        P.box(x - 0.07, 1.48, x + 0.07, 1.88, 0.6, 7, '#e0a526', { edge: false, ao: false });
        P.box(x - 0.07, 1.48, x + 0.07, 1.88, 3.8, 5.8, '#2e4b5c', { edge: false, ao: false, noTop: true });
      }
    },
  }),
  station: () => ({
    fw: 2, fd: 2, H: 50, draw(P) {
      lot(P, 2, 2, PAVE);
      // platforms along both axes
      P.box(0.05, 1.45, 1.95, 1.8, 0, 3, '#c8c1b1', { edge: false });
      P.line3([0.05, 1.8, 3.01], [1.95, 1.8, 3.01], '#e5c840', 0.8);
      P.box(1.45, 0.05, 1.8, 1.4, 0, 3, '#c8c1b1', { edge: false });
      // canopy over platform
      for (let k = 0; k < 4; k++) P.line3([0.25 + k * 0.48, 1.62, 3], [0.25 + k * 0.48, 1.62, 13], '#4a555c', 0.8);
      P.box(0.1, 1.48, 1.9, 1.78, 13, 14.5, '#3f5b6b', { edge: false });
      for (let k = 0; k < 4; k++) P.glowDot(0.25 + k * 0.48, 1.63, 12, 6, 'rgba(255,230,170,0.85)');
      // station hall with clock tower
      P.shadow(0.15, 0.15, 1.35, 1.35, 30);
      const hall = P.house(0.15, 0.15, 1.35, 1.35, 22, 10, '#c98a68', '#4d5761', 'y');
      P.windows(hall, 'L', { floors: 1, density: 3, base: 3, wf: 0.5, hf: 0.75, sill: true });
      P.windows(hall, 'R', { floors: 2, density: 3, base: 2, wf: 0.45, hf: 0.6 });
      P.door('L', 1.35, 0.6, 0.9, 12, '#3f4b52');
      const t = P.box(0.2, 1.05, 0.48, 1.33, 0, 42, '#c98a68');
      P.hipRoof(0.2, 1.05, 0.48, 1.33, 42, 6, '#5f8f7d');
      const [cx, cy] = P.pt(0.34, 1.33, 35); const c = P.c;
      c.fillStyle = '#f4efe2'; c.beginPath(); c.ellipse(cx, cy, 2.6 * P.s, 3 * P.s, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#333'; c.lineWidth = 0.4 * P.s; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy - 2 * P.s); c.moveTo(cx, cy); c.lineTo(cx + 1.5 * P.s, cy); c.stroke();
      void t;
    },
  }),
  freight: (rng) => ({
    fw: 3, fd: 3, H: 56, draw(P) {
      lot(P, 3, 3, '#9e978a');
      const cols = ['#c4473a', '#2e6e8e', '#3d8758', '#d6a034', '#8a8f94', '#7a4f8a'];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
        const x = 0.25 + k * 0.42, y = 1.55 + r * 0.42;
        const h = 1 + Math.floor(rng() * 3);
        for (let z = 0; z < h; z++) {
          const col = cols[Math.floor(rng() * cols.length)];
          P.box(x, y, x + 0.36, y + 0.18, z * 5, z * 5 + 5, col, { edge: false, ao: z === 0 });
        }
      }
      P.shadow(0.2, 0.2, 1.9, 1.2, 22);
      const wh = P.box(0.2, 0.2, 1.9, 1.2, 0, 20, '#a7a39b');
      for (let k = 0; k < 4; k++) P.door('L', 1.2, 0.28 + k * 0.4, 0.55 + k * 0.4, 12, '#4e5357');
      P.poly([[0.2, 0.2, 20], [1.9, 0.2, 20], [1.9, 1.2, 20], [0.2, 1.2, 20]], '#878d91');
      void wh;
      // gantry crane
      const yA = 1.45, yB = 2.85;
      for (const x of [2.15, 2.85]) { P.line3([x, yA, 0], [x, yA, 44], '#d9a62e', 1.4); P.line3([x, yB, 0], [x, yB, 44], '#d9a62e', 1.4); }
      P.box(2.1, yA - 0.04, 2.9, yA + 0.04, 42, 46, '#d9a62e', { edge: false, ao: false });
      P.box(2.1, yB - 0.04, 2.9, yB + 0.04, 42, 46, '#d9a62e', { edge: false, ao: false });
      P.box(2.4, yA, 2.6, yB, 44, 47, '#c99a26', { edge: false, ao: false });
      P.box(2.42, 2.0, 2.58, 2.2, 38, 44, '#4a4f54', { edge: false, ao: false });
      P.glowDot(2.5, 2.1, 46, 6, 'rgba(255,214,140,0.9)');
    },
  }),
  police: (rng) => ({
    fw: 2, fd: 2, H: 46, draw(P) {
      lot(P, 2, 2, ASPH);
      parkingLines(P, 0.1, 1.45, 1.9, 1.95, 'x', 6);
      P.shadow(0.15, 0.15, 1.6, 1.3, 26);
      const bx = P.box(0.15, 0.15, 1.6, 1.3, 0, 26, '#cfd2cf');
      P.windows(bx, 'L', { floors: 2, density: 4, base: 3, wf: 0.55, hf: 0.55 });
      P.windows(bx, 'R', { floors: 2, density: 4, base: 3, wf: 0.55, hf: 0.55 });
      P.box(0.15, 1.24, 1.6, 1.3, 18, 22, '#24477a', { edge: false, ao: false, noTop: true });
      P.box(0.15, 0.15, 1.6, 0.21, 18, 22, '#24477a', { edge: false, ao: false });
      parapet(P, 0.15, 0.15, 1.6, 1.3, 26, '#dadcd9');
      P.box(0.6, 0.5, 1.0, 0.9, 26, 34, '#cfd2cf');
      P.door('L', 1.3, 0.7, 1.0, 10, '#2f3f55');
      for (let k = 0; k < 3; k++) vehicle(P, 0.35 + k * 0.5, 1.7, 'y', '#f2f2ee', '#24477a');
      flag(P, 1.8, 0.3, 32, '#24477a');
      P.glowDot(0.35, 1.7, 7.5, 3, 'rgba(80,140,255,0.9)');
    },
  }),
  policehq: (rng) => ({
    fw: 3, fd: 3, H: 70, draw(P) {
      lot(P, 3, 3, PAVE);
      parkingLines(P, 0.1, 2.4, 2.9, 2.95, 'x', 9);
      P.shadow(0.2, 0.2, 2.6, 2.2, 50);
      const bx = P.box(0.2, 0.2, 2.6, 2.2, 0, 50, '#c9ccc8');
      P.windows(bx, 'L', { floors: 5, band: true, density: 4, base: 4, hf: 0.45, glass: '#3e5266' });
      P.windows(bx, 'R', { floors: 5, band: true, density: 4, base: 4, hf: 0.45, glass: '#3e5266' });
      P.box(0.2, 2.14, 2.6, 2.2, 44, 50, '#24477a', { edge: false, ao: false, noTop: true });
      parapet(P, 0.2, 0.2, 2.6, 2.2, 50, '#d5d7d4');
      P.groundEllipse(1.4, 1.2, 0.5, 0.5, '#4d5156', 50.1);
      P.groundEllipse(1.4, 1.2, 0.36, 0.36, '#e1d24f', 50.2);
      P.groundEllipse(1.4, 1.2, 0.3, 0.3, '#4d5156', 50.3);
      for (let k = 0; k < 4; k++) vehicle(P, 0.4 + k * 0.6, 2.65, 'y', '#f2f2ee', '#24477a');
      flag(P, 2.8, 0.4, 44, '#24477a');
    },
  }),
  fire: (rng) => ({
    fw: 2, fd: 2, H: 54, draw(P) {
      lot(P, 2, 2, PAVE);
      P.ground(0.2, 1.3, 1.5, 1.98, ASPH);
      P.shadow(0.15, 0.2, 1.5, 1.3, 22);
      const bx = P.box(0.15, 0.2, 1.5, 1.3, 0, 22, '#a8503f');
      for (let k = 0; k < 3; k++) P.door('L', 1.3, 0.24 + k * 0.42, 0.56 + k * 0.42, 13, '#e5e0d6');
      for (let k = 0; k < 3; k++) for (let j = 1; j < 4; j++) P.line3([0.24 + k * 0.42, 1.3, j * 3.2], [0.56 + k * 0.42, 1.3, j * 3.2], 'rgba(0,0,0,0.15)', 0.5);
      P.windows({ ...bx, z0: 13 }, 'L', { floors: 1, density: 5, wf: 0.5, hf: 0.5 });
      P.windows(bx, 'R', { floors: 2, density: 4, base: 2, wf: 0.5, hf: 0.5 });
      parapet(P, 0.15, 0.2, 1.5, 1.3, 22, '#b45c49');
      const t = P.box(1.5, 0.3, 1.85, 0.65, 0, 46, '#a8503f');
      P.windows(t, 'L', { floors: 4, cols: 1, base: 8, wf: 0.4, hf: 0.5 });
      P.hipRoof(1.5, 0.3, 1.85, 0.65, 46, 5, '#5a3a32');
      vehicle(P, 0.4, 1.65, 'y', '#c8342a', '#f2f2ee'); vehicle(P, 0.82, 1.7, 'y', '#c8342a', '#f2f2ee');
    },
  }),
  firehq: (rng) => ({
    fw: 3, fd: 3, H: 70, draw(P) {
      lot(P, 3, 3, PAVE);
      P.ground(0.2, 2.0, 2.4, 2.95, ASPH);
      P.shadow(0.15, 0.2, 2.4, 2.0, 30);
      const bx = P.box(0.15, 0.2, 2.4, 2.0, 0, 30, '#a24c3c');
      for (let k = 0; k < 5; k++) P.door('L', 2.0, 0.22 + k * 0.43, 0.56 + k * 0.43, 14, '#e5e0d6');
      P.windows({ ...bx, z0: 15 }, 'L', { floors: 1, density: 4, wf: 0.5, hf: 0.5 });
      P.windows(bx, 'R', { floors: 3, density: 4, base: 2, wf: 0.5, hf: 0.5 });
      parapet(P, 0.15, 0.2, 2.4, 2.0, 30, '#b45c49');
      const t = P.box(2.45, 0.3, 2.85, 0.7, 0, 62, '#a24c3c');
      P.windows(t, 'L', { floors: 5, cols: 1, base: 8, wf: 0.4, hf: 0.5 });
      P.hipRoof(2.45, 0.3, 2.85, 0.7, 62, 6, '#5a3a32');
      for (let k = 0; k < 4; k++) vehicle(P, 0.4 + k * 0.5, 2.5, 'y', '#c8342a', '#f2f2ee');
    },
  }),
  clinic: () => ({
    fw: 2, fd: 2, H: 40, draw(P) {
      lot(P, 2, 2, PAVE);
      P.ground(0.05, 1.45, 1.95, 1.95, LAWN);
      P.shadow(0.2, 0.2, 1.7, 1.35, 22);
      const bx = P.box(0.2, 0.2, 1.7, 1.35, 0, 22, '#eeece6');
      P.windows(bx, 'L', { floors: 2, band: true, density: 4, base: 2, hf: 0.45, glass: '#5b8aa0' });
      P.windows(bx, 'R', { floors: 2, band: true, density: 4, base: 2, hf: 0.45, glass: '#5b8aa0' });
      parapet(P, 0.2, 0.2, 1.7, 1.35, 22, '#f6f5f1');
      P.box(0.7, 1.35, 1.2, 1.55, 6, 7.5, '#d9d6cf', { edge: false });
      crossSign(P, 'L', 1.35, 1.45, 17, '#2f9e6b');
      vehicle(P, 1.55, 1.7, 'y', '#f4f2ea', '#2f9e6b');
      P.tree(0.3, 1.75, 4, 4, '#5e8f3d'); P.tree(0.75, 1.8, 3.6, 4, '#4f7f36');
    },
  }),
  hospital: () => ({
    fw: 3, fd: 3, H: 84, draw(P) {
      lot(P, 3, 3, PAVE);
      P.ground(0.05, 2.35, 2.95, 2.95, LAWN);
      P.shadow(0.2, 1.3, 2.8, 2.2, 22);
      const wing = P.box(0.2, 1.3, 2.8, 2.2, 0, 22, '#eceae4');
      P.windows(wing, 'L', { floors: 2, band: true, density: 4, base: 2, hf: 0.45, glass: '#5b8aa0' });
      P.windows(wing, 'R', { floors: 2, band: true, density: 4, base: 2, hf: 0.45, glass: '#5b8aa0' });
      parapet(P, 0.2, 1.3, 2.8, 2.2, 22, '#f6f5f1');
      P.shadow(0.5, 0.25, 2.1, 1.3, 64);
      const t = P.box(0.5, 0.25, 2.1, 1.3, 0, 64, '#f1efe9');
      P.windows(t, 'L', { floors: 7, density: 6, base: 3, wf: 0.6, hf: 0.55, glass: '#5b8aa0' });
      P.windows(t, 'R', { floors: 7, density: 6, base: 3, wf: 0.6, hf: 0.55, glass: '#5b8aa0' });
      parapet(P, 0.5, 0.25, 2.1, 1.3, 64, '#f6f5f1');
      P.groundEllipse(1.3, 0.78, 0.36, 0.36, '#3c8a62', 64.1);
      P.poly([[1.22, 0.62, 64.2], [1.38, 0.62, 64.2], [1.38, 0.94, 64.2], [1.22, 0.94, 64.2]], '#ffffff');
      P.poly([[1.14, 0.7, 64.2], [1.46, 0.7, 64.2], [1.46, 0.86, 64.2], [1.14, 0.86, 64.2]], '#ffffff');
      crossSign(P, 'L', 1.3, 1.8, 54, '#c8423b');
      vehicle(P, 2.3, 2.6, 'y', '#f4f2ea', '#c8423b'); vehicle(P, 2.65, 2.6, 'y', '#f4f2ea', '#c8423b');
    },
  }),
  school: () => ({
    fw: 2, fd: 2, H: 40, draw(P) {
      lot(P, 2, 2, LAWN);
      P.ground(1.1, 1.1, 1.92, 1.92, '#c69a66');
      P.line3([1.2, 1.5, 0], [1.82, 1.5, 0], 'rgba(255,255,255,0.7)', 0.6);
      P.shadow(0.15, 0.15, 1.85, 0.95, 24);
      const bx = P.house(0.15, 0.15, 1.85, 0.95, 18, 8, '#b5654b', '#4d5761', 'x');
      P.windows(bx, 'L', { floors: 2, density: 5, base: 1, wf: 0.55, hf: 0.6, sill: true });
      P.windows(bx, 'R', { floors: 2, density: 4, base: 1, wf: 0.55, hf: 0.6 });
      P.door('L', 0.95, 0.9, 1.1, 8, '#2f3f55');
      const w2 = P.house(0.15, 0.95, 0.85, 1.8, 14, 6, '#b5654b', '#4d5761', 'y');
      P.windows(w2, 'R', { floors: 1, density: 5, base: 2, wf: 0.55, hf: 0.6 });
      flag(P, 1.0, 1.25, 26, '#c8423b');
      P.tree(1.3, 1.25, 4, 4, '#5e8f3d');
    },
  }),
  library: () => ({
    fw: 2, fd: 2, H: 40, draw(P) {
      lot(P, 2, 2, PAVE);
      P.ground(0.05, 1.5, 1.95, 1.95, LAWN);
      P.shadow(0.2, 0.2, 1.8, 1.2, 24);
      P.box(0.15, 0.15, 1.85, 1.4, 0, 2.5, '#d7d1c3');
      const bx = P.box(0.25, 0.25, 1.75, 1.1, 2.5, 22, '#e3dccb');
      P.windows(bx, 'R', { floors: 2, density: 3, base: 2, wf: 0.4, hf: 0.65 });
      // colonnade on front
      for (let k = 0; k < 7; k++) P.cyl(0.32 + k * 0.23, 1.22, 0.035, 2.5, 20, '#efe9dc', { noTop: true });
      P.box(0.25, 1.1, 1.75, 1.3, 20, 23, '#e8e1d0');
      P.poly([[0.25, 1.3, 23], [1.75, 1.3, 23], [1.0, 1.3, 30]], '#ebe5d6');
      P.poly([[0.25, 0.25, 23], [1.75, 0.25, 23], [1.0, 0.25, 30], [1.0, 1.3, 30], [0.25, 1.3, 23]], null);
      P.gableRoof(0.25, 0.25, 1.75, 1.3, 23, 7, '#7f8a86', 'y');
      P.tree(0.3, 1.75, 4, 4, '#5e8f3d'); P.tree(1.7, 1.75, 4, 4, '#4f7f36');
    },
  }),
  highschool: () => ({
    fw: 3, fd: 3, H: 44, draw(P) {
      lot(P, 3, 3, LAWN);
      // running track
      P.groundEllipse(2.05, 2.05, 0.82, 0.82, '#b9573f');
      P.groundEllipse(2.05, 2.05, 0.62, 0.62, '#6f9d4a');
      P.line3([1.75, 2.05, 0], [2.35, 2.05, 0], 'rgba(255,255,255,0.8)', 0.5);
      P.shadow(0.15, 0.15, 2.8, 1.0, 28);
      const a = P.box(0.15, 0.15, 2.8, 1.0, 0, 28, '#c9b48f');
      P.windows(a, 'L', { floors: 3, density: 5, base: 2, wf: 0.6, hf: 0.55 });
      P.windows(a, 'R', { floors: 3, density: 4, base: 2, wf: 0.6, hf: 0.55 });
      parapet(P, 0.15, 0.15, 2.8, 1.0, 28, '#d6c39f');
      const b = P.box(0.15, 1.0, 1.0, 2.8, 0, 20, '#c9b48f');
      P.windows(b, 'R', { floors: 2, density: 5, base: 2, wf: 0.6, hf: 0.55 });
      P.windows(b, 'L', { floors: 2, density: 4, base: 2, wf: 0.6, hf: 0.55 });
      parapet(P, 0.15, 1.0, 1.0, 2.8, 20, '#d6c39f');
      P.box(0.15, 0.95, 2.8, 1.0, 22, 24, '#2e6e8e', { edge: false, ao: false, noTop: true });
      flag(P, 1.2, 1.2, 30, '#2e6e8e');
    },
  }),
  university: () => ({
    fw: 4, fd: 4, H: 84, draw(P) {
      lot(P, 4, 4, LAWN);
      P.ground(1.6, 0.2, 2.4, 3.8, PAVE); P.ground(0.2, 1.6, 3.8, 2.4, PAVE);
      const wall = '#b9765c', roof = '#4d5761';
      const halls = [[0.2, 0.2, 1.5, 1.4], [2.5, 0.2, 3.8, 1.4], [0.2, 2.6, 1.5, 3.8], [2.5, 2.6, 3.8, 3.8]];
      for (const [x0, y0, x1, y1] of halls) {
        const bx = P.house(x0, y0, x1, y1, 22, 9, wall, roof, 'x');
        P.windows(bx, 'L', { floors: 2, density: 5, base: 2, wf: 0.5, hf: 0.6, sill: true });
        P.windows(bx, 'R', { floors: 2, density: 5, base: 2, wf: 0.5, hf: 0.6 });
      }
      // clock tower
      P.shadow(1.75, 1.75, 2.25, 2.25, 70);
      const t = P.box(1.75, 1.75, 2.25, 2.25, 0, 62, '#c08068');
      P.windows(t, 'L', { floors: 5, cols: 1, base: 6, wf: 0.35, hf: 0.5 });
      P.windows(t, 'R', { floors: 5, cols: 1, base: 6, wf: 0.35, hf: 0.5 });
      P.hipRoof(1.75, 1.75, 2.25, 2.25, 62, 14, '#5f8f7d');
      const [cx, cy] = P.pt(2.0, 2.25, 54); const c = P.c;
      c.fillStyle = '#f4efe2'; c.beginPath(); c.ellipse(cx - 6 * P.s, cy - 2 * P.s, 3.2 * P.s, 3.8 * P.s, -0.5, 0, Math.PI * 2); c.fill();
      for (const [x, y] of [[0.6, 1.9], [3.4, 2.1], [1.9, 0.6], [2.1, 3.4], [1.2, 2.0], [2.9, 1.8]]) P.tree(x, y, 4.6, 5, '#5e8f3d');
    },
  }),
  park: (rng) => ({
    fw: 1, fd: 1, H: 30, draw(P) {
      lot(P, 1, 1, '#93b866', 0.02);
      P.poly([[0.0, 0.42], [1, 0.42], [1, 0.58], [0, 0.58]], '#d9cfb4');
      P.poly([[0.42, 0.58], [0.58, 0.58], [0.58, 1], [0.42, 1]], '#d9cfb4');
      P.box(0.62, 0.3, 0.84, 0.36, 2, 3, '#7a5236', { edge: false, ao: false });
      P.tree(0.24, 0.22, 5.2, 5, '#5e8f3d'); P.tree(0.78, 0.8, 4.6, 4, '#6a9844'); P.tree(0.22, 0.8, 3.8, 4, '#4f7f36');
      P.glowDot(0.5, 0.5, 8, 4);
      P.line3([0.5, 0.5, 0], [0.5, 0.5, 8], '#3f4448', 0.6);
    },
  }),
  playground: () => ({
    fw: 1, fd: 1, H: 26, draw(P) {
      lot(P, 1, 1, '#93b866', 0.02);
      P.ground(0.12, 0.12, 0.62, 0.62, '#d8c08a');
      // swings
      P.line3([0.2, 0.2, 0], [0.2, 0.2, 10], '#c64634', 0.8); P.line3([0.55, 0.2, 0], [0.55, 0.2, 10], '#c64634', 0.8);
      P.line3([0.2, 0.2, 10], [0.55, 0.2, 10], '#c64634', 0.8);
      P.line3([0.3, 0.2, 10], [0.3, 0.2, 3], '#444', 0.4); P.line3([0.45, 0.2, 10], [0.45, 0.2, 3], '#444', 0.4);
      // slide
      P.box(0.25, 0.45, 0.35, 0.55, 0, 8, '#2e6e8e', { edge: false });
      P.poly([[0.35, 0.45, 8], [0.62, 0.45, 1], [0.62, 0.55, 1], [0.35, 0.55, 8]], '#e0a526');
      P.tree(0.8, 0.25, 4.6, 4, '#5e8f3d'); P.tree(0.8, 0.8, 4, 4, '#6a9844');
    },
  }),
  plaza: () => ({
    fw: 2, fd: 2, H: 30, draw(P) {
      lot(P, 2, 2, '#d6cdb9', 0.02);
      for (let k = 1; k < 8; k++) { P.line3([k * 0.25, 0.05, 0], [k * 0.25, 1.95, 0], rgba('#9c917c', 0.4), 0.4); P.line3([0.05, k * 0.25, 0], [1.95, k * 0.25, 0], rgba('#9c917c', 0.4), 0.4); }
      P.cyl(1, 1, 0.42, 0, 3, '#bdb4a2', { top: '#4f9fbd' });
      P.groundEllipse(1, 1, 0.34, 0.34, '#5fb0cc', 3.05);
      P.cyl(1, 1, 0.08, 3, 9, '#cfc7b5');
      P.cyl(1, 1, 0.16, 9, 10, '#cfc7b5', { top: '#7ec4da' });
      for (const [x, y] of [[0.3, 0.3], [1.7, 0.3], [0.3, 1.7], [1.7, 1.7]]) { P.cyl(x, y, 0.13, 0, 2, '#9b917e'); P.tree(x, y, 5, 5, '#5e8f3d'); }
      for (const [x, y] of [[1, 0.25], [0.25, 1], [1.75, 1], [1, 1.75]]) P.glowDot(x, y, 8, 5);
    },
  }),
  pond: () => ({
    fw: 2, fd: 2, H: 30, draw(P) {
      lot(P, 2, 2, '#93b866', 0.02);
      P.groundEllipse(1, 1.05, 0.72, 0.55, '#d9cfb4');
      P.groundEllipse(1, 1.05, 0.62, 0.45, '#4c9bb3');
      P.groundEllipse(0.9, 0.95, 0.4, 0.25, '#62b0c4');
      for (const [x, y] of [[0.8, 1.2], [1.25, 0.9], [1.15, 1.25]]) P.groundEllipse(x, y, 0.06, 0.05, '#5b9a4a');
      P.tree(0.25, 0.3, 5.4, 5, '#5e8f3d'); P.tree(1.75, 0.3, 4.8, 5, '#6a9844'); P.tree(1.75, 1.75, 5, 5, '#4f7f36');
      P.tree(0.3, 1.75, 4.4, 4, '#7a9e47', 'conifer');
      P.box(1.4, 1.5, 1.9, 1.62, 0, 1.5, '#8a6a4a', { edge: false });
    },
  }),
  bigpark: () => ({
    fw: 3, fd: 3, H: 36, draw(P) {
      lot(P, 3, 3, '#93b866', 0.02);
      const c = P.c;
      const path = [[0, 1.5], [0.8, 1.3], [1.5, 1.5], [2.2, 1.8], [3, 1.6]];
      c.strokeStyle = '#d9cfb4'; c.lineWidth = 5 * P.s; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); path.forEach((p, k) => { const q = P.pt(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke();
      const p2 = [[1.5, 0], [1.4, 0.8], [1.5, 1.5], [1.7, 2.3], [1.5, 3]];
      c.beginPath(); p2.forEach((p, k) => { const q = P.pt(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke();
      P.groundEllipse(0.75, 2.2, 0.5, 0.35, '#4c9bb3');
      // pavilion
      P.cyl(1.5, 1.5, 0.25, 0, 1.5, '#e3dccb');
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P.line3([1.5 + Math.cos(a) * 0.2, 1.5 + Math.sin(a) * 0.2, 1.5], [1.5 + Math.cos(a) * 0.2, 1.5 + Math.sin(a) * 0.2, 10], '#efe9dc', 0.8); }
      P.hipRoof(1.3, 1.3, 1.7, 1.7, 10, 6, '#5f8f7d');
      const trees = [[0.3, 0.3], [0.9, 0.4], [0.4, 0.9], [2.2, 0.3], [2.7, 0.6], [2.5, 1.0], [2.6, 2.6], [2.2, 2.7], [0.3, 2.8], [1.1, 2.7], [2.8, 2.2], [0.9, 0.9]];
      trees.forEach(([x, y], k) => P.tree(x, y, 4.4 + (k % 3), 4 + (k % 2) * 2, ['#5e8f3d', '#6a9844', '#4f7f36', '#7a9e47'][k % 4], k % 5 === 0 ? 'conifer' : 'round'));
      for (const [x, y] of [[0.8, 1.3], [2.2, 1.8], [1.4, 0.8], [1.7, 2.3]]) P.glowDot(x, y, 8, 5);
    },
  }),
  sports: () => ({
    fw: 3, fd: 3, H: 40, draw(P) {
      lot(P, 3, 3, '#b9573f', 0.02);
      P.ground(0.3, 0.3, 2.7, 2.7, '#5f9a45');
      for (let k = 0; k < 6; k++) P.ground(0.3 + k * 0.4, 0.3, 0.5 + k * 0.4, 2.7, '#69a44d');
      const L = (a, b) => P.line3([a[0], a[1], 0], [b[0], b[1], 0], 'rgba(255,255,255,0.85)', 0.6);
      L([0.4, 0.4], [2.6, 0.4]); L([2.6, 0.4], [2.6, 2.6]); L([2.6, 2.6], [0.4, 2.6]); L([0.4, 2.6], [0.4, 0.4]);
      L([1.5, 0.4], [1.5, 2.6]);
      P.groundEllipse(1.5, 1.5, 0.3, 0.3, 'rgba(0,0,0,0)');
      const c = P.c; const pts = []; for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; pts.push(P.pt(1.5 + Math.cos(a) * 0.3, 1.5 + Math.sin(a) * 0.3)); }
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 0.6 * P.s; c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
      L([0.4, 1.1], [0.75, 1.1]); L([0.75, 1.1], [0.75, 1.9]); L([0.75, 1.9], [0.4, 1.9]);
      L([2.6, 1.1], [2.25, 1.1]); L([2.25, 1.1], [2.25, 1.9]); L([2.25, 1.9], [2.6, 1.9]);
      // stand
      for (let k = 0; k < 4; k++) P.box(0.5, 0.02 + k * 0.06, 2.5, 0.08 + k * 0.06, 0, 8 - k * 2, k % 2 ? '#d6d2c8' : '#2e6e8e', { edge: false, ao: false });
      for (const [x, y] of [[0.15, 0.15], [2.85, 2.85]]) { P.line3([x, y, 0], [x, y, 34], '#7d8287', 1); P.box(x - 0.08, y - 0.04, x + 0.08, y + 0.04, 32, 36, '#e5e2da', { edge: false, ao: false }); P.glowDot(x, y, 34, 10, 'rgba(255,250,230,0.95)'); }
    },
  }),
  cityhall: () => ({
    fw: 3, fd: 3, H: 86, draw(P) {
      lot(P, 3, 3, '#d6cdb9');
      P.ground(0.05, 2.3, 2.95, 2.95, '#93b866');
      P.shadow(0.3, 0.3, 2.7, 2.0, 40);
      P.box(0.25, 0.25, 2.75, 2.2, 0, 4, '#d9d2c2');
      const bx = P.box(0.35, 0.35, 2.65, 1.95, 4, 34, '#e9e2d1');
      P.windows(bx, 'L', { floors: 2, density: 4, base: 2, wf: 0.4, hf: 0.65, sill: true });
      P.windows(bx, 'R', { floors: 2, density: 4, base: 2, wf: 0.4, hf: 0.65, sill: true });
      for (let k = 0; k < 8; k++) P.cyl(1.0 + k * 0.14, 2.06, 0.035, 4, 30, '#f3eee2', { noTop: true });
      P.box(0.95, 1.95, 2.05, 2.15, 30, 34, '#ece6d6');
      P.poly([[0.95, 2.15, 34], [2.05, 2.15, 34], [1.5, 2.15, 42]], '#efe9da');
      parapet(P, 0.35, 0.35, 2.65, 1.95, 34, '#efe9da', '#a9a497');
      P.cyl(1.5, 1.15, 0.45, 34, 50, '#ece6d6', { noTop: true });
      for (let k = 0; k < 10; k++) { const a = Math.PI * 0.1 + k / 10 * Math.PI * 0.8; P.line3([1.5 + Math.cos(a) * 0.45, 1.15 + Math.sin(a) * 0.45, 36], [1.5 + Math.cos(a) * 0.45, 1.15 + Math.sin(a) * 0.45, 48], 'rgba(120,110,90,0.35)', 0.6); }
      P.dome(1.5, 1.15, 0.45, 50, '#6f9f8d', 0.9);
      P.line3([1.5, 1.15, 70], [1.5, 1.15, 82], '#4a4a48', 0.6);
      flag(P, 2.5, 2.5, 30, '#c8423b'); flag(P, 0.6, 2.5, 30, '#2e6e8e');
      P.glowDot(1.5, 2.2, 20, 14, 'rgba(255,214,150,0.6)');
    },
  }),
  museum: () => ({
    fw: 3, fd: 3, H: 60, draw(P) {
      lot(P, 3, 3, '#d4cfc4');
      P.ground(0.05, 2.4, 2.95, 2.95, '#93b866');
      P.shadow(0.25, 0.25, 2.5, 1.6, 30);
      const a = P.box(0.25, 0.25, 2.5, 1.6, 0, 30, '#ece9e2');
      P.windows(a, 'R', { floors: 1, density: 1.5, base: 4, wf: 0.3, hf: 0.7, glass: '#3c4c58' });
      P.box(0.25, 1.55, 2.5, 1.6, 0, 30, '#ece9e2', { noTop: true });
      P.poly([[0.25, 0.25, 30], [2.5, 0.25, 30], [2.5, 1.6, 30], [0.25, 1.6, 30]], '#cfccc4');
      // glass atrium wedge
      P.shadow(1.2, 1.4, 2.6, 2.3, 40);
      P.poly([[1.2, 2.3, 0], [2.6, 2.3, 0], [2.6, 2.3, 22], [1.2, 2.3, 44]], '#5d8aa0');
      P.poly([[2.6, 1.4, 0], [2.6, 2.3, 0], [2.6, 2.3, 22], [2.6, 1.4, 22]], '#3e6478');
      P.poly([[1.2, 1.4, 44], [2.6, 1.4, 22], [2.6, 2.3, 22], [1.2, 2.3, 44]], '#88b2c4');
      for (let k = 1; k < 7; k++) { const x = 1.2 + k * 0.2; P.line3([x, 2.3, 0], [x, 2.3, 44 - k * 22 / 7 * 1.0], rgba('#ffffff', 0.4), 0.5); }
      P.windows({ x0: 1.2, y0: 1.4, x1: 2.6, y1: 2.3, z0: 0, z1: 20 }, 'L', { floors: 2, density: 5, wf: 0.85, hf: 0.8, glass: null, lit: 0.9 });
      // sculpture
      P.box(0.5, 2.55, 0.62, 2.67, 0, 3, '#bab4a6', { edge: false });
      P.cyl(0.56, 2.61, 0.06, 3, 14, '#c76a3b');
    },
  }),
  stadium: () => ({
    fw: 4, fd: 4, H: 64, draw(P) {
      lot(P, 4, 4, ASPH);
      const c = P.c;
      const ring = (rx, ry, z, fill) => P.groundEllipse(2, 2, rx, ry, fill, z);
      // outer wall
      P.cyl(2, 2, 1.85, 0, 26, '#d8d4cb', { noTop: true });
      ring(1.85, 1.85, 26, '#e9e6df');
      ring(1.7, 1.7, 26.1, '#8f9599');
      for (let k = 0; k < 6; k++) ring(1.7 - k * 0.1, 1.7 - k * 0.1, 26 - k * 3.2, k % 2 ? '#2e6e8e' : '#c4473a');
      ring(1.0, 1.0, 8, '#5f9a45');
      ring(0.8, 0.55, 8.1, '#69a44d');
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; const x = 2 + Math.cos(a) * 1.75, y = 2 + Math.sin(a) * 1.75; P.line3([x, y, 26], [x, y, 56], '#7d8287', 1); P.box(x - 0.1, y - 0.05, x + 0.1, y + 0.05, 54, 60, '#efede6', { edge: false, ao: false }); P.glowDot(x, y, 57, 14, 'rgba(255,250,230,0.9)'); }
      void c;
    },
  }),
  spire: () => ({
    fw: 2, fd: 2, H: 290, meta: { beacon: [[1, 1, 286]] }, draw(P) {
      lot(P, 2, 2, '#d6cdb9');
      P.groundEllipse(1, 1, 0.9, 0.9, '#93b866');
      P.groundEllipse(1, 1, 0.55, 0.55, '#cfc6b2');
      P.shadow(0.7, 0.7, 1.3, 1.3, 120);
      const c = P.c; const s = P.s;
      const [sx, sy] = P.pt(1, 1, 0), [, ty] = P.pt(1, 1, 230);
      const gr = c.createLinearGradient(sx - 14 * s, 0, sx + 14 * s, 0);
      gr.addColorStop(0, '#d9dcdc'); gr.addColorStop(0.4, '#f7f6f1'); gr.addColorStop(1, '#9ea3a5');
      c.fillStyle = gr; c.beginPath(); c.moveTo(sx - 14 * s, sy); c.lineTo(sx - 4 * s, ty); c.lineTo(sx + 4 * s, ty); c.lineTo(sx + 14 * s, sy); c.fill();
      for (let z = 20; z < 230; z += 18) { const [, yz] = P.pt(1, 1, z); const w = 14 - (z / 230) * 10; c.fillStyle = 'rgba(80,90,100,0.18)'; c.fillRect(sx - w * s, yz, w * 2 * s, 1.2 * s); }
      P.cyl(1, 1, 0.42, 200, 214, '#3f6378', { top: '#d8dcdc' });
      P.cyl(1, 1, 0.36, 214, 220, '#e8e8e2');
      P.glowDot(1, 1, 206, 16, 'rgba(255,224,160,0.85)');
      P.line3([1, 1, 220], [1, 1, 284], '#8a8f92', 1.2);
    },
  }),
};

export function zoneArt(zt, tier, variant, facing) {
  const rng = mulberry32(variant * 7919 + tier * 104729 + zt * 13);
  if (zt === 1) return resTier(tier, rng, facing);
  if (zt === 2) return comTier(tier, rng, facing);
  return indTier(tier, rng, facing);
}

export function serviceArt(key, variant) {
  const rng = mulberry32(variant * 31 + 7);
  const f = SERVICES[key];
  return f ? f(rng) : null;
}

export const SERVICE_KEYS = Object.keys(SERVICES);
void mix;
