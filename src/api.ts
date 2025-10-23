/**
 * Simplified API module using registry-driven architecture
 *
 * All city-specific logic is now in adapters. This file provides
 * a clean interface for the rest of the app.
 */
import type { UnifiedTrashCollectionPoint } from './types';
import { cityRegistry, type City } from './cities/cityRegistry';

/**
 * Fetch data for a specific city
 * Uses the city registry to dispatch to the appropriate adapter
 */
export async function fetchTrashCollectionPoints(city: City): Promise<UnifiedTrashCollectionPoint[]> {
  const adapter = cityRegistry.getAdapter(city);
  return adapter.fetchData();
}

/**
 * Fetch data for multiple cities and combine them
 * @param cities - Array of city identifiers to fetch
 * @returns Combined array of trash collection points from all cities
 */
export async function fetchMultipleCities(cities: City[]): Promise<UnifiedTrashCollectionPoint[]> {
  const promises = cities.map(city => fetchTrashCollectionPoints(city));
  const results = await Promise.all(promises);
  return results.flat();
}

// Re-export City type for convenience
export type { City };

/**
 * Minimum zoom level required to load city data
 *
 * When the map is zoomed out beyond this level, no data is loaded
 * to prevent performance issues from loading large datasets when
 * the entire island is visible.
 */
export const MIN_DATA_LOAD_ZOOM = 10;

/**
 * Check if a viewport (bounding box) intersects with a city's boundaries
 * Uses bounding box intersection algorithm
 */
export function doesViewportIntersectCity(
  viewport: { north: number; south: number; east: number; west: number },
  city: City
): boolean {
  const cityBounds = cityRegistry.getCityBounds(city);

  // Two bounding boxes intersect if they are NOT separated on any axis
  return !(
    viewport.south > cityBounds.north ||  // viewport is above city
    viewport.north < cityBounds.south ||  // viewport is below city
    viewport.west > cityBounds.east ||    // viewport is right of city
    viewport.east < cityBounds.west       // viewport is left of city
  );
}

/**
 * Determine which cities should be loaded based on current viewport and zoom
 * Now automatically checks all registered cities in the registry
 */
export function getCitiesInViewport(
  viewport: { north: number; south: number; east: number; west: number } | null,
  zoom: number
): City[] {
  // Prevent data loading when zoomed out too far or viewport not initialized
  if (zoom < MIN_DATA_LOAD_ZOOM || !viewport) {
    return [];
  }

  // Automatically check all registered cities (no hardcoded checks needed!)
  return cityRegistry.getCityIds().filter(cityId =>
    doesViewportIntersectCity(viewport, cityId)
  );
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

// Group points into routes and sort by sequence
export function groupPointsIntoRoutes(points: UnifiedTrashCollectionPoint[]): Map<string, UnifiedTrashCollectionPoint[]> {
  const routeMap = new Map<string, UnifiedTrashCollectionPoint[]>();

  points.forEach(point => {
    const routeKey = `${point.source}-${point.route}`;
    if (!routeMap.has(routeKey)) {
      routeMap.set(routeKey, []);
    }
    routeMap.get(routeKey)!.push(point);
  });

  // Sort points within each route
  routeMap.forEach((routePoints, routeKey) => {
    if (routePoints[0]?.source === 'new-taipei') {
      // New Taipei: sort by rank
      routePoints.sort((a, b) => {
        const rankA = parseInt(a.id.split('-').pop() || '0');
        const rankB = parseInt(b.id.split('-').pop() || '0');
        return rankA - rankB;
      });
    } else {
      // Taipei: sort by arrival time
      routePoints.sort((a, b) => parseTimeToMinutes(a.arrivalTime) - parseTimeToMinutes(b.arrivalTime));
    }
  });

  return routeMap;
}

// Interpolate truck position along route based on current time
export function interpolateTruckPosition(
  routePoints: UnifiedTrashCollectionPoint[],
  currentMinutes: number
): { lat: number; lng: number; progress: number; status: 'before' | 'active' | 'after' } | null {
  if (routePoints.length === 0) return null;

  // Find the segment the truck is currently on
  for (let i = 0; i < routePoints.length; i++) {
    const currentPoint = routePoints[i];
    const arrivalTime = parseTimeToMinutes(currentPoint.arrivalTime);
    const departureTime = parseTimeToMinutes(currentPoint.departureTime);

    // Truck is at this stop
    if (currentMinutes >= arrivalTime && currentMinutes <= departureTime) {
      return {
        lat: parseFloat(currentPoint.latitude),
        lng: parseFloat(currentPoint.longitude),
        progress: i / (routePoints.length - 1),
        status: 'active',
      };
    }

    // Truck is between this stop and the next
    if (i < routePoints.length - 1) {
      const nextPoint = routePoints[i + 1];
      const nextArrivalTime = parseTimeToMinutes(nextPoint.arrivalTime);

      if (currentMinutes > departureTime && currentMinutes < nextArrivalTime) {
        // Interpolate position between two points
        const totalTime = nextArrivalTime - departureTime;
        const elapsedTime = currentMinutes - departureTime;
        const ratio = Math.min(1, Math.max(0, elapsedTime / totalTime));

        const lat1 = parseFloat(currentPoint.latitude);
        const lng1 = parseFloat(currentPoint.longitude);
        const lat2 = parseFloat(nextPoint.latitude);
        const lng2 = parseFloat(nextPoint.longitude);

        return {
          lat: lat1 + (lat2 - lat1) * ratio,
          lng: lng1 + (lng2 - lng1) * ratio,
          progress: (i + ratio) / (routePoints.length - 1),
          status: 'active',
        };
      }
    }
  }

  // Check if route hasn't started yet
  const firstArrival = parseTimeToMinutes(routePoints[0].arrivalTime);
  if (currentMinutes < firstArrival) {
    return {
      lat: parseFloat(routePoints[0].latitude),
      lng: parseFloat(routePoints[0].longitude),
      progress: 0,
      status: 'before',
    };
  }

  // Route has finished - show at last stop
  const lastPoint = routePoints[routePoints.length - 1];
  const lastDeparture = parseTimeToMinutes(lastPoint.departureTime);

  // Always return last stop if we get here (after all checks)
  return {
    lat: parseFloat(lastPoint.latitude),
    lng: parseFloat(lastPoint.longitude),
    progress: 1,
    status: currentMinutes > lastDeparture ? 'after' : 'active',
  };
}
