const CACHE_NAME = 'schuetzen-app-v1';
const ASSETS_TO_CACHE = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'icons/wappen.jpg'
];

// Installation & Caching
self.addEventListener('install', event => {
  console.log('[SW] Service Worker wird installiert...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching der App-Shell...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => {
        console.error('[SW] Fehler beim Caching während der Installation:', err);
      })
  );
});

// Aktivierung & alte Caches löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

// Fetch (Netzwerk First, dann Cache als Fallback)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
