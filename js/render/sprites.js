// Lazily rasterizes art generators into cached canvases, with night variants.
import { HW, HH, SCALE, Painter, makeCanvas } from './art.js';
import { mulberry32 } from '../util/rng.js';
import * as G from './ground.js';
import { zoneArt, serviceArt } from './buildings.js';

const NIGHT_TINT = '#2a3558';

export class SpriteBank {
  constructor() {
    this.map = new Map();
    this.count = 0;
  }

  build(key, gen) {
    const { fw, fd, H } = gen;
    const pad = gen.pad ?? 8;
    const shadowPad = H > 0 ? Math.min(70, 10 + H * 0.4) : 0;
    const padL = pad, padT = pad, padR = pad + shadowPad, padB = pad + shadowPad * 0.4;
    const wW = (fw + fd) * HW + padL + padR;
    const wH = (fw + fd) * HH + H + padT + padB;
    const S = SCALE;
    const img = makeCanvas(wW * S, wH * S);
    const ctx = img.getContext('2d');
    const hasGlow = H > 0;
    let glow = null, gctx = null;
    if (hasGlow) {
      glow = makeCanvas(wW, wH); gctx = glow.getContext('2d'); gctx.scale(1 / S, 1 / S);
    }
    const ax = fd * HW + padL, ay = H + padT;
    const P = new Painter(ctx, ax * S, ay * S, S, gctx, mulberry32(this.count * 13 + 5));
    gen.draw(P);
    this.count++;
    const spr = { img, glow, night: null, ax, ay, w: wW, h: wH, meta: gen.meta || null, fw, fd, H, glowUsed: hasGlow };
    this.map.set(key, spr);
    return spr;
  }

  get(key, genFn) {
    let s = this.map.get(key);
    if (!s) { const g = genFn(); s = this.build(key, g); }
    return s;
  }

  // Darkened half-res copy for night.
  night(spr) {
    if (spr.night) return spr.night;
    const w = Math.ceil(spr.w), h = Math.ceil(spr.h);
    const c = makeCanvas(w, h); const x = c.getContext('2d');
    x.drawImage(spr.img, 0, 0, w, h);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = NIGHT_TINT; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(spr.img, 0, 0, w, h);
    spr.night = c;
    return c;
  }

  // Desaturated/darker variant for abandoned buildings.
  abandoned(spr) {
    if (spr.aband) return spr.aband;
    const c = makeCanvas(spr.img.width, spr.img.height); const x = c.getContext('2d');
    x.drawImage(spr.img, 0, 0);
    x.globalCompositeOperation = 'saturation';
    x.fillStyle = '#808080'; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = '#cfc7bb'; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(spr.img, 0, 0);
    spr.aband = c;
    return c;
  }

  // ---- typed getters ----
  grass(t, v) { return this.get(`g${t}_${v}`, () => G.grassTile(t, v)); }
  deco(k, v) { return this.get(`d${k}_${v}`, () => G.decoTile(k, v)); }
  sand(v) { return this.get(`s${v}`, () => G.sandTile(v)); }
  water(d) { return this.get(`w${d}`, () => G.waterTile(d)); }
  shimmer(f, v) { return this.get(`ws${f}_${v}`, () => G.waterShimmer(f, v)); }
  foam(m) { return this.get(`wf${m}`, () => G.shoreFoam(m)); }
  road(m, bridge) { return this.get(`r${m}_${bridge ? 1 : 0}`, () => G.roadTile(m, bridge)); }
  zone(zt, zd) { return this.get(`z${zt}_${zd}`, () => G.zoneTile(zt, zd)); }
  tree(d, v) { return this.get(`t${d}_${v}`, () => G.treeTile(d, v)); }
  pole(m) { return this.get(`p${m}`, () => G.poleTile(m)); }
  rubble(v) { return this.get(`rb${v}`, () => G.rubbleTile(v)); }
  construction(size, tall, v) { return this.get(`c${size}_${tall ? 1 : 0}_${v}`, () => G.constructionTile(size, tall, v)); }
  zoneBuilding(zt, tier, variant, facing) {
    return this.get(`b${zt}_${tier}_${variant}_${facing}`, () => zoneArt(zt, tier, variant, facing));
  }
  service(key, variant = 0) { return this.get(`sv_${key}_${variant}`, () => serviceArt(key, variant)); }
}

export const VARIANTS = 6;
