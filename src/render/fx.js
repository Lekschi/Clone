// Particle effects: chimney smoke, construction dust, clouds drifting over the city.
import * as THREE from 'three';

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.tex = puffTexture();
    this.pool = [];
    this.live = [];
    this.emitters = [];
  }

  sprite() {
    let s = this.pool.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, opacity: 0 }));
      this.scene.add(s);
    }
    s.visible = true;
    return s;
  }

  spawn(pos, { color = '#d9d9d9', life = 4, size = 0.25, grow = 0.6, rise = 0.35, drift = 0.12, opacity = 0.55 } = {}) {
    if (this.live.length > 360) return;
    const s = this.sprite();
    s.material.color.set(color);
    s.position.copy(pos);
    s.userData = { age: 0, life, size, grow, rise, drift, opacity, vx: drift * (0.6 + Math.random() * 0.6), vz: drift * 0.3 * (Math.random() - 0.5) };
    s.scale.setScalar(size);
    this.live.push(s);
  }

  dust(x, z, w, d) {
    for (let i = 0; i < 18; i++) {
      const p = new THREE.Vector3(x + (Math.random() - 0.5) * w, 0.1, z + (Math.random() - 0.5) * d);
      this.spawn(p, { color: '#d8cdb8', life: 1.3, size: 0.35, grow: 0.9, rise: 0.25, drift: 0.2, opacity: 0.7 });
    }
  }

  // emitters: [{pos: Vector3, rate, color, active: () => bool}]
  setEmitters(list) { this.emitters = list; }

  update(dt, night) {
    for (const e of this.emitters) {
      if (e.active && !e.active()) continue;
      e.acc = (e.acc || Math.random()) + dt * e.rate;
      while (e.acc > 1) {
        e.acc -= 1;
        const p = e.pos.clone();
        p.x += (Math.random() - 0.5) * 0.05;
        p.z += (Math.random() - 0.5) * 0.05;
        if (e.fire) {
          if (Math.random() < 0.65) this.spawn(p, { color: Math.random() < 0.5 ? '#ff7a1a' : '#ffc23a', life: 0.8, size: 0.2, grow: 0.2, rise: 0.7, drift: 0.05, opacity: 0.95 });
          else this.spawn(p, { color: '#4a4a4f', life: 3.2, size: 0.25, grow: 0.9, rise: 0.45, drift: 0.12, opacity: 0.6 });
          continue;
        }
        this.spawn(p, { color: night ? '#8a8f99' : e.color || '#e2e2e2', life: 4.5, size: 0.22, grow: 0.7, rise: 0.32, drift: 0.14, opacity: 0.5 });
      }
    }
    for (let i = this.live.length - 1; i >= 0; i--) {
      const s = this.live[i];
      const u = s.userData;
      u.age += dt;
      const k = u.age / u.life;
      if (k >= 1) {
        s.visible = false;
        this.live.splice(i, 1);
        this.pool.push(s);
        continue;
      }
      s.position.y += u.rise * dt * (1 - k * 0.5);
      s.position.x += u.vx * dt;
      s.position.z += u.vz * dt;
      s.scale.setScalar(u.size * (1 + u.grow * k * 3));
      s.material.opacity = u.opacity * Math.min(1, k * 6) * (1 - k);
    }
  }
}

export class Clouds {
  constructor(scene, cx, cz) {
    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
    this.cx = cx; this.cz = cz;
    this.items = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const n = 4 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        const r = 1.2 + Math.random() * 1.6;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
        m.position.set((k - n / 2) * 1.6 + Math.random(), Math.random() * 0.8, (Math.random() - 0.5) * 2);
        m.scale.y = 0.55;
        m.castShadow = true;
        g.add(m);
      }
      g.position.set(cx - 60 + Math.random() * 120, 16 + Math.random() * 5, cz - 60 + Math.random() * 120);
      this.group.add(g);
      this.items.push(g);
    }
    scene.add(this.group);
  }

  update(dt) {
    for (const g of this.items) {
      g.position.x += dt * 0.6;
      g.position.z += dt * 0.15;
      if (g.position.x > this.cx + 80) { g.position.x = this.cx - 80; g.position.z = this.cz - 60 + Math.random() * 120; }
      if (g.position.z > this.cz + 80) g.position.z = this.cz - 80;
    }
  }

  setOpacity(o) {
    // stay "visible" even when faded out so the clouds keep casting shadows
    const m = this.items[0].children[0].material;
    m.opacity = 0.9 * o;
    m.depthWrite = false;
  }
}
