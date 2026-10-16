// ============================================
// CALLBREAK TRACKER — Service Worker
// Caches app shell for offline use.
// Bump CACHE_VERSION whenever you update files.
// ============================================

const CACHE_VERSION = 'callbreak-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// Install — cache all assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => {
            return cache.addAll(ASSETS).catch(err => {
                // If one asset fails (e.g. icon missing), don't break install
                console.warn('SW: some assets failed to cache', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate — clear old caches, take control
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch — cache-first for same-origin, fall back to network
self.addEventListener('fetch', event => {
    // Only handle GET requests from our own origin
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== location.origin) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                // Cache successful responses for next time
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline fallback: serve index.html for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});