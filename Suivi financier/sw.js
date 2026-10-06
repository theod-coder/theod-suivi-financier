const CACHE_NAME = 'mon-budget-v7';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './js/constants.js',
  './js/utils.js',
  './js/state.js',
  './js/realtime.js',
  './js/transactions.js',
  './js/visualization.js',
  './js/categories.js',
  './js/backup.js',
  './manifest.json',
  './icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((k) => { if (k !== CACHE_NAME) return caches.delete(k); })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});