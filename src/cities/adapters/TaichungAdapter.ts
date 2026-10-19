import { CityDataAdapter, type FetchOptions } from './BaseAdapter';
import type { CollectionSchedule, TaichungTrashCollectionPoint, UnifiedTrashCollectionPoint } from '../../types';

/**
 * Adapter for Taichung City (台中市) trash collection data
 *
 * Data Source: Merged from two sources:
 * 1. Schedule data from datacenter.taichung.gov.tw API
 *    - Collection times (arrival/departure)
 *    - Route information (vehicle license)
 *    - District, village, location
 * 2. Geocoded coordinates from TGOS batch geocoding
 *    - WGS84 longitude/latitude
 *
 * Data Structure:
 * - Static pre-fetched JSON file (updated monthly)
 * - Each record is a collection point with schedule
 * - Supports both garbage and recycling collection
 * - Day-specific schedules (1-7 for Monday-Sunday)
 *
 * Notes:
 * - Taichung has different collection times for different days
 * - Each location may appear multiple times (different days/types)
 * - Filter by current day of week for accurate real-time display
 */
export class TaichungAdapter extends CityDataAdapter<TaichungTrashCollectionPoint> {
  readonly cityId = 'taichung';
  readonly displayName = '台中市';
  readonly dataUrl = '/taichung-trash-collection-points.json';
  readonly dataType = 'static' as const;

  // Taichung city boundaries (extracted from Taiwan TopoJSON)
  readonly bounds = {
    north: 24.3647,
    south: 24.0097,
    east: 121.1427,
    west: 120.5608,
  };

  async fetchRawData(): Promise<TaichungTrashCollectionPoint[]> {
    return this.fetchJson<TaichungTrashCollectionPoint[]>(this.dataUrl);
  }

  override mapToUnified(point: TaichungTrashCollectionPoint): UnifiedTrashCollectionPoint {
    // Generate unique ID: route-location-day-type
    const locationKey = point.location.replace(/[^a-zA-Z0-9]/g, '');
    const id = `taichung-${point.route}-${locationKey}-d${point.dayOfWeek}-${point.collectionType}`;

    return {
      id,
      city: this.displayName,
      district: point.area,
      village: point.village,
      location: point.location,
      route: point.route,
      carSeq: point.route, // Use vehicle license as carSeq for route matching
      arrivalTime: point.arrivalTime,
      departureTime: point.departureTime,
      longitude: point.longitude,
      latitude: point.latitude,
      source: 'taichung',
      schedule: { [point.collectionType]: [point.dayOfWeek] },
    };
  }

  /**
   * Post-process: Filter by current day of week and deduplicate by location
   *
   * Strategy:
   * 1. Filter to only show today's collection points
   * 2. Deduplicate by coordinates (keep earliest collection time)
   *
   * Why: Same location can have multiple collections per day:
   * - Same truck visits multiple times
   * - Different collection types (garbage/recycling)
   */
  override postprocessData(
    unified: UnifiedTrashCollectionPoint[],
    options: FetchOptions = {},
  ): UnifiedTrashCollectionPoint[] {
    if (options.allDays) return this.mergeAllDays(unified);

    // Get current day of week (1 = Monday, 7 = Sunday)
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const taichungDay = currentDay === 0 ? 7 : currentDay; // Convert to 1-7 format

    // Step 1: Filter to only show today's collection points
    const todaysPoints = unified.filter(point => {
      // Extract dayOfWeek from the ID (format: taichung-ROUTE-LOCATION-dN-TYPE)
      const match = point.id.match(/-d(\d)-/);
      if (!match || !match[1]) return false;

      const pointDay = parseInt(match[1], 10);
      return pointDay === taichungDay;
    });

    // Step 2: Deduplicate by coordinates (keep earliest collection time)
    const locationMap = new Map<string, UnifiedTrashCollectionPoint>();

    for (const point of todaysPoints) {
      // Use coordinates as unique key
      const coordKey = `${point.longitude},${point.latitude}`;
      const existing = locationMap.get(coordKey);

      if (!existing) {
        // First time seeing this location
        locationMap.set(coordKey, point);
      } else {
        // Keep the point with earlier arrival time
        if (point.arrivalTime < existing.arrivalTime) {
          locationMap.set(coordKey, point);
        }
      }
    }

    // A single-day schedule would be misleading, so only all-days results carry one
    const deduplicated = Array.from(locationMap.values()).map(({ schedule: _schedule, ...point }) => point);

    console.log(`TaichungAdapter: ${unified.length} total → ${todaysPoints.length} today → ${deduplicated.length} deduplicated`);

    return deduplicated;
  }

  /**
   * All-days mode: rows are one per (stop, weekday, type), so collapse rows that
   * describe the same truck visit into one stop whose schedule lists every weekday.
   */
  private mergeAllDays(unified: UnifiedTrashCollectionPoint[]): UnifiedTrashCollectionPoint[] {
    const merged = new Map<string, UnifiedTrashCollectionPoint>();

    for (const point of unified) {
      const key = `${point.longitude},${point.latitude}|${point.route}|${point.arrivalTime}|${point.departureTime}`;
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, { ...point, schedule: cloneSchedule(point.schedule) });
        continue;
      }
      for (const [type, days] of Object.entries(point.schedule ?? {}) as [keyof CollectionSchedule, number[]][]) {
        const union = new Set([...(existing.schedule?.[type] ?? []), ...days]);
        existing.schedule = { ...existing.schedule, [type]: [...union].sort((a, b) => a - b) };
      }
    }

    console.log(`TaichungAdapter: ${unified.length} rows → ${merged.size} stops (all days)`);
    return Array.from(merged.values());
  }
}

function cloneSchedule(schedule: CollectionSchedule | undefined): CollectionSchedule | undefined {
  if (!schedule) return undefined;
  return Object.fromEntries(Object.entries(schedule).map(([type, days]) => [type, [...days]]));
}
