// Renders building models into small images for menus, using a dedicated offscreen renderer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makeModel } from './models.js';
import { BUILDINGS } from '../data/buildings.js';

let R = null;
const cache = new Map();

function setup() {
  const size = 220;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight('#e6f2ff', '#8a9370', 1.1));
  const sun = new THREE.DirectionalLight('#fff4e2', 2.4);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  R = { renderer, scene, camera, size };
}

export function thumb(type, level = 1) {
  const key = `${type}:${level}`;
  if (cache.has(key)) return cache.get(key);
  if (!R) setup();
  const { renderer, scene, camera } = R;
  const obj = makeModel(type, level, 1);
  const def = BUILDINGS[type];
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = Math.max(sphere.radius, 0.6);
  const dir = new THREE.Vector3(0.75, 0.62, 1).normalize();
  const dist = r / Math.sin((camera.fov * Math.PI) / 360) * 0.98;
  camera.position.copy(sphere.center).addScaledVector(dir, dist);
  camera.lookAt(sphere.center);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(obj);
  void def;
  cache.set(key, url);
  return url;
}
