const CACHE_NAME = 'monitor-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/components.css',
    '/css/animations.css',
    '/src/app.js',
    '/src/auth.js',
    '/src/firebase.js',
    '/src/ui.js',
    '/src/utils.js',
    '/src/charts.js',
    '/src/export.js',
    '/src/keys.js',
    '/src/ocr.js',
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ));
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
