import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'cotiza-go-logo.png', 'logo-icon.svg'],
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
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
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
        // Nunca cachear la API de Supabase: los datos deben venir frescos.
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/],
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
          charts: ['recharts'],
          pdf: ['jspdf', 'jspdf-autotable', 'qrcode'],
        },
      },
    },
  },
})
