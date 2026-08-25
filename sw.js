// Service Worker for Skill Practice Blog
// Provides offline support and caching strategy

const CACHE_NAME = 'skill-practice-v1';
const OFFLINE_URL = '/skill-practice/offline.html';

// Resources to pre-cache
const PRECACHE_RESOURCES = [
  '/skill-practice/',
  '/skill-practice/css/custom-enhancements.css',
  '/skill-practice/css/coze-style.css'
];

// Install event - pre-cache critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_RESOURCES);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests
  if (url.origin !== location.origin) return;

  // HTML pages: Network first, cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request) || caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets (CSS, JS, images): Cache first, network fallback
  if (
    url.pathname.match(/\.(css|js|png|jpg|jpeg|gif|webp|svg|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Update cache in background
          fetch(request).then((response) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
          });
          return cached;
        }
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Default: Network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
