import { CityDataAdapter } from './BaseAdapter';
import { stablePointId } from '../pointId';
import { parseCompactDays } from '../schedule';
import type { CollectionSchedule, HwmsTrashCollectionPoint, UnifiedTrashCollectionPoint } from '../../types';

function buildHwmsSchedule(point: HwmsTrashCollectionPoint): CollectionSchedule | undefined {
  const garbage = point.garbageDays ? parseCompactDays(point.garbageDays) : undefined;
  const recycling = point.recyclingDays ? parseCompactDays(point.recyclingDays) : undefined;
  const foodscraps = point.foodscrapsDays ? parseCompactDays(point.foodscrapsDays) : undefined;

  const schedule: CollectionSchedule = {
    ...(garbage?.length ? { garbage } : {}),
    ...(recycling?.length ? { recycling } : {}),
    ...(foodscraps?.length ? { foodscraps } : {}),
  };
  return Object.keys(schedule).length > 0 ? schedule : undefined;
}

/**
 * Shared adapter base for counties sourced from the Ministry of Environment
 * route portal (hwms.moenv.gov.tw) + TGOS geocoding.
 */
export abstract class HwmsCityAdapter extends CityDataAdapter<HwmsTrashCollectionPoint> {
  readonly dataType = 'static' as const;
  abstract override readonly cityId: 'changhua' | 'yunlin';

  async fetchRawData(): Promise<HwmsTrashCollectionPoint[]> {
    return this.fetchJson<HwmsTrashCollectionPoint[]>(this.dataUrl);
  }

  mapToUnified(point: HwmsTrashCollectionPoint): UnifiedTrashCollectionPoint {
    return {
      // `seq` shifts when stops are added or removed, so identity uses routeSeq + location
      id: stablePointId(this.cityId, point.routeSeq || point.district, point.location),
      sequence: point.seq || undefined,
      city: this.displayName,
      district: point.district,
      village: '',
      location: point.location,
      route: point.route,
      carSeq: point.route,
      arrivalTime: point.arrivalTime,
      departureTime: point.departureTime,
      longitude: point.longitude,
      latitude: point.latitude,
      source: this.cityId,
      schedule: buildHwmsSchedule(point),
    };
  }
}
