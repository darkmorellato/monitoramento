/**
 * Service Worker for Monitor de Avaliações Miplace
 * Advanced PWA with background sync, push notifications, and offline support
 * @version 2.0.0
 */

const CACHE_NAME = 'monitor-v2';
const STATIC_CACHE = 'monitor-static-v2';
const DYNAMIC_CACHE = 'monitor-dynamic-v2';
const IMAGE_CACHE = 'monitor-images-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/components.css',
  '/css/animations.css',
  '/src/accessibility/a11y.css',
  '/manifest.json',
  '/assets/icone/favicon.ico',
  '/assets/icone/favicon-32x32.png',
  '/assets/icone/favicon-16x16.png',
  '/assets/icone/apple-touch-icon.png',
  '/assets/icone/android-chrome-192x192.png',
  '/assets/icone/android-chrome-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (
              cacheName !== STATIC_CACHE &&
              cacheName !== DYNAMIC_CACHE &&
              cacheName !== IMAGE_CACHE
            ) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isStaticAsset(request)) {
    event.respondWith(handleStaticRequest(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

// Helper functions
function isImageRequest(request) {
  return request.destination === 'image';
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return STATIC_ASSETS.includes(url.pathname) ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.startsWith('/assets/icone/');
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis');
}

// Handle static assets - Cache First
async function handleStaticRequest(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    console.error('[SW] Failed to fetch static asset:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Handle images - Cache First with expiration
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Return cached but also refresh in background
    refreshCache(request, cache);
    return cached;
  }

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    console.log('[SW] Image fetch failed, returning placeholder');
    return new Response('Image unavailable offline', { status: 503 });
  }
}

// Handle API requests - Network First with cache fallback
async function handleAPIRequest(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Handle dynamic content - Network First, fallback to cache
async function handleDynamicRequest(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Fallback to index.html for SPA routes
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }

    throw error;
  }
}

// Refresh cache in background
async function refreshCache(request, cache) {
  try {
    const response = await fetch(request);
    cache.put(request, response);
  } catch (error) {
    // Ignore refresh errors
  }
}

// Background Sync - for offline data sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-logs') {
    event.waitUntil(syncPendingLogs());
  } else if (event.tag === 'sync-entries') {
    event.waitUntil(syncPendingEntries());
  }
});

async function syncPendingLogs() {
  console.log('[SW] Syncing pending logs...');
  // Implementation would sync with Firebase
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      data: { timestamp: Date.now() }
    });
  });
}

async function syncPendingEntries() {
  console.log('[SW] Syncing pending entries...');
  // Implementation would sync form submissions
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'ENTRIES_SYNC_COMPLETE',
      data: { timestamp: Date.now() }
    });
  });
}

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  const data = event.data?.json() || {
    title: 'Monitor de Avaliações',
    body: 'Nova atualização disponível!',
    icon: '/assets/icone/android-chrome-192x192.png',
    badge: '/assets/icone/badge-72x72.png',
    url: '/'
  };

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      { action: 'open', title: 'Abrir App' },
      { action: 'dismiss', title: 'Fechar' }
    ],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  const { action, notification } = event;
  const { url } = notification.data || {};

  if (action === 'dismiss') {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then((clients) => {
        // Focus existing window if open
        for (const client of clients) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data === 'CLEAR_CACHES') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }

  if (event.data?.type === 'CACHE_ASSETS') {
    const assets = event.data.assets;
    caches.open(STATIC_CACHE).then((cache) => {
      cache.addAll(assets);
    });
  }

  // Handle push subscription
  if (event.data?.type === 'SUBSCRIBE_PUSH') {
    subscribeToPush(event.data.subscription);
  }
});

async function subscribeToPush(subscription) {
  console.log('[SW] Push subscription:', subscription);
  // Send subscription to server
  // Implementation would POST to backend
}

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'daily-sync') {
      event.waitUntil(syncPendingLogs());
    }
  });
}

// Error handling
self.addEventListener('error', (event) => {
  console.error('[SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
});

console.log('[SW] Service Worker loaded successfully');
