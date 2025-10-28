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
      <div className="rounded-lg border border-neutral-300 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
        <button
          onClick={handleDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-neutral-400 transition-colors hover:text-black dark:text-neutral-500 dark:hover:text-white"
          aria-label="關閉安裝提示"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-3 flex items-start gap-3">
          <div className="rounded-lg bg-sky-500 p-2.5 text-white shadow-sm dark:bg-sky-600">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="flex-1 pr-6">
            <h3 className="text-sm font-semibold text-black dark:text-white">
              安裝到主畫面
            </h3>
            <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
              獲得更好的使用體驗
            </p>
          </div>
        </div>

        <div className="mb-3 space-y-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300">
          <div className="flex items-center gap-2">
            <span className="text-sky-500 dark:text-sky-400">✓</span>
            <span>一鍵啟動，無需開啟瀏覽器</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sky-500 dark:text-sky-400">✓</span>
            <span>離線瀏覽收集點資訊</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sky-500 dark:text-sky-400">✓</span>
            <span>全螢幕體驗，介面更簡潔</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            disabled={isInstalling}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-black bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {isInstalling ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-black dark:border-t-transparent" />
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
            className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:border-black hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:border-white dark:hover:bg-neutral-800"
          >
            稍後
          </button>
        </div>

        <p className="mt-3 text-center text-[10px] text-neutral-500 dark:text-neutral-500">
          適用於 Android Chrome、Edge 與 Samsung 瀏覽器
        </p>
      </div>
    </div>
  );
}
