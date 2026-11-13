import { describe, expect, test } from 'bun:test';
import { NewTaipeiAdapter } from '../../src/cities/adapters/NewTaipeiAdapter';
import { TaichungAdapter } from '../../src/cities/adapters/TaichungAdapter';
import { ChanghuaAdapter } from '../../src/cities/adapters/ChanghuaAdapter';
import { YunlinAdapter } from '../../src/cities/adapters/YunlinAdapter';
import { cityRegistry } from '../../src/cities/cityRegistry';
import { taipeiIsoWeekday } from '../../src/utils/taipeiTime';
import { cityOfPointId } from './data';
import type { HwmsTrashCollectionPoint, NewTaipeiTrashCollectionPoint, TaichungTrashCollectionPoint } from '../../src/types';

const ntpc = (over: Record<string, string>) =>
  ({
    city: '板橋區', lineid: '1', linename: 'A路線', rank: '1', name: '文化路', village: '莒光里',
    longitude: '121.47', latitude: '25.02', time: '13:42', memo: '', ...over,
  }) as unknown as NewTaipeiTrashCollectionPoint;

const tc = (over: Partial<TaichungTrashCollectionPoint>): TaichungTrashCollectionPoint => ({
  area: '西屯區', village: '何成里', route: 'KED-9072', location: '文心路二段', type: '定點',
  arrivalTime: '0700', departureTime: '0705', longitude: '120.64', latitude: '24.15',
  collectionType: 'garbage', dayOfWeek: 1, ...over,
});

describe('NewTaipeiAdapter schedule', () => {
  const adapter = new NewTaipeiAdapter();

  test('reads the compact day fields', () => {
    const p = adapter.mapToUnified(ntpc({ garbageDays: '12456', recyclingDays: '14', foodscrapsDays: '' }));
    expect(p.schedule).toEqual({ garbage: [1, 2, 4, 5, 6], recycling: [1, 4], foodscraps: [] });
  });

  test('falls back to the raw per-day flags (data published before the trim change)', () => {
    const p = adapter.mapToUnified(ntpc({ garbagemonday: 'Y', garbagetuesday: '', garbagesunday: 'Y' }));
    expect(p.schedule?.garbage).toEqual([1, 7]);
  });

  test('no schedule when the data carries none', () => {
    expect(adapter.mapToUnified(ntpc({})).schedule).toBeUndefined();
  });
});

describe('TaichungAdapter all-days mode', () => {
  const adapter = new TaichungAdapter();
  const rows = [
    tc({ dayOfWeek: 1 }),
    tc({ dayOfWeek: 3 }),
    tc({ dayOfWeek: 2, collectionType: 'recycling' }),
    tc({ arrivalTime: '1900', departureTime: '1905', dayOfWeek: 1 }),
  ];
  const mapped = rows.map(r => adapter.mapToUnified(r));

  test('merges rows of the same visit and unions weekdays per type', () => {
    const merged = adapter.postprocessData(mapped, { allDays: true });
    expect(merged).toHaveLength(2);
    const morning = merged.find(p => p.arrivalTime === '0700')!;
    expect(morning.schedule).toEqual({ garbage: [1, 3], recycling: [2] });
  });

  test('does not mutate the input rows', () => {
    adapter.postprocessData(mapped, { allDays: true });
    expect(mapped[0]!.schedule).toEqual({ garbage: [1] });
  });

  test('default mode still filters to today and drops the one-day schedule', () => {
    const today = taipeiIsoWeekday();
    const out = adapter.postprocessData([adapter.mapToUnified(tc({ dayOfWeek: today })), adapter.mapToUnified(tc({ dayOfWeek: (today % 7) + 1, longitude: '120.7' }))]);
    expect(out).toHaveLength(1);
    expect(out[0]!.schedule).toBeUndefined();
  });
});

describe('ChanghuaAdapter and YunlinAdapter', () => {
  const changhua = new ChanghuaAdapter();
  const yunlin = new YunlinAdapter();

  const hwmsPoint = (over: Partial<HwmsTrashCollectionPoint> = {}): HwmsTrashCollectionPoint => ({
    district: '彰化市',
    routeSeq: 'N50010001',
    route: '彰化市 第1線',
    seq: 3,
    location: '聖安路743-1號',
    arrivalTime: '1800',
    departureTime: '1810',
    longitude: '120.54',
    latitude: '24.08',
    garbageDays: '12456',
    recyclingDays: '246',
    ...over,
  });

  test('registers both counties in cityRegistry and resolves point IDs', () => {
    expect(cityRegistry.getCityIds()).toContain('changhua');
    expect(cityRegistry.getCityIds()).toContain('yunlin');

    const chPoint = changhua.mapToUnified(hwmsPoint());
    expect(chPoint.source).toBe('changhua');
    expect(chPoint.city).toBe('彰化縣');
    expect(chPoint.sequence).toBe(3);
    expect(chPoint.schedule).toEqual({ garbage: [1, 2, 4, 5, 6], recycling: [2, 4, 6] });
    expect(cityOfPointId(chPoint.id)).toBe('changhua');

    const ylPoint = yunlin.mapToUnified(
      hwmsPoint({ district: '斗六市', routeSeq: 'P001', route: '斗六市 第1線', garbageDays: '14', recyclingDays: '' }),
    );
    expect(ylPoint.source).toBe('yunlin');
    expect(ylPoint.city).toBe('雲林縣');
    expect(ylPoint.schedule).toEqual({ garbage: [1, 4] });
    expect(cityOfPointId(ylPoint.id)).toBe('yunlin');
  });
});
