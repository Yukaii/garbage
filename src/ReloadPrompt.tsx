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
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        left: '1rem',
        maxWidth: '400px',
        margin: '0 auto',
        padding: '1rem',
        backgroundColor: '#1f2937',
        color: '#f9fafb',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        zIndex: 1000,
      }}
    >
      <div style={{ marginBottom: '0.75rem' }}>
        {offlineReady ? (
          <span>應用程式已可離線使用 | App ready to work offline</span>
        ) : (
          <span>有新版本可用！| New version available!</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {needRefresh && (
          <button
            onClick={handleUpdate}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            重新載入 | Reload
          </button>
        )}
        <button
          onClick={close}
          style={{
            flex: 1,
            padding: '0.5rem 1rem',
            backgroundColor: '#4b5563',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          關閉 | Close
        </button>
      </div>
    </div>
  )
}
