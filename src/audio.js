// Small synthesized sound effects (no audio files).
let ctx = null;
let enabled = true;

export function setSound(on) { enabled = on; }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, { type = 'sine', vol = 0.12, delay = 0, slide = 0 } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.08, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const sfx = {
  tap() { if (enabled) tone(660, 0.06, { type: 'triangle', vol: 0.06 }); },
  coin() { if (!enabled) return; tone(988, 0.08, { type: 'square', vol: 0.05 }); tone(1319, 0.16, { type: 'square', vol: 0.05, delay: 0.07 }); },
  collect() { if (!enabled) return; tone(523, 0.08, { type: 'triangle', vol: 0.1 }); tone(784, 0.14, { type: 'triangle', vol: 0.1, delay: 0.06 }); },
  build() { if (!enabled) return; noise(0.35, 0.12); tone(196, 0.2, { type: 'triangle', vol: 0.1, delay: 0.05 }); tone(294, 0.25, { type: 'triangle', vol: 0.08, delay: 0.15 }); },
  upgrade() { if (!enabled) return; [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.09, delay: i * 0.07 })); },
  level() { if (!enabled) return; [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.1, delay: i * 0.09 })); },
  error() { if (!enabled) return; tone(220, 0.16, { type: 'sawtooth', vol: 0.05, slide: 0.7 }); },
  road() { if (enabled) noise(0.12, 0.06); },
  remove() { if (!enabled) return; noise(0.3, 0.12); tone(150, 0.25, { type: 'sawtooth', vol: 0.04, slide: 0.5 }); },
  train() { if (!enabled) return; tone(392, 0.4, { type: 'sawtooth', vol: 0.04 }); tone(330, 0.5, { type: 'sawtooth', vol: 0.04, delay: 0.35 }); },
};
