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
    <div className="fixed bottom-4 left-4 right-4 z-[1000] mx-auto max-w-md animate-slide-up">
      <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-2xl dark:border-green-800 dark:from-green-950 dark:to-emerald-950">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-green-600 transition-colors hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900"
          aria-label="關閉安裝提示"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-lg bg-green-500 p-2 text-white shadow-md dark:bg-green-600">
            <Smartphone className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-green-900 dark:text-green-100">
              安裝到主畫面
            </h3>
            <p className="mt-1 text-sm text-green-700 dark:text-green-300">
              快速啟動、離線使用、接收更新通知
            </p>
          </div>
        </div>

        <div className="mb-3 space-y-2 text-xs text-green-600 dark:text-green-400">
          <div className="flex items-center gap-2">
            <span className="text-green-500 dark:text-green-500">✓</span>
            <span>一鍵啟動，無需開啟瀏覽器</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500 dark:text-green-500">✓</span>
            <span>離線瀏覽收集點資訊</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500 dark:text-green-500">✓</span>
            <span>全螢幕體驗，介面更簡潔</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-600"
          >
            {isInstalling ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>安裝中...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>立即安裝</span>
              </>
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-lg border border-green-300 bg-white px-4 py-3 text-sm font-medium text-green-700 transition-colors hover:bg-green-50 dark:border-green-700 dark:bg-green-950 dark:text-green-300 dark:hover:bg-green-900"
          >
            稍後
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] text-green-600 dark:text-green-500">
          適用於 Android Chrome、Edge 與 Samsung 瀏覽器
        </p>
      </div>
    </div>
  );
}
