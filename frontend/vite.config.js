import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Disable service worker registration completely.
      // Service workers intercept page requests and return stale cached content,
      // causing a blank screen on refresh. Trading platforms need live data
      // on every load — offline caching is actively harmful here.
      injectRegister: null,
      registerType: 'prompt', // don't auto-register
      workbox: {
        // Don't precache anything
        globPatterns: [],
        // Immediately claim and clear old caches to fix users with the old broken SW
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [],
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
})
