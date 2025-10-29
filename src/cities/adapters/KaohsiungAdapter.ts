import { CityDataAdapter } from './BaseAdapter';
import type { UnifiedTrashCollectionPoint } from '../../types';

/**
 * Kaohsiung trash collection point (from API + geocoded data)
 * Matches Taichung data structure format
 */
interface KaohsiungTrashCollectionPoint {
  area: string;
  village: string;
  route: string;
  location: string;
  type: string;
  arrivalTime: string; // Format: "HHMM" (e.g., "1625")
  departureTime: string; // Format: "HHMM" (e.g., "1631")
  longitude: string;
  latitude: string;
  collectionType: string;
}

/**
 * Adapter for Kaohsiung City (高雄市) trash collection data
 *
 * Data Source: Merged from two sources:
 * 1. Live API from Kaohsiung City Government (data.kcg.gov.tw)
 *    - District, village, location
 *    - Collection times (today_s, today_e)
 *    - Route information (vehicle license)
 *    - 18,495 collection records (includes duplicates by time)
 * 2. Geocoded coordinates from TGOS batch geocoding
 *    - WGS84 longitude/latitude
 *    - 12,003 unique geocoded addresses (97.9% success rate)
 *
 * Data Structure:
 * - Static pre-fetched JSON file (regenerated periodically)
 * - Each record is a collection point with schedule
 * - Time format: "HH:MM" (24-hour)
 * - Deduplicated by coordinates (one entry per location)
 * - 11,426 final collection points
 *
 * Notes:
 * - Similar to Taipei, provides arrival and departure times
 * - Times appear to be estimates based on route schedules
 * - Same location may appear multiple times in source (different times/routes)
 * - We deduplicate by coordinates to show one marker per location
 */
export class KaohsiungAdapter extends CityDataAdapter<KaohsiungTrashCollectionPoint> {
  readonly cityId = 'kaohsiung';
  readonly displayName = '高雄市';
  readonly dataUrl = '/kaohsiung-trash-collection-points.json';
  readonly dataType = 'static' as const;

  // Kaohsiung city boundaries (extracted from Taiwan TopoJSON)
  // Source: Taiwan.TopoJSON - counties.json (高雄市)
  readonly bounds = {
    north: 23.421571,
    south: 22.490566,
    east: 120.731426,
    west: 120.136817,
  };

  async fetchRawData(): Promise<KaohsiungTrashCollectionPoint[]> {
    return this.fetchJson<KaohsiungTrashCollectionPoint[]>(this.dataUrl);
  }

  mapToUnified(point: KaohsiungTrashCollectionPoint): UnifiedTrashCollectionPoint {
    // Generate unique ID using coordinates and route
    const coordKey = `${parseFloat(point.longitude).toFixed(6)}_${parseFloat(point.latitude).toFixed(6)}`;
    const id = `kaohsiung-${coordKey}-${point.route}`;

    return {
      id,
      city: this.displayName,
      district: point.area,
      village: point.village,
      location: point.location,
      route: point.route,
      arrivalTime: point.arrivalTime,
      departureTime: point.departureTime,
      longitude: parseFloat(point.longitude),
      latitude: parseFloat(point.latitude),
      source: 'kaohsiung',
    };
  }

  /**
   * No post-processing needed for Kaohsiung
   * - Data is already deduplicated by coordinates during merge
   * - No day-specific filtering needed
   */
  postprocessData(unified: UnifiedTrashCollectionPoint[]): UnifiedTrashCollectionPoint[] {
    console.log(`KaohsiungAdapter: ${unified.length} collection points loaded`);
    return unified;
  }
}
