// Post-processing chain: ambient occlusion → bloom → tone mapping → colour grading → SMAA.
// Quality tiers keep it fast on tablets: "ultra" full-res AO, "high" half-res AO, "low" no post.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { N8AOPass } from 'n8ao';

// Gentle filmic grade: contrast, saturation, warm highlights / cool shadows, vignette.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSat: { value: 1.0 },
    uContrast: { value: 1.05 },
    uVignette: { value: 0.28 },
    uWarm: { value: 0.03 },
    uNight: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uSat, uContrast, uVignette, uWarm, uNight;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5;
      // split toning
      col += vec3(uWarm, uWarm * 0.4, -uWarm) * smoothstep(0.45, 1.0, l);
      col += vec3(-0.012, 0.0, 0.025) * (1.0 - smoothstep(0.0, 0.4, l)) * (1.0 + uNight * 2.0);
      vec2 d = vUv - 0.5;
      col *= 1.0 - uVignette * dot(d, d) * 2.2;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.quality = null;
    this.composer = null;
  }

  setQuality(q) {
    if (q === this.quality) return;
    this.quality = q;
    if (this.composer) { this.composer.dispose(); this.composer = null; }
    if (q === 'low') return;
    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x * r.getPixelRatio(), size.y * r.getPixelRatio(), { type: THREE.HalfFloatType });
    const composer = new EffectComposer(r, target);
    let ao = null;
    try {
      ao = new N8AOPass(this.scene, this.camera, size.x, size.y);
      ao.configuration.gammaCorrection = false;
      ao.configuration.aoRadius = 0.9;
      ao.configuration.distanceFalloff = 0.6;
      ao.configuration.intensity = 3.2;
      ao.configuration.color = new THREE.Color('#14203a');
      ao.configuration.halfRes = q !== 'ultra';
      ao.setQualityMode(q === 'ultra' ? 'Medium' : 'Low');
      composer.addPass(ao);
    } catch (e) {
      console.warn('AO unavailable', e);
      ao = null;
      composer.addPass(new RenderPass(this.scene, this.camera));
    }
    this.ao = ao;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.35, 0.55, 0.9);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    composer.addPass(this.grade);
    this.smaa = new SMAAPass(size.x * r.getPixelRatio(), size.y * r.getPixelRatio());
    composer.addPass(this.smaa);
    this.composer = composer;
  }

  setSize(w, h) {
    if (this.composer) this.composer.setSize(w, h);
  }

  render(dt, night, weather = 0) {
    if (!this.composer) { this.renderer.render(this.scene, this.camera); return; }
    // brighter, wider glow at night for windows, lamps and headlights
    this.bloom.strength = 0.12 + night * 0.38;
    this.bloom.threshold = 1.0 - night * 0.22;
    this.bloom.radius = 0.32 + night * 0.18;
    this.grade.uniforms.uNight.value = night;
    this.grade.uniforms.uSat.value = 1.02 - weather * 0.25 - night * 0.08;
    if (this.ao) this.ao.configuration.intensity = 3.2 - night * 1.4;
    this.composer.render(dt);
  }
}
