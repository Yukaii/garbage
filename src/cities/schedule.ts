import type { CollectionSchedule, CollectionType, UnifiedTrashCollectionPoint } from '../types';

/**
 * Citywide collection days for cities whose open data has no per-stop weekdays.
 * Taipei: no garbage, recycling or food-scrap collection on Wednesday and Sunday
 * (Department of Environmental Protection route page, garbage.gov.taipei/epb/iframe/trash.aspx).
 * Kaohsiung: also Wednesday and Sunday off; widely reported, though no current official notice was found.
 */
export const MON_TUE_THU_FRI_SAT = [1, 2, 4, 5, 6];

export const COLLECTION_TYPE_LABELS: Record<CollectionType, string> = {
  garbage: '一般垃圾',
  recycling: '資源回收',
  foodscraps: '廚餘',
};

/** ISO weekdays from a compact string written by scripts/data/publish.ts: "1245" → [1, 2, 4, 5]. */
export function parseCompactDays(compact: string): number[] {
  return [...compact].map(Number).filter(day => day >= 1 && day <= 7);
}

/**
 * Whether the stop is served on this ISO weekday. Stops without a schedule (Taichung's
 * map data, already filtered to today) count as served.
 */
export function servesOn(point: Pick<UnifiedTrashCollectionPoint, 'schedule'>, weekday: number): boolean {
  if (!point.schedule) return true;
  return Object.values(point.schedule).some(days => days?.includes(weekday));
}

/** Collection types served on this weekday, e.g. ['garbage', 'recycling']. */
export function typesOn(schedule: CollectionSchedule | undefined, weekday: number): CollectionType[] {
  if (!schedule) return [];
  return (Object.entries(schedule) as [CollectionType, number[]][])
    .filter(([, days]) => days.includes(weekday))
    .map(([type]) => type);
}

/** The next weekday after `weekday` the stop is served, or null if it has no service days. */
export function nextServiceDay(schedule: CollectionSchedule | undefined, weekday: number): number | null {
  if (!schedule) return null;
  const days = new Set(Object.values(schedule).flat());
  for (let offset = 1; offset <= 7; offset++) {
    const day = ((weekday - 1 + offset) % 7) + 1;
    if (days.has(day)) return day;
  }
  return null;
}
