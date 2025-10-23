import { CityDataAdapter } from './BaseAdapter';
import type { TaipeiTrashCollectionPoint, TaipeiApiResponse, UnifiedTrashCollectionPoint } from '../../types';

/**
 * Adapter for Taipei City (台北市) trash collection data
 *
 * Data Source: data.taipei Open Data API
 * - Static pre-fetched JSON file (updated monthly)
 * - Wraps results in result.results structure
 * - Uses Chinese field names (行政區, 地點, etc.)
 * - Time format: HHMM (e.g., "1830")
 */
export class TaipeiAdapter extends CityDataAdapter<TaipeiTrashCollectionPoint> {
  readonly cityId = 'taipei';
  readonly displayName = '台北市';
  readonly dataUrl = '/trash-collection-points.json';
  readonly dataType = 'static' as const;
  readonly bounds = {
    north: 25.209306675338553,
    south: 24.96052289128283,
    east: 121.66597827746033,
    west: 121.45733834043676,
  };

  async fetchRawData(): Promise<TaipeiTrashCollectionPoint[]> {
    const data = await this.fetchJson<TaipeiApiResponse>(this.dataUrl);
    return this.preprocessData(data);
  }

  preprocessData(raw: TaipeiApiResponse): TaipeiTrashCollectionPoint[] {
    // Unwrap the nested structure
    return raw.result.results;
  }

  mapToUnified(point: TaipeiTrashCollectionPoint): UnifiedTrashCollectionPoint {
    return {
      id: `taipei-${point._id}`,
      city: this.displayName,
      district: point.行政區,
      village: point.里別,
      location: point.地點,
      route: point.路線,
      arrivalTime: point.抵達時間,
      departureTime: point.離開時間,
      longitude: point.經度,
      latitude: point.緯度,
      source: 'taipei',
    };
  }
}
