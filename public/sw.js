// Service Worker pour l'Évaluateur de Prix Insertech - Mode Network First (Zéro cache obsolète)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes API
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Enforcer Network-First pour toujours charger la version la plus récente du serveur
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
