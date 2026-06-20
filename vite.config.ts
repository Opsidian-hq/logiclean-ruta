/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA: precachea el shell y TODOS los chunks de ruta para que, tras la
    // primera carga con señal, la app (incluidas las rutas ya construidas)
    // funcione sin conexión. Cierra el riesgo de que el code-splitting deje
    // una ruta sin descargar offline.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'fonts/*.woff2'],
      manifest: {
        name: 'Logiclean Ruta',
        short_name: 'Logiclean',
        description: 'App de venta en ruta offline-first',
        theme_color: '#001D51',
        background_color: '#001D51',
        display: 'standalone',
        lang: 'es',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Precachea cada chunk emitido (incluye los lazy de cada ruta).
        globPatterns: ['**/*.{js,css,html,svg,woff2,ico,png}'],
        // Algún chunk de vendor puede superar el límite por defecto (2 MiB).
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // SPA: cualquier navegación cae en index.html (servido del precache).
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Separa los vendors estables del código de la app. Cambian rara vez,
        // así que entre deploys el service worker (precache por hash) no vuelve
        // a descargarlos y la primera carga en Android gama baja parte mejor.
        advancedChunks: {
          groups: [
            { name: 'vendor-react', test: /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\// },
            { name: 'vendor-ionic', test: /node_modules\/(@ionic|ionicons)\// },
            { name: 'vendor-supabase', test: /node_modules\/@supabase\// },
            { name: 'vendor-dexie', test: /node_modules\/dexie\// },
          ],
        },
      },
    },
  },
  test: {
    // Vitest config
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts'],
  },
});
