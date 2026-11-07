// Procedurally painted textures. Everything is drawn on canvases at load time, so the game ships
// without image files while still getting crisp, detailed surfaces.
import * as THREE from 'three';
import { mulberry32 } from '../game/emitter.js';

const cache = new Map();
let maxAniso = 4;
export function setAnisotropy(n) { maxAniso = n; }

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTex(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function noise(ctx, w, h, amount, rnd, size = 1, alpha = 0.08) {
  for (let i = 0; i < amount; i++) {
    const x = rnd() * w, y = rnd() * h;
    const v = rnd() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rnd()})`;
    ctx.fillRect(x, y, size, size);
  }
}

// ------------------------------------------------------------------------------ ground
export function grassTexture() {
  return memo('grass', () => {
    const S = 512, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(7);
    ctx.fillStyle = '#5f9a3e';
    ctx.fillRect(0, 0, S, S);
    // soft patches
    for (let i = 0; i < 90; i++) {
      const x = rnd() * S, y = rnd() * S, r = 20 + rnd() * 70;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const tone = rnd() < 0.5 ? 'rgba(120,170,70,0.22)' : 'rgba(60,110,40,0.22)';
      g.addColorStop(0, tone); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { ctx.save(); ctx.translate(ox, oy); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); }
    }
    // blades
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * S, y = rnd() * S;
      const l = 40 + rnd() * 40;
      ctx.strokeStyle = `hsla(${88 + rnd() * 30},${40 + rnd() * 25}%,${l}%,0.35)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 4); ctx.stroke();
    }
    // tiny flowers
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = ['#f4f1d0', '#f7d76a', '#e9a5c8', '#ffffff'][Math.floor(rnd() * 4)];
      ctx.globalAlpha = 0.5;
      ctx.fillRect(rnd() * S, rnd() * S, 2, 2);
    }
    ctx.globalAlpha = 1;
    return toTex(c);
  });
}

export function lockedTexture() {
  return memo('locked', () => {
    const S = 256, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(11);
    ctx.fillStyle = '#6d8f4d';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = `hsla(${70 + rnd() * 30},${25 + rnd() * 20}%,${30 + rnd() * 25}%,0.35)`;
      ctx.fillRect(rnd() * S, rnd() * S, 2, 2 + rnd() * 2);
    }
    return toTex(c);
  });
}

export function sandTexture() {
  return memo('sand', () => {
    const S = 256, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(3);
    ctx.fillStyle = '#e3cf9b';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 6000, rnd, 2, 0.15);
    return toTex(c);
  });
}

export function pavingTexture() {
  return memo('paving', () => {
    const S = 256, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(5);
    ctx.fillStyle = '#c9c4ba';
    ctx.fillRect(0, 0, S, S);
    const n = 8, s = S / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const l = 74 + rnd() * 8;
      ctx.fillStyle = `hsl(35,8%,${l}%)`;
      ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
    }
    noise(ctx, S, S, 3000, rnd, 1, 0.12);
    return toTex(c);
  });
}

export function asphaltTexture() {
  return memo('asphalt', () => {
    const S = 256, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(9);
    ctx.fillStyle = '#4a4e55';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 9000, rnd, 1, 0.18);
    // parking bays
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    for (let x = 0; x <= S; x += S / 4) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S * 0.42); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, S * 0.58); ctx.lineTo(x, S); ctx.stroke(); }
    return toTex(c);
  });
}

export function plainAsphalt() {
  return memo('plainAsphalt', () => {
    const S = 128, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(19);
    ctx.fillStyle = '#4f535a';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 3000, rnd, 1, 0.16);
    return toTex(c);
  });
}

export function concreteTexture() {
  return memo('concrete', () => {
    const S = 256, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(21);
    ctx.fillStyle = '#b5b3ae';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 7000, rnd, 1, 0.14);
    ctx.strokeStyle = 'rgba(80,80,80,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= S; i += S / 2) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke(); }
    return toTex(c);
  });
}

// ------------------------------------------------------------------------------ roads
// Painted per connection pattern; the canonical orientation is drawn and rotated at placement.
export function roadTexture(n, e, s, w) {
  return memo(`road${+n}${+e}${+s}${+w}`, () => {
    const S = 256, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(n * 1 + e * 2 + s * 4 + w * 8 + 31);
    const side = Math.round(S * 0.125);
    // asphalt
    ctx.fillStyle = '#464c57';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 5000, rnd, 1, 0.16);
    // sidewalks along closed edges + corners
    const walk = (x, y, ww, hh) => {
      ctx.fillStyle = '#cdd0d2';
      ctx.fillRect(x, y, ww, hh);
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < Math.max(ww, hh); i += 16) {
        ctx.beginPath();
        if (ww > hh) { ctx.moveTo(x + i, y); ctx.lineTo(x + i, y + hh); } else { ctx.moveTo(x, y + i); ctx.lineTo(x + ww, y + i); }
        ctx.stroke();
      }
    };
    if (!n) walk(0, 0, S, side);
    if (!s) walk(0, S - side, S, side);
    if (!w) walk(0, 0, side, S);
    if (!e) walk(S - side, 0, side, S);
    walk(0, 0, side, side); walk(S - side, 0, side, side); walk(0, S - side, side, side); walk(S - side, S - side, side, side);
    // curbs
    ctx.strokeStyle = '#8f8b84';
    ctx.lineWidth = 3;
    const curb = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
    if (!n) curb(n || w ? side : side, side, e ? S : S - side, side);
    if (!s) curb(side, S - side, S - side, S - side);
    if (!w) curb(side, side, side, S - side);
    if (!e) curb(S - side, side, S - side, S - side);
    if (n) { curb(side, 0, side, side); curb(S - side, 0, S - side, side); }
    if (s) { curb(side, S - side, side, S); curb(S - side, S - side, S - side, S); }
    if (w) { curb(0, side, side, side); curb(0, S - side, side, S - side); }
    if (e) { curb(S - side, side, S, side); curb(S - side, S - side, S, S - side); }
    if (!n && !w) {}
    const count = n + e + s + w;
    ctx.fillStyle = 'rgba(245,245,235,0.85)';
    const mid = S / 2;
    const dash = (x1, y1, x2, y2) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(245,240,225,0.85)';
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 14]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    };
    if (count >= 3) {
      // intersection: zebra crossings at each connected arm
      const zebra = (horizontal, pos) => {
        for (let i = side + 6; i < S - side - 6; i += 14) {
          if (horizontal) ctx.fillRect(i, pos, 8, side * 0.7);
          else ctx.fillRect(pos, i, side * 0.7, 8);
        }
      };
      if (n) zebra(true, 4);
      if (s) zebra(true, S - side * 0.7 - 4);
      if (w) zebra(false, 4);
      if (e) zebra(false, S - side * 0.7 - 4);
    } else if (count === 2 && ((n && s) || (e && w))) {
      if (n) dash(mid, 0, mid, S); else dash(0, mid, S, mid);
    } else if (count === 2) {
      // corner: curved dashed line
      ctx.save();
      ctx.strokeStyle = 'rgba(245,240,225,0.85)';
      ctx.lineWidth = 4;
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      const cx = e ? S : 0, cy = s ? S : 0;
      ctx.arc(cx, cy, mid, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // round off the outer corner with sidewalk
      ctx.fillStyle = '#cdd0d2';
      const ox = e ? 0 : S, oy = s ? 0 : S;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox, oy + (s ? side * 2 : -side * 2));
      ctx.quadraticCurveTo(ox + (e ? side : -side) * 0.2, oy + (s ? side : -side) * 0.2, ox + (e ? side * 2 : -side * 2), oy);
      ctx.closePath();
      ctx.fill();
    } else if (count === 1) {
      if (n) dash(mid, 0, mid, mid); if (s) dash(mid, mid, mid, S);
      if (w) dash(0, mid, mid, mid); if (e) dash(mid, mid, S, mid);
      // turning circle
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(mid, mid, mid * 0.55, 0, 7); ctx.fill();
    }
    // tyre wear
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    if (n || s) { ctx.fillRect(mid - 50, 0, 18, S); ctx.fillRect(mid + 32, 0, 18, S); }
    if (e || w) { ctx.fillRect(0, mid - 50, S, 18); ctx.fillRect(0, mid + 32, S, 18); }
    return toTex(c, { repeat: false });
  });
}

// ------------------------------------------------------------------------------ facades
// Each facade texture covers 1×1 world unit = 4 bays × 4 floors. A matching emissive map lights a
// random subset of windows at night.
const FACADES = {
  plaster: { wall: '#f1ece2', frame: '#ffffff', glass: '#5f7488', style: 'punched' },
  brick: { wall: '#a8553f', frame: '#efe7dc', glass: '#4f6274', style: 'brick' },
  modern: { wall: '#e9e9e6', frame: '#33373d', glass: '#6b8aa3', style: 'band' },
  glass: { wall: '#2d4a66', frame: '#9fb3c4', glass: '#6c9cc4', style: 'curtain' },
  glassdark: { wall: '#253447', frame: '#5a6b7d', glass: '#3f6a90', style: 'curtain' },
  office: { wall: '#d8d5cc', frame: '#8c8f93', glass: '#58799a', style: 'grid' },
  panel: { wall: '#c7cbd0', frame: '#a0a5ab', glass: '#5b7189', style: 'industrial' },
  shop: { wall: '#ebe6dc', frame: '#3b3f45', glass: '#7ea4c2', style: 'shopfront' },
  timber: { wall: '#f3ead6', frame: '#5d3b25', glass: '#4f6274', style: 'timber' },
  clinic: { wall: '#f6f7f8', frame: '#d0d6dc', glass: '#7fa6c6', style: 'band' },
};

function drawFacade(ctx, S, f, lit, rnd) {
  const bay = S / 4;
  ctx.fillStyle = lit ? '#000' : f.wall;
  ctx.fillRect(0, 0, S, S);
  if (!lit) {
    noise(ctx, S, S, 2500, rnd, 1, 0.06);
    if (f.style === 'brick') {
      ctx.strokeStyle = 'rgba(60,25,15,0.25)';
      ctx.lineWidth = 1;
      for (let y = 0; y < S; y += 6) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
        for (let x = (y / 6) % 2 ? 0 : 7; x < S; x += 14) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 6); ctx.stroke(); }
      }
    }
    if (f.style === 'industrial') {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      for (let x = 0; x < S; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke(); }
    }
  }
  for (let fy = 0; fy < 4; fy++) {
    for (let bx = 0; bx < 4; bx++) {
      const x0 = bx * bay, y0 = fy * bay;
      const on = rnd() < 0.42;
      const warm = rnd() < 0.8;
      const litCol = warm ? `rgb(255,${200 + Math.floor(rnd() * 40)},${120 + Math.floor(rnd() * 50)})` : 'rgb(190,215,255)';
      const glass = (x, y, w, h) => {
        if (lit) { ctx.fillStyle = on ? litCol : '#000'; ctx.fillRect(x, y, w, h); return; }
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, shade(f.glass, 28)); g.addColorStop(1, shade(f.glass, -18));
        ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w * 0.35, h);
      };
      switch (f.style) {
        case 'punched':
        case 'brick':
        case 'timber': {
          const w = bay * 0.46, h = bay * 0.56, x = x0 + (bay - w) / 2, y = y0 + bay * 0.2;
          if (!lit) {
            ctx.fillStyle = f.frame; ctx.fillRect(x - 3, y - 3, w + 6, h + 7);
            if (f.style === 'timber') {
              ctx.strokeStyle = f.frame; ctx.lineWidth = 4;
              ctx.strokeRect(x0 + 2, y0 + 2, bay - 4, bay - 4);
              ctx.beginPath(); ctx.moveTo(x0, y0 + bay); ctx.lineTo(x - 3, y + h + 4); ctx.moveTo(x0 + bay, y0 + bay); ctx.lineTo(x + w + 3, y + h + 4); ctx.stroke();
            }
          }
          glass(x, y, w, h);
          if (!lit) { ctx.fillStyle = f.frame; ctx.fillRect(x + w / 2 - 1.5, y, 3, h); ctx.fillRect(x, y + h * 0.4, w, 3); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - 4, y + h + 4, w + 8, 3); }
          break;
        }
        case 'band': {
          const h = bay * 0.46, y = y0 + bay * 0.26;
          glass(x0, y, bay, h);
          if (!lit) { ctx.fillStyle = f.frame; ctx.fillRect(x0 + bay - 3, y, 3, h); ctx.fillRect(x0, y + h, bay, 4); }
          break;
        }
        case 'curtain': {
          glass(x0 + 2, y0 + 2, bay - 4, bay - 4);
          if (!lit) { ctx.fillStyle = f.frame; ctx.fillRect(x0, y0, bay, 3); ctx.fillRect(x0, y0, 3, bay); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x0, y0 + bay * 0.85, bay, bay * 0.15); }
          break;
        }
        case 'grid': {
          const w = bay * 0.7, h = bay * 0.6, x = x0 + (bay - w) / 2, y = y0 + bay * 0.2;
          glass(x, y, w, h);
          if (!lit) { ctx.fillStyle = f.frame; ctx.fillRect(x, y + h, w, 3); ctx.fillRect(x + w / 2 - 1, y, 2, h); }
          break;
        }
        case 'industrial': {
          if (fy === 0 && bx % 2 === 0) {
            const w = bay * 1.6, h = bay * 0.3, x = x0 + bay * 0.2, y = y0 + bay * 0.2;
            glass(x, y, w, h);
          }
          break;
        }
        case 'shopfront': {
          if (fy === 3) {
            glass(x0 + 3, y0 + bay * 0.1, bay - 6, bay * 0.8);
            if (!lit) { ctx.fillStyle = f.frame; ctx.fillRect(x0, y0, bay, 6); ctx.fillRect(x0, y0, 4, bay); }
            if (lit) { ctx.fillStyle = 'rgb(255,236,190)'; ctx.fillRect(x0 + 3, y0 + bay * 0.1, bay - 6, bay * 0.8); }
          } else {
            const w = bay * 0.5, h = bay * 0.5, x = x0 + (bay - w) / 2, y = y0 + bay * 0.22;
            if (!lit) { ctx.fillStyle = f.frame; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); }
            glass(x, y, w, h);
          }
          break;
        }
      }
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export function facadeTextures(name) {
  return memo(`facade-${name}`, () => {
    const f = FACADES[name];
    const S = 256;
    const seed = name.length * 977 + name.charCodeAt(0);
    const c1 = canvas(S), c2 = canvas(S);
    drawFacade(c1.getContext('2d'), S, f, false, mulberry32(seed));
    drawFacade(c2.getContext('2d'), S, f, true, mulberry32(seed));
    return { map: toTex(c1), emissive: toTex(c2) };
  });
}

export function roofTexture(kind) {
  return memo(`roof-${kind}`, () => {
    const S = 128, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(kind.length * 31);
    if (kind === 'tiles') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 10) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, y + 8, S, 2);
        for (let x = (y / 10) % 2 ? 0 : 6; x < S; x += 12) { ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(x, y, 1, 8); }
      }
      noise(ctx, S, S, 800, rnd, 1, 0.15);
    } else if (kind === 'gravel') {
      ctx.fillStyle = '#9b9a95';
      ctx.fillRect(0, 0, S, S);
      noise(ctx, S, S, 5000, rnd, 1, 0.3);
    } else if (kind === 'metal') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, S, S);
      for (let x = 0; x < S; x += 8) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x, 0, 2, S); }
    } else if (kind === 'solar') {
      ctx.fillStyle = '#1b2c48';
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = '#9fb4d0';
      ctx.lineWidth = 1;
      for (let i = 0; i <= S; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(0, 0, S, S / 3);
    } else if (kind === 'field') {
      ctx.fillStyle = '#4f8f3c';
      ctx.fillRect(0, 0, S, S);
      for (let x = 0; x < S; x += 16) { ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x, 0, 8, S); }
    }
    return toTex(c);
  });
}

export function signTexture(text, bg = '#1e6fd9', fg = '#ffffff', w = 512, h = 128) {
  return memo(`sign-${text}-${bg}-${fg}-${w}`, () => {
    const c = canvas(w, h), ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    let size = h * 0.62;
    ctx.font = `800 ${size}px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif`;
    while (ctx.measureText(text).width > w * 0.9 && size > 10) { size -= 2; ctx.font = `800 ${size}px ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif`; }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
    return toTex(c, { repeat: false });
  });
}

export function emojiTexture(emoji, size = 128) {
  return memo(`emoji-${emoji}`, () => {
    const c = canvas(size), ctx = c.getContext('2d');
    ctx.font = `${size * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.05);
    return toTex(c, { repeat: false });
  });
}

export function waterTexture() {
  return memo('water', () => {
    const S = 256, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(77);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * S, y = rnd() * S, l = 6 + rnd() * 20;
      ctx.strokeStyle = `rgba(255,255,255,${0.2 + rnd() * 0.3})`;
      ctx.fillStyle = `rgba(0,40,80,${0.04 + rnd() * 0.06})`;
      ctx.fillRect(x, y, l, 2);
    }
    return toTex(c);
  });
}

export function cloudShadowTexture() {
  return memo('cloudShadow', () => {
    const S = 512, c = canvas(S), ctx = c.getContext('2d');
    const rnd = mulberry32(99);
    ctx.clearRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      const x = rnd() * S, y = rnd() * S, r = 30 + rnd() * 70;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, 'rgba(0,0,0,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, 7); ctx.fill();
      }
    }
    return toTex(c, { srgb: false });
  });
}

export function gridTexture() {
  return memo('grid', () => {
    const S = 64, c = canvas(S), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
    return toTex(c, { srgb: false });
  });
}
