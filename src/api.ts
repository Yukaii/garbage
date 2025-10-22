import type { ApiResponse, TrashCollectionPoint } from './types';

// Fetch from static JSON file that is copied from the 'data' branch during build
// Data is stored separately and updated monthly via GitHub Actions
const STATIC_DATA_URL = '/trash-collection-points.json';

export async function fetchTrashCollectionPoints(): Promise<TrashCollectionPoint[]> {
  try {
    const response = await fetch(STATIC_DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: ApiResponse = await response.json();
    return data.result.results;
  } catch (error) {
    console.error('Error fetching trash collection points:', error);
    throw error;
  }
}

export function formatTime(time: string): string {
  if (!time || time.length < 3) return time;
  // Convert HHMM to HH:MM format
  const hours = time.slice(0, -2).padStart(2, '0');
  const minutes = time.slice(-2);
  return `${hours}:${minutes}`;
}
