import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'starredPoints';

/**
 * Custom hook to manage starred/favorite points in localStorage
 * Provides persistent storage across browser sessions
 */
export function useFavorites() {
  const [starredPointIds, setStarredPointIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage whenever starredPointIds changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(starredPointIds));
    } catch (error) {
      console.error('Failed to save starred points to localStorage:', error);
    }
  }, [starredPointIds]);

  const toggleStar = useCallback((pointId: string) => {
    setStarredPointIds((prev) => {
      if (prev.includes(pointId)) {
        return prev.filter((id) => id !== pointId);
      }
      return [...prev, pointId];
    });
  }, []);

  const isStarred = useCallback(
    (pointId: string) => starredPointIds.includes(pointId),
    [starredPointIds]
  );

  const clearAllStars = useCallback(() => {
    setStarredPointIds([]);
  }, []);

  return {
    starredPointIds,
    toggleStar,
    isStarred,
    clearAllStars,
    starredCount: starredPointIds.length,
  };
}
