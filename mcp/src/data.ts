import { cityRegistry, type City } from '../../src/cities/cityRegistry';
import { setDataBaseUrl } from '../../src/cities/adapters/BaseAdapter';
import type { UnifiedTrashCollectionPoint } from '../../src/types';

const DATA_BASE_URL = process.env.DATA_BASE_URL ?? 'https://garbage.yukai.dev';
const CACHE_TTL_MS = 60 * 60 * 1000;

setDataBaseUrl(DATA_BASE_URL);

interface CacheEntry {
  expires: number;
  points: Promise<UnifiedTrashCollectionPoint[]>;
}

const cache = new Map<City, CacheEntry>();

/**
 * Load one city's points via its adapter (the same mapping the web app uses).
 * Cities load lazily and are cached per warm instance; Taichung's file is ~50 MB,
 * so nothing is fetched until a tool actually needs that city.
 */
export function loadCity(city: City): Promise<UnifiedTrashCollectionPoint[]> {
  const hit = cache.get(city);
  if (hit && hit.expires > Date.now()) return hit.points;

  const points = cityRegistry.getAdapter(city).fetchData();
  cache.set(city, { expires: Date.now() + CACHE_TTL_MS, points });
  // Don't keep a failed load around: let the next call retry.
  points.catch(() => {
    if (cache.get(city)?.points === points) cache.delete(city);
  });
  return points;
}

/** Resolve the city a point id belongs to from its prefix (ids look like `<city>-...`). */
export function cityOfPointId(id: string): City | undefined {
  return cityRegistry
    .getCityIds()
    .filter(c => id.startsWith(`${c}-`))
    .sort((a, b) => b.length - a.length)[0];
}

export function resetCacheForTests(): void {
  cache.clear();
}
