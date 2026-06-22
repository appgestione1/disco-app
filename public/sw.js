// Service worker EVENT — offline app shell + installabilità Android.
// Strategia anti-stale:
//  - navigazioni: network-first, fallback alla index.html in cache (app apribile offline)
//  - asset hashati (/assets/*) e icone: cache-first (i nomi cambiano a ogni build → sempre freschi)
//  - tutto il resto (Firestore, googleapis, TMDB, analytics, cross-origin): passa diretto, mai in cache
// Aggiornare CACHE_VERSION a ogni modifica di questo file per invalidare la cache.
const CACHE_VERSION = 'event-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Solo stessa origine: Firestore/TMDB/analytics/CDN esterni passano diretti.
  if (url.origin !== self.location.origin) return;

  // Navigazioni (apertura pagina): network-first, fallback all'app shell in cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    );
    return;
  }

  // Asset statici: cache-first, popolando la cache al primo fetch.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
        }
        return res;
      });
    })
  );
});
