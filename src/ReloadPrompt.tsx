import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000
const OFFLINE_READY_TOAST_MS = 4000

export function ReloadPrompt() {
  // Stays true after the prompt is dismissed: the waiting worker still needs applying.
  const [updateWaiting, setUpdateWaiting] = useState(false)
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      setUpdateWaiting(true)
    },
    onRegisteredSW(swUrl, registration) {
      if (!registration) return

      // Drop runtime caches from the previous caching strategy (it kept the ~50 MB
      // Taichung file); Workbox only cleans up its precache automatically.
      void caches.delete('data-cache')
      void caches.delete('unpkg-cache')

      const checkForUpdate = async () => {
        if (registration.installing || !navigator.onLine) return
        try {
          // Probe the worker script first: registration.update() rejects noisily
          // when the network is flaky or behind a captive portal.
          const res = await fetch(swUrl, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
          if (res.status === 200) await registration.update()
        } catch {
          // Transient network failure; the next trigger will retry.
        }
      }

      setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
      window.addEventListener('online', checkForUpdate)
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) checkForUpdate()
      })
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error)
    },
  })

  // "Ready for offline" is informational: don't leave it on screen.
  useEffect(() => {
    if (!offlineReady) return
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_READY_TOAST_MS)
    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  // A dismissed prompt must not pin users to an old version forever: apply the
  // waiting update the next time the app is backgrounded, when a reload is invisible.
  useEffect(() => {
    if (!updateWaiting) return
    const applyWhenHidden = () => {
      if (document.hidden) updateServiceWorker(true)
    }
    document.addEventListener('visibilitychange', applyWhenHidden)
    return () => document.removeEventListener('visibilitychange', applyWhenHidden)
  }, [updateWaiting, updateServiceWorker])

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  const handleUpdate = () => {
    updateServiceWorker(true)
  }

  if (!offlineReady && !needRefresh) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[1000] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-lg border border-neutral-300 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900" style={{ marginBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="mb-3 text-sm font-medium text-black dark:text-white">
        {offlineReady ? (
          <span>已完成離線快取，沒網路也能查詢站點！</span>
        ) : (
          <span>有新版本可用，重新載入即可更新。</span>
        )}
      </div>
      <div className="flex gap-2">
        {needRefresh && (
          <button
            onClick={handleUpdate}
            className="flex-1 rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            立即更新
          </button>
        )}
        <button
          onClick={close}
          className="flex-1 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:border-black hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:border-white dark:hover:bg-neutral-800"
        >
          關閉
        </button>
      </div>
    </div>
  )
}
