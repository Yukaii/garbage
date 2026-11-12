import { useEffect, useState } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import {
  getPlatformInfo,
  hasUserDismissedInstallPrompt,
  markInstallPromptDismissed,
  markPWAInstalled,
} from './utils/platform';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [platform] = useState(() => getPlatformInfo());

  useEffect(() => {
    // Don't show if already installed or user dismissed recently
    if (platform.isStandalone || hasUserDismissedInstallPrompt()) {
      return;
    }

    // Only show for Android Chrome/Edge/Samsung Browser
    if (!platform.isAndroid || !platform.canInstall) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the default mini-infobar from appearing
      e.preventDefault();

      // Store the event for later use
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Show custom install prompt after a short delay (2 seconds)
      setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
    };

    const handleAppInstalled = () => {
      // Hide the install prompt
      setShowPrompt(false);
      setDeferredPrompt(null);

      // Mark as installed
      markPWAInstalled();

      console.log('PWA was installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [platform]);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    setIsInstalling(true);

    try {
      // Show the browser's install prompt
      await deferredPrompt.prompt();

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        markPWAInstalled();
      } else {
        console.log('User dismissed the install prompt');
      }

      // Clear the deferred prompt
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error during installation:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    markInstallPromptDismissed();
  };

  // Don't render if conditions aren't met
  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div
      className="fixed right-4 bottom-4 left-4 z-[1000] mx-auto max-w-md animate-slide-up"
      style={{
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="relative rounded-xl border border-neutral-200 bg-white/95 p-4 shadow-xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          aria-label="關閉安裝提示"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-lg bg-sky-500 p-2.5 text-white shadow-sm dark:bg-sky-600">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              加到手機主畫面
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              像 App 一樣快速開啟，支援離線查詢
            </p>
          </div>
        </div>

        <div className="mb-3 space-y-1.5 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-neutral-300">
          <div className="flex items-center gap-2">
            <span className="text-sky-500 dark:text-sky-400">✓</span>
            <span>從主畫面一鍵開啟，免開瀏覽器</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sky-500 dark:text-sky-400">✓</span>
            <span>自動快取資料，沒網路也能查時刻表</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sky-500 dark:text-sky-400">✓</span>
            <span>全螢幕地圖介面，視野更清爽</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleInstall}
            disabled={isInstalling}
            className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-4 text-xs font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {isInstalling ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-neutral-900 dark:border-t-transparent" />
                <span>安裝中…</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>立即安裝</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="h-9 rounded-lg border border-neutral-200 bg-white px-4 text-xs font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            稍後
          </button>
        </div>

        <p className="mt-2.5 text-center text-[10px] text-neutral-400 dark:text-neutral-500">
          支援 Android 版 Chrome、Edge 與 Samsung 瀏覽器
        </p>
      </div>
    </div>
  );
}
