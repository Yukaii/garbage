import { CityDataAdapter } from './BaseAdapter';
import type { CollectionSchedule, NewTaipeiTrashCollectionPoint, UnifiedTrashCollectionPoint } from '../../types';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/** ISO weekdays (Mon=1 .. Sun=7) from the compact "1245" field, else from the raw per-day Y flags. */
function parseDays(compact: string | undefined, point: NewTaipeiTrashCollectionPoint, prefix: string): number[] | undefined {
  if (compact !== undefined) return [...compact].map(Number).filter(d => d >= 1 && d <= 7);
  const flags = point as unknown as Record<string, string | undefined>;
  if (!WEEKDAYS.some(day => prefix + day in flags)) return undefined;
  return WEEKDAYS.flatMap((day, i) => (flags[prefix + day] === 'Y' ? [i + 1] : []));
}

function buildSchedule(point: NewTaipeiTrashCollectionPoint): CollectionSchedule | undefined {
  const garbage = parseDays(point.garbageDays, point, 'garbage');
  const recycling = parseDays(point.recyclingDays, point, 'recycling');
  const foodscraps = parseDays(point.foodscrapsDays, point, 'foodscraps');
  if (!garbage && !recycling && !foodscraps) return undefined;
  return { ...(garbage && { garbage }), ...(recycling && { recycling }), ...(foodscraps && { foodscraps }) };
}

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
      carSeq: point.linename, // New Taipei uses linename as both route and car identifier
      arrivalTime,
      departureTime,
      longitude: point.longitude,
      latitude: point.latitude,
      source: 'new-taipei',
      schedule: buildSchedule(point),
    };
  }
}
