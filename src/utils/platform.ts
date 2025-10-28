/**
 * Platform detection utilities for PWA installation
 */

export interface PlatformInfo {
  isAndroid: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'samsung' | 'other';
}

/**
 * Detects if the user is on an Android device
 */
export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/**
 * Detects if the user is on an iOS device
 */
export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Detects if the app is running in standalone mode (already installed)
 */
export function isStandalone(): boolean {
  // Check for PWA standalone mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check for iOS standalone
  if ('standalone' in navigator && (navigator as any).standalone === true) {
    return true;
  }

  return false;
}

/**
 * Detects the browser being used
 */
export function detectBrowser(): PlatformInfo['browser'] {
  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('samsungbrowser')) return 'samsung';
  if (ua.includes('edg')) return 'edge';
  if (ua.includes('chrome')) return 'chrome';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('safari')) return 'safari';

  return 'other';
}

/**
 * Checks if the device/browser supports PWA installation
 */
export function canInstallPWA(): boolean {
  // Already installed
  if (isStandalone()) {
    return false;
  }

  // iOS Safari supports manual installation
  if (isIOS()) {
    return true;
  }

  // Android browsers that support beforeinstallprompt
  if (isAndroid()) {
    const browser = detectBrowser();
    return ['chrome', 'edge', 'samsung'].includes(browser);
  }

  return false;
}

/**
 * Gets comprehensive platform information
 */
export function getPlatformInfo(): PlatformInfo {
  return {
    isAndroid: isAndroid(),
    isIOS: isIOS(),
    isStandalone: isStandalone(),
    canInstall: canInstallPWA(),
    browser: detectBrowser(),
  };
}

/**
 * Checks if the user has previously dismissed the install prompt
 */
export function hasUserDismissedInstallPrompt(): boolean {
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  if (!dismissed) return false;

  const dismissedDate = new Date(dismissed);
  const now = new Date();
  const daysSinceDismissal = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);

  // Show again after 7 days
  return daysSinceDismissal < 7;
}

/**
 * Marks that the user has dismissed the install prompt
 */
export function markInstallPromptDismissed(): void {
  localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
}

/**
 * Checks if the user has installed the PWA
 */
export function markPWAInstalled(): void {
  localStorage.setItem('pwa-installed', 'true');
}

/**
 * Checks if the PWA was previously installed
 */
export function wasPWAInstalled(): boolean {
  return localStorage.getItem('pwa-installed') === 'true';
}
