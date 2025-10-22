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

// Parse HHMM string to minutes since midnight
export function parseTimeToMinutes(time: string): number {
  if (!time || time.length < 3) return 0;
  const hours = parseInt(time.slice(0, -2), 10);
  const minutes = parseInt(time.slice(-2), 10);
  return hours * 60 + minutes;
}

// Get current time in minutes since midnight (Taipei timezone)
export function getCurrentTimeInMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Get current time formatted as HH:MM (Taipei timezone)
export function getCurrentTimeFormatted(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

// Calculate time difference in minutes
export function getTimeDifferenceInMinutes(targetTime: string, currentMinutes: number): number {
  const targetMinutes = parseTimeToMinutes(targetTime);
  return targetMinutes - currentMinutes;
}

// Format time difference as human-readable string
export function formatTimeDifference(minutes: number): string {
  if (minutes < 0) return '已結束';
  if (minutes === 0) return '現在';
  if (minutes < 60) return `${minutes} 分鐘後`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} 小時後`;
  return `${hours} 小時 ${mins} 分鐘後`;
}

export type TimeStatus = 'active' | 'upcoming' | 'past';

// Determine if a point is active, upcoming, or past
export function getTimeStatus(arrivalTime: string, departureTime: string, currentMinutes: number): TimeStatus {
  const arrival = parseTimeToMinutes(arrivalTime);
  const departure = parseTimeToMinutes(departureTime);

  if (currentMinutes >= arrival && currentMinutes <= departure) {
    return 'active';
  } else if (currentMinutes < arrival) {
    return 'upcoming';
  } else {
    return 'past';
  }
}

// Check if point is within a time window
export function isWithinTimeWindow(
  arrivalTime: string,
  departureTime: string,
  currentMinutes: number,
  windowMinutes: number
): boolean {
  const arrival = parseTimeToMinutes(arrivalTime);
  const departure = parseTimeToMinutes(departureTime);
  const windowEnd = currentMinutes + windowMinutes;

  // Active now
  if (currentMinutes >= arrival && currentMinutes <= departure) {
    return true;
  }

  // Arriving within window
  if (arrival > currentMinutes && arrival <= windowEnd) {
    return true;
  }

  return false;
}
