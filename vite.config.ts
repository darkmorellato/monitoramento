import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Monitoramento de Preços',
        short_name: 'Monitoramento',
        description: 'Sistema de monitoramento de preços com OCR',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'firebase-storage',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    headers: {
      // Content Security Policy - Proteção contra XSS
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://www.gstatic.com https://*.firebaseio.com https://*.googleapis.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.googleusercontent.com",
        "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebasestorage.googleapis.com wss://*.firebaseio.com",
        "worker-src 'self' blob:",
        "frame-src 'self'",
        "media-src 'self' blob:",
      ].join('; '),
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      // Clickjacking protection
      'X-Frame-Options': 'DENY',
      // XSS Protection
      'X-XSS-Protection': '1; mode=block',
      // Referrer Policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // Permissions Policy
      'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
      // Strict Transport Security (HSTS)
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Code splitting - separate vendor chunks
          'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/storage'],
          'vendor-charts': ['chart.js'],
          'vendor-ocr': ['tesseract.js'],
          'vendor-utils': ['jspdf', 'papaparse'],
        },
      },
    },
  },
});
