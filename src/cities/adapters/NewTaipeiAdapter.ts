import { CityDataAdapter } from './BaseAdapter';
import type { NewTaipeiTrashCollectionPoint, UnifiedTrashCollectionPoint } from '../../types';

/**
 * Adapter for New Taipei City (新北市) trash collection data
 *
 * Data Source: data.ntpc.gov.tw Open Data API
 * - Static pre-fetched JSON file (updated monthly)
 * - Direct array format (no wrapper)
 * - Uses English field names (city, lineid, name, etc.)
 * - Time format: HH:MM (e.g., "18:30")
 * - No explicit departure time (calculated as +10 minutes)
 */
export class NewTaipeiAdapter extends CityDataAdapter<NewTaipeiTrashCollectionPoint> {
  readonly cityId = 'new-taipei';
  readonly displayName = '新北市';
  readonly dataUrl = '/new-taipei-trash-collection-points.json';
  readonly dataType = 'static' as const;
  readonly bounds = {
    north: 25.298899838693202,
    south: 24.67314274446706,
    east: 122.00691904918543,
    west: 121.28260999667577,
  };

  async fetchRawData(): Promise<NewTaipeiTrashCollectionPoint[]> {
    return this.fetchJson<NewTaipeiTrashCollectionPoint[]>(this.dataUrl);
  }

  mapToUnified(point: NewTaipeiTrashCollectionPoint): UnifiedTrashCollectionPoint {
    // Convert HH:MM to HHMM format for internal use
    const arrivalTime = point.time.replace(':', '');

    // Calculate departure time (assume 10 minutes collection time)
    const arrivalMinutes = parseInt(arrivalTime.slice(0, -2)) * 60 + parseInt(arrivalTime.slice(-2));
    const departureMinutes = arrivalMinutes + 10;
    const departureHours = Math.floor(departureMinutes / 60);
    const departureMins = departureMinutes % 60;
    const departureTime = `${departureHours}${departureMins.toString().padStart(2, '0')}`;

    return {
      id: `new-taipei-${point.lineid}-${point.rank}`,
      city: this.displayName,
      district: point.city,
      village: point.village,
      location: point.name,
      route: point.linename,
      arrivalTime,
      departureTime,
      longitude: point.longitude,
      latitude: point.latitude,
      source: 'new-taipei',
    };
  }
}
