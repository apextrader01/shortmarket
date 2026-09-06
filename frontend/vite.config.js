import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // We must use injectManifest strategy to supply our own custom sw.js.
      // Otherwise, VitePWA ignores our public/sw.js and generates its own
      // which caches index.html and causes the blank screen!
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      injectRegister: null,
      registerType: 'prompt', // don't auto-register
      injectManifest: {
        injectionPoint: undefined, // Don't try to inject precache manifest into our sw.js
      },
      manifest: {
        name: 'ShortMarket',
        short_name: 'ShortMarket',
        description: 'Advanced Paper Trading Platform',
        theme_color: '#0a0b0d',
        background_color: '#0a0b0d',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    emptyOutDir: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lightweight-charts') || id.includes('recharts') || id.includes('technicalindicators') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('socket.io-client') || id.includes('zustand') || id.includes('firebase')) {
              return 'vendor-core';
            }
            return 'vendor-libs';
          }
        }
      }
    }
  }
})

