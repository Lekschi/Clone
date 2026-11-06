// Isometric painting primitives. All sprites are drawn from 3D-ish geometry
// (boxes, prisms, cylinders) with consistent lighting so the world reads as one place.

export const HW = 32, HH = 16; // half tile width/height in world px
export const SCALE = 2;          // sprite raster scale (retina)

// ---------- color ----------
const cache = new Map();
export function rgb(hex) {
  let v = cache.get(hex);
  if (v) return v;
  const h = hex.replace('#', '');
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  cache.set(hex, v);
  return v;
}
export function shade(hex, f) {
  const [r, g, b] = rgb(hex);
  const h2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  if (f >= 1) {
    const t = f - 1;
    return '#' + h2(r + (255 - r) * t) + h2(g + (255 - g) * t) + h2(b + (255 - b) * t);
  }
  return '#' + h2(r * f) + h2(g * f) + h2(b * f);
}
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  const c = (i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return '#' + c(0) + c(1) + c(2);
}
export function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }

export const LIGHT = { top: 1.06, left: 0.9, right: 0.7 };

function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop();
  return lo.concat(up);
}

// ---------- painter ----------
export class Painter {
  constructor(ctx, ox, oy, s, glow, rng) {
    this.c = ctx; this.ox = ox; this.oy = oy; this.s = s; this.g = glow; this.rng = rng || Math.random;
    this.lit = 0.55; // probability a window is lit at night
    this.glowColor = '#ffcf7a';
  }
  pt(x, y, z = 0) { return [this.ox + (x - y) * HW * this.s, this.oy + ((x + y) * HH - z) * this.s]; }

  path(pts, ctx = this.c) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.closePath();
  }
  poly(p3, fill, stroke, lw = 0.6, ctx = this.c) {
    const pts = p3.map((p) => this.pt(p[0], p[1], p[2] || 0));
    this.path(pts, ctx);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw * this.s; ctx.stroke(); }
    return pts;
  }
  ground(x0, y0, x1, y1, fill, stroke) { return this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], fill, stroke); }

  shadow(x0, y0, x1, y1, h, alpha = 0.22) {
    const L = Math.min(1.7, h * 0.016), dy = -L * 0.25;
    const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0 + L, y0 + dy], [x1 + L, y0 + dy], [x1 + L, y1 + dy], [x0 + L, y1 + dy]]
      .map((p) => this.pt(p[0], p[1], 0));
    this.path(hull(pts));
    this.c.fillStyle = `rgba(28,36,30,${alpha})`;
    this.c.fill();
  }

  // Axis-aligned box. col = base wall color, opt.top/left/right override; opt.roof = top color
  box(x0, y0, x1, y1, z0, z1, col, opt = {}) {
    const top = opt.top || shade(col, LIGHT.top);
    const left = opt.left || shade(col, LIGHT.left);
    const right = opt.right || shade(col, LIGHT.right);
    const c = this.c;
    // left face (y = y1)
    this.poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], left);
    // right face (x = x1)
    this.poly([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], right);
    if (opt.ao !== false && z0 === 0 && z1 - z0 > 4) this.ao(x0, y0, x1, y1, z0, Math.min(10, (z1 - z0) * 0.4));
    if (!opt.noTop) this.poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top);
    if (opt.edge !== false) {
      // crisp highlight on the near vertical edge + top edges
      c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 0.6 * this.s;
      const a = this.pt(x1, y1, z0), b = this.pt(x1, y1, z1);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      if (!opt.noTop) {
        const p1 = this.pt(x0, y1, z1), p2 = this.pt(x1, y1, z1), p3 = this.pt(x1, y0, z1);
        c.strokeStyle = 'rgba(255,255,255,0.28)';
        c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.stroke();
      }
    }
    return { x0, y0, x1, y1, z0, z1 };
  }

  ao(x0, y0, x1, y1, z0, h) {
    const c = this.c;
    for (const f of ['L', 'R']) {
      const q = f === 'L' ? [[x0, y1, z0], [x1, y1, z0], [x1, y1, z0 + h], [x0, y1, z0 + h]]
        : [[x1, y0, z0], [x1, y1, z0], [x1, y1, z0 + h], [x1, y0, z0 + h]];
      const pts = q.map((p) => this.pt(...p));
      const gy0 = pts[0][1], gy1 = pts[3][1];
      const gr = c.createLinearGradient(0, gy0, 0, gy1);
      gr.addColorStop(0, 'rgba(20,24,28,0.28)'); gr.addColorStop(1, 'rgba(20,24,28,0)');
      this.path(pts); c.fillStyle = gr; c.fill();
    }
  }

  // quad on a face. face 'L' (y=const plane, u along x) or 'R' (x=const plane, u along y)
  fq(face, k, u0, u1, z0, z1) {
    return face === 'L' ? [[u0, k, z0], [u1, k, z0], [u1, k, z1], [u0, k, z1]] : [[k, u0, z0], [k, u1, z0], [k, u1, z1], [k, u0, z1]];
  }

  // Windows on a box face.
  windows(bx, face, opt = {}) {
    const { x0, y0, x1, y1, z0, z1 } = bx;
    const floors = opt.floors || Math.max(1, Math.floor((z1 - z0 - (opt.base || 0)) / (opt.fh || 9)));
    const fh = (z1 - z0 - (opt.base || 0) - (opt.topPad || 2)) / floors;
    const k = face === 'L' ? y1 + 0.001 : x1 + 0.001;
    const a = face === 'L' ? x0 : y0, b = face === 'L' ? x1 : y1;
    const len = b - a;
    const cols = opt.cols || Math.max(1, Math.round(len * (opt.density || 4)));
    const cw = len / cols;
    const wf = opt.wf ?? 0.55, hf = opt.hf ?? 0.55;
    const glass = 'glass' in opt ? opt.glass : '#3d4e5c';
    const frameDark = face === 'L' ? 0.95 : 0.8;
    const lit = opt.lit ?? this.lit;
    for (let f = 0; f < floors; f++) {
      const zb = z0 + (opt.base || 0) + f * fh + fh * (1 - hf) * 0.5;
      const zt = zb + fh * hf;
      if (opt.band) {
        const q = this.fq(face, k, a + cw * 0.08, b - cw * 0.08, zb, zt);
        if (glass) { this.poly(q, shade(glass, frameDark)); this.glassSheen(q, face); }
        // night: band split into segments
        for (let cI = 0; cI < cols; cI++) if (this.rng() < lit) {
          this.poly(this.fq(face, k, a + cI * cw + cw * 0.04, a + (cI + 1) * cw - cw * 0.04, zb, zt), opt.glowCol || this.glowColor, null, 0, this.g);
        }
        continue;
      }
      for (let cI = 0; cI < cols; cI++) {
        if (opt.skip && opt.skip(f, cI)) continue;
        const u0 = a + cI * cw + cw * (1 - wf) / 2, u1 = u0 + cw * wf;
        const q = this.fq(face, k, u0, u1, zb, zt);
        if (glass) this.poly(q, shade(glass, frameDark));
        if (opt.sill) this.poly(this.fq(face, k, u0 - cw * 0.04, u1 + cw * 0.04, zb - 0.8, zb), 'rgba(255,255,255,0.35)');
        if (this.rng() < lit) this.poly(q, opt.glowCol || (this.rng() < 0.2 ? '#ffe7b0' : this.glowColor), null, 0, this.g);
      }
    }
  }

  glassSheen(q, face) {
    const pts = q.map((p) => this.pt(...p));
    const c = this.c;
    const gr = c.createLinearGradient(pts[0][0], pts[3][1], pts[1][0], pts[0][1]);
    gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.02)'); gr.addColorStop(1, 'rgba(255,255,255,0.12)');
    this.path(pts); c.fillStyle = gr; c.fill();
  }

  // Door on face
  door(face, k, u0, u1, h, col = '#5a4636') {
    this.poly(this.fq(face, k + 0.001, u0, u1, 0, h), shade(col, face === 'L' ? 1 : 0.8));
  }

  // House body + gable roof as one: walls with triangular gable ends.
  house(x0, y0, x1, y1, h, rh, wall, roof, axis = 'x') {
    this.shadow(x0, y0, x1, y1, h + rh * 0.6);
    const bx = this.box(x0, y0, x1, y1, 0, h, wall, { noTop: true });
    if (axis === 'x') {
      const ym = (y0 + y1) / 2;
      // gable end on right (x = x1)
      this.poly([[x1, y0, h], [x1, y1, h], [x1, ym, h + rh]], shade(wall, LIGHT.right));
      this.gableRoof(x0, y0, x1, y1, h, rh, roof, 'x');
    } else {
      const xm = (x0 + x1) / 2;
      this.poly([[x0, y1, h], [x1, y1, h], [xm, y1, h + rh]], shade(wall, LIGHT.left));
      this.gableRoof(x0, y0, x1, y1, h, rh, roof, 'y');
    }
    return bx;
  }

  gableRoof(x0, y0, x1, y1, z, rh, col, axis) {
    const o = 0.05;
    if (axis === 'x') {
      const ym = (y0 + y1) / 2;
      this.poly([[x0 - o, y0 - o, z - 1], [x1 + o, y0 - o, z - 1], [x1 + o, ym, z + rh], [x0 - o, ym, z + rh]], shade(col, 0.82));
      const f = this.poly([[x0 - o, ym, z + rh], [x1 + o, ym, z + rh], [x1 + o, y1 + o, z - 1], [x0 - o, y1 + o, z - 1]], shade(col, 1.0));
      this.roofLines(x0 - o, ym, x1 + o, y1 + o, z + rh, z - 1, col, 'x');
      // ridge highlight
      this.poly([[x0 - o, ym, z + rh], [x1 + o, ym, z + rh]], null, 'rgba(255,255,255,0.35)', 0.6);
      // eave edge at right
      this.poly([[x1 + o, y0 - o, z - 1], [x1 + o, ym, z + rh], [x1 + o, y1 + o, z - 1]], null, shade(col, 0.6), 0.7);
    } else {
      const xm = (x0 + x1) / 2;
      this.poly([[x0 - o, y0 - o, z - 1], [xm, y0 - o, z + rh], [xm, y1 + o, z + rh], [x0 - o, y1 + o, z - 1]], shade(col, 0.95));
      this.poly([[xm, y0 - o, z + rh], [x1 + o, y0 - o, z - 1], [x1 + o, y1 + o, z - 1], [xm, y1 + o, z + rh]], shade(col, 0.74));
      this.roofLines(xm, y0 - o, x1 + o, y1 + o, z + rh, z - 1, col, 'y');
      this.poly([[xm, y0 - o, z + rh], [xm, y1 + o, z + rh]], null, 'rgba(255,255,255,0.3)', 0.6);
      this.poly([[x0 - o, y1 + o, z - 1], [xm, y1 + o, z + rh], [x1 + o, y1 + o, z - 1]], null, shade(col, 0.6), 0.7);
    }
  }

  roofLines(a0, b0, a1, b1, zTop, zBot, col, axis) {
    // tile courses on the visible slope
    const n = 4; const c = this.c;
    c.strokeStyle = rgba('#000000', 0.12); c.lineWidth = 0.5 * this.s;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (axis === 'x') {
        const y = b0 + (b1 - b0) * t, z = zTop + (zBot - zTop) * t;
        const p = this.pt(a0, y, z), q = this.pt(a1, y, z);
        c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
      } else {
        const x = a0 + (a1 - a0) * t, z = zTop + (zBot - zTop) * t;
        const p = this.pt(x, b0, z), q = this.pt(x, b1, z);
        c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
      }
    }
  }

  hipRoof(x0, y0, x1, y1, z, rh, col) {
    const o = 0.05; x0 -= o; y0 -= o; x1 += o; y1 += o;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const ix = Math.max(0, (x1 - x0) - (y1 - y0)) / 2, iy = Math.max(0, (y1 - y0) - (x1 - x0)) / 2;
    const r0 = [cx - ix, cy - iy, z + rh], r1 = [cx + ix, cy + iy, z + rh];
    // back faces
    this.poly([[x0, y0, z], [x1, y0, z], [r1[0], r0[1], z + rh], [r0[0], r0[1], z + rh]], shade(col, 0.85));
    this.poly([[x0, y0, z], [r0[0], r0[1], z + rh], [r0[0], r1[1], z + rh], [x0, y1, z]], shade(col, 0.92));
    // front faces
    this.poly([[x1, y0, z], [x1, y1, z], [r1[0], r1[1], z + rh], [r1[0], r0[1], z + rh]], shade(col, 0.74));
    this.poly([[x0, y1, z], [r0[0], r1[1], z + rh], [r1[0], r1[1], z + rh], [x1, y1, z]], shade(col, 1.02));
    this.poly([[x1, y1, z], [r1[0], r1[1], z + rh]], null, 'rgba(255,255,255,0.25)', 0.6);
  }

  // vertical cylinder centered at (cx, cy) with radius r (tile units)
  cyl(cx, cy, r, z0, z1, col, opt = {}) {
    const c = this.c; const s = this.s;
    const [sx, sy0] = this.pt(cx, cy, z0); const [, sy1] = this.pt(cx, cy, z1);
    const rx = r * Math.SQRT2 * HW * s, ry = r * Math.SQRT2 * HH * s;
    const gr = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
    gr.addColorStop(0, shade(col, 0.82)); gr.addColorStop(0.35, shade(col, 1.04)); gr.addColorStop(1, shade(col, 0.6));
    c.beginPath();
    c.moveTo(sx - rx, sy1); c.lineTo(sx - rx, sy0);
    c.ellipse(sx, sy0, rx, ry, 0, Math.PI, 0, true);
    c.lineTo(sx + rx, sy1);
    c.ellipse(sx, sy1, rx, ry, 0, 0, Math.PI, true);
    c.closePath(); c.fillStyle = gr; c.fill();
    if (opt.bands) for (const [za, zb, bc] of opt.bands) {
      const [, ya] = this.pt(cx, cy, za), [, yb] = this.pt(cx, cy, zb);
      const g2 = c.createLinearGradient(sx - rx, 0, sx + rx, 0);
      g2.addColorStop(0, shade(bc, 0.82)); g2.addColorStop(0.35, shade(bc, 1.04)); g2.addColorStop(1, shade(bc, 0.6));
      c.beginPath(); c.moveTo(sx - rx, yb); c.lineTo(sx - rx, ya); c.ellipse(sx, ya, rx, ry, 0, Math.PI, 0, true);
      c.lineTo(sx + rx, yb); c.ellipse(sx, yb, rx, ry, 0, 0, Math.PI, true); c.closePath(); c.fillStyle = g2; c.fill();
    }
    if (!opt.noTop) {
      c.beginPath(); c.ellipse(sx, sy1, rx, ry, 0, 0, Math.PI * 2);
      c.fillStyle = opt.top || shade(col, 1.12); c.fill();
      if (opt.hollow) { c.beginPath(); c.ellipse(sx, sy1, rx * 0.75, ry * 0.75, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(20,20,20,0.75)'; c.fill(); }
    }
    return { sx, sy0, sy1, rx, ry };
  }

  dome(cx, cy, r, z, col, hScale = 1) {
    const c = this.c; const s = this.s;
    const [sx, sy] = this.pt(cx, cy, z);
    const rx = r * Math.SQRT2 * HW * s, ry = r * Math.SQRT2 * HH * s;
    const h = rx * 0.9 * hScale;
    const gr = c.createRadialGradient(sx - rx * 0.35, sy - h * 0.7, rx * 0.1, sx, sy - h * 0.3, rx * 1.2);
    gr.addColorStop(0, shade(col, 1.2)); gr.addColorStop(0.6, shade(col, 0.95)); gr.addColorStop(1, shade(col, 0.62));
    c.beginPath(); c.ellipse(sx, sy, rx, ry, 0, 0, Math.PI); c.ellipse(sx, sy, rx, h, 0, Math.PI, 0); c.closePath();
    c.fillStyle = gr; c.fill();
    return { sx, sy, rx, h };
  }

  // Leafy tree crown at tile pos (x,y) with radius r (px) and trunk height th
  tree(x, y, r, th, col = '#5b8a3c', kind = 'round') {
    const c = this.c; const s = this.s;
    const [sx, sy] = this.pt(x, y, 0);
    // shadow
    c.fillStyle = 'rgba(25,40,25,0.25)';
    c.beginPath(); c.ellipse(sx + r * 0.5 * s, sy + 1 * s, r * 1.0 * s, r * 0.45 * s, 0, 0, Math.PI * 2); c.fill();
    if (kind === 'conifer') {
      c.fillStyle = '#5a4030'; c.fillRect(sx - 0.8 * s, sy - th * 0.5 * s, 1.6 * s, th * 0.5 * s);
      const H = th + r * 2.2;
      for (let k = 0; k < 3; k++) {
        const yb = sy - th * 0.35 * s - k * r * 0.55 * s, w = r * (1 - k * 0.22) * s, ht = r * 1.2 * s;
        c.beginPath(); c.moveTo(sx - w, yb); c.lineTo(sx, yb - ht); c.lineTo(sx + w, yb); c.closePath();
        const gr = c.createLinearGradient(sx - w, 0, sx + w, 0);
        gr.addColorStop(0, shade(col, 1.05)); gr.addColorStop(0.55, shade(col, 0.9)); gr.addColorStop(1, shade(col, 0.62));
        c.fillStyle = gr; c.fill();
      }
      return H;
    }
    c.fillStyle = '#6a4a35'; c.fillRect(sx - 0.9 * s, sy - th * s, 1.8 * s, th * s);
    const cy = sy - (th + r * 0.8) * s;
    const blobs = [[0, 0, 1], [-0.45, 0.2, 0.7], [0.45, 0.25, 0.68], [0.05, -0.45, 0.62]];
    for (const [bx, by, br] of blobs) {
      const px = sx + bx * r * s, py = cy + by * r * s, rr = r * br * s;
      const gr = c.createRadialGradient(px - rr * 0.4, py - rr * 0.5, rr * 0.1, px, py, rr);
      gr.addColorStop(0, shade(col, 1.25)); gr.addColorStop(0.7, col); gr.addColorStop(1, shade(col, 0.7));
      c.fillStyle = gr; c.beginPath(); c.arc(px, py, rr, 0, Math.PI * 2); c.fill();
    }
    return th + r * 1.8;
  }

  // flat ellipse on ground (tile coords center, radii in tiles)
  groundEllipse(cx, cy, rx, ry, fill, z = 0) {
    const c = this.c; const pts = [];
    for (let k = 0; k < 28; k++) {
      const a = k / 28 * Math.PI * 2;
      pts.push(this.pt(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z));
    }
    this.path(pts); c.fillStyle = fill; c.fill();
  }

  // Vertical text-less sign panel / generic small quad helpers
  line3(a, b, col, lw = 0.8) {
    const c = this.c; const p = this.pt(...a), q = this.pt(...b);
    c.strokeStyle = col; c.lineWidth = lw * this.s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
  }

  glowDot(x, y, z, r, col = '#ffd98a') {
    const g = this.g; if (!g) return;
    const [sx, sy] = this.pt(x, y, z);
    const gr = g.createRadialGradient(sx, sy, 0, sx, sy, r * this.s);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, r * this.s, 0, Math.PI * 2); g.fill();
  }

  // Car on ground: axis 'x' or 'y'
  car(x, y, axis, col) {
    const L = 0.22, W = 0.11;
    const [x0, x1, y0, y1] = axis === 'x' ? [x - L / 2, x + L / 2, y - W / 2, y + W / 2] : [x - W / 2, x + W / 2, y - L / 2, y + L / 2];
    this.box(x0, y0, x1, y1, 0.5, 3, col, { edge: false, ao: false });
    const i = 0.25;
    const [a0, a1, b0, b1] = axis === 'x' ? [x0 + (x1 - x0) * i, x1 - (x1 - x0) * i, y0, y1] : [x0, x1, y0 + (y1 - y0) * i, y1 - (y1 - y0) * i];
    this.box(a0, b0, a1, b1, 3, 4.6, '#cfd8de', { edge: false, ao: false });
  }
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
