// The 3D view of the city: scene setup, lighting and day/night, terrain, roads, buildings,
// traffic, effects, placement previews and picking.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BUILDINGS } from '../data/buildings.js';
import { makeModel } from './models.js';
import { nightMaterials, M } from './kit.js';
import { roadTexture, setAnisotropy, gridTexture } from './textures.js';
import { Terrain, Forest } from './terrain.js';
import { Traffic } from './traffic.js';
import { Particles, Clouds } from './fx.js';

const HIGHWAY_Z = 30;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export class World {
  constructor(container, game, settings) {
    this.game = game;
    this.settings = settings;
    this.container = container;
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 0.92;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    this.renderer = r;
    setAnisotropy(Math.min(8, r.capabilities.getMaxAnisotropy()));

    const scene = new THREE.Scene();
    this.scene = scene;
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 900);
    this.cam = { target: new THREE.Vector3(26, 0, 30), dist: 26, yaw: -0.62, pitch: 0.92 };

    this.hemi = new THREE.HemisphereLight('#d6e9ff', '#6f7d58', 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3df', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.applyQuality();

    this.fog = new THREE.Fog('#bfd8ec', 60, 260);
    scene.fog = this.fog;
    scene.background = new THREE.Color('#bfd8ec');

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
    this.traffic = new Traffic(scene, game, HIGHWAY_Z);
    this.walkers = new Traffic(scene, game, HIGHWAY_Z, { walkers: true });
    this.walkers.mesh.castShadow = false;
    this.particles = new Particles(scene);
    this.clouds = new Clouds(scene, game.W / 2, game.H / 2);

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

    game.on('built', (b) => { this.syncBuilding(b, true); this.updateEmitters(); this.refreshOverlay(); });
    game.on('moved', (b) => { this.syncBuilding(b, true); this.updateEmitters(); this.refreshOverlay(); });
    game.on('removed', (b) => { this.removeBuilding(b); this.updateEmitters(); this.refreshOverlay(); });
    game.on('upgraded', (b) => { this.syncBuilding(b, true); this.updateEmitters(); });
    game.on('roads', () => { this.rebuildRoads(); this.refacingAll(); });
    game.on('expanded', () => { this.rebuildLocks(); this.treeSpots = this.treeSpots.filter((s) => !s.cell || !game.isUnlocked(s.cell[0], s.cell[1])); this.forest.set(this.treeSpots); });
    game.on('city', () => this.refreshOverlay());
    game.on('fire', () => this.updateEmitters());
    game.on('fireOut', (b) => { this.updateEmitters(); const [w, d] = game.size(b); this.particles.dust(b.x + w / 2, b.z + d / 2, w, d); });

    this.resize();
  }

  applyQuality() {
    const high = this.settings.quality !== 'low';
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, high ? 2 : 1.25));
    const size = high ? 4096 : 2048;
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
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ camera
  updateCamera() {
    const c = this.cam;
    c.dist = Math.max(5, Math.min(80, c.dist));
    c.pitch = 0.62 + smooth(5, 50, c.dist) * 0.42;
    c.target.x = Math.max(-6, Math.min(this.game.W + 6, c.target.x));
    c.target.z = Math.max(-6, Math.min(this.game.H + 8, c.target.z));
    const cp = Math.cos(c.pitch);
    this.camera.position.set(
      c.target.x + Math.sin(c.yaw) * cp * c.dist,
      c.target.y + Math.sin(c.pitch) * c.dist,
      c.target.z + Math.cos(c.yaw) * cp * c.dist,
    );
    this.camera.lookAt(c.target);
  }

  // Move the camera target by a screen-space delta (pixels).
  panBy(dx, dy) {
    const c = this.cam;
    const scale = (c.dist * Math.tan((this.camera.fov * Math.PI) / 360) * 2) / this.container.clientHeight;
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
    // right vector (co, -s), forward on ground (-s, -co)
    c.target.x -= (dx * co + dy * s / Math.sin(c.pitch)) * scale;
    c.target.z -= (-dx * s + dy * co / Math.sin(c.pitch)) * scale;
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
      const mat = this.roadMats?.[mask] || new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2 });
      this.roadMats = this.roadMats || {};
      this.roadMats[mask] = mat;
      const im = new THREE.InstancedMesh(geo, mat, cells.length);
      cells.forEach(([x, z], i) => { m4.makeTranslation(x + 0.5, 0.012, z + 0.5); im.setMatrixAt(i, m4); });
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.roadGroup.add(im);
    }
    this.buildLamps(groups);
    this.traffic.setRoads();
    this.walkers?.setRoads();
  }

  // Street lights along straight road segments; their heads glow at night.
  buildLamps(groups) {
    if (!this.lampGeo) {
      const pole = new THREE.CylinderGeometry(0.008, 0.011, 0.26, 5);
      pole.translate(0, 0.13, 0);
      const arm = new THREE.BoxGeometry(0.09, 0.008, 0.01);
      arm.translate(0.04, 0.255, 0);
      this.lampGeo = mergePlanesAny([pole, arm]);
      this.lampHeadGeo = new THREE.BoxGeometry(0.05, 0.012, 0.028);
      this.lampHeadGeo.translate(0.075, 0.248, 0);
      this.lampMat = new THREE.MeshStandardMaterial({ color: '#4a5058', metalness: 0.5, roughness: 0.5 });
      this.lampHeadMat = M.glow('#ffe2a0');
    }
    const spots = [];
    for (const [mask, cells] of groups) {
      const ns = mask === 5, ew = mask === 10;
      if (!ns && !ew) continue;
      for (const [x, z] of cells) {
        if ((x + z) % 3 !== 0) continue;
        const side = (x + z) % 2 ? 1 : -1;
        if (ns) spots.push([x + 0.5 + side * 0.41, z + 0.5, side > 0 ? Math.PI : 0]);
        else spots.push([x + 0.5, z + 0.5 + side * 0.41, side > 0 ? Math.PI / 2 : -Math.PI / 2]);
      }
    }
    if (this.lamps) for (const m of this.lamps) { this.roadGroup.remove(m); m.dispose(); }
    this.lamps = [];
    if (!spots.length) return;
    const q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    for (const [geo, mat, shadow] of [[this.lampGeo, this.lampMat, true], [this.lampHeadGeo, this.lampHeadMat, false]]) {
      const im = new THREE.InstancedMesh(geo, mat, spots.length);
      spots.forEach(([x, z, r], i) => { q.setFromAxisAngle(up, r); m4.compose(new THREE.Vector3(x, 0.012, z), q, one); im.setMatrixAt(i, m4); });
      im.castShadow = shadow;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.roadGroup.add(im);
      this.lamps.push(im);
    }
  }

  rebuildLocks() {
    const g = this.game;
    this.lockGroup.clear();
    const C = 8, CW = g.W / C;
    const shade = new THREE.MeshBasicMaterial({ color: '#0d1a12', transparent: true, opacity: 0.28, depthWrite: false });
    const line = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false });
    const sale = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.1, depthWrite: false });
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
    const level = b.type === 'house' ? b.level : 1;
    const g = this.game;
    const [w, d] = g.size(b);
    const ang = this.facing(b);
    if (old && old.level === level) {
      old.obj.position.set(b.x + w / 2, 0, b.z + d / 2);
      old.obj.rotation.y = ang;
      old.obj.updateMatrixWorld(true);
      if (anim) this.pop(old.obj, b, w, d);
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
    if (anim) this.pop(obj, b, w, d);
  }

  pop(obj, b, w, d) {
    obj.scale.set(1, 0.02, 1);
    this.anims.push({ obj, t: 0, dur: 0.75 });
    this.particles.dust(b.x + w / 2, b.z + d / 2, w, d);
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
      if (b.type !== 'house') continue;
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
    if (mode === 'day') this.time = 0.45;
    else if (mode === 'real') this.time = this.realTime();
    else {
      const speed = this.night > 0.5 ? 2.2 : 1;
      this.time = (this.time + (dt * speed) / (14 * 60)) % 1;
    }
    const t = this.time;
    const e = -Math.cos(t * Math.PI * 2); // -1 midnight .. 1 noon
    const day = smooth(-0.15, 0.3, e);
    const dusk = smooth(-0.2, 0.05, e) * (1 - smooth(0.05, 0.4, e));
    this.night = 1 - day;
    const az = t * Math.PI * 2 + 0.6;
    const elev = 0.5 + Math.abs(e) * 0.32;
    const C = this._lc || (this._lc = {
      dir: new THREE.Vector3(), sunDay: new THREE.Color('#fff3df'), sunDusk: new THREE.Color('#ffae6b'), moon: new THREE.Color('#9fb6ff'),
      hemiN: new THREE.Color('#1d2b4d'), hemiD: new THREE.Color('#d6e9ff'), gN: new THREE.Color('#1a1f1a'), gD: new THREE.Color('#6f7d58'),
      fogDay: new THREE.Color('#bfd8ec'), fogDusk: new THREE.Color('#e8b48e'), fogNight: new THREE.Color('#0d1528'), tmp: new THREE.Color(),
    });
    const dir = C.dir.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev));
    if (day < 0.5) dir.set(-dir.x, dir.y, -dir.z);
    const c = this.cam;
    const tgt = c.target;
    this.sun.position.copy(tgt).addScaledVector(dir, 70);
    this.sun.target.position.copy(tgt);
    const half = Math.max(12, Math.min(70, c.dist * 0.95));
    const sc = this.sun.shadow.camera;
    if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 160; sc.updateProjectionMatrix(); }
    this.sun.color.copy(C.moon).lerp(C.sunDusk, smooth(0, 0.5, day)).lerp(C.sunDay, smooth(0.5, 1, day) * (1 - dusk * 0.8));
    this.sun.intensity = 0.45 + day * 2.3;
    this.hemi.intensity = 0.28 + day * 0.7;
    this.hemi.color.copy(C.hemiN).lerp(C.hemiD, day);
    this.hemi.groundColor.copy(C.gN).lerp(C.gD, day);
    this.fog.color.copy(C.fogNight).lerp(C.fogDusk, smooth(0, 0.6, day)).lerp(C.fogDay, smooth(0.55, 1, day) * (1 - dusk));
    this.scene.background.copy(this.fog.color);
    this.fog.near = c.dist * 1.8 + 20;
    this.fog.far = c.dist * 4 + 160;
    this.scene.environmentIntensity = 0.12 + day * 0.38;
    this.renderer.toneMappingExposure = 0.9 + (1 - day) * 0.25;
    const lit = smooth(0.35, 0.85, this.night);
    for (const m of nightMaterials) {
      if (m.userData.sign) m.emissiveIntensity = 0.15 + lit * 0.9;
      else if (m.userData.glow) m.emissiveIntensity = 0.25 + lit * 2.2;
      else m.emissiveIntensity = lit * 1.15;
    }
  }

  update(dt) {
    this.updateCamera();
    this.updateLighting(dt);
    // spawn animations
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.obj.scale.y = Math.max(0.02, easeOutBack(k));
      if (k >= 1) { a.obj.scale.y = 1; this.anims.splice(i, 1); }
    }
    for (const { obj } of this.objs.values()) for (const r of obj.userData.rotors) r.rotation.z += dt * r.userData.spin.speed;
    if (this.selRing) this.selRing.material.opacity = 0.35 + Math.sin(performance.now() / 200) * 0.2;
    this.traffic.update(dt);
    if (this.cam.dist < 40) this.walkers.update(dt);
    this.walkers.mesh.visible = this.cam.dist < 40;
    this.particles.update(dt, this.night > 0.6);
    this.clouds.update(dt);
    this.clouds.setOpacity(smooth(30, 60, this.cam.dist));
    const wm = this.terrain.water.material.map;
    if (wm) { wm.offset.x += dt * 0.004; wm.offset.y += dt * 0.002; }
    this.renderer.render(this.scene, this.camera);
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
