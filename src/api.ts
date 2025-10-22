import type { ApiResponse, TrashCollectionPoint } from './types';

const API_URL = 'https://data.taipei/api/v1/dataset/a6e90031-7ec4-4089-afb5-361a4efe7202';

export async function fetchTrashCollectionPoints(limit = 5000, offset = 0): Promise<TrashCollectionPoint[]> {
  try {
    const response = await fetch(`${API_URL}?scope=resourceAquire&limit=${limit}&offset=${offset}`);
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
