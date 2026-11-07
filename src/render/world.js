// The 3D view of the city: scene setup, lighting and day/night, terrain, roads, buildings,
// traffic, effects, placement previews and picking.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BUILDINGS } from '../data/buildings.js';
import { makeModel } from './models.js';
import { nightMaterials, M } from './kit.js';
import { roadTexture, setAnisotropy, gridTexture, normalFromCanvas } from './textures.js';
import { Terrain, Forest } from './terrain.js';
import { Traffic } from './traffic.js';
import { Particles, Clouds } from './fx.js';
import { Post } from './post.js';
import { SkySystem } from './sky.js';
import { Weather } from './weather.js';
import { Birds, Boats, Aircraft } from './life.js';
import { TIME, WIND } from './shared.js';
import { sfx } from '../audio.js';
import { Builder, forEachMaterial } from './kit.js';
import { SEA_LEVEL } from './terrain.js';
import { StreetFurniture } from './street.js';
import { Agents } from './agents.js';

const HIGHWAY_Z = 30;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export class World {
  constructor(container, game, settings) {
    this.game = game;
    this.settings = settings;
    this.container = container;
    // MSAA is replaced by SMAA in the post chain (AO needs a clean depth buffer)
    const r = new THREE.WebGLRenderer({ antialias: settings.quality === 'low', powerPreference: 'high-performance', stencil: false });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(r.domElement);
    this.renderer = r;
    setAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

    const scene = new THREE.Scene();
    this.scene = scene;
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 1200);
    this.cam = { target: new THREE.Vector3(26, 0, 30), dist: 26, yaw: -0.62, pitch: 0.92, tilt: 0 };
    // the rendered view eases towards `cam` (the goal set by input) for smooth, weighty motion
    this.view = { target: new THREE.Vector3(30, 0, 34), dist: 75, yaw: -1.1, tilt: 0 };
    this.panAcc = new THREE.Vector2();
    this.panVel = new THREE.Vector2();
    this.dragging = false;

    this.hemi = new THREE.HemisphereLight('#d6e9ff', '#6f7d58', 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3df', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 2.5;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.post = new Post(r, scene, this.camera);
    this.applyQuality();

    this.fog = new THREE.Fog('#bfd8ec', 60, 260);
    scene.fog = this.fog;
    this.skySys = new SkySystem(r, scene);
    this.weather = new Weather(scene);
    this.weather.enabled = settings.weather !== false;

    // landscape
    this.terrain = new Terrain(game.W, game.H, game.state.seed, HIGHWAY_Z);
    scene.add(this.terrain.build());
    this.forest = new Forest(scene);
    this.treeSpots = this.terrain.treeSpots((x, z) => !game.isUnlocked(x, z) && game.at(x, z) === 0);
    this.forest.set(this.treeSpots);

    this.roadGroup = new THREE.Group();
    scene.add(this.roadGroup);
    this.lockGroup = new THREE.Group();
    scene.add(this.lockGroup);
    this.buildRoot = new THREE.Group();
    scene.add(this.buildRoot);
    this.overlayGroup = new THREE.Group();
    scene.add(this.overlayGroup);
    this.previewGroup = new THREE.Group();
    scene.add(this.previewGroup);

    // build grid shown while placing
    const gt = gridTexture();
    const gtex = gt.clone(); gtex.needsUpdate = true; gtex.repeat.set(game.W, game.H);
    this.grid = new THREE.Mesh(new THREE.PlaneGeometry(game.W, game.H), new THREE.MeshBasicMaterial({ map: gtex, transparent: true, opacity: 0.35, depthWrite: false }));
    this.grid.rotation.x = -Math.PI / 2;
    this.grid.position.set(game.W / 2, 0.03, game.H / 2);
    this.grid.visible = false;
    this.grid.renderOrder = 2;
    scene.add(this.grid);

    this.objs = new Map();
    this.anims = [];
    this.street = new StreetFurniture(scene, game);
    this.traffic = new Traffic(scene, game, HIGHWAY_Z);
    this.traffic.street = this.street;
    this.walkers = new Traffic(scene, game, HIGHWAY_Z, { walkers: true });
    this.agents = new Agents(scene, game, this);
    this.particles = new Particles(scene);
    this.clouds = new Clouds(scene, game.W / 2, game.H / 2);
    this.birds = new Birds(scene, game.W / 2, game.H / 2);
    this.boats = new Boats(scene, game.W, game.H, SEA_LEVEL);
    this.aircraft = new Aircraft(scene, game.W / 2, game.H / 2);

    this.time = settings.daytime === 'real' ? this.realTime() : 0.42;
    this.night = 0;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.selected = null;
    this.overlay = null;

    this.rebuildRoads();
    this.rebuildLocks();
    for (const b of game.state.buildings) this.syncBuilding(b, false);
    this.updateEmitters();

    game.on('built', (b) => { this.syncBuilding(b, 'build'); this.updateEmitters(); this.refreshOverlay(); });
    game.on('moved', (b) => { this.syncBuilding(b, true); this.updateEmitters(); this.refreshOverlay(); });
    game.on('removed', (b) => { this.removeBuilding(b); this.updateEmitters(); this.refreshOverlay(); });
    game.on('upgraded', (b) => { this.syncBuilding(b, 'build'); this.updateEmitters(); });
    game.on('roads', () => { this.rebuildRoads(); this.refacingAll(); });
    game.on('expanded', () => { this.rebuildLocks(); this.treeSpots = this.treeSpots.filter((s) => !s.cell || !game.isUnlocked(s.cell[0], s.cell[1])); this.forest.set(this.treeSpots); });
    game.on('city', () => this.refreshOverlay());
    game.on('fire', () => this.updateEmitters());
    // delivery trucks carry finished goods from factories and shops to the warehouse
    game.on('collected', (b) => {
      const cat = BUILDINGS[b.type].cat;
      if (cat !== 'industry' && cat !== 'commerce') return;
      const store = game.state.buildings.find((x) => x.type === 'storage');
      if (store) this.agents.dispatch('truck', b, store, { color: cat === 'industry' ? '#f2b632' : '#3f7fd8' });
    });
    game.on('fireOut', (b) => { this.updateEmitters(); const [w, d] = game.size(b); this.particles.dust(b.x + w / 2, b.z + d / 2, w, d); });

    this.resize();
  }

  applyQuality() {
    const q = this.settings.quality || 'high';
    const high = q !== 'low';
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, q === 'ultra' ? 2 : high ? 1.6 : 1.25));
    const size = q === 'ultra' ? 4096 : high ? 3072 : 2048;
    this.post.setQuality(q);
    if (this.weather) this.weather.enabled = this.settings.weather !== false;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.renderer.shadowMap.enabled = this.settings.shadows !== false;
  }

  realTime() {
    const d = new Date();
    return (d.getHours() + d.getMinutes() / 60) / 24;
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.post.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ camera
  updateCamera(dt = 0.016) {
    const c = this.cam;
    // inertia: keep gliding after a flick
    if (this.dragging) {
      if (dt > 0) this.panVel.lerp(this.panAcc.clone().divideScalar(dt), 0.5);
    } else if (this.panVel.lengthSq() > 1e-4) {
      c.target.x += this.panVel.x * dt;
      c.target.z += this.panVel.y * dt;
      this.panVel.multiplyScalar(Math.exp(-dt * 4.5));
    }
    this.panAcc.set(0, 0);
    if (this.cinematic) {
      // title screen: a slow glide around the city with the horizon in view
      this.cineT = (this.cineT || 0) + dt;
      const t = this.cineT;
      const cx = this.game.W / 2 - 4, cz = this.game.H / 2 - 2;
      c.target.set(cx + Math.sin(t * 0.045) * 7, 0, cz + Math.cos(t * 0.06) * 5);
      c.dist = 27 + Math.sin(t * 0.08) * 5;
      c.yaw = -0.9 + t * 0.035;
      c.tilt = -0.66;
    }
    c.dist = Math.max(4.5, Math.min(80, c.dist));
    c.tilt = Math.max(this.cinematic ? -0.7 : -0.5, Math.min(0.25, c.tilt || 0));
    c.pitch = Math.max(0.14, 0.62 + smooth(5, 50, c.dist) * 0.42 + c.tilt);
    c.target.x = Math.max(-6, Math.min(this.game.W + 6, c.target.x));
    c.target.z = Math.max(-6, Math.min(this.game.H + 8, c.target.z));
    const v = this.view;
    const k = 1 - Math.exp(-dt * 11);
    v.target.lerp(c.target, k);
    v.dist += (c.dist - v.dist) * (1 - Math.exp(-dt * 8));
    let dy = c.yaw - v.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    v.yaw += dy * (1 - Math.exp(-dt * 9));
    v.tilt += (c.tilt - v.tilt) * (1 - Math.exp(-dt * 8));
    const pitch = Math.max(0.14, 0.62 + smooth(5, 50, v.dist) * 0.42 + v.tilt);
    const cp = Math.cos(pitch);
    this.camera.position.set(
      v.target.x + Math.sin(v.yaw) * cp * v.dist,
      v.target.y + Math.sin(pitch) * v.dist,
      v.target.z + Math.cos(v.yaw) * cp * v.dist,
    );
    // never dip into a building: stay above whatever stands under the camera
    const id = this.game.at(Math.floor(this.camera.position.x), Math.floor(this.camera.position.z));
    const o = id > 0 ? this.objs.get(id) : null;
    const minY = (o ? (o.obj.userData.height || 0) : 0) + 0.5;
    this.camLift = Math.max(this.camLift || 0, minY - this.camera.position.y);
    this.camLift *= Math.exp(-dt * 1.5);
    if (this.camera.position.y < minY) this.camLift = Math.max(this.camLift, minY - this.camera.position.y);
    this.camera.position.y += Math.max(0, this.camLift);
    this.camera.lookAt(v.target);
  }

  setDragging(on) {
    this.dragging = on;
    if (on) this.panVel.set(0, 0);
  }

  stopGlide() { this.panVel.set(0, 0); }

  // Move the camera target by a screen-space delta (pixels).
  panBy(dx, dy) {
    const c = this.cam;
    const scale = (c.dist * Math.tan((this.camera.fov * Math.PI) / 360) * 2) / this.container.clientHeight;
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
    // right vector (co, -s), forward on ground (-s, -co)
    const mx = -(dx * co + dy * s / Math.sin(c.pitch)) * scale;
    const mz = -(-dx * s + dy * co / Math.sin(c.pitch)) * scale;
    c.target.x += mx;
    c.target.z += mz;
    this.panAcc.x += mx;
    this.panAcc.y += mz;
  }

  focus(x, z, dist) {
    this.cam.target.set(x, 0, z);
    if (dist) this.cam.dist = dist;
  }

  // ------------------------------------------------------------------ roads & land
  rebuildRoads() {
    const g = this.game;
    for (const m of this.roadGroup.children) m.dispose?.();
    this.roadGroup.clear();
    const groups = new Map();
    for (const r of g.state.roads) {
      const x = r % g.W, z = Math.floor(r / g.W);
      const con = (dx, dz) => {
        const nx = x + dx, nz = z + dz;
        if (!g.inMap(nx, nz)) return true;
        return g.isRoad(nx, nz);
      };
      const mask = (con(0, -1) ? 1 : 0) | (con(1, 0) ? 2 : 0) | (con(0, 1) ? 4 : 0) | (con(-1, 0) ? 8 : 0);
      if (!groups.has(mask)) groups.set(mask, []);
      groups.get(mask).push([x, z]);
    }
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const m4 = new THREE.Matrix4();
    for (const [mask, cells] of groups) {
      const tex = roadTexture(!!(mask & 1), !!(mask & 2), !!(mask & 4), !!(mask & 8));
      const mat = this.roadMats?.[mask] || new THREE.MeshStandardMaterial({ map: tex, normalMap: normalFromCanvas(tex.image, 1.4), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
      this.roadMats = this.roadMats || {};
      this.roadMats[mask] = mat;
      const im = new THREE.InstancedMesh(geo, mat, cells.length);
      cells.forEach(([x, z], i) => { m4.makeTranslation(x + 0.5, 0.012, z + 0.5); im.setMatrixAt(i, m4); });
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.roadGroup.add(im);
    }
    this.street.rebuild(groups);
    this.traffic.setRoads();
    this.walkers?.setRoads();
  }

  rebuildLocks() {
    const g = this.game;
    this.lockGroup.clear();
    const C = 8, CW = g.W / C;
    const shade = new THREE.MeshBasicMaterial({ color: '#0d1a12', transparent: true, opacity: 0.28, depthWrite: false });
    const line = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
    const sale = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.06, depthWrite: false });
    for (const m of [line, sale]) m.userData.base = m.color.clone();
    this.lockMats = [line, sale];
    const planes = [];
    for (let ci = 0; ci < CW * CW; ci++) {
      if (g.unlocked.has(ci)) continue;
      const cx = ci % CW, cz = Math.floor(ci / CW);
      const p = new THREE.PlaneGeometry(C, C);
      p.rotateX(-Math.PI / 2);
      p.translate(cx * C + C / 2, 0.02, cz * C + C / 2);
      planes.push(p);
      if (g.chunkUnlockable(ci)) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(C - 0.3, C - 0.3), sale);
        s.rotation.x = -Math.PI / 2;
        s.position.set(cx * C + C / 2, 0.025, cz * C + C / 2);
        s.renderOrder = 1;
        this.lockGroup.add(s);
      }
    }
    if (planes.length) {
      const merged = mergePlanes(planes);
      const mesh = new THREE.Mesh(merged, shade);
      mesh.renderOrder = 1;
      this.lockGroup.add(mesh);
    }
    // boundary of owned land
    const edges = [];
    for (let ci = 0; ci < CW * CW; ci++) {
      if (!g.unlocked.has(ci)) continue;
      const cx = ci % CW, cz = Math.floor(ci / CW);
      const owned = (x, z) => x >= 0 && z >= 0 && x < CW && z < CW && g.unlocked.has(z * CW + x);
      if (!owned(cx, cz - 1)) edges.push([cx * C + C / 2, cz * C, C, 0.08]);
      if (!owned(cx, cz + 1)) edges.push([cx * C + C / 2, cz * C + C, C, 0.08]);
      if (!owned(cx - 1, cz)) edges.push([cx * C, cz * C + C / 2, 0.08, C]);
      if (!owned(cx + 1, cz)) edges.push([cx * C + C, cz * C + C / 2, 0.08, C]);
    }
    const eg = edges.map(([x, z, w, d]) => { const p = new THREE.PlaneGeometry(w, d); p.rotateX(-Math.PI / 2); p.translate(x, 0.03, z); return p; });
    if (eg.length) {
      const m = new THREE.Mesh(mergePlanes(eg), line);
      m.renderOrder = 2;
      this.lockGroup.add(m);
    }
  }

  // ------------------------------------------------------------------ buildings
  facing(b) {
    const g = this.game;
    const [w, d] = g.size(b);
    const def = BUILDINGS[b.type];
    const sides = [
      { ang: 0, n: 0, cells: () => { let n = 0; for (let i = 0; i < w; i++) n += g.isRoad(b.x + i, b.z + d); return n; } },
      { ang: Math.PI / 2, n: 0, cells: () => { let n = 0; for (let i = 0; i < d; i++) n += g.isRoad(b.x + w, b.z + i); return n; } },
      { ang: Math.PI, n: 0, cells: () => { let n = 0; for (let i = 0; i < w; i++) n += g.isRoad(b.x + i, b.z - 1); return n; } },
      { ang: -Math.PI / 2, n: 0, cells: () => { let n = 0; for (let i = 0; i < d; i++) n += g.isRoad(b.x - 1, b.z + i); return n; } },
    ];
    const square = def.size[0] === def.size[1];
    const odd = (b.rot || 0) % 2 === 1;
    const allowed = square ? [0, 1, 2, 3] : odd ? [1, 3] : [0, 2];
    let best = allowed[0], bestN = -1;
    for (const i of allowed) {
      const n = sides[i].cells();
      if (n > bestN) { bestN = n; best = i; }
    }
    if (bestN <= 0 && square) best = allowed.includes(b.face) ? b.face : allowed[0];
    return sides[best].ang;
  }

  syncBuilding(b, anim) {
    const old = this.objs.get(b.id);
    const level = BUILDINGS[b.type].cat === 'res' ? b.level : 1;
    const g = this.game;
    const [w, d] = g.size(b);
    const ang = this.facing(b);
    if (old && old.level === level) {
      old.obj.position.set(b.x + w / 2, 0, b.z + d / 2);
      old.obj.rotation.y = ang;
      old.obj.updateMatrixWorld(true);
      if (anim === 'build') this.construct(old.obj, b, w, d);
      else if (anim) this.pop(old.obj, b, w, d);
      return;
    }
    if (old) this.buildRoot.remove(old.obj);
    const obj = makeModel(b.type, level, b.v || 0);
    obj.position.set(b.x + w / 2, 0, b.z + d / 2);
    obj.rotation.y = ang;
    obj.userData.bid = b.id;
    obj.traverse((o) => { o.userData.bid = b.id; });
    obj.updateMatrixWorld(true);
    if (obj.userData.height == null) {
      const box = new THREE.Box3().setFromObject(obj);
      obj.userData.height = box.max.y;
    }
    this.buildRoot.add(obj);
    this.objs.set(b.id, { obj, level, type: b.type });
    if (anim === 'build') this.construct(obj, b, w, d);
    else if (anim) this.pop(obj, b, w, d);
  }

  pop(obj, b, w, d) {
    this.finishAnim(obj);
    obj.scale.set(1, 0.02, 1);
    this.anims.push({ kind: 'pop', obj, t: 0, dur: 0.75 });
    this.particles.dust(b.x + w / 2, b.z + d / 2, w, d);
  }

  finishAnim(obj) {
    for (const a of this.anims) if (a.obj === obj) a.t = a.dur;
  }

  // Construction site: scaffolding goes up, the building rises floor by floor while a tower
  // crane swings overhead, then the scaffolding comes down.
  construct(obj, b, w, d) {
    this.finishAnim(obj);
    const h = Math.max(0.3, obj.userData.height || 0.6);
    const bl = new Builder();
    const pole = M.color('#aeb5bb', { metal: 0.6, rough: 0.4 });
    const plank = M.color('#b98c52');
    const net = M.color('#3d8f6c', { opacity: 0.42 });
    const W = Math.max(0.6, w - 0.2), D = Math.max(0.6, d - 0.2);
    const top = Math.min(h + 0.06, 6.2);
    const nx = Math.max(2, Math.round(W / 0.33)), nz = Math.max(2, Math.round(D / 0.33));
    for (let i = 0; i <= nx; i++) for (const z of [-D / 2, D / 2]) bl.box(0.012, top, 0.012, pole, -W / 2 + (i * W) / nx, 0, z);
    for (let i = 1; i < nz; i++) for (const x of [-W / 2, W / 2]) bl.box(0.012, top, 0.012, pole, x, 0, -D / 2 + (i * D) / nz);
    for (let y = 0.25; y < top; y += 0.25) {
      for (const z of [-D / 2, D / 2]) { bl.box(W, 0.008, 0.012, pole, 0, y, z); bl.box(W, 0.006, 0.06, plank, 0, y - 0.006, z + Math.sign(z) * 0.035); }
      for (const x of [-W / 2, W / 2]) { bl.box(0.012, 0.008, D, pole, x, y, 0); bl.box(0.06, 0.006, D, plank, x + Math.sign(x) * 0.035, y - 0.006, 0); }
    }
    bl.box(W, top, 0.004, net, 0, 0, -D / 2 - 0.07);
    bl.box(0.004, top, D, net, W / 2 + 0.07, 0, 0);
    const scaffold = bl.build();
    scaffold.position.copy(obj.position);
    scaffold.rotation.y = obj.rotation.y;
    scaffold.scale.y = 0.01;
    this.scene.add(scaffold);
    // tower crane
    let crane = null, jib = null;
    if (h > 0.45 || w * d >= 4) {
      crane = new THREE.Group();
      const yellow = M.color('#f2b632', { metal: 0.3, rough: 0.5 });
      const dark = M.color('#3a3f45', { metal: 0.4 });
      const mh = Math.min(h + 0.7, 7);
      const cb = new Builder();
      cb.box(0.05, mh, 0.05, yellow, 0, 0, 0);
      for (let y = 0.1; y < mh; y += 0.12) cb.box(0.056, 0.008, 0.056, dark, 0, y, 0);
      cb.box(0.2, 0.04, 0.2, M.color('#9aa1a8'), 0, 0, 0);
      const mast = cb.build();
      crane.add(mast);
      jib = new THREE.Group();
      jib.position.y = mh;
      const L = Math.max(w, d) * 1.1 + 0.5;
      const jb = new Builder();
      jb.box(L, 0.035, 0.035, yellow, L / 2 - 0.05, 0, 0);
      jb.box(0.45, 0.03, 0.03, yellow, -0.25, 0, 0);
      jb.box(0.12, 0.08, 0.08, M.color('#8a9097'), -0.42, -0.06, 0);
      jb.box(0.07, 0.06, 0.06, M.color('#e9ecef'), 0.05, -0.06, 0.05);
      jb.box(0.03, 0.18, 0.03, yellow, 0, 0.02, 0);
      jb.box(0.004, mh * 0.6, 0.004, dark, L * 0.7, -mh * 0.6, 0);
      jb.box(0.03, 0.03, 0.03, M.color('#d93030'), L * 0.7, -mh * 0.6 - 0.03, 0);
      jib.add(jb.build());
      crane.add(jib);
      const cx = W / 2 + 0.12, cz = -D / 2 - 0.12;
      const a = obj.rotation.y;
      crane.position.set(obj.position.x + cx * Math.cos(a) + cz * Math.sin(a), 0, obj.position.z - cx * Math.sin(a) + cz * Math.cos(a));
      crane.scale.y = 0.01;
      this.scene.add(crane);
    }
    obj.scale.set(1, 0.01, 1);
    const dur = 2.6 + Math.min(4, h * 0.45);
    this.anims.push({ kind: 'build', obj, scaffold, crane, jib, t: 0, dur, floors: Math.max(1, Math.round(h / 0.25)), b, w, d, dustT: 0 });
    this.particles.dust(b.x + w / 2, b.z + d / 2, w, d);
  }

  stepAnims(dt) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      if (a.kind === 'pop') {
        a.obj.scale.y = Math.max(0.02, easeOutBack(k));
        if (k >= 1) { a.obj.scale.y = 1; this.anims.splice(i, 1); }
        continue;
      }
      // construction timeline: 0–12 % scaffold up, 12–88 % building rises, 88–100 % scaffold down
      const up = smooth(0, 0.12, k), down = smooth(0.88, 1, k);
      const sc = Math.max(0.01, up * (1 - down));
      a.scaffold.scale.y = sc;
      if (a.crane) {
        a.crane.scale.y = Math.max(0.01, smooth(0, 0.1, k) * (1 - smooth(0.92, 1, k)));
        a.jib.rotation.y = Math.sin(a.t * 0.9) * 1.1 + a.t * 0.25;
      }
      const p = Math.max(0, Math.min(1, (k - 0.12) / 0.76));
      const f = p * a.floors;
      const grown = (Math.floor(f) + smooth(0.15, 0.85, f - Math.floor(f))) / a.floors;
      a.obj.scale.y = Math.max(0.01, Math.min(1, grown));
      // hammering on the site, louder when the camera is close
      a.hamT = (a.hamT || 0) - dt;
      if (a.hamT <= 0 && k > 0.1 && k < 0.88) {
        a.hamT = 0.25 + Math.random() * 0.5;
        const d = Math.hypot(a.obj.position.x - this.view.target.x, a.obj.position.z - this.view.target.z) + this.view.dist * 0.4;
        const vol = Math.max(0, 0.35 - d * 0.012);
        if (vol > 0.02) {
          const pan = Math.max(-0.8, Math.min(0.8, this.toScreen(a.obj.position).x / this.container.clientWidth * 2 - 1));
          if (Math.random() < 0.85) sfx.hammer(vol, pan); else sfx.clink(vol * 0.8, pan);
        }
      }
      a.dustT -= dt;
      if (a.dustT <= 0 && k < 0.9) {
        a.dustT = 0.35;
        const pp = new THREE.Vector3(a.obj.position.x + (Math.random() - 0.5) * a.w * 0.8, 0.05 + grown * (a.obj.userData.height || 0.5), a.obj.position.z + (Math.random() - 0.5) * a.d * 0.8);
        this.particles.spawn(pp, { color: '#d6ccb8', life: 1.6, size: 0.18, grow: 1, rise: 0.15, drift: 0.1, opacity: 0.45 });
      }
      if (k >= 1) {
        a.obj.scale.y = 1;
        this.scene.remove(a.scaffold);
        if (a.crane) this.scene.remove(a.crane);
        for (const o of [a.scaffold, a.crane]) o?.traverse((m) => { if (m.isMesh) m.geometry.dispose(); });
        this.particles.dust(a.b.x + a.w / 2, a.b.z + a.d / 2, a.w, a.d);
        this.anims.splice(i, 1);
      }
    }
  }

  refacingAll() {
    for (const b of this.game.state.buildings) {
      const o = this.objs.get(b.id);
      if (o) o.obj.rotation.y = this.facing(b);
    }
  }

  removeBuilding(b) {
    const o = this.objs.get(b.id);
    if (!o) return;
    this.buildRoot.remove(o.obj);
    this.objs.delete(b.id);
    const [w, d] = this.game.size(b);
    this.particles.dust(b.x + w / 2, b.z + d / 2, w, d);
    if (this.selected === b.id) this.select(null);
  }

  updateEmitters() {
    const list = [];
    const g = this.game;
    for (const b of g.state.buildings) {
      const o = this.objs.get(b.id);
      if (o && b.fire) {
        const top = o.obj.userData.height ?? 0.6;
        for (const [dx, dz] of [[-0.25, 0], [0.25, -0.1], [0, 0.2]]) {
          list.push({ pos: new THREE.Vector3(o.obj.position.x + dx, top * 0.7, o.obj.position.z + dz), rate: 7, fire: true, active: () => !!b.fire });
        }
      }
      if (o && o.obj.userData.fountain?.length) {
        for (const p of o.obj.userData.fountain) list.push({ pos: p.clone().applyMatrix4(o.obj.matrixWorld), rate: 26, fountain: true });
      }
      if (!o || !o.obj.userData.smoke?.length) continue;
      const def = BUILDINGS[b.type];
      for (const p of o.obj.userData.smoke) {
        const pos = p.clone().applyMatrix4(o.obj.matrixWorld);
        let active = null;
        if (def.factory) active = () => b.slots.some((s) => s.end > Date.now());
        else if (def.shop) active = () => b.queue.some((s) => s.end > Date.now());
        list.push({ pos, rate: 1.6, active, color: def.supply ? '#ececec' : '#dedede' });
      }
    }
    this.particles.setEmitters(list);
  }

  // ------------------------------------------------------------------ selection, previews, overlays
  select(bid) {
    this.selected = bid;
    this.previewGroup.remove(this.selRing);
    if (!bid) return;
    const b = this.game.byId.get(bid);
    if (!b) return;
    const [w, d] = this.game.size(b);
    this.selRing = footprintMesh(w, d, '#ffd84a', 0.55);
    this.selRing.position.set(b.x + w / 2, 0.04, b.z + d / 2);
    this.previewGroup.add(this.selRing);
  }

  showGrid(on) { this.grid.visible = on; }

  setGhost(type, x, z, rot, ok, level = 1, v = 0) {
    const key = `${type}:${rot}:${level}`;
    if (!this.ghost || this.ghost.key !== key) {
      this.clearGhost();
      const obj = makeModel(type, level, v);
      obj.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.82;
          o.material.depthWrite = true;
          o.castShadow = false;
        }
      });
      const def = BUILDINGS[type];
      const [w, d] = rot % 2 ? [def.size[1], def.size[0]] : def.size;
      const fp = footprintMesh(w, d, '#3ddc84', 0.45);
      const grp = new THREE.Group();
      grp.add(obj);
      const radius = def.service?.r || def.boost?.r || def.pollution || 0;
      let ring = null;
      if (radius) {
        const col = def.pollution && !def.service && !def.boost ? '#c0603a' : def.boost ? '#7ad957' : '#4aa8ff';
        void col;
        ring = new THREE.Mesh(new THREE.CircleGeometry(radius + Math.max(w, d) / 2 + 1, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.035;
        const edge = new THREE.Mesh(new THREE.RingGeometry(radius + Math.max(w, d) / 2 + 0.92, radius + Math.max(w, d) / 2 + 1, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }));
        edge.rotation.x = -Math.PI / 2;
        edge.position.y = 0.036;
        grp.add(ring, edge);
      }
      this.previewGroup.add(grp, fp);
      this.ghost = { key, grp, obj, fp, w, d };
    }
    const gh = this.ghost;
    gh.grp.position.set(x + gh.w / 2, 0, z + gh.d / 2);
    gh.fp.position.set(x + gh.w / 2, 0.04, z + gh.d / 2);
    gh.fp.material.color.set(ok ? '#3ddc84' : '#ff4d4d');
    // face the road if possible
    const fake = { type, x, z, rot };
    gh.obj.rotation.y = this.facing(fake);
    gh.obj.position.y = 0.06 + Math.sin(performance.now() / 260) * 0.02;
  }

  clearGhost() {
    if (!this.ghost) return;
    this.previewGroup.remove(this.ghost.grp, this.ghost.fp);
    this.ghost = null;
  }

  setRoadPreview(cells, ok, removing = false) {
    if (this.roadPrev) this.previewGroup.remove(this.roadPrev);
    this.roadPrev = null;
    if (!cells || !cells.length) return;
    const geos = cells.map(([x, z]) => { const p = new THREE.PlaneGeometry(0.94, 0.94); p.rotateX(-Math.PI / 2); p.translate(x + 0.5, 0.05, z + 0.5); return p; });
    const color = removing ? '#ff6b4a' : ok ? '#56c7ff' : '#ff4d4d';
    this.roadPrev = new THREE.Mesh(mergePlanes(geos), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
    this.roadPrev.renderOrder = 3;
    this.previewGroup.add(this.roadPrev);
  }

  setOverlay(kind) {
    this.overlay = kind;
    this.refreshOverlay();
  }

  refreshOverlay() {
    this.overlayGroup.clear();
    const kind = this.overlay;
    if (!kind) return;
    const g = this.game;
    const good = [], bad = [];
    for (const b of g.state.buildings) {
      if (BUILDINGS[b.type].cat !== 'res') continue;
      const inf = g.info.get(b.id);
      if (!inf) continue;
      let ok;
      if (kind === 'pollution') ok = !inf.polluted;
      else if (kind === 'utility') ok = !inf.missing.length;
      else if (kind === 'boost') ok = inf.boostPct > 0;
      else ok = inf.services?.[kind];
      const [w, d] = g.size(b);
      const p = new THREE.PlaneGeometry(w - 0.1, d - 0.1);
      p.rotateX(-Math.PI / 2);
      p.translate(b.x + w / 2, 0.05, b.z + d / 2);
      (ok ? good : bad).push(p);
    }
    const add = (list, color) => {
      if (!list.length) return;
      const m = new THREE.Mesh(mergePlanes(list), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }));
      m.renderOrder = 3;
      this.overlayGroup.add(m);
    };
    add(good, '#3ddc84');
    add(bad, '#ff4d4d');
    // coverage circles of matching buildings
    for (const b of g.state.buildings) {
      const def = BUILDINGS[b.type];
      let r = 0;
      if (kind === 'pollution' && def.pollution) r = def.pollution;
      else if (def.service?.kind === kind) r = def.service.r;
      else if (kind === 'boost' && def.boost) r = def.boost.r;
      if (!r) continue;
      const [w, d] = g.size(b);
      const R = r + Math.max(w, d) / 2 + 1;
      const color = kind === 'pollution' ? '#d07a3a' : kind === 'boost' ? '#7ad957' : '#4aa8ff';
      const c = new THREE.Mesh(new THREE.RingGeometry(R - 0.08, R, 64), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
      c.rotation.x = -Math.PI / 2;
      c.position.set(b.x + w / 2, 0.06, b.z + d / 2);
      this.overlayGroup.add(c);
    }
  }

  // ------------------------------------------------------------------ picking & projection
  setNDC(cx, cy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  pickBuilding(cx, cy) {
    this.setNDC(cx, cy);
    const hits = this.raycaster.intersectObjects(this.buildRoot.children, true);
    for (const h of hits) if (h.object.userData.bid) return h.object.userData.bid;
    return null;
  }

  pickGround(cx, cy) {
    this.setNDC(cx, cy);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return null;
    return p;
  }

  pickCell(cx, cy) {
    const p = this.pickGround(cx, cy);
    return p ? [Math.floor(p.x), Math.floor(p.z)] : null;
  }

  toScreen(v) {
    const p = v.clone().project(this.camera);
    const w = this.container.clientWidth, h = this.container.clientHeight;
    return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, vis: p.z < 1 && p.x > -1.2 && p.x < 1.2 && p.y > -1.2 && p.y < 1.2 };
  }

  pointToScreen(x, y, z) {
    return this.toScreen(new THREE.Vector3(x, y, z));
  }

  buildingAnchor(bid) {
    const o = this.objs.get(bid);
    if (!o) return null;
    const v = new THREE.Vector3(o.obj.position.x, (o.obj.userData.height ?? 0.8) + 0.25, o.obj.position.z);
    return this.toScreen(v);
  }

  // ------------------------------------------------------------------ frame
  updateLighting(dt) {
    const mode = this.settings.daytime || 'cycle';
    if (mode === 'day') this.time = 0.42;
    else if (mode === 'real') this.time = this.realTime();
    else {
      const speed = this.night > 0.5 ? 2.2 : 1;
      this.time = (this.time + (dt * speed) / (14 * 60)) % 1;
    }
    const t = this.time;
    const e = -Math.cos(t * Math.PI * 2); // -1 midnight .. 1 noon
    const day = smooth(-0.12, 0.3, e);
    const dusk = smooth(-0.22, 0.02, e) * (1 - smooth(0.02, 0.38, e));
    this.night = 1 - day;
    const cover = this.weather.cover;
    const wet = this.weather.wet;
    const C = this._lc || (this._lc = {
      dir: new THREE.Vector3(), skySun: new THREE.Vector3(),
      sunDay: new THREE.Color('#fff1dc'), sunDusk: new THREE.Color('#ff9a52'), moon: new THREE.Color('#b4c6ff'),
      hemiN: new THREE.Color('#4a6496'), hemiD: new THREE.Color('#cfe3ff'), gN: new THREE.Color('#463f30'), gD: new THREE.Color('#6f7d58'),
      fogDay: new THREE.Color('#c9d9e6'), fogDusk: new THREE.Color('#e7a77a'), fogNight: new THREE.Color('#1a2742'), fogRain: new THREE.Color('#8f9aa4'),
      cloudDay: new THREE.Color('#ffffff'), cloudRain: new THREE.Color('#8d949c'), cloudNight: new THREE.Color('#2a3140'), cloudDusk: new THREE.Color('#ffc9a3'), tmp: new THREE.Color(),
    });
    // true sun position for the sky (it sets and rises below the horizon)
    const az = t * Math.PI * 2 + 0.6;
    const se = e * 1.12;
    C.skySun.set(Math.cos(az) * Math.cos(se), Math.sin(se), Math.sin(az) * Math.cos(se));
    // the shadow-casting light: sun by day (never too flat), moon by night
    const le = day >= 0.5 ? Math.max(0.42, se) : 0.75;
    const dir = C.dir.set(Math.cos(az) * Math.cos(le), Math.sin(le), Math.sin(az) * Math.cos(le));
    if (day < 0.5) dir.set(-dir.x, dir.y, -dir.z);
    const tgt = this.view.target;
    const dist = this.view.dist;
    this.sun.position.copy(tgt).addScaledVector(dir, 80);
    this.sun.target.position.copy(tgt);
    const half = Math.max(10, Math.min(70, dist * 0.9));
    const sc = this.sun.shadow.camera;
    if (Math.abs(sc.right - half) > 0.5) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 180; sc.updateProjectionMatrix(); }
    this.sun.color.copy(C.moon).lerp(C.sunDusk, smooth(0, 0.5, day)).lerp(C.sunDay, smooth(0.5, 1, day) * (1 - dusk * 0.85));
    this.sun.intensity = (1.05 + day * 1.9) * (1 - cover * 0.8);
    this.sun.shadow.radius = 2 + cover * 6;
    this.hemi.intensity = (0.62 + day * 0.38) * (1 - cover * 0.1);
    this.hemi.color.copy(C.hemiN).lerp(C.hemiD, day);
    this.hemi.groundColor.copy(C.gN).lerp(C.gD, day);
    this.fog.color.copy(C.fogNight).lerp(C.fogDusk, smooth(0, 0.6, day)).lerp(C.fogDay, smooth(0.55, 1, day) * (1 - dusk));
    this.fog.color.lerp(C.tmp.copy(C.fogRain).multiplyScalar(0.25 + day * 0.75), cover * 0.75);
    this.fog.near = dist * 1.6 + 18 - cover * 10;
    this.fog.far = dist * 4 + 170 - cover * 60;
    this.scene.environmentIntensity = (0.55 + day * 0.5) * (1 - cover * 0.3);
    this.renderer.toneMappingExposure = (1.0 + (1 - day) * 0.45) * (1 - cover * 0.18);
    this.clouds.castShadows(day > 0.5);
    this.skySys.update(this.camera, C.skySun, this.night, cover);
    // lights of the city
    const lit = smooth(0.45, 0.85, this.night) + cover * 0.2 * day;
    for (const m of nightMaterials) {
      if (m.userData.sign) m.emissiveIntensity = 0.15 + lit * 1.0;
      else if (m.userData.glow) m.emissiveIntensity = 0.25 + lit * 2.4;
      else m.emissiveIntensity = Math.min(1, lit) * 1.05;
    }
    this.street.update(0, this.night);
    // unlit overlays follow the light level
    const lv = Math.max(0.15, day * (1 - cover * 0.4));
    for (const m of this.lockMats || []) m.color.copy(m.userData.base).multiplyScalar(lv);
    this.grid.material.color.setScalar(Math.max(0.35, lv));
    // wet streets after rain
    if (Math.abs((this._wet ?? -1) - wet) > 0.01) {
      this._wet = wet;
      const apply = (m) => {
        if (m.userData.dryRough == null) m.userData.dryRough = m.roughness;
        m.roughness = m.userData.dryRough * (1 - wet * 0.68);
        m.envMapIntensity = 1 + wet * 1.4;
        m.color.setScalar(1 - wet * 0.3);
      };
      for (const m of Object.values(this.roadMats || {})) apply(m);
      forEachMaterial((m) => { if (m.userData.ground && m.userData.ground !== 'grass' && m.userData.ground !== 'sand') apply(m); });
    }
    // clouds: visible from afar, heavier and greyer in bad weather
    C.tmp.copy(C.cloudNight).lerp(C.cloudDusk, smooth(0, 0.6, day)).lerp(C.cloudDay, smooth(0.55, 1, day) * (1 - dusk * 0.7));
    C.tmp.lerp(C.cloudRain, cover * 0.8 * day);
    this.clouds.setLook(Math.min(1, smooth(24, 58, dist) + cover * 0.3), C.tmp);
    WIND.value = 1 + cover * 1.4;
  }

  update(dt) {
    TIME.value += dt;
    this.updateCamera(dt);
    this.weather.update(dt, this.view.target);
    this.updateLighting(dt);
    this.stepAnims(dt);
    for (const { obj } of this.objs.values()) for (const r of obj.userData.rotors) r.rotation.z += dt * r.userData.spin.speed * WIND.value;
    if (this.selRing) this.selRing.material.opacity = 0.35 + Math.sin(performance.now() / 200) * 0.2;
    this.street.update(dt, this.night);
    this.traffic.update(dt, this.night, this.weather.wet);
    this.agents.update(dt, this.night);
    const near = this.view.dist < 40;
    if (near) this.walkers.update(dt);
    for (const m of this.walkers.meshes) m.visible = near && this.weather.wet < 0.7;
    this.particles.update(dt, this.night > 0.6, WIND.value);
    this.clouds.update(dt, WIND.value);
    this.birds.update(dt, this.night + this.weather.wet);
    this.boats.update(dt, TIME.value);
    this.aircraft.update(dt, TIME.value, this.night);
    this.post.render(dt, this.night, this.weather.cover);
  }
}

function footprintMesh(w, d, color, opacity) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, d - 0.06), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 3;
  return m;
}

function mergePlanesAny(list) {
  return mergePlanes(list);
}

function mergePlanes(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const len = parts.reduce((a, g) => a + g.attributes[name].array.length, 0);
    const arr = new Float32Array(len);
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, parts[0].attributes[name].itemSize));
  }
  return out;
}

export { M };
