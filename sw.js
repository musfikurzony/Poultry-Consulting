// CluckWise Field - Service Worker
// Caches the app shell (this page + its CDN scripts) so the app opens
// and works offline once installed. Supabase requests always go to the
// network directly - they are never cached, so data stays fresh and the
// app's own offline-queue logic handles saves made while disconnected.

const CACHE_NAME = 'cluckwise-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_FILES).catch(function (err) {
        console.warn('Shell cache warm-up failed (will still work online):', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  const url = event.request.url;

  // Never cache/interfere with Supabase API calls - always go live.
  if (url.indexOf('supabase.co') !== -1) {
    return;
  }

  // Cache-first for the app shell and its known CDN scripts.
  if (SHELL_FILES.indexOf(url) !== -1 || event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        return cached || fetch(event.request).then(function (response) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
          return response;
        }).catch(function () {
          return caches.match('./index.html');
        });
      })
    );
  }
});
