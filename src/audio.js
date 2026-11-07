// Audio: sampled sound effects, day/night music playlists with crossfades, and a living
// ambience (birds, crickets, traffic, surf, wind, rain) synthesized in Web Audio and mixed by
// what the camera sees.
//
// Effects: Kenney (CC0) and UI SFX (CC0). Music: Kevin MacLeod (CC BY 3.0) and filmmusic.io
// artists (filmmusic.io standard license); credits are shown in the settings.

const BASE = 'audio/';
const SFX = ['tap', 'open', 'close', 'coin', 'coins', 'collect', 'build', 'upgrade', 'level', 'error', 'road', 'remove', 'train', 'reward', 'notify', 'page', 'hammer', 'hammer2', 'clink'];
const T = (file, title, artist, url, license, mood) => ({ file, title, artist, url, license, mood });
const KM = 'CC BY 3.0', FM = 'filmmusic.io Standard';
export const TRACKS = [
  T('the-builder', 'The Builder', 'Kevin MacLeod', 'https://incompetech.com', KM, 'day'),
  T('amazing-plan', 'Amazing Plan', 'Kevin MacLeod', 'https://incompetech.com', KM, 'day'),
  T('sunset-fields', 'Sunset Fields', 'Alexander Nakarada', 'https://filmmusic.io/song/7979-sunset-fields', FM, 'day'),
  T('merry-go-slower', 'Merry Go Slower', 'Kevin MacLeod', 'https://incompetech.com', KM, 'day'),
  T('greenlands', 'Greenlands', 'Alexander Nakarada', 'https://filmmusic.io/song/7819-greenlands', FM, 'day'),
  T('thatched-villagers', 'Thatched Villagers', 'Kevin MacLeod', 'https://incompetech.com', KM, 'day'),
  T('plucky-daisy', 'Plucky Daisy', 'Kevin MacLeod', 'https://incompetech.com', KM, 'day'),
  T('fjeld', 'Fjeld', 'Alexander Nakarada', 'https://filmmusic.io/song/7242-fjeld', FM, 'day'),
  T('hand-trolley', 'Hand Trolley', 'Kevin MacLeod', 'https://incompetech.com', KM, 'day'),
  T('look-busy', 'Look Busy', 'Kevin MacLeod', 'https://incompetech.com', KM, 'day'),
  T('dreams', 'Dreams', 'Sascha Ende', 'https://filmmusic.io/song/7284-dreams', FM, 'night'),
  T('haven', 'Haven', 'Alexander Nakarada', 'https://filmmusic.io/song/8205-haven-full-version', FM, 'night'),
  T('night-of-mystery', 'Night of Mystery', 'Alexander Nakarada', 'https://filmmusic.io/song/7469-night-of-mystery', FM, 'night'),
  T('efter-storm', 'Efter Storm', 'Alexander Nakarada', 'https://filmmusic.io/song/7879-efter-storm', FM, 'night'),
  T('landskab', 'Landskab', 'Alexander Nakarada', 'https://filmmusic.io/song/7881-landskab', FM, 'night'),
  T('voyager', 'Voyager', 'Rafael Krux', 'https://filmmusic.io/song/5390-voyager-', FM, 'night'),
];
export const MUSIC_LICENSES = {
  [KM]: 'https://creativecommons.org/licenses/by/3.0/',
  [FM]: 'https://filmmusic.io/standard-license',
};

let ctx = null, sfxGain = null, musicBus = null, ambBus = null, master = null;
const buffers = new Map();
let soundOn = true, musicOn = true, ambOn = true;
let started = false;
const lastPlay = new Map();
const listeners = new Set();
const trackListeners = new Set();

export function onAudioStart(fn) { if (started) fn(); else listeners.add(fn); }
export function onTrackChange(fn) { trackListeners.add(fn); }
export function setSound(on) { soundOn = on; }
export function setAmbience(on) { ambOn = on; if (amb) amb.setEnabled(on); }

// ------------------------------------------------------------------ music
class Music {
  constructor() {
    this.mood = 'day';
    this.decks = [0, 1].map(() => {
      const el = new Audio();
      el.preload = 'auto';
      const g = ctx.createGain();
      g.gain.value = 0;
      try { ctx.createMediaElementSource(el).connect(g); } catch { /* element plays directly */ }
      g.connect(musicBus);
      el.addEventListener('ended', () => this.next());
      return { el, g };
    });
    this.active = 0;
    this.history = [];
    this.current = null;
  }

  pick() {
    const pool = TRACKS.filter((t) => t.mood === this.mood && !this.history.slice(-4).includes(t.file));
    const list = pool.length ? pool : TRACKS.filter((t) => t.mood === this.mood);
    return list[Math.floor(Math.random() * list.length)];
  }

  play(track, fade = 3) {
    const t = ctx.currentTime;
    const old = this.decks[this.active];
    this.active = 1 - this.active;
    const d = this.decks[this.active];
    this.current = track;
    this.history.push(track.file);
    d.el.src = `${BASE}music/${track.file}.mp3`;
    d.g.gain.cancelScheduledValues(t);
    d.g.gain.setValueAtTime(0, t);
    d.g.gain.linearRampToValueAtTime(1, t + fade);
    old.g.gain.cancelScheduledValues(t);
    old.g.gain.setValueAtTime(old.g.gain.value, t);
    old.g.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => old.el.pause(), fade * 1000 + 200);
    if (musicOn && !document.hidden) d.el.play().catch(() => {});
    for (const fn of trackListeners) fn(track);
  }

  next() { this.play(this.pick(), 1.5); }

  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.current) this.play(this.pick(), 6);
  }

  pause() { for (const d of this.decks) d.el.pause(); }
  resume() { if (musicOn && this.current) this.decks[this.active].el.play().catch(() => {}); }
}

let music = null;
export function setMusic(on) {
  musicOn = on;
  if (!music) return;
  if (on && !document.hidden) { if (!music.current) music.next(); else music.resume(); } else music.pause();
}
export function setMusicMood(mood) { if (music) music.setMood(mood); }
export function nowPlaying() { return music?.current || null; }
export function skipTrack() { if (music) music.next(); }

// ------------------------------------------------------------------ ambience
function noiseBuffer(kind = 'pink', sec = 4) {
  const n = ctx.sampleRate * sec;
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = 0.997 * b0 + 0.029591 * w; b1 = 0.985 * b1 + 0.032534 * w; b2 = 0.95 * b2 + 0.048056 * w; d[i] = (b0 + b1 + b2 + w * 0.1) * 0.6; }
    }
    // crossfade the loop seam
    const f = Math.floor(ctx.sampleRate * 0.05);
    for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[n - f + i] * (1 - k); }
  }
  return buf;
}

class Ambience {
  constructor() {
    this.out = ctx.createGain();
    this.out.connect(ambBus);
    this.levels = {};
    const pink = noiseBuffer('pink'), brown = noiseBuffer('brown');
    const layer = (buf, filters) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      let node = src;
      for (const [type, f, q] of filters) {
        const fl = ctx.createBiquadFilter();
        fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7;
        node.connect(fl); node = fl;
      }
      const g = ctx.createGain();
      g.gain.value = 0;
      node.connect(g).connect(this.out);
      src.start(0, Math.random() * 3);
      return g;
    };
    this.traffic = layer(brown, [['lowpass', 380], ['highshelf', 2000, 0.7]]);
    this.rain = layer(pink, [['highpass', 900], ['lowpass', 7000]]);
    this.rainLow = layer(brown, [['lowpass', 500]]);
    this.wind = layer(pink, [['bandpass', 500, 0.6]]);
    this.windFilter = null;
    this.surf = layer(brown, [['lowpass', 900]]);
    this.surfHiss = layer(pink, [['bandpass', 2400, 0.4]]);
    this.t = 0;
    this.nextBird = 1;
    this.nextCricket = 0;
    this.nextCar = 2;
    this.nextDrop = 0;
    this.enabled = true;
  }

  setEnabled(on) { this.enabled = on; this.out.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.4); }

  set(g, v) { g.gain.setTargetAtTime(v, ctx.currentTime, 0.6); }

  // s: { night, rain, wind, coast, city, zoom, green }
  update(dt, s) {
    if (!this.enabled) return;
    this.t += dt;
    const near = 1 - Math.min(1, Math.max(0, (s.zoom - 8) / 60)); // 1 close .. 0 far
    this.set(this.traffic, Math.min(0.22, s.city * 0.25) * (0.35 + near * 0.65) * (1 - s.night * 0.5));
    this.set(this.rain, s.rain * 0.16);
    this.set(this.rainLow, s.rain * 0.12);
    // wind gusts
    const gust = 0.5 + 0.5 * Math.sin(this.t * 0.37) * Math.sin(this.t * 0.13 + 1);
    this.set(this.wind, (0.012 + s.wind * 0.05) * gust * (0.5 + (1 - near) * 0.5));
    // surf: slow swells
    const swell = 0.55 + 0.45 * Math.sin(this.t * 0.55) * Math.sin(this.t * 0.21 + 2);
    this.set(this.surf, s.coast * 0.28 * swell);
    this.set(this.surfHiss, s.coast * 0.05 * swell * swell);
    const now = this.t;
    // birds by day, crickets by night (less in rain and from far away)
    if (now > this.nextBird) {
      this.nextBird = now + 0.6 + Math.random() * 3.5 / (0.3 + s.green);
      const v = (1 - s.night) * (1 - s.rain) * (0.25 + near * 0.75) * (0.4 + s.green * 0.6);
      if (v > 0.05) this.bird(v * 0.09);
    }
    if (now > this.nextCricket) {
      this.nextCricket = now + 0.25 + Math.random() * 0.9;
      const v = s.night * (1 - s.rain) * (0.3 + near * 0.7) * (0.5 + s.green * 0.5);
      if (v > 0.05) this.cricket(v * 0.03);
    }
    if (now > this.nextCar && s.city > 0.05) {
      this.nextCar = now + 2 + Math.random() * 7 / (0.2 + s.city);
      this.carPass(Math.min(0.06, s.city * 0.08) * (0.3 + near * 0.7));
    }
    if (s.rain > 0.2 && now > this.nextDrop) {
      this.nextDrop = now + 0.04 + Math.random() * 0.25 / s.rain;
      this.drip(0.025 * s.rain * near);
    }
  }

  bird(vol) {
    const t = ctx.currentTime;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const species = Math.floor(Math.random() * 3);
    const notes = 2 + Math.floor(Math.random() * 5);
    const base = [2800, 3600, 4400][species] * (0.85 + Math.random() * 0.3);
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const st = t + i * (0.09 + Math.random() * 0.05);
      const len = 0.05 + Math.random() * 0.07;
      o.type = 'sine';
      const f0 = base * (1 + (Math.random() - 0.3) * 0.4);
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f0 * (species === 1 ? 0.6 : 1.4), st + len);
      // vibrato for warbling birds
      if (species === 2) {
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.frequency.value = 38; lg.gain.value = 260;
        lfo.connect(lg).connect(o.frequency); lfo.start(st); lfo.stop(st + len + 0.02);
      }
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(vol, st + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, st + len);
      o.connect(g);
      if (pan) { g.connect(pan); } else g.connect(this.out);
      o.start(st); o.stop(st + len + 0.03);
    }
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; pan.connect(this.out); }
  }

  cricket(vol) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const am = ctx.createOscillator();
    const amg = ctx.createGain();
    const g = ctx.createGain();
    o.frequency.value = 4300 + Math.random() * 900;
    am.frequency.value = 28 + Math.random() * 12;
    amg.gain.value = vol;
    g.gain.value = 0;
    am.connect(amg).connect(g.gain);
    const env = ctx.createGain();
    const len = 0.15 + Math.random() * 0.25;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.02);
    env.gain.setValueAtTime(1, t + len);
    env.gain.linearRampToValueAtTime(0, t + len + 0.03);
    o.connect(g).connect(env).connect(this.out);
    o.start(t); am.start(t); o.stop(t + len + 0.05); am.stop(t + len + 0.05);
  }

  carPass(vol) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.carBuf || (this.carBuf = noiseBuffer('brown', 3));
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.2;
    const dur = 2 + Math.random() * 2;
    f.frequency.setValueAtTime(260, t);
    f.frequency.linearRampToValueAtTime(520, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, t + dur);
    let node = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      const dir = Math.random() < 0.5 ? -1 : 1;
      p.pan.setValueAtTime(-0.8 * dir, t);
      p.pan.linearRampToValueAtTime(0.8 * dir, t + dur);
      g.connect(p); node = p;
    }
    src.connect(f).connect(g);
    node.connect(this.out);
    src.start(t, Math.random()); src.stop(t + dur);
  }

  drip(vol) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = 900 + Math.random() * 1800;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.03);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.out);
    o.start(t); o.stop(t + 0.06);
  }
}

let amb = null;
export function updateAmbience(dt, state) { if (amb && ambOn) amb.update(dt, state); }

// ------------------------------------------------------------------ looping world sounds
// Sirens and construction sites keep sounding while they are active.
const loops = new Map();
export function siren(id, on, vol = 0.05) {
  if (!ctx || !soundOn) on = false;
  const cur = loops.get(id);
  if (on && !cur) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    const t = ctx.currentTime;
    // German two-tone "Martinshorn": 440 Hz / 585 Hz alternating
    for (let i = 0; i < 400; i++) o.frequency.setValueAtTime(i % 2 ? 585 : 440, t + i * 0.6);
    g.gain.value = 0;
    g.gain.setTargetAtTime(vol, t, 0.3);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2200;
    o.connect(f).connect(g).connect(sfxGain);
    o.start();
    loops.set(id, { o, g });
  } else if (!on && cur) {
    cur.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    cur.o.stop(ctx.currentTime + 1.5);
    loops.delete(id);
  } else if (on && cur) cur.g.gain.setTargetAtTime(vol, ctx.currentTime, 0.3);
}

// ------------------------------------------------------------------ boot
async function load(name) {
  try {
    const r = await fetch(`${BASE}sfx/${name}.mp3`);
    if (!r.ok) return;
    const data = await r.arrayBuffer();
    const buf = await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
    buffers.set(name, buf);
  } catch { /* missing sound: stay silent */ }
}

// Audio may only start after the first touch or click.
export function unlock() {
  if (started) { if (ctx?.state === 'suspended') ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  started = true;
  ctx = new C();
  master = ctx.createDynamicsCompressor();
  master.threshold.value = -14; master.ratio.value = 3;
  master.connect(ctx.destination);
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.85; sfxGain.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 0.9; ambBus.connect(master);
  for (const n of SFX) load(n);
  music = new Music();
  amb = new Ambience();
  amb.setEnabled(ambOn);
  if (musicOn) music.next();
  musicBus.gain.setTargetAtTime(0.3, ctx.currentTime + 0.3, 2.5);
  for (const fn of listeners) fn();
}
for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) { music?.pause(); ctx.suspend(); }
  else { ctx.resume(); if (musicOn) music?.resume(); }
});

// Briefly lower music under an important sound (level-up jingle, rewards).
function duck(sec) {
  if (!musicBus) return;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setTargetAtTime(0.08, t, 0.08);
  musicBus.gain.setTargetAtTime(0.3, t + sec, 0.8);
}

function play(name, { vol = 1, rate = 1, jitter = 0.04, gap = 0.05, pan = 0 } = {}) {
  if (!soundOn || !ctx) return;
  const buf = buffers.get(name);
  if (!buf) return;
  const now = ctx.currentTime;
  if (now - (lastPlay.get(name) || -1) < gap) return;
  lastPlay.set(name, now);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * jitter * 2);
  const g = ctx.createGain();
  g.gain.value = vol;
  let node = src.connect(g);
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
  node.connect(sfxGain);
  src.start();
}

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
  hammer(vol = 0.3, pan = 0) { play(Math.random() < 0.6 ? 'hammer' : 'hammer2', { vol, pan, gap: 0.12, jitter: 0.12 }); },
  clink(vol = 0.25, pan = 0) { play('clink', { vol, pan, gap: 0.2, jitter: 0.15 }); },
};
