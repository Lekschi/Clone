// Tiny procedural sound kit (WebAudio). No audio files needed.
let ac = null, master = null, enabled = true, ambient = null;

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

export function setSound(on) { enabled = on; if (!on) stopAmbient(); }
export function unlock() { if (enabled) ctx(); }

function tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
  const a = ctx(); if (!a || !enabled) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.2, filt = 1200, delay = 0) {
  const a = ctx(); if (!a || !enabled) return;
  const t = a.currentTime + delay;
  const len = Math.ceil(a.sampleRate * dur); const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filt;
  const g = a.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

export const sfx = {
  tap: () => tone(880, 0.05, 'triangle', 0.06),
  open: () => { tone(520, 0.07, 'triangle', 0.06); tone(780, 0.08, 'triangle', 0.05, 0, 0.04); },
  close: () => tone(420, 0.07, 'triangle', 0.05),
  build: () => { noise(0.12, 0.25, 500); tone(140, 0.14, 'sine', 0.18, -40); },
  road: () => { noise(0.08, 0.15, 900); },
  zone: () => tone(660, 0.06, 'sine', 0.06, 120),
  bulldoze: () => { noise(0.28, 0.32, 380); tone(90, 0.25, 'sawtooth', 0.05, -30); },
  error: () => { tone(220, 0.09, 'square', 0.05); tone(180, 0.12, 'square', 0.05, 0, 0.08); },
  cash: () => { tone(1320, 0.06, 'triangle', 0.07); tone(1760, 0.1, 'triangle', 0.07, 0, 0.06); },
  milestone: () => { [523, 659, 784, 1046].forEach((f, k) => tone(f, 0.35, 'triangle', 0.08, 0, k * 0.11)); },
  alert: () => { tone(740, 0.12, 'sine', 0.08); tone(554, 0.18, 'sine', 0.08, 0, 0.14); },
};

export function startAmbient() {
  const a = ctx(); if (!a || !enabled || ambient) return;
  const len = a.sampleRate * 4; const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
  let last = 0; for (let i = 0; i < len; i++) { last = (last + (Math.random() * 2 - 1) * 0.02) * 0.995; d[i] = last; }
  const s = a.createBufferSource(); s.buffer = buf; s.loop = true;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  const g = a.createGain(); g.gain.value = 0;
  s.connect(f); f.connect(g); g.connect(master); s.start();
  g.gain.linearRampToValueAtTime(0.5, a.currentTime + 2);
  ambient = { s, g };
}
export function setAmbientLevel(v) { if (ambient && ac) ambient.g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ac.currentTime, 0.5); }
export function stopAmbient() { if (ambient) { try { ambient.s.stop(); } catch (e) { /* */ } ambient = null; } }
