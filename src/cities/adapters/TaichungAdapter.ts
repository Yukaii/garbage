import { CityDataAdapter, type FetchOptions } from './BaseAdapter';
import { stablePointId } from '../pointId';
import { taipeiIsoWeekday } from '../../utils/taipeiTime';
import { parseCompactDays } from '../schedule';
import type { CollectionSchedule, TaichungTrashCollectionPoint, UnifiedTrashCollectionPoint } from '../../types';

/**
 * Adapter for Taichung City (台中市) trash collection data
 *
 * Data: the city's collection schedule (newdatacenter.taichung.gov.tw, data.gov.tw/dataset/84004)
 * joined to cached TGOS geocodes by scripts/data/update.ts, refreshed weekly.
 *
 * Accepts two row shapes (see TaichungTrashCollectionPoint):
 * - published file: one row per truck visit with compact `garbageDays` / `recyclingDays`
 * - data-branch file: one row per (stop, weekday, collection type)
 *
 * The map wants today's stops only (one per coordinate, earliest visit); `allDays` returns
 * every visit with its weekly schedule (MCP server, static pages).
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
    return {
      // One ID per address, shared by all its weekday/type rows so a starred stop stays starred every
      // day. Not keyed on `route`: it is the truck's license plate, which changes with fleet swaps.
      id: stablePointId('taichung', point.area, point.location),
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
      schedule: taichungSchedule(point),
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

    const today = taipeiIsoWeekday();

    // Step 1: Filter to only show today's collection points
    const todaysPoints = unified.filter(point =>
      Object.values(point.schedule ?? {}).some(days => days?.includes(today))
    );

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
        // Keep the earliest visit; on equal arrival, the earlier departure (independent of row order)
        const earlier = point.arrivalTime < existing.arrivalTime ||
          (point.arrivalTime === existing.arrivalTime && point.departureTime < existing.departureTime);
        if (earlier) locationMap.set(coordKey, point);
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

/** Published rows carry compact weekday strings; data-branch rows one weekday and type each. */
function taichungSchedule(point: TaichungTrashCollectionPoint): CollectionSchedule {
  if (point.dayOfWeek !== undefined && point.collectionType) return { [point.collectionType]: [point.dayOfWeek] };
  const schedule: CollectionSchedule = {};
  if (point.garbageDays) schedule.garbage = parseCompactDays(point.garbageDays);
  if (point.recyclingDays) schedule.recycling = parseCompactDays(point.recyclingDays);
  return schedule;
}
