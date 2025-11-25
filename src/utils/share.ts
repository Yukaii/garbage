/**
 * Utility functions for sharing collection points via URL
 */

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
 * Share a point using Web Share API if available, otherwise copy to clipboard
 * Returns true if sharing was successful, false otherwise
 */
export async function sharePoint(
  pointId: string,
  pointName: string
): Promise<{ success: boolean; method: 'share' | 'clipboard' | 'error'; message: string }> {
  const shareUrl = generateShareUrl(pointId);

  // Try native Web Share API first (mobile)
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

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(shareUrl);
    return { success: true, method: 'clipboard', message: '已複製連結' };
  } catch (error) {
    // Last resort: try creating a temporary textarea
    try {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return { success: true, method: 'clipboard', message: '已複製連結' };
    } catch {
      return { success: false, method: 'error', message: '無法複製連結' };
    }
  }
}
