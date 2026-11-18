const CACHE_NAME = 'xolbor-ultimate-v5';
const ASSETS = [
    '/',
    '/public/home.css'
    // removed specific assets to rely on dynamic caching or network
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force activation
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim(); // Take control immediately
});

self.addEventListener('fetch', (event) => {
    // Network First strategy
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request).then(response => response || new Response('Not found', { status: 404 })))
    );
});
