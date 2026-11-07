// Ambient life around the city: flocks of birds, boats on the sea, aircraft crossing the sky.
import * as THREE from 'three';
import { TIME } from './shared.js';

// ------------------------------------------------------------------ birds
export class Birds {
  constructor(scene, cx, cz) {
    this.cx = cx; this.cz = cz;
    const g = new THREE.BufferGeometry();
    // body + two wings (wing tips flap in the vertex shader)
    const p = [
      -0.09, 0, 0.0, 0, 0, -0.03, 0, 0, 0.03, // left wing
      0.09, 0, 0.0, 0, 0, 0.03, 0, 0, -0.03, // right wing
      0, 0, -0.045, 0, 0.008, 0.04, 0, -0.008, 0.04, // body
    ];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    const m = new THREE.MeshBasicMaterial({ color: '#2b2f36', side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = TIME;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
          transformed.y += abs(position.x) * sin(uTime * 13.0 + ph) * 0.9;`);
    };
    this.count = 30;
    this.mesh = new THREE.InstancedMesh(g, m, this.count);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.flocks = [0, 1, 2].map((i) => ({
      c: new THREE.Vector3(cx + (i - 1) * 18, 7 + i * 2, cz + (i - 1) * 10),
      r: 6 + i * 3, a: i * 2, s: 0.25 + i * 0.05,
      drift: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4),
      off: Array.from({ length: 10 }, () => new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 2.2)),
    }));
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(1, 1, 1); this.p = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  update(dt, night) {
    this.mesh.visible = night < 0.6;
    let i = 0;
    for (const f of this.flocks) {
      f.a += dt * f.s;
      f.c.addScaledVector(f.drift, dt);
      if (Math.abs(f.c.x - this.cx) > 40) f.drift.x *= -1;
      if (Math.abs(f.c.z - this.cz) > 40) f.drift.z *= -1;
      const head = f.a + Math.PI / 2;
      for (const o of f.off) {
        if (i >= this.count) break;
        const a = f.a + o.x * 0.05;
        this.p.set(f.c.x + Math.cos(a) * (f.r + o.z), f.c.y + o.y + Math.sin(f.a * 2 + o.x) * 0.2, f.c.z + Math.sin(a) * (f.r + o.z));
        this.q.setFromAxisAngle(this.up, -head);
        this.m4.compose(this.p, this.q, this.s);
        this.mesh.setMatrixAt(i++, this.m4);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ boats
function boatModel(kind) {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: kind === 'ship' ? '#b8402f' : '#f4f4f0', roughness: 0.5 });
  const deck = new THREE.MeshStandardMaterial({ color: kind === 'ship' ? '#2f3d4f' : '#a5774d', roughness: 0.7 });
  if (kind === 'ship') {
    const h = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 0.7), hull);
    h.position.y = 0.05;
    g.add(h);
    const d = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.05, 0.66), deck);
    d.position.y = 0.25;
    g.add(d);
    const cols = ['#2f6db1', '#3a8d5c', '#d9a531', '#c2452d', '#e6e6e6'];
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.25), new THREE.MeshStandardMaterial({ color: cols[i % 5], roughness: 0.6, metalness: 0.2 }));
      c.position.set(-1.1 + (i % 5) * 0.52, 0.37 + Math.floor(i / 5) * 0.0, i < 5 ? -0.15 : 0.15);
      g.add(c);
    }
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.6), new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.5 }));
    br.position.set(1.3, 0.48, 0);
    g.add(br);
  } else {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.05, 0.7, 8, 1), hull);
    h.rotation.z = Math.PI / 2;
    h.scale.set(1, 1, 0.5);
    h.position.y = 0.04;
    g.add(h);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 4), deck);
    mast.position.y = 0.42;
    g.add(mast);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.1, 0, 0, 0.78, 0, -0.32, 0.1, 0], 3));
    sg.computeVertexNormals();
    const sail = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: '#fbfbf6', side: THREE.DoubleSide, roughness: 0.8 }));
    g.add(sail);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export class Boats {
  constructor(scene, W, H, seaY) {
    this.items = [];
    this.seaY = seaY;
    const specs = [['ship', 0.6, H + 30], ['sail', 0.35, H + 16], ['sail', 0.28, H + 22], ['sail', 0.4, H + 40], ['ship', 0.45, H + 55]];
    specs.forEach(([kind, speed, z], i) => {
      const g = boatModel(kind);
      g.position.set(-60 + i * 37, seaY, z);
      const dir = i % 2 ? -1 : 1;
      g.rotation.y = dir > 0 ? 0 : Math.PI;
      scene.add(g);
      // wake
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(kind === 'ship' ? 6 : 2, kind === 'ship' ? 0.9 : 0.35), new THREE.MeshBasicMaterial({ map: wakeTexture(), transparent: true, opacity: 0.55, depthWrite: false }));
      wake.rotation.x = -Math.PI / 2;
      scene.add(wake);
      this.items.push({ g, wake, speed, dir, kind, ph: Math.random() * 6, len: kind === 'ship' ? 6 : 2 });
    });
    this.W = W;
  }

  update(dt, t) {
    for (const b of this.items) {
      b.g.position.x += b.speed * b.dir * dt;
      if (b.g.position.x > this.W + 120) b.g.position.x = -120;
      if (b.g.position.x < -120) b.g.position.x = this.W + 120;
      b.g.position.y = this.seaY + Math.sin(t * 1.3 + b.ph) * 0.025;
      b.g.rotation.x = Math.sin(t * 1.1 + b.ph) * 0.03;
      b.g.rotation.z = Math.sin(t * 0.9 + b.ph * 2) * 0.03;
      b.wake.position.set(b.g.position.x - b.dir * b.len * 0.55, this.seaY + 0.01, b.g.position.z);
      b.wake.rotation.z = b.dir > 0 ? 0 : Math.PI;
    }
  }
}

let wakeTex = null;
function wakeTexture() {
  if (wakeTex) return wakeTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.85, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 32 - 30); ctx.lineTo(256, 32 - 4); ctx.lineTo(256, 32 + 4); ctx.lineTo(0, 32 + 30); ctx.closePath(); ctx.fill();
  wakeTex = new THREE.CanvasTexture(c);
  wakeTex.colorSpace = THREE.SRGBColorSpace;
  return wakeTex;
}

// ------------------------------------------------------------------ aircraft
export class Aircraft {
  constructor(scene, cx, cz) {
    this.cx = cx; this.cz = cz;
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: '#f5f7f9', roughness: 0.3, metalness: 0.2 });
    const blue = new THREE.MeshStandardMaterial({ color: '#2f6db1', roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 2.6, 12), white);
    body.rotation.z = Math.PI / 2;
    g.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), white);
    nose.position.x = 1.3;
    g.add(nose);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 2.8), white);
    wing.position.x = 0.1;
    g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 1.0), white);
    tail.position.x = -1.15;
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.04), blue);
    fin.position.set(-1.15, 0.3, 0);
    g.add(fin);
    for (const z of [-0.7, 0.7]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 10), blue);
      eng.rotation.z = Math.PI / 2;
      eng.position.set(0.25, -0.1, z);
      g.add(eng);
    }
    // navigation lights
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.3) }));
    red.position.set(0.1, 0, -1.4);
    const green = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 4, 0.5) }));
    green.position.set(0.1, 0, 1.4);
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 5) }));
    this.beacon.position.set(0, 0.18, 0);
    g.add(red, green, this.beacon);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(0.9);
    scene.add(g);
    this.g = g;
    // contrail
    const tc = document.createElement('canvas');
    tc.width = 256; tc.height = 16;
    const ctx = tc.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 256, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.7)');
    ctx.fillStyle = gr; ctx.fillRect(0, 4, 256, 8);
    const tt = new THREE.CanvasTexture(tc);
    this.trail = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.5), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    scene.add(this.trail);
    this.reset();
  }

  reset() {
    const a = Math.random() * Math.PI * 2;
    this.dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-this.dir.z, 0, this.dir.x).multiplyScalar((Math.random() - 0.5) * 50);
    this.pos = new THREE.Vector3(this.cx, 24 + Math.random() * 6, this.cz).addScaledVector(this.dir, -160).add(side);
    this.wait = 25 + Math.random() * 50;
  }

  update(dt, t, night) {
    if (this.wait > 0) { this.wait -= dt; this.g.visible = this.trail.visible = false; return; }
    this.g.visible = this.trail.visible = true;
    this.pos.addScaledVector(this.dir, dt * 7);
    this.g.position.copy(this.pos);
    this.g.rotation.y = Math.atan2(-this.dir.z, this.dir.x);
    this.trail.position.copy(this.pos).addScaledVector(this.dir, -21);
    this.trail.rotation.set(-Math.PI / 2, Math.atan2(-this.dir.z, this.dir.x), 0, 'YXZ');
    this.trail.material.opacity = 0.6 * (1 - night * 0.8);
    this.beacon.visible = Math.sin(t * 6) > 0.6;
    if (this.pos.distanceTo(new THREE.Vector3(this.cx, this.pos.y, this.cz)) > 170) this.reset();
  }
}
