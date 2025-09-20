const CACHE_NAME = 'studylog-cache-v33';
const urlsToCache = [
  '/',
  '/index.html?v=33',
  '/styles.css?v=33',
  '/main.js?v=33',
  '/assets/sounds/alarm.mp3',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/libs/dexie.mjs',
  '/libs/lucide.js',
  '/libs/echarts.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch(() => response);
    })
  );
});
