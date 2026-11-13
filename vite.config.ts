import { defineConfig, type Plugin, type PluginOption } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
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

// React Compiler (stable Babel build) memoizes components and hooks at build time.
// It needs Babel 7: babel-plugin-react-compiler 1.0 mis-parses Babel 8's AST, so @babel/core
// stays on ^7 (@rolldown/plugin-babel ^0.3 is fine with Babel 7).
// Functions it can't analyze are left as written (unmemoized); `COMPILER_REPORT=1 bun run build`
// lists which ones were compiled and which were skipped, and why.
function reactCompiler(): PluginOption[] {
  const report = process.env.COMPILER_REPORT === '1'
  const compiled: string[] = []
  const skipped: string[] = []
  const logger = {
    logEvent(filename: string | null, event: { kind: string; fnName?: string | null; detail?: unknown }) {
      const where = `${filename?.split('/src/')[1] ?? filename}:${event.fnName ?? '(anonymous)'}`
      if (event.kind === 'CompileSuccess') compiled.push(where)
      else if (event.kind === 'CompileError' || event.kind === 'CompileSkip') {
        const detail = event.detail as { reason?: string; options?: { reason?: string } } | undefined
        skipped.push(`${filename?.split('/src/')[1] ?? filename} — ${detail?.reason ?? detail?.options?.reason ?? event.kind}`)
      }
    },
  }
  return [
    babel({ presets: [reactCompilerPreset(report ? ({ logger } as never) : undefined)] }),
    {
      name: 'react-compiler-report',
      apply: 'build',
      closeBundle() {
        if (!report) return
        console.log(`\nReact Compiler: ${compiled.length} compiled, ${skipped.length} skipped`)
        for (const line of [...new Set(skipped)].sort()) console.log(`  skipped ${line}`)
      },
    },
  ]
}

export default defineConfig({
  plugins: [
    react(),
    ...reactCompiler(),
    htmlEnvPlugin(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: '垃圾車地圖',
        short_name: '垃圾車地圖',
        lang: 'zh-TW',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0f172a',
        theme_color: '#111827',
        description: '即時查詢台北、新北、台中、高雄、彰化、雲林垃圾車與資源回收車的停靠地點、清運路線與到達時間，支援常用站點收藏與離線瀏覽。',
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
        // Static schedules must remain normal HTML navigations after the PWA
        // takes control, rather than receiving the interactive map app shell.
        navigateFallbackDenylist: [/^\/(?:taipei|new-taipei|taichung|kaohsiung|changhua|yunlin)(?:\/|$)/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
        cleanupOutdatedCaches: true,
        // Take control of open pages as soon as a worker activates (first install and
        // user-approved updates), so offline support doesn't wait for a second visit.
        clientsClaim: true,
        runtimeCaching: [
          {
            // City point data changes at most weekly: serve the cached copy instantly and
            // refresh it in the background, instead of blocking on the network
            // (Taichung's published file is ~8 MB).
            urlPattern: ({ sameOrigin, url }) => sameOrigin && /-?trash-collection-points\.json$/.test(url.pathname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'city-data',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          },
          {
            // Route geometry, manifests and metadata are served same-origin under /routes/ and
            // rebuilt weekly: show the cached copy instantly, refresh in the background.
            // Kept in its own cache so it can't evict city data.
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/routes/'),
            handler: 'StaleWhileRevalidate',
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
