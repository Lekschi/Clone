// Terrain, roads, zones, trees and power poles.
import { HW, HH, shade, mix, rgba } from './art.js';
import { hash2 } from '../util/rng.js';

const GRASS_A = '#86a457', GRASS_B = '#9cb565', GRASS_C = '#749a4c';

// diamond with a hair of overlap to avoid seams
function diamond(P, fill, grow = 0.012) {
  P.poly([[-grow, -grow], [1 + grow, -grow], [1 + grow, 1 + grow], [-grow, 1 + grow]], fill);
}

export function grassTile(tint, tex) {
  return {
    fw: 1, fd: 1, H: 0, pad: 2,
    draw(P) {
      const base = mix(mix(GRASS_C, GRASS_B, tint / 3), GRASS_A, 0.62);
      diamond(P, base);
      const c = P.c; const r = (k) => hash2(tex * 97 + k, tint * 13 + k * 7, 5);
      // soft mottling
      for (let k = 0; k < 7; k++) {
        const x = 0.1 + r(k) * 0.8, y = 0.1 + r(k + 50) * 0.8;
        P.groundEllipse(x, y, 0.12 + r(k + 9) * 0.12, 0.08 + r(k + 19) * 0.1, rgba(r(k + 3) < 0.5 ? '#5f8a40' : '#b2c77a', 0.12));
      }
      // blades
      for (let k = 0; k < 26; k++) {
        const x = 0.05 + r(k + 100) * 0.9, y = 0.05 + r(k + 200) * 0.9;
        const [sx, sy] = P.pt(x, y, 0);
        c.strokeStyle = r(k + 300) < 0.5 ? rgba('#5d8640', 0.55) : rgba('#c3d48a', 0.45);
        c.lineWidth = 0.7 * P.s;
        c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (r(k + 400) - 0.5) * 2 * P.s, sy - 2.2 * P.s); c.stroke();
      }
    },
  };
}

export function decoTile(kind, v) {
  return {
    fw: 1, fd: 1, H: 6, pad: 2,
    draw(P) {
      const r = (k) => hash2(v * 31 + k, kind * 17, 9);
      if (kind === 1) { // rocks
        for (let k = 0; k < 3; k++) {
          const x = 0.25 + r(k) * 0.5, y = 0.25 + r(k + 5) * 0.5, s = 0.06 + r(k + 9) * 0.07;
          P.box(x - s, y - s * 0.8, x + s, y + s * 0.8, 0, 2 + r(k + 2) * 3, '#a39f94', { edge: false, ao: false, top: '#c4c0b4' });
        }
      } else { // wildflowers
        const cols = ['#f2e6a0', '#e9a3a3', '#f6f3ee', '#b9a6e0'];
        for (let k = 0; k < 14; k++) {
          const [sx, sy] = P.pt(0.15 + r(k) * 0.7, 0.15 + r(k + 30) * 0.7, 0);
          P.c.fillStyle = cols[Math.floor(r(k + 60) * cols.length)];
          P.c.beginPath(); P.c.arc(sx, sy - P.s, 0.9 * P.s, 0, Math.PI * 2); P.c.fill();
        }
      }
    },
  };
}

export function sandTile(v) {
  return {
    fw: 1, fd: 1, H: 0, pad: 2,
    draw(P) {
      diamond(P, mix('#ddd0a2', '#d3c38f', v / 3));
      const c = P.c;
      for (let k = 0; k < 30; k++) {
        const [sx, sy] = P.pt(0.05 + hash2(k, v, 3) * 0.9, 0.05 + hash2(k, v, 4) * 0.9, 0);
        c.fillStyle = hash2(k, v, 5) < 0.5 ? 'rgba(160,130,80,0.35)' : 'rgba(255,250,230,0.5)';
        c.fillRect(sx, sy, 0.8 * P.s, 0.8 * P.s);
      }
    },
  };
}

export function waterTile(depth) {
  return {
    fw: 1, fd: 1, H: 0, pad: 2,
    draw(P) {
      const col = ['#58a2ae', '#4893a8', '#3f88a1', '#387e99'][depth];
      diamond(P, col);
    },
  };
}

export function waterShimmer(frame, v) {
  return {
    fw: 1, fd: 1, H: 0, pad: 2,
    draw(P) {
      const c = P.c;
      c.strokeStyle = 'rgba(214,240,240,0.42)'; c.lineWidth = 0.7 * P.s; c.lineCap = 'round';
      for (let k = 0; k < 4; k++) {
        const ph = (frame / 4 + hash2(k, v, 21)) % 1;
        const x = 0.15 + hash2(k, v, 22) * 0.7, y = 0.15 + hash2(k, v, 23) * 0.7;
        const len = 0.08 + 0.12 * Math.sin(ph * Math.PI);
        if (len < 0.05) continue;
        const a = P.pt(x - len, y + len * 0.2, 0), b = P.pt(x + len, y - len * 0.2, 0);
        c.globalAlpha = Math.sin(ph * Math.PI);
        c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo((a[0] + b[0]) / 2, a[1] - 1.2 * P.s, b[0], b[1]); c.stroke();
      }
      c.globalAlpha = 1;
    },
  };
}

// foam on sides where land touches (mask bits: 1=-y,2=+x,4=+y,8=-x)
export function shoreFoam(mask) {
  return {
    fw: 1, fd: 1, H: 0, pad: 2,
    draw(P) {
      const c = P.c;
      const sides = [
        [[0, 0], [1, 0], 'y', 0], [[1, 0], [1, 1], 'x', 1], [[0, 1], [1, 1], 'y', 1], [[0, 0], [0, 1], 'x', 0],
      ];
      for (let k = 0; k < 4; k++) {
        if (!(mask & (1 << k))) continue;
        const [a, b, ax, at] = sides[k];
        for (let band = 0; band < 3; band++) {
          const off = 0.03 + band * 0.07;
          const d = at === 0 ? off : -off;
          const pa = ax === 'y' ? [a[0], a[1] + d] : [a[0] + d, a[1]];
          const pb = ax === 'y' ? [b[0], b[1] + d] : [b[0] + d, b[1]];
          const A = P.pt(pa[0], pa[1]), B = P.pt(pb[0], pb[1]);
          c.strokeStyle = `rgba(236,246,242,${0.55 - band * 0.17})`;
          c.lineWidth = (1.6 - band * 0.4) * P.s;
          c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.stroke();
        }
        // shallow tint
        const q = ax === 'y'
          ? (at === 0 ? [[0, 0], [1, 0], [1, 0.3], [0, 0.3]] : [[0, 0.7], [1, 0.7], [1, 1], [0, 1]])
          : (at === 0 ? [[0, 0], [0.3, 0], [0.3, 1], [0, 1]] : [[0.7, 0], [1, 0], [1, 1], [0.7, 1]]);
        P.poly(q, 'rgba(120,200,200,0.18)');
      }
    },
  };
}

// ---------- roads ----------
const ASPHALT = '#565a5f', CURB = '#bdb7aa', LANE = '#eadfba';

function roadShapes(mask) {
  // returns asphalt rects and sidewalk rects in tile coords
  const a = 0.22, b = 0.78, s0 = 0.1, s1 = 0.9;
  const asph = [[a, a, b, b]], side = [[s0, s0, s1, s1]];
  if (mask & 1) { asph.push([a, 0, b, a]); side.push([s0, 0, s1, s0]); }
  if (mask & 2) { asph.push([b, a, 1, b]); side.push([s1, s0, 1, s1]); }
  if (mask & 4) { asph.push([a, b, b, 1]); side.push([s0, s1, s1, 1]); }
  if (mask & 8) { asph.push([0, a, a, b]); side.push([0, s0, s0, s1]); }
  return { asph, side };
}

export function roadTile(mask, bridge) {
  return {
    fw: 1, fd: 1, H: bridge ? 4 : 10, pad: 4,
    draw(P) {
      const { asph, side } = roadShapes(mask);
      const z = bridge ? 2 : 0;
      const g = (r, col) => P.poly([[r[0], r[1], z], [r[2], r[1], z], [r[2], r[3], z], [r[0], r[3], z]], col);
      if (bridge) {
        // pillar and deck thickness
        P.box(0.4, 0.4, 0.6, 0.6, -10, z, '#a59f92', { edge: false, ao: false });
        for (const r of side) P.box(r[0], r[1], r[2], r[3], z - 2.5, z, '#b9b2a4', { edge: false, ao: false });
      }
      for (const r of side) g(r, bridge ? '#c9c2b4' : CURB);
      for (const r of asph) g(r, ASPHALT);
      // subtle asphalt grain
      const c = P.c;
      for (let k = 0; k < 18; k++) {
        const x = 0.25 + hash2(k, mask, 41) * 0.5, y = 0.25 + hash2(k, mask, 42) * 0.5;
        const [sx, sy] = P.pt(x, y, z);
        c.fillStyle = hash2(k, mask, 43) < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)';
        c.fillRect(sx, sy, 1.2 * P.s, 0.8 * P.s);
      }
      const cnt = [1, 2, 4, 8].filter((m) => mask & m).length;
      const dash = (x0, y0, x1, y1) => P.line3([x0, y0, z], [x1, y1, z], LANE, 0.9);
      const straightX = mask === 10, straightY = mask === 5;
      if (cnt <= 2) {
        // lane dashes along connected arms
        if (mask & 1) { dash(0.5, 0.04, 0.5, 0.18); dash(0.5, 0.32, 0.5, 0.42); }
        if (mask & 4) { dash(0.5, 0.58, 0.5, 0.68); dash(0.5, 0.82, 0.5, 0.96); }
        if (mask & 8) { dash(0.04, 0.5, 0.18, 0.5); dash(0.32, 0.5, 0.42, 0.5); }
        if (mask & 2) { dash(0.58, 0.5, 0.68, 0.5); dash(0.82, 0.5, 0.96, 0.5); }
        if (!straightX && !straightY && cnt === 2) { /* corner: no center mark */ }
      } else {
        // crosswalk zebra stripes on each arm
        const zebra = (axis, at) => {
          for (let k = 0; k < 5; k++) {
            const u = 0.27 + k * 0.105;
            if (axis === 'y') P.poly([[u, at, z], [u + 0.05, at, z], [u + 0.05, at + 0.08, z], [u, at + 0.08, z]], 'rgba(240,236,224,0.85)');
            else P.poly([[at, u, z], [at + 0.08, u, z], [at + 0.08, u + 0.05, z], [at, u + 0.05, z]], 'rgba(240,236,224,0.85)');
          }
        };
        if (mask & 1) zebra('y', 0.06); if (mask & 4) zebra('y', 0.86);
        if (mask & 8) zebra('x', 0.06); if (mask & 2) zebra('x', 0.86);
      }
      if (bridge) {
        // railings on sides without connection
        const rail = (a, b) => { P.line3([a[0], a[1], z + 3], [b[0], b[1], z + 3], '#8f8a80', 0.8); P.line3([a[0], a[1], z], [b[0], b[1], z], '#7d786f', 0.6); };
        if (!(mask & 1) || straightX) rail([0.1, 0.1], [0.9, 0.1]);
        if (!(mask & 4) || straightX) rail([0.1, 0.9], [0.9, 0.9]);
        if (!(mask & 8) || straightY) rail([0.1, 0.1], [0.1, 0.9]);
        if (!(mask & 2) || straightY) rail([0.9, 0.1], [0.9, 0.9]);
      } else if (cnt === 2 && (straightX || straightY)) {
        // a street lamp on the curb
        const [lx, ly] = straightX ? [0.5, 0.94] : [0.94, 0.5];
        P.line3([lx, ly, 0], [lx, ly, 9], '#4a4f55', 0.8);
        P.glowDot(lx, ly, 9.5, 5, 'rgba(255,214,140,0.9)');
        const [sx, sy] = P.pt(lx, ly, 9.5); P.c.fillStyle = '#e9e2c9'; P.c.fillRect(sx - 1 * P.s, sy - 0.6 * P.s, 2 * P.s, 1.2 * P.s);
      }
    },
  };
}

// ---------- zones ----------
export const ZONE_COLORS = { 1: '#4caf50', 2: '#3a86d4', 3: '#e0a526' };
export function zoneTile(zt, zd) {
  return {
    fw: 1, fd: 1, H: 0, pad: 2,
    draw(P) {
      const col = ZONE_COLORS[zt];
      P.poly([[0.04, 0.04], [0.96, 0.04], [0.96, 0.96], [0.04, 0.96]], rgba(col, 0.18 + zd * 0.06));
      const c = P.c;
      const ring = (m, lw, dashArr) => {
        const pts = [[m, m], [1 - m, m], [1 - m, 1 - m], [m, 1 - m]].map((p) => P.pt(p[0], p[1]));
        P.path(pts); c.setLineDash(dashArr.map((d) => d * P.s)); c.strokeStyle = rgba(shade(col, 0.8), 0.9);
        c.lineWidth = lw * P.s; c.stroke(); c.setLineDash([]);
      };
      ring(0.08, 1.1, [3, 2]);
      if (zd >= 2) ring(0.2, 0.8, [2, 2]);
      if (zd >= 3) ring(0.32, 0.8, [1.5, 1.5]);
      // survey stake
      const [sx, sy] = P.pt(0.5, 0.5);
      c.fillStyle = rgba(col, 0.9); c.beginPath(); c.arc(sx, sy, 1.4 * P.s, 0, Math.PI * 2); c.fill();
    },
  };
}

// ---------- trees ----------
const TREE_COLS = ['#4f7f36', '#5e8f3d', '#6a9844', '#47723a', '#7a9e47', '#3f6a3a'];
export function treeTile(density, v) {
  return {
    fw: 1, fd: 1, H: 34, pad: 6,
    draw(P) {
      const r = (k) => hash2(v * 7 + k, density * 3, 77);
      const n = density === 1 ? 1 + (r(0) < 0.5 ? 1 : 0) : density === 2 ? 3 : 5;
      const pts = [];
      for (let k = 0; k < n; k++) pts.push([0.18 + r(k + 1) * 0.64, 0.18 + r(k + 11) * 0.64, k]);
      pts.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
      for (const [x, y, k] of pts) {
        const conifer = r(k + 21) < 0.35;
        const col = TREE_COLS[Math.floor(r(k + 31) * TREE_COLS.length)];
        const size = 4 + r(k + 41) * 3.2;
        if (conifer) P.tree(x, y, size * 0.9, 4, shade(col, 0.85), 'conifer');
        else P.tree(x, y, size, 4 + r(k + 51) * 3, col);
      }
    },
  };
}

// ---------- power line poles ----------
export function poleTile(mask) {
  return {
    fw: 1, fd: 1, H: 30, pad: 6,
    draw(P) {
      const top = 22;
      // lattice pylon (small)
      const c = P.c;
      const legs = [[0.42, 0.42], [0.58, 0.42], [0.58, 0.58], [0.42, 0.58]];
      for (const [x, y] of legs) P.line3([x, y, 0], [0.5 + (x - 0.5) * 0.3, 0.5 + (y - 0.5) * 0.3, top], '#6f747a', 0.7);
      P.line3([0.5, 0.5, top], [0.5, 0.5, top + 4], '#6f747a', 0.8);
      // cross arms
      const arm = mask & 5 && !(mask & 10) ? 'x' : 'y';
      if (arm === 'x') P.line3([0.32, 0.5, top], [0.68, 0.5, top], '#5f646a', 0.9);
      else P.line3([0.5, 0.32, top], [0.5, 0.68, top], '#5f646a', 0.9);
      // wires to neighbor midpoints (sag)
      c.strokeStyle = 'rgba(40,40,44,0.75)'; c.lineWidth = 0.5 * P.s;
      const dirs = [[0.5, -0.5], [1.5, 0.5], [0.5, 1.5], [-0.5, 0.5]];
      for (let k = 0; k < 4; k++) {
        if (!(mask & (1 << k))) continue;
        const [tx, ty] = dirs[k];
        const mx = (0.5 + tx) / 2, my = (0.5 + ty) / 2;
        for (const off of [-0.14, 0.14]) {
          const ox = arm === 'x' ? off : 0, oy = arm === 'y' ? off : 0;
          const a = P.pt(0.5 + ox, 0.5 + oy, top), b = P.pt(mx + ox, my + oy, top - 1.5);
          const m = P.pt((0.5 + mx) / 2 + ox, (0.5 + my) / 2 + oy, top - 3);
          c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(m[0], m[1], b[0], b[1]); c.stroke();
        }
      }
    },
  };
}

export function rubbleTile(v) {
  return {
    fw: 1, fd: 1, H: 10, pad: 4,
    draw(P) {
      P.poly([[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]], '#8d8478');
      for (let k = 0; k < 14; k++) {
        const x = 0.15 + hash2(k, v, 61) * 0.7, y = 0.15 + hash2(k, v, 62) * 0.7, s = 0.04 + hash2(k, v, 63) * 0.07;
        P.box(x - s, y - s, x + s, y + s * 0.7, 0, 1 + hash2(k, v, 64) * 5, ['#9b938a', '#7a6f63', '#a6643f', '#5f5953'][k % 4], { edge: false, ao: false });
      }
    },
  };
}

export function constructionTile(size, tall, v) {
  return {
    fw: size, fd: size, H: tall ? 70 : 24, pad: 6,
    draw(P) {
      const S = size;
      P.poly([[0.04, 0.04], [S - 0.04, 0.04], [S - 0.04, S - 0.04], [0.04, S - 0.04]], '#b79f7d');
      // dirt mounds
      P.groundEllipse(S * 0.3, S * 0.7, 0.15 * S, 0.1 * S, '#9c845f');
      // foundation slab and scaffold
      const a = 0.18 * S, b = 0.82 * S;
      P.box(a, a, b, b, 0, 3, '#b8b4ac', { edge: false });
      const h = tall ? 34 : 14;
      const c = P.c;
      for (const [x, y] of [[a, a], [b, a], [b, b], [a, b], [(a + b) / 2, b], [b, (a + b) / 2]]) P.line3([x, y, 3], [x, y, 3 + h], '#c7a03c', 0.8);
      for (let z = 3 + h / 3; z <= 3 + h; z += h / 3) {
        P.line3([a, b, z], [b, b, z], '#c7a03c', 0.7); P.line3([b, a, z], [b, b, z], '#c7a03c', 0.7);
      }
      // fence
      P.line3([0.06, S - 0.06, 3], [S - 0.06, S - 0.06, 3], '#e3e0d6', 1);
      P.line3([S - 0.06, 0.06, 3], [S - 0.06, S - 0.06, 3], '#e3e0d6', 1);
      if (tall) {
        const cx = a + 0.1, cy = a + 0.1, top = 66;
        P.line3([cx, cy, 0], [cx, cy, top], '#d9a62e', 1.6);
        P.line3([cx - 0.2, cy, top], [cx + 0.9 * S * 0.6, cy, top], '#d9a62e', 1.2);
        P.line3([cx + 0.6 * S * 0.6, cy, top], [cx + 0.6 * S * 0.6, cy, top - 18], 'rgba(40,40,40,0.7)', 0.4);
        P.box(cx - 0.3, cy - 0.06, cx - 0.12, cy + 0.06, top - 3, top + 1, '#7d7d7d', { edge: false, ao: false });
        P.glowDot(cx, cy, top + 3, 3, 'rgba(255,60,40,0.9)');
      }
      void c; void v;
    },
  };
}

// ---------- highways ----------
export function highwayTile(mask, hmask, bridge) {
  return {
    fw: 1, fd: 1, H: bridge ? 4 : 8, pad: 4,
    draw(P) {
      const z = bridge ? 2 : 0;
      const a = 0.06, b = 0.94;
      const rects = [[a, a, b, b]];
      if (mask & 1) rects.push([a, 0, b, a]); if (mask & 2) rects.push([b, a, 1, b]);
      if (mask & 4) rects.push([a, b, b, 1]); if (mask & 8) rects.push([0, a, a, b]);
      if (bridge) {
        P.box(0.35, 0.35, 0.65, 0.65, -10, z, '#a59f92', { edge: false, ao: false });
        P.box(0, 0, 1, 1, z - 3, z, '#b3ad9f', { edge: false, ao: false });
      }
      for (const r of rects) P.poly([[r[0], r[1], z], [r[2], r[1], z], [r[2], r[3], z], [r[0], r[3], z]], '#4f5257');
      const c = P.c;
      for (let k = 0; k < 22; k++) {
        const [sx, sy] = P.pt(0.1 + hash2(k, mask, 71) * 0.8, 0.1 + hash2(k, mask, 72) * 0.8, z);
        c.fillStyle = hash2(k, mask, 73) < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
        c.fillRect(sx, sy, 1.2 * P.s, 0.8 * P.s);
      }
      const alongX = (hmask & 10) && !(hmask & 5), alongY = (hmask & 5) && !(hmask & 10);
      const lane = (pts) => P.line3(pts[0], pts[1], 'rgba(240,240,232,0.85)', 0.7);
      if (alongX) {
        P.box(0, 0.47, 1, 0.53, z, z + 2.4, '#c9c4b8', { edge: false, ao: false });
        for (const y of [0.27, 0.73]) { lane([[0.05, y, z], [0.3, y, z]]); lane([[0.55, y, z], [0.8, y, z]]); }
        P.line3([0, 0.08, z], [1, 0.08, z], '#e9e2c6', 0.6); P.line3([0, 0.92, z], [1, 0.92, z], '#e9e2c6', 0.6);
        P.box(0, 0.94, 1, 0.97, z, z + 2, '#b7b2a7', { edge: false, ao: false });
      } else if (alongY) {
        P.box(0.47, 0, 0.53, 1, z, z + 2.4, '#c9c4b8', { edge: false, ao: false });
        for (const x of [0.27, 0.73]) { lane([[x, 0.05, z], [x, 0.3, z]]); lane([[x, 0.55, z], [x, 0.8, z]]); }
        P.line3([0.08, 0, z], [0.08, 1, z], '#e9e2c6', 0.6); P.line3([0.92, 0, z], [0.92, 1, z], '#e9e2c6', 0.6);
        P.box(0.94, 0, 0.97, 1, z, z + 2, '#b7b2a7', { edge: false, ao: false });
      } else {
        // interchange / junction: arrows and stop bars
        for (const [k, at] of [[1, [0.5, 0.12]], [4, [0.5, 0.88]], [8, [0.12, 0.5]], [2, [0.88, 0.5]]]) if (mask & k) P.groundEllipse(at[0], at[1], 0.05, 0.05, 'rgba(240,240,232,0.7)', z);
      }
      if (!bridge && (alongX || alongY)) {
        const [lx, ly] = alongX ? [0.5, 0.5] : [0.5, 0.5];
        P.line3([lx, ly, z + 2], [lx, ly, z + 12], '#5a5f64', 0.8);
        P.glowDot(lx + (alongY ? 0.15 : 0), ly + (alongX ? 0.15 : 0), z + 12, 7, 'rgba(255,214,140,0.9)');
        P.glowDot(lx - (alongY ? 0.15 : 0), ly - (alongX ? 0.15 : 0), z + 12, 7, 'rgba(255,214,140,0.9)');
      }
    },
  };
}

// ---------- railway ----------
function bez(a, c, b, t) { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; }
function trackPaths(mask) {
  const mid = [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]];
  const arms = [0, 1, 2, 3].filter((k) => mask & (1 << k));
  const paths = [];
  if (arms.length === 0) paths.push([[0.5, 0.2], [0.5, 0.8]]);
  else if (arms.length === 1) { const e = mid[arms[0]]; paths.push([e, [0.5, 0.5], [1 - e[0], 1 - e[1]].map((v) => 0.5 + (v - 0.5) * 0.5)]); }
  else if (arms.length === 2 && (arms[1] - arms[0]) === 2) paths.push([mid[arms[0]], mid[arms[1]]]);
  else if (arms.length === 2) {
    const A = mid[arms[0]], B = mid[arms[1]], pts = [];
    for (let k = 0; k <= 12; k++) pts.push(bez(A, [0.5, 0.5], B, k / 12));
    paths.push(pts);
  } else {
    // junction: straight through on the main axis plus curved branches
    if ((mask & 5) === 5) paths.push([mid[0], mid[2]]);
    if ((mask & 10) === 10) paths.push([mid[3], mid[1]]);
    for (const k of arms) if (!paths.some((p) => p.includes(mid[k]))) paths.push([mid[k], [0.5, 0.5]]);
  }
  return paths;
}
function resample(path) {
  // densify a polyline so offsets follow curves
  const out = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.08));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  out.push(path[path.length - 1]);
  return out;
}
export function railTile(mask, mode) {
  // mode: 0 = ground, 1 = bridge, 2 = level crossing on a road
  return {
    fw: 1, fd: 1, H: mode === 1 ? 6 : 4, pad: 4,
    draw(P) {
      const z = mode === 1 ? 2 : 0;
      const c = P.c;
      if (mode === 1) {
        P.box(0.38, 0.38, 0.62, 0.62, -10, z, '#a59f92', { edge: false, ao: false });
        const sides = mask & 5 && !(mask & 10) ? [0.25, 0, 0.75, 1] : mask & 10 && !(mask & 5) ? [0, 0.25, 1, 0.75] : [0.2, 0.2, 0.8, 0.8];
        P.box(sides[0], sides[1], sides[2], sides[3], z - 3, z, '#a79f90', { edge: false, ao: false });
      }
      const paths = trackPaths(mask).map(resample);
      const stroke = (pts, off, col, w) => {
        c.strokeStyle = col; c.lineWidth = w * P.s; c.lineJoin = 'round'; c.lineCap = 'butt';
        c.beginPath();
        pts.forEach((p, k) => {
          const q = pts[Math.min(pts.length - 1, k + 1)], r = pts[Math.max(0, k - 1)];
          let tx = q[0] - r[0], ty = q[1] - r[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
          const s = P.pt(p[0] - ty * off, p[1] + tx * off, z);
          k ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]);
        });
        c.stroke();
      };
      for (const pts of paths) if (mode !== 2) stroke(pts, 0, '#9a9183', 15);
      for (const pts of paths) {
        if (mode !== 2) {
          // sleepers
          for (let k = 0; k < pts.length; k += 1) {
            const p = pts[k], q = pts[Math.min(pts.length - 1, k + 1)], r = pts[Math.max(0, k - 1)];
            let tx = q[0] - r[0], ty = q[1] - r[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
            const a = P.pt(p[0] - ty * 0.17, p[1] + tx * 0.17, z), b = P.pt(p[0] + ty * 0.17, p[1] - tx * 0.17, z);
            c.strokeStyle = '#6a5442'; c.lineWidth = 1.6 * P.s; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
          }
        } else {
          stroke(pts, 0, 'rgba(40,40,42,0.55)', 9);
        }
        stroke(pts, 0.1, '#5b5d60', 1.4); stroke(pts, -0.1, '#5b5d60', 1.4);
        stroke(pts, 0.1, '#d3d6d9', 0.6); stroke(pts, -0.1, '#d3d6d9', 0.6);
      }
      if (mode === 2) {
        // crossing barriers
        for (const [x, y] of [[0.12, 0.12], [0.88, 0.88]]) { P.line3([x, y, 0], [x, y, 7], '#3d4044', 0.7); P.glowDot(x, y, 7, 3, 'rgba(255,70,50,0.9)'); }
      }
    },
  };
}

export function trainCar(axis, kind, col) {
  return {
    fw: 1, fd: 1, H: 12, pad: 3,
    draw(P) {
      const L = 0.42, W = 0.17;
      const [x0, x1, y0, y1] = axis === 'x' ? [0.5 - L / 2, 0.5 + L / 2, 0.5 - W / 2, 0.5 + W / 2] : [0.5 - W / 2, 0.5 + W / 2, 0.5 - L / 2, 0.5 + L / 2];
      P.box(x0, y0, x1, y1, 1.2, 2.4, '#2c2e31', { edge: false, ao: false });
      if (kind === 'loco') {
        P.box(x0, y0, x1, y1, 2.4, 8.5, col, { edge: false, ao: false });
        P.box(x0, y0, x1, y1, 5.6, 6.6, '#f2ede2', { edge: false, ao: false, noTop: true });
        const nose = 0.08;
        if (axis === 'x') P.box(x1 - nose, y0 + 0.02, x1, y1 - 0.02, 6.6, 8.2, '#2f4655', { edge: false, ao: false });
        else P.box(x0 + 0.02, y1 - nose, x1 - 0.02, y1, 6.6, 8.2, '#2f4655', { edge: false, ao: false });
      } else if (kind === 'pax') {
        P.box(x0, y0, x1, y1, 2.4, 8, '#d9dcdd', { edge: false, ao: false });
        P.box(x0, y0, x1, y1, 5, 6.6, '#34536a', { edge: false, ao: false, noTop: true });
        P.box(x0, y0, x1, y1, 2.4, 3.4, col, { edge: false, ao: false, noTop: true });
        P.glowDot((x0 + x1) / 2, y1, 5.8, 3, 'rgba(255,220,150,0.8)');
      } else {
        P.box(x0, y0, x1, y1, 2.4, 7.5, col, { edge: false, ao: false });
        for (let k = 1; k < 4; k++) { const u = k / 4; if (axis === 'x') P.line3([x0 + (x1 - x0) * u, y1, 2.6], [x0 + (x1 - x0) * u, y1, 7.3], 'rgba(0,0,0,0.2)', 0.5); else P.line3([x1, y0 + (y1 - y0) * u, 2.6], [x1, y0 + (y1 - y0) * u, 7.3], 'rgba(0,0,0,0.2)', 0.5); }
      }
    },
  };
}

export function busSprite(axis) {
  return {
    fw: 1, fd: 1, H: 10, pad: 3,
    draw(P) {
      const L = 0.36, W = 0.14;
      const [x0, x1, y0, y1] = axis === 'x' ? [0.5 - L / 2, 0.5 + L / 2, 0.5 - W / 2, 0.5 + W / 2] : [0.5 - W / 2, 0.5 + W / 2, 0.5 - L / 2, 0.5 + L / 2];
      P.box(x0, y0, x1, y1, 0.6, 7, '#e0a526', { edge: false, ao: false });
      P.box(x0, y0, x1, y1, 3.8, 5.8, '#2e4b5c', { edge: false, ao: false, noTop: true });
      P.poly([[x0, y0, 7.01], [x1, y0, 7.01], [x1, y1, 7.01], [x0, y1, 7.01]], '#f0eee6');
    },
  };
}
