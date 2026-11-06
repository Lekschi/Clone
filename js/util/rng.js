// Deterministic random + noise helpers.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) { return t * t * (3 - 2 * t); }

export function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, seed, oct = 4) {
  let amp = 1, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += valueNoise(x * f, y * f, seed + i * 131) * amp;
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

const NAME_A = ['Port', 'North', 'East', 'West', 'Upper', 'Lower', 'New', 'Old', 'Saint', 'Fort', 'Lake', 'Glen'];
const NAME_B = ['Halden', 'Marrow', 'Ashby', 'Calder', 'Wrenfield', 'Brannock', 'Oakhurst', 'Selby', 'Tamsin', 'Corvale',
  'Linwood', 'Harrowgate', 'Ellery', 'Fennick', 'Dunmore', 'Rosmund', 'Kestrel', 'Varnley', 'Orrin', 'Pemberly', 'Thistle', 'Quarry'];
const NAME_C = ['', '', '', ' Bay', ' Falls', ' Crossing', ' Heights', ' Harbor', ' Junction', ' Vale', ' Ridge'];
export function cityName(rng = Math.random) {
  const r = rng();
  if (r < 0.35) return pick(rng, NAME_A) + ' ' + pick(rng, NAME_B);
  return pick(rng, NAME_B) + pick(rng, NAME_C);
}
