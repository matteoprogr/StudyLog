console.log("🚀 Service Worker v60 caricato");

importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

const CACHE_NAME = "studylog-cache-v62"; // Cambia versione
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/main.js",
  "/assets/sounds/alarm.mp3",
  "/icons/icon-192.png",
  "/libs/dexie.mjs",
  "/libs/lucide.js",
  "/libs/echarts.min.js",
];

self.addEventListener("install", (event) => {
  console.log("🔧 INSTALL iniziato");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("📦 Cache aperta, tento di cachare i file...");

        // Cacha i file uno per uno per identificare quale fallisce
        const promises = urlsToCache.map((url) => {
          return fetch(url)
            .then((response) => {
              if (!response.ok) {
                console.warn(`⚠️ ${url} - Status: ${response.status}`);
                return null; // Non bloccare per file mancanti
              }
              console.log(`✅ ${url} - OK`);
              return cache.put(url, response);
            })
            .catch((err) => {
              console.error(`❌ Errore su ${url}:`, err.message);
              return null; // Non bloccare per errori di rete
            });
        });

        return Promise.all(promises);
      })
      .then(() => {
        console.log("✅ Install completato - skipWaiting");
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error("💥 ERRORE CRITICO install:", err);
        throw err; // Questo renderà il SW redundant
      })
  );
});

self.addEventListener("activate", (event) => {
  console.log("🎯 ACTIVATE iniziato");

  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        console.log("🗑️ Cache esistenti:", keys);
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log(`🗑️ Elimino cache vecchia: ${key}`);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => {
        console.log("✅ Activate completato - claiming clients");
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
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              return caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              });
            }
            return networkResponse;
          })
          .catch(() => response)
      );
    })
  );
});

//self.addEventListener("push", (event) => {
//  console.log("📬 Push ricevuto:", event.data);
//  if (!event.data) return;
//
//  const data = event.data.json();
//
//  event.waitUntil(
//    self.registration.showNotification("Sessione completata", {
//      body: `Hai terminato lo studio di ${data.materia}`,
//      icon: "/icons/icon-192.png",
//      badge: "/icons/icon-192.png",
//      tag: "study-timer",
//    })
//  );
//});


//self.addEventListener("notificationclick", (event) => {
//  event.notification.close();
//
//  event.waitUntil(
//    self.clients
//      .matchAll({ type: "window", includeUncontrolled: true })
//      .then((clients) => {
//        if (clients.length > 0) {
//          clients[0].focus();
//        } else {
//          self.clients.openWindow("/");
//        }
//      })
//  );
//});
