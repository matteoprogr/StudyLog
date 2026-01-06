const CACHE_NAME = 'studylog-cache-v55';
const urlsToCache = [
  '/',
  '/index.html?v=55',
  '/styles.css?v=55',
  '/main.js?v=55',
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

let activeTimer = null;

self.addEventListener('message', event => {
  if (event.data.type === 'START_TIMER') {
    const { endTime, materia } = event.data;
    const delay = endTime - Date.now();

    if (activeTimer) {
      clearTimeout(activeTimer);
    }

    if (delay > 0) {
      activeTimer = setTimeout(() => {
        self.registration.showNotification('Sessione completata', {
          body: `Hai terminato lo studio di ${materia}`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: [200, 100, 200],
          tag: 'study-timer'
        });
      }, delay);
    }
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/');
        }
      })
  );
});
