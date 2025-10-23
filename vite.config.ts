import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Plugin to replace environment variables in HTML
function htmlEnvPlugin(): Plugin {
  return {
    name: 'html-env-plugin',
    transformIndexHtml(html) {
      return html.replace(
        /%%VITE_ADSENSE_CLIENT_ID%%/g,
        process.env.VITE_ADSENSE_CLIENT_ID || ''
      )
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    htmlEnvPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: '台北市垃圾車地圖',
        short_name: '垃圾車地圖',
        lang: 'zh-TW',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0f172a',
        theme_color: '#111827',
        description: '查詢台北市與新北市垃圾車和資源回收車路線、停靠地點與到站時間的互動式地圖工具。',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/unpkg\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unpkg-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /.*\.json$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'data-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  base: '/',
  server: {
    port: 3000,
  },
})
