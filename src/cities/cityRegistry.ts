import { CityDataAdapter } from './adapters/BaseAdapter';
import { TaipeiAdapter } from './adapters/TaipeiAdapter';
import { NewTaipeiAdapter } from './adapters/NewTaipeiAdapter';
import { TaichungAdapter } from './adapters/TaichungAdapter';
import { KaohsiungAdapter } from './adapters/KaohsiungAdapter';

/**
 * City identifier type
 * Add new city IDs here when expanding support
 */
export type City = 'taipei' | 'new-taipei' | 'taichung' | 'kaohsiung';

/**
 * Central registry of all supported cities
 *
 * This is the SINGLE SOURCE OF TRUTH for city configuration.
 * To add a new city:
 * 1. Create a new adapter class extending CityDataAdapter
 * 2. Add city ID to City type above
 * 3. Register the adapter instance here
 *
 * Everything else (UI selectors, viewport loading, etc.) is automatically derived from this registry.
 */
class CityRegistry {
  private adapters: Map<City, CityDataAdapter> = new Map();

  constructor() {
    // Register all city adapters
    this.register(new TaipeiAdapter());
    this.register(new NewTaipeiAdapter());
    this.register(new TaichungAdapter());
    this.register(new KaohsiungAdapter());
  }

  /**
   * Register a city adapter
   */
  private register(adapter: CityDataAdapter): void {
    this.adapters.set(adapter.cityId as City, adapter);
  }

  /**
   * Get adapter for a specific city
   */
  getAdapter(cityId: City): CityDataAdapter {
    const adapter = this.adapters.get(cityId);
    if (!adapter) {
      throw new Error(`No adapter found for city: ${cityId}`);
    }
    return adapter;
  }

  /**
   * Get all registered city IDs
   */
  getCityIds(): City[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): CityDataAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get city display names for UI (e.g., dropdown options)
   */
  getCityOptions(): Array<{ value: City; label: string }> {
    return this.getAllAdapters().map(adapter => ({
      value: adapter.cityId as City,
      label: adapter.displayName,
    }));
  }

  /**
   * Get city boundaries for viewport-based loading
   */
  getCityBounds(cityId: City) {
    return this.getAdapter(cityId).bounds;
  }

  /**
   * Check if a city is supported
   */
  hasCity(cityId: string): cityId is City {
    return this.adapters.has(cityId as City);
  }
}

/**
 * Global singleton instance
 * Import this to access city configuration anywhere in the app
 */
export const cityRegistry = new CityRegistry();

/**
 * Convenience export: Get all city IDs
 */
export const ALL_CITIES = cityRegistry.getCityIds();
