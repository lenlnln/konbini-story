// 離線快取：改版時請更新 VERSION
const VERSION = 'konbini-v0.7.0';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/main.js', './js/data.js', './js/catalog.js', './js/state.js', './js/path.js', './js/world.js', './js/sim.js', './js/ui.js', './js/build.js', './js/tutorial.js', './js/prodart.js', './js/quests.js', './art/faces/owner.webp', './art/faces/assistant.webp', './art/products/atlas.webp',
  './vendor/three.module.min.js', './vendor/OrbitControls.js', './vendor/RoundedBoxGeometry.js', './vendor/RoomEnvironment.js',
  ...['staff_f', 'staff_m', 'manager', 'student_f', 'student_m', 'office_f', 'office_m', 'resident_f', 'resident_m', 'elder_f', 'elder_m', 'night_f', 'night_m'].flatMap(n => [`./art/chars/${n}.webp`, `./art/faces/${n}.webp`]),
  ...['p1', 'p2', 'p3', 'p4'].map(n => `./art/posters/${n}.webp`),
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 先用網路（拿到最新版），沒網路時用快取
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
