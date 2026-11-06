// Offline support: network-first (so updates arrive immediately), falling back to cache.
const CACHE = 'meridian-v1';
const ASSETS = [
  './', 'index.html', 'game.html', 'manifest.webmanifest', 'css/app.css', 'css/launcher.css',
  'js/launcher.js', 'js/game.js', 'js/demo.js', 'js/storage.js', 'js/audio.js',
  'js/util/rng.js', 'js/data/defs.js', 'js/world/world.js', 'js/world/sim.js',
  'js/render/art.js', 'js/render/ground.js', 'js/render/buildings.js', 'js/render/sprites.js', 'js/render/renderer.js',
  'js/ui/icons.js', 'js/ui/hud.js',
  'assets/icons/icon.svg', 'assets/icons/icon-180.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
