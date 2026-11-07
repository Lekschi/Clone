// Weather: clear, cloudy and rainy spells that change light, sky, wetness and particles.
import * as THREE from 'three';

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.state = 'clear';
    this.amount = 0; // 0 clear .. 1 heavy rain (smoothed)
    this.target = 0;
    this.timer = 90 + Math.random() * 120;
    this.enabled = true;
    // rain streaks: line segments recycled around the camera target
    const N = 2600;
    const pos = new Float32Array(N * 6);
    this.drops = [];
    for (let i = 0; i < N; i++) this.drops.push({ x: (Math.random() - 0.5) * 60, y: Math.random() * 18, z: (Math.random() - 0.5) * 60, v: 14 + Math.random() * 6 });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c9d6e6', transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    scene.add(this.rain);
    this.N = N;
  }

  update(dt, target) {
    if (!this.enabled) this.target = 0;
    else {
      this.timer -= dt;
      if (this.timer <= 0) {
        const r = Math.random();
        this.state = this.state !== 'clear' ? 'clear' : r < 0.55 ? 'cloudy' : 'rain';
        this.target = this.state === 'clear' ? 0 : this.state === 'cloudy' ? 0.45 : 1;
        this.timer = this.state === 'clear' ? 150 + Math.random() * 240 : 70 + Math.random() * 90;
      }
    }
    this.amount += (this.target - this.amount) * Math.min(1, dt * 0.15);
    const raining = Math.max(0, this.amount - 0.55) / 0.45;
    this.rain.material.opacity = raining * 0.55;
    this.rain.visible = raining > 0.01;
    if (!this.rain.visible) return;
    const p = this.rain.geometry.attributes.position.array;
    const n = Math.floor(this.N * raining);
    const wind = 0.15;
    for (let i = 0; i < this.N; i++) {
      const d = this.drops[i];
      d.y -= d.v * dt;
      d.x += wind * d.v * dt * 0.1;
      if (d.y < 0) { d.y += 18; d.x = (Math.random() - 0.5) * 60; d.z = (Math.random() - 0.5) * 60; }
      const o = i * 6;
      if (i >= n) { p[o] = p[o + 3] = 0; p[o + 1] = p[o + 4] = -100; p[o + 2] = p[o + 5] = 0; continue; }
      const x = target.x + d.x, z = target.z + d.z;
      p[o] = x; p[o + 1] = d.y; p[o + 2] = z;
      p[o + 3] = x - wind * 0.25; p[o + 4] = d.y + 0.35; p[o + 5] = z;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  // 0..1 cloud cover, used for lighting
  get cover() { return Math.min(1, this.amount * 1.1); }
  get wet() { return Math.max(0, this.amount - 0.5) * 2; }
}
