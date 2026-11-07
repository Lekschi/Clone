// Shared animated shader bits: water surfaces and wind-blown foliage.
import * as THREE from 'three';
import { waterNormal } from './textures.js';

export const TIME = { value: 0 };
export const WIND = { value: 1 };

// Water: physically based material whose normal map is sampled twice at different scales and
// directions, giving moving interference ripples that reflect the sky environment.
const waterMats = new Map();
export function waterMaterial(kind = 'sea') {
  if (waterMats.has(kind)) return waterMats.get(kind);
  const sea = kind === 'sea';
  const m = new THREE.MeshPhysicalMaterial({
    color: sea ? '#14506f' : kind === 'dirty' ? '#55603a' : '#2a7aa6',
    roughness: sea ? 0.06 : 0.04,
    metalness: 0,
    ior: 1.33,
    normalMap: waterNormal(),
    normalScale: new THREE.Vector2(sea ? 0.55 : 0.35, sea ? 0.55 : 0.35),
    envMapIntensity: 1.25,
    transparent: sea,
    opacity: sea ? 0.94 : 1,
  });
  m.userData.water = true;
  const scale = sea ? 1 : 3.5;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <normal_fragment_maps>', `
        #ifdef USE_NORMALMAP_TANGENTSPACE
          vec2 wuv = vNormalMapUv * ${scale.toFixed(2)};
          vec3 n1 = texture2D(normalMap, wuv + vec2(uTime * 0.012, uTime * 0.007)).xyz * 2.0 - 1.0;
          vec3 n2 = texture2D(normalMap, wuv * 1.83 + vec2(-uTime * 0.009, uTime * 0.013)).xyz * 2.0 - 1.0;
          vec3 n3 = texture2D(normalMap, wuv * 0.37 + vec2(uTime * 0.003, -uTime * 0.002)).xyz * 2.0 - 1.0;
          vec3 mapN = normalize(vec3(n1.xy + n2.xy * 0.7 + n3.xy * 0.8, 1.0));
          mapN.xy *= normalScale;
          normal = normalize(tbn * mapN);
        #endif`);
  };
  m.customProgramCacheKey = () => `water-${kind}`;
  waterMats.set(kind, m);
  return m;
}

// Foliage sway: displaces vertices above trunk height with layered sine waves in world space.
export function addWind(material, amp = 1) {
  if (material.userData.wind) return material;
  material.userData.wind = true;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uTime = TIME;
    sh.uniforms.uWind = WIND;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec3 wp = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float hgt = max(0.0, position.y - 0.18);
          #else
            vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
            float hgt = max(0.0, position.y - 0.12) * 0.6;
          #endif
          float gust = 0.6 + 0.4 * sin(uTime * 0.31 + wp.x * 0.05);
          float sway = sin(uTime * 1.9 + wp.x * 0.7 + wp.z * 0.45) * 0.6 + sin(uTime * 3.7 + wp.z * 1.3) * 0.25;
          transformed.x += sway * hgt * 0.09 * uWind * gust * ${amp.toFixed(2)};
          transformed.z += cos(uTime * 1.6 + wp.z * 0.6) * hgt * 0.05 * uWind * gust * ${amp.toFixed(2)};
        }`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `wind-${amp}-${key ? key() : ''}`;
  return material;
}
