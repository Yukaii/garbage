/**
 * Utility functions for sharing collection points via URL
 */

/**
 * Check if the current device is desktop (not mobile)
 */
function isDesktop(): boolean {
  return window.innerWidth >= 768;
}

/**
 * Generate a shareable URL for a specific point
 * Preserves existing URL parameters (lat, lng, zoom) and adds point parameter
 */
export function generateShareUrl(pointId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('point', pointId);
  return url.toString();
}

/**
 * Get point ID from current URL if present
 */
export function getPointIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('point');
}

/**
 * Extract city/region from point ID
 * Point IDs are formatted as: {city}-{rest} (e.g., taipei-123, new-taipei-lineid-rank)
 */
export function getCityFromPointId(pointId: string): string | null {
  // Handle known city prefixes
  if (pointId.startsWith('new-taipei-')) return 'new-taipei';
  if (pointId.startsWith('taipei-')) return 'taipei';
  if (pointId.startsWith('taichung-')) return 'taichung';
  if (pointId.startsWith('kaohsiung-')) return 'kaohsiung';
  return null;
}

/**
 * Remove point parameter from URL without page reload
 */
export function clearPointFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('point');
  window.history.replaceState({}, '', url.toString());
}

/**
 * Copy URL to clipboard
 */
async function copyToClipboard(url: string): Promise<{ success: boolean; message: string }> {
  try {
    await navigator.clipboard.writeText(url);
    return { success: true, message: '已複製連結' };
  } catch (error) {
    // Last resort: try creating a temporary textarea
    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return { success: true, message: '已複製連結' };
    } catch {
      return { success: false, message: '無法複製連結' };
    }
  }
}

/**
 * Share a point - on desktop always copy to clipboard, on mobile use Web Share API
 * Returns true if sharing was successful, false otherwise
 */
export async function sharePoint(
  pointId: string,
  pointName: string
): Promise<{ success: boolean; method: 'share' | 'clipboard' | 'error'; message: string }> {
  const shareUrl = generateShareUrl(pointId);

  // On desktop, always copy to clipboard
  if (isDesktop()) {
    const result = await copyToClipboard(shareUrl);
    return { ...result, method: result.success ? 'clipboard' : 'error' };
  }

  // On mobile, try native Web Share API first
  if (navigator.share) {
    try {
      await navigator.share({
        title: '垃圾車地圖 - 收集點',
        text: `查看收集點：${pointName}`,
        url: shareUrl,
      });
      return { success: true, method: 'share', message: '已分享' };
    } catch (error) {
      // User cancelled share - not an error
      if ((error as Error).name === 'AbortError') {
        return { success: false, method: 'share', message: '取消分享' };
      }
      // Fall through to clipboard
    }
  }

  // Fallback to clipboard on mobile if Web Share fails
  const result = await copyToClipboard(shareUrl);
  return { ...result, method: result.success ? 'clipboard' : 'error' };
}
