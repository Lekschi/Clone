// Physically based sky (Rayleigh/Mie scattering), stars and moon. The sky is also rendered into a
// prefiltered environment map so glass, water and metal reflect the real sky colour of the moment.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

function tameSky(sky, gain) {
  const m = sky.material;
  m.uniforms.skyGain = { value: gain };
  m.fragmentShader = m.fragmentShader
    .replace('uniform vec3 up;', 'uniform vec3 up;\nuniform float skyGain;')
    .replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
  m.needsUpdate = true;
}

export class SkySystem {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.sky = new Sky();
    this.sky.scale.setScalar(800);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);
    tameSky(this.sky, 0.5);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;

    // offscreen copy for the environment map
    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.scale.setScalar(100);
    this.envScene.add(this.envSky);
    tameSky(this.envSky, 0.5);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: '#4a6b3a' }));
    this.envGround.rotation.x = -Math.PI / 2;
    this.envGround.position.y = -2;
    this.envScene.add(this.envGround);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    this.lastEnvDir = new THREE.Vector3(0, -1, 0);
    this.lastEnvWeather = -1;

    // stars
    const n = 1600;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u1 = Math.random(), v1 = Math.random() * 0.95;
      const th = u1 * Math.PI * 2, ph = Math.acos(1 - v1);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 600;
      pos[i * 3 + 1] = Math.cos(ph) * 600;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 600;
      const b = 0.6 + Math.random() * 0.4;
      const warm = Math.random();
      col[i * 3] = b; col[i * 3 + 1] = b * (0.9 + warm * 0.1); col[i * 3 + 2] = b * (0.85 + (1 - warm) * 0.25);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    scene.add(this.stars);

    // moon
    const mc = document.createElement('canvas');
    mc.width = mc.height = 128;
    const ctx = mc.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,253,240,1)'); g.addColorStop(0.32, 'rgba(240,240,225,1)'); g.addColorStop(0.36, 'rgba(200,215,255,0.35)'); g.addColorStop(1, 'rgba(160,190,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(180,180,170,0.35)';
    for (const [x, y, r] of [[54, 52, 7], [72, 70, 9], [60, 78, 5], [76, 50, 4]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    const mt = new THREE.CanvasTexture(mc);
    mt.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, transparent: true, depthWrite: false, fog: false, opacity: 0 }));
    this.moon.scale.setScalar(70);
    scene.add(this.moon);
  }

  // dir: normalised direction to the sun (may be below the horizon at night)
  update(camera, sunDir, night, weather) {
    const p = camera.position;
    this.sky.position.copy(p);
    this.stars.position.copy(p);
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(sunDir);
    u.turbidity.value = 5 + weather * 12;
    u.rayleigh.value = 1.4 + weather * 1.5 - night * 0.4;
    u.mieCoefficient.value = 0.004 + weather * 0.01;
    u.skyGain.value = (0.5 - weather * 0.22) * (1 - night * 0.45);
    this.stars.material.opacity = Math.max(0, night - 0.35) * 1.5 * (1 - weather);
    this.stars.rotation.y += 0.00004;
    const md = sunDir.clone().negate();
    md.y = Math.abs(md.y) * 0.8 + 0.25;
    md.normalize();
    this.moon.position.copy(p).addScaledVector(md, 500);
    this.moon.material.opacity = Math.max(0, night - 0.3) * (1 - weather * 0.8);
    // refresh reflections when the light changed noticeably
    if (sunDir.distanceTo(this.lastEnvDir) > 0.035 || Math.abs(weather - this.lastEnvWeather) > 0.08) this.bakeEnv(sunDir, night, weather);
  }

  bakeEnv(sunDir, night, weather) {
    this.lastEnvDir.copy(sunDir);
    this.lastEnvWeather = weather;
    const u = this.envSky.material.uniforms, s = this.sky.material.uniforms;
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'skyGain']) u[k].value = s[k].value;
    u.sunPosition.value.copy(sunDir);
    this.envGround.material.color.setRGB(0.18, 0.26, 0.14).multiplyScalar(Math.max(0.35, 1 - night));
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 200);
    if (this.envRT) this.envRT.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }
}
