import { useRegisterSW } from 'virtual:pwa-register/react'

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates every 60 seconds
      if (r) {
        setInterval(() => {
          r.update()
        }, 60000)
      }
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error)
    },
  })

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
    <div className="fixed bottom-4 left-4 right-4 z-[1000] mx-auto max-w-md rounded-lg border border-neutral-300 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-3 text-sm font-medium text-black dark:text-white">
        {offlineReady ? (
          <span>應用程式已可離線使用</span>
        ) : (
          <span>有新版本可用！</span>
        )}
      </div>
      <div className="flex gap-2">
        {needRefresh && (
          <button
            onClick={handleUpdate}
            className="flex-1 rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            重新載入
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
