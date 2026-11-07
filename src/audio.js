// Sound effects and background music.
// Effects: Kenney (CC0) and UI SFX (CC0) samples. Music: tracks from filmmusic.io (credited in
// the settings). Everything is loaded from files next to the page and mixed through Web Audio.

const BASE = 'audio/';
const SFX = ['tap', 'open', 'close', 'coin', 'coins', 'collect', 'build', 'upgrade', 'level', 'error', 'road', 'remove', 'train', 'reward', 'notify', 'page'];
export const TRACKS = [
  { file: 'sunset-fields', title: 'Sunset Fields', artist: 'Alexander Nakarada', url: 'https://filmmusic.io/song/7979-sunset-fields' },
  { file: 'greenlands', title: 'Greenlands', artist: 'Alexander Nakarada', url: 'https://filmmusic.io/song/7819-greenlands' },
  { file: 'dreams', title: 'Dreams', artist: 'Sascha Ende', url: 'https://filmmusic.io/song/7284-dreams' },
  { file: 'haven', title: 'Haven', artist: 'Alexander Nakarada', url: 'https://filmmusic.io/song/8205-haven-full-version' },
  { file: 'fjeld', title: 'Fjeld', artist: 'Alexander Nakarada', url: 'https://filmmusic.io/song/7242-fjeld' },
];

let ctx = null, sfxGain = null, musicGain = null;
const buffers = new Map();
let soundOn = true, musicOn = true;
let musicEl = null, trackIdx = Math.floor(Math.random() * TRACKS.length), started = false;
const lastPlay = new Map();

export function setSound(on) { soundOn = on; }
export function setMusic(on) {
  musicOn = on;
  if (!musicEl) return;
  if (on && started && !document.hidden) musicEl.play().catch(() => {});
  else musicEl.pause();
}

async function load(name) {
  try {
    const r = await fetch(`${BASE}sfx/${name}.mp3`);
    if (!r.ok) return;
    const data = await r.arrayBuffer();
    const buf = await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
    buffers.set(name, buf);
  } catch { /* missing sound: stay silent */ }
}

function nextTrack() {
  trackIdx = (trackIdx + 1) % TRACKS.length;
  musicEl.src = `${BASE}music/${TRACKS[trackIdx].file}.mp3`;
  if (musicOn && !document.hidden) musicEl.play().catch(() => {});
}

// Audio may only start after the first touch or click.
function unlock() {
  if (started) { if (ctx?.state === 'suspended') ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  started = true;
  ctx = new C();
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.8;
  sfxGain.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(ctx.destination);
  for (const n of SFX) load(n);
  musicEl = new Audio();
  musicEl.preload = 'auto';
  musicEl.addEventListener('ended', nextTrack);
  try { ctx.createMediaElementSource(musicEl).connect(musicGain); } catch { /* falls back to element volume */ }
  musicEl.src = `${BASE}music/${TRACKS[trackIdx].file}.mp3`;
  if (musicOn) musicEl.play().catch(() => {});
  musicGain.gain.setTargetAtTime(0.32, ctx.currentTime + 0.3, 2.5);
}
for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (!musicEl) return;
  if (document.hidden) musicEl.pause();
  else if (musicOn) musicEl.play().catch(() => {});
});

// Briefly lower the music under an important sound (level-up jingle, rewards).
function duck(sec) {
  if (!musicGain) return;
  const t = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setTargetAtTime(0.08, t, 0.08);
  musicGain.gain.setTargetAtTime(0.32, t + sec, 0.8);
}

function play(name, { vol = 1, rate = 1, jitter = 0.04, gap = 0.05 } = {}) {
  if (!soundOn || !ctx) return;
  const buf = buffers.get(name);
  if (!buf) return;
  const now = ctx.currentTime;
  if (now - (lastPlay.get(name) || -1) < gap) return; // avoid machine-gun stacking
  lastPlay.set(name, now);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * jitter * 2);
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(g).connect(sfxGain);
  src.start();
}

export function nowPlaying() { return TRACKS[trackIdx]; }

export const sfx = {
  tap() { play('tap', { vol: 0.55, gap: 0.03 }); },
  open() { play('open', { vol: 0.55 }); },
  close() { play('close', { vol: 0.5 }); },
  coin() { play('coin', { vol: 0.9 }); play('coins', { vol: 0.35, rate: 1.1 }); },
  collect() { play('collect', { vol: 0.75 }); },
  build() { play('build', { vol: 0.9, rate: 0.85 }); play('coins', { vol: 0.25, rate: 0.8 }); },
  upgrade() { play('upgrade', { vol: 0.85 }); duck(1.4); },
  level() { play('level', { vol: 0.9, jitter: 0 }); duck(3); },
  error() { play('error', { vol: 0.6 }); },
  road() { play('road', { vol: 0.6 }); },
  remove() { play('remove', { vol: 0.7 }); },
  train() { play('train', { vol: 0.8 }); },
  reward() { play('reward', { vol: 0.85 }); duck(1.5); },
  notify() { play('notify', { vol: 0.6 }); },
  page() { play('page', { vol: 0.45 }); },
};
