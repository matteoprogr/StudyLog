// Keep the existing worker URL so installed copies receive the local update.
const CACHE = 'studylog-cache-local-v5';
const APP = [
  './index.html',
  './css/style.css',
  './main.js',
  './query.js',
  './card.js',
  './charts.js',
  './manifest.json',
  './icons/icon-192.png',
  './libs/dexie.mjs',
  './libs/lucide.js',
  './libs/echarts.min.js',
  './assets/sounds/alarm.mp3',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP.map(path => new Request(path, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('studylog-cache-') && key !== CACHE)
      .map(key => caches.delete(key)));
    try {
      const subscription = await self.registration.pushManager?.getSubscription();
      if (subscription) await subscription.unsubscribe();
    } catch (error) {
      console.warn(error);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(new URL('./index.html', self.registration.scope), { cacheName: CACHE })));
    return;
  }
  event.respondWith(caches.match(request, { cacheName: CACHE }).then(response => response ?? fetch(request)));
});
