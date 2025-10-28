/**
 * Utility to dynamically update theme-color meta tag for iOS and Android
 * This ensures the browser chrome and status bar match the app's theme
 */

const LIGHT_THEME_COLOR = '#ffffff';
const DARK_THEME_COLOR = '#111827';

/**
 * Updates the theme-color meta tag to match the current theme
 * This is especially important for iOS Safari status bar appearance
 */
export function updateThemeColor(isDarkMode: boolean): void {
  const color = isDarkMode ? DARK_THEME_COLOR : LIGHT_THEME_COLOR;

  // Update all theme-color meta tags
  const metaTags = document.querySelectorAll('meta[name="theme-color"]');

  if (metaTags.length === 0) {
    // If no meta tag exists, create one
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
  } else {
    // Update existing meta tags
    metaTags.forEach((tag) => {
      (tag as HTMLMetaElement).content = color;
    });
  }

  // Also update msapplication-TileColor for Windows
  const tileMeta = document.querySelector('meta[name="msapplication-TileColor"]');
  if (tileMeta) {
    (tileMeta as HTMLMetaElement).content = color;
  }
}

/**
 * Initialize theme color based on current theme
 * Should be called on app mount
 */
export function initializeThemeColor(): void {
  const isDarkMode = document.documentElement.classList.contains('dark');
  updateThemeColor(isDarkMode);
}
