import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages sirve el sitio bajo /<repo>/, asi que el workflow de despliegue
// pasa BASE_PATH=/<repo>/. En local usamos '/' para que la app se pueda abrir
// desde el iPad en http://<ip-de-tu-mac>:5173.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        id: 'luz-verde-luz-roja',
        name: 'Luz Verde, Luz Roja',
        short_name: 'Luz Verde',
        description:
          'Juego infantil de Luz Verde, Luz Roja. Camina despacio hacia el iPad y quedate como estatua en la luz roja.',
        lang: 'es',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        categories: ['games', 'kids'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El app shell se precachea. El modelo de pose (~5.7 MB) y el runtime
        // wasm (~12 MB) NO se precachean: se guardan en cache la primera vez
        // que se usan, para que la primera carga no descargue 18 MB de golpe.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/models/') || url.pathname.endsWith('.task'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pose-model',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/mediapipe/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-runtime',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
