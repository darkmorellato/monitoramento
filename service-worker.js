self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Apaga os caches e limpa para sempre, não bloqueia requisições do Vite.
});
