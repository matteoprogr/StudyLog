// OneSignalSDKWorker.js
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

console.log("✅ OneSignal Service Worker caricato");

const CACHE_NAME = "studylog-cache-v71";
const urlsToCache = [
  "./",
  "./index.html",
  "./css/style.css",
  "./main.js",
  "./auth.js",
  "./query.js",
  "./card.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./libs/dexie.mjs",
  "./libs/lucide.js",
  "./libs/echarts.min.js",
];

self.addEventListener("install", (event) => {
  console.log("🔧 INSTALL iniziato");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("📦 Cache aperta");
        const promises = urlsToCache.map((url) => {
          return fetch(url)
            .then((response) => {
              if (!response.ok) {
                console.warn(`⚠️ ${url} - Status: ${response.status}`);
                return null;
              }
              console.log(`✅ ${url} - OK`);
              return cache.put(url, response);
            })
            .catch((err) => {
              console.error(`❌ Errore su ${url}:`, err.message);
              return null;
            });
        });
        return Promise.all(promises);
      })
      .then(() => {
        console.log("✅ Install completato");
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", (event) => {
  console.log("🎯 ACTIVATE iniziato");

  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log(`🗑️ Elimino cache: ${key}`);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => {
        console.log("✅ Activate completato");
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          }
          return networkResponse;
        })
      );
    })
  );
});