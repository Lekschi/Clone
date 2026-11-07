// Particle effects (smoke, fire, dust, fountain spray) and clouds.
import * as THREE from 'three';
import { mulberry32 } from '../game/emitter.js';

function puffTexture(seed = 1, soft = false) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  // a cluster of soft blobs gives a billowing, irregular puff
  const n = soft ? 1 : 9;
  for (let i = 0; i < n; i++) {
    const r = soft ? S * 0.5 : S * (0.18 + rnd() * 0.16);
    const x = soft ? S / 2 : S / 2 + (rnd() - 0.5) * S * 0.36;
    const y = soft ? S / 2 : S / 2 + (rnd() - 0.5) * S * 0.36;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${soft ? 1 : 0.55})`);
    g.addColorStop(0.55, `rgba(255,255,255,${soft ? 0.5 : 0.25})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }
  if (!soft) {
    // erode with fine noise for a fluffy edge
    const img = ctx.getImageData(0, 0, S, S);
    for (let i = 0; i < S * S; i++) img.data[i * 4 + 3] *= 0.75 + rnd() * 0.25;
    ctx.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.texs = [puffTexture(1), puffTexture(2), puffTexture(3)];
    this.drop = puffTexture(9, true);
    this.pool = [];
    this.live = [];
    this.emitters = [];
  }

  sprite() {
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texs[0], transparent: true, depthWrite: false, opacity: 0 }));
      this.scene.add(s);
    }
    s.visible = true;
    return s;
  }

  spawn(pos, o = {}) {
    if (this.live.length > 520) return;
    const { color = '#d9d9d9', life = 4, size = 0.25, grow = 0.6, rise = 0.35, drift = 0.12, opacity = 0.55, vy = 0, gravity = 0, spread = 0, tex = null, additive = false } = o;
    const s = this.sprite();
    const m = s.material;
    m.map = tex || this.texs[Math.floor(Math.random() * 3)];
    m.color.set(color);
    m.rotation = Math.random() * 6.28;
    m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    s.position.copy(pos);
    const a = Math.random() * 6.28;
    s.userData = {
      age: 0, life: life * (0.8 + Math.random() * 0.4), size, grow, rise, drift, opacity, gravity, vy,
      vx: drift * (0.6 + Math.random() * 0.6) + Math.cos(a) * spread, vz: drift * 0.3 * (Math.random() - 0.5) + Math.sin(a) * spread,
      spin: (Math.random() - 0.5) * 0.6,
    };
    s.scale.setScalar(size);
    this.live.push(s);
  }

  dust(x, z, w, d) {
    for (let i = 0; i < 26; i++) {
      const p = new THREE.Vector3(x + (Math.random() - 0.5) * w, 0.08, z + (Math.random() - 0.5) * d);
      this.spawn(p, { color: '#cfc3ab', life: 1.8, size: 0.4, grow: 1.1, rise: 0.22, drift: 0.12, opacity: 0.6, spread: 0.25 });
    }
  }

  // water jet from a fire engine's monitor to a burning building (ballistic droplets)
  spray(x, z, tx, tz, dt) {
    this.sprayAcc = (this.sprayAcc || 0) + dt * 34;
    const T = 0.55;
    while (this.sprayAcc > 1) {
      this.sprayAcc -= 1;
      const p = new THREE.Vector3(x, 0.17, z);
      this.spawn(p, { color: '#e3f2ff', life: T * 1.25, size: 0.045, grow: 0.5, rise: 0, vy: 0.75 + Math.random() * 0.12, gravity: 1.6, opacity: 0.8, tex: this.drop });
      const u = this.live[this.live.length - 1]?.userData;
      if (u) { u.vx = (tx - x) / T * (0.92 + Math.random() * 0.12); u.vz = (tz - z) / T * (0.92 + Math.random() * 0.12); }
      if (Math.random() < 0.25) this.spawn(new THREE.Vector3(tx, 0.25, tz), { color: '#f2f5f7', life: 1.6, size: 0.18, grow: 0.9, rise: 0.4, drift: 0.05, opacity: 0.45, spread: 0.08 });
    }
  }

  // a firework burst: additive sparks falling under gravity
  firework(x, y, z) {
    const cols = [['#ff5a5a', '#ffd0d0'], ['#5ab0ff', '#d6ecff'], ['#ffd34d', '#fff3c4'], ['#7dff8a', '#e0ffe4'], ['#d77dff', '#f3dcff']];
    const [c1, c2] = cols[Math.floor(Math.random() * cols.length)];
    const n = 46;
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3(x, y, z);
      this.spawn(p, { color: i % 4 ? c1 : c2, life: 1.6, size: 0.12, grow: 0.1, rise: 0, vy: 0, gravity: 0.9, opacity: 1, additive: true, tex: this.drop });
      const u = this.live[this.live.length - 1]?.userData;
      if (!u) break;
      // even directions on a sphere
      const k = (i + 0.5) / n, phi = Math.acos(1 - 2 * k), th = Math.PI * (1 + Math.sqrt(5)) * i;
      const sp = 1.6 + Math.random() * 0.3;
      u.vx = Math.sin(phi) * Math.cos(th) * sp; u.vz = Math.sin(phi) * Math.sin(th) * sp; u.vy = Math.cos(phi) * sp;
      u.drag = 1.4;
    }
  }

  setEmitters(list) { this.emitters = list; }

  update(dt, night, wind = 1) {
    for (const e of this.emitters) {
      if (e.active && !e.active()) continue;
      e.acc = (e.acc || Math.random()) + dt * e.rate;
      while (e.acc > 1) {
        e.acc -= 1;
        const p = e.pos.clone();
        p.x += (Math.random() - 0.5) * 0.05;
        p.z += (Math.random() - 0.5) * 0.05;
        if (e.fire) {
          if (Math.random() < 0.65) this.spawn(p, { color: Math.random() < 0.5 ? '#ff7a1a' : '#ffc23a', life: 0.8, size: 0.2, grow: 0.2, rise: 0.7, drift: 0.05, opacity: 0.95, additive: true });
          else this.spawn(p, { color: '#3e3e44', life: 3.4, size: 0.26, grow: 1.0, rise: 0.45, drift: 0.12 * wind, opacity: 0.65 });
          continue;
        }
        if (e.fountain) {
          this.spawn(p, { color: '#e6f4ff', life: 1.0, size: 0.05, grow: 0.3, rise: 0, vy: 1.0 + Math.random() * 0.25, gravity: 2.3, spread: 0.07, opacity: 0.85, tex: this.drop });
          continue;
        }
        const grey = 205 + Math.floor(Math.random() * 40);
        const col = night ? '#7d828c' : e.color || `rgb(${grey},${grey},${grey})`;
        this.spawn(p, { color: col, life: 5, size: 0.22, grow: 0.8, rise: 0.3, drift: 0.16 * wind, opacity: 0.55 });
      }
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i];
      const u = s.userData;
      u.age += dt;
      const k = u.age / u.life;
      if (k >= 1 || s.position.y < -0.05) {
        s.visible = false;
        this.live.splice(i, 1);
        this.pool.push(s);
        continue;
      }
      if (u.drag) { const f = Math.exp(-u.drag * dt); u.vx *= f; u.vz *= f; u.vy *= f; }
      if (u.gravity) { u.vy -= u.gravity * dt; s.position.y += u.vy * dt; }
      else s.position.y += u.rise * dt * (1 - k * 0.5);
      s.position.x += u.vx * dt;
      s.position.z += u.vz * dt;
      s.material.rotation += u.spin * dt;
      s.scale.setScalar(u.size * (1 + u.grow * k * 3));
      s.material.opacity = u.opacity * Math.min(1, k * 6) * (1 - k);
    }
  }
}

// Clouds: soft billboard puffs for the eye, plus invisible solid shapes that cast moving shadows.
export class Clouds {
  constructor(scene, cx, cz) {
    this.group = new THREE.Group();
    this.cx = cx; this.cz = cz;
    this.items = [];
    const texs = [puffTexture(21), puffTexture(22), puffTexture(23), puffTexture(24)];
    this.mats = texs.map((t) => new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.9, fog: false }));
    const shadowMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    for (let i = 0; i < 11; i++) {
      const g = new THREE.Group();
      const n = 7 + Math.floor(Math.random() * 6);
      for (let k = 0; k < n; k++) {
        const sp = new THREE.Sprite(this.mats[k % 4]);
        const sz = 4 + Math.random() * 5;
        sp.scale.set(sz * 1.4, sz * 0.8, 1);
        sp.position.set((k - n / 2) * 1.5 + (Math.random() - 0.5) * 2, Math.random() * 1.4, (Math.random() - 0.5) * 3);
        g.add(sp);
        const sh = new THREE.Mesh(new THREE.IcosahedronGeometry(sz * 0.32, 0), shadowMat);
        sh.position.copy(sp.position);
        sh.scale.y = 0.5;
        sh.castShadow = true;
        sh.userData.caster = true;
        g.add(sh);
      }
      g.position.set(cx - 70 + Math.random() * 140, 17 + Math.random() * 6, cz - 70 + Math.random() * 140);
      this.group.add(g);
      this.items.push(g);
    }
    scene.add(this.group);
  }

  update(dt, wind = 1) {
    for (const g of this.items) {
      g.position.x += dt * 0.55 * wind;
      g.position.z += dt * 0.14 * wind;
      if (g.position.x > this.cx + 90) { g.position.x = this.cx - 90; g.position.z = this.cz - 70 + Math.random() * 140; }
      if (g.position.z > this.cz + 90) g.position.z = this.cz - 90;
    }
  }

  castShadows(on) {
    if (this._cast === on) return;
    this._cast = on;
    this.group.traverse((o) => { if (o.userData.caster) o.visible = on; });
  }

  setLook(opacity, tint) {
    for (const m of this.mats) { m.opacity = 0.92 * opacity; m.color.copy(tint); }
  }
}
