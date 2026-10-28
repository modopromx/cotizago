import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate': el service worker aplica la version nueva y recarga solo,
      // sin molestar al usuario con un aviso. skipWaiting + clientsClaim hacen
      // que el nuevo SW tome control de inmediato.
      registerType: 'autoUpdate',
      // No inyectar el script de registro (workbox). La app ya no registra el SW;
      // en Safari iOS ese registro lanzaba «InvalidStateError: newestWorker is null».
      // La limpieza de SW/cachés viejos la hace AvisoActualizacion con la API nativa.
      injectRegister: false,
      // Service Worker AUTODESTRUCTIVO: en vez de cachear, se desregistra solo y
      // borra cachés viejos. Elimina de raíz los problemas de "versión vieja
      // pegada" que rompían el portal de facturación embebido. La app siempre
      // carga la última versión desde el servidor. (Se quita la PWA/offline, que
      // no se usaba; reversible si se quiere reactivar bien configurada.)
      selfDestroying: true,
      includeAssets: [
        'cotiza-go-logo-v2.png', 'apple-touch-icon.png', 'favicon-32x32.png',
      ],
      manifest: {
        name: 'Cotiza Go — Cotizaciones profesionales',
        short_name: 'Cotiza Go',
        description: 'Crea cotizaciones profesionales en PDF y envíalas por WhatsApp o email.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F3F6F9',
        theme_color: '#06213B',
        categories: ['business', 'productivity'],
        // iOS ignora los iconos SVG y Chrome pide PNG de 192 y 512 para ofrecer
        // la instalacion, asi que los PNG son los que mandan. El SVG queda como
        // extra para pantallas de alta densidad.
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Nueva cotización', short_name: 'Cotizar', url: '/app/cotizaciones/nueva' },
          { name: 'Mis cotizaciones', short_name: 'Cotizaciones', url: '/app/cotizaciones' },
        ],
      },
      workbox: {
        // El bundle incluye jsPDF/recharts: subimos el límite de precache.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Nunca cachear la API de Supabase ni el portal público de facturación:
        // /facturar debe cargar SIEMPRE en vivo (va embebido en el sitio de cada
        // negocio y los clientes deben ver la última versión al instante, sin caché).
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/, /^\/facturar/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'fuentes', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          // recharts y jspdf NO van aquí: un chunk manual arrastra sus helpers
          // compartidos y la portada terminaba precargando el PDF. Sin forzarlos,
          // Rollup los deja en trozos que solo bajan las páginas que los usan.
        },
      },
    },
  },
})
