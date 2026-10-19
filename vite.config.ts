import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Plugin to replace environment variables in HTML
function htmlEnvPlugin(): Plugin {
  return {
    name: 'html-env-plugin',
    transformIndexHtml(html) {
      return html
        .replace(
          /%%VITE_ADSENSE_CLIENT_ID%%/g,
          process.env.VITE_ADSENSE_CLIENT_ID || ''
        )
        .replace(
          /%%VITE_GA_ID%%/g,
          process.env.VITE_GA_ID || ''
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
        cleanupOutdatedCaches: true,
        // Take control of open pages as soon as a worker activates (first install and
        // user-approved updates), so offline support doesn't wait for a second visit.
        clientsClaim: true,
        runtimeCaching: [
          {
            // City point data changes monthly: serve the cached copy instantly and
            // refresh it in the background, instead of blocking on the network
            // (Taichung's file is ~50 MB).
            urlPattern: ({ sameOrigin, url }) => sameOrigin && /-?trash-collection-points\.json$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'city-data',
              expiration: {
                maxEntries: 6,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          },
          {
            // Route geometry is fetched from a CDN pinned to a data-branch commit, so
            // each URL is immutable. Kept in its own cache so it can't evict city data.
            urlPattern: ({ url }) => url.hostname === 'rawcdn.githack.com' && url.pathname.endsWith('.geojson'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'route-geometry',
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  base: '/',
})
