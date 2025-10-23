import type { UnifiedTrashCollectionPoint } from '../../types';

/**
 * City boundary definition for viewport-based loading
 */
export interface CityBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Abstract base class for city data adapters
 *
 * Each city implements this adapter to handle its specific data format
 * and transforms it into the unified format used by the app.
 *
 * @template TSource - The raw data type from the city's API
 */
export abstract class CityDataAdapter<TSource = any> {
  /** Unique identifier for this city */
  abstract readonly cityId: string;

  /** Display name in Traditional Chinese */
  abstract readonly displayName: string;

  /** URL to fetch data from (can be static file or API endpoint) */
  abstract readonly dataUrl: string;

  /** Geographic boundaries for viewport-based loading */
  abstract readonly bounds: CityBounds;

  /** Data type: 'static' for pre-fetched JSON, 'realtime' for live API */
  abstract readonly dataType: 'static' | 'realtime';

  /**
   * Fetch raw data from the source
   * Override this to handle different API structures
   */
  abstract fetchRawData(): Promise<TSource[]>;

  /**
   * Map a single source record to unified format
   * This is where city-specific field mapping happens
   */
  abstract mapToUnified(source: TSource): UnifiedTrashCollectionPoint;

  /**
   * Optional: Preprocess raw API response before mapping
   * Use this for unwrapping API responses, filtering invalid data, etc.
   */
  preprocessData(raw: any): TSource[] {
    return raw as TSource[];
  }

  /**
   * Optional: Post-process unified data after mapping
   * Use this for sorting, filtering, or enriching data
   */
  postprocessData(unified: UnifiedTrashCollectionPoint[]): UnifiedTrashCollectionPoint[] {
    return unified;
  }

  /**
   * Main public method: Fetch and transform data to unified format
   */
  async fetchData(): Promise<UnifiedTrashCollectionPoint[]> {
    try {
      const rawData = await this.fetchRawData();
      const mapped = rawData.map(item => this.mapToUnified(item));
      return this.postprocessData(mapped);
    } catch (error) {
      console.error(`Error fetching data for ${this.displayName}:`, error);
      throw error;
    }
  }

  /**
   * Helper: Standard fetch implementation for JSON endpoints
   */
  protected async fetchJson<T = any>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
}
