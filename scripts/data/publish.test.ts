import { describe, expect, test } from 'bun:test';
import { compactNewTaipei, compactTaichung, compactTaipei } from './publish';
import { simplifyLine } from './export-routes';
import { TaichungAdapter } from '../../src/cities/adapters/TaichungAdapter';

const tc = (over: Record<string, unknown>) => ({
  area: '中區', village: '中華里', route: 'KEQ-0315', location: '中山路321號', type: '定點',
  arrivalTime: '0712', departureTime: '0720', longitude: '120.67', latitude: '24.14',
  collectionType: 'garbage', dayOfWeek: 1, ...over,
});

describe('compactTaichung', () => {
  const rows = [
    tc({ dayOfWeek: 1 }),
    tc({ dayOfWeek: 4 }),
    tc({ dayOfWeek: 2, collectionType: 'recycling' }),
    tc({ dayOfWeek: 6, arrivalTime: '1900', departureTime: '1905' }),
  ];

  test('one row per visit with compact weekdays per type', () => {
    expect(compactTaichung(rows)).toEqual([
      { area: '中區', village: '中華里', route: 'KEQ-0315', location: '中山路321號', arrivalTime: '0712', departureTime: '0720', longitude: '120.67', latitude: '24.14', garbageDays: '14', recyclingDays: '2' },
      { area: '中區', village: '中華里', route: 'KEQ-0315', location: '中山路321號', arrivalTime: '1900', departureTime: '1905', longitude: '120.67', latitude: '24.14', garbageDays: '6' },
    ]);
  });

  test('is idempotent', () => {
    const once = compactTaichung(rows);
    expect(compactTaichung(once)).toBe(once);
  });

  test('the adapter reads both shapes the same way', () => {
    const adapter = new TaichungAdapter();
    const strip = (points: ReturnType<typeof adapter.mapToUnified>[]) => points.map(({ id, arrivalTime, schedule }) => ({ id, arrivalTime, schedule }));
    const fromRaw = adapter.postprocessData(rows.map(r => adapter.mapToUnified(r as never)), { allDays: true });
    const fromCompact = adapter.postprocessData(compactTaichung(rows).map(r => adapter.mapToUnified(r as never)), { allDays: true });
    expect(strip(fromCompact)).toEqual(strip(fromRaw));
  });
});

test('compactNewTaipei collapses Y flags into ISO weekdays', () => {
  const [row] = compactNewTaipei([{ city: '板橋區', name: '文化路', garbagemonday: 'Y', garbagethursday: 'Y', recyclingsunday: 'Y', memo: 'x' }]);
  expect(row).toMatchObject({ city: '板橋區', garbageDays: '14', recyclingDays: '7', foodscrapsDays: '' });
  expect(row).not.toHaveProperty('memo');
  expect(row).not.toHaveProperty('garbagemonday');
});

test('compactTaipei keeps the squad name the adapter reads', () => {
  const out = compactTaipei({ result: { count: 1, results: [{ _id: 1, 分隊: '台大分隊', 車號: 'X', _importdate: {} }] } });
  expect(out.result.results[0]).toMatchObject({ 分隊: '台大分隊' });
  expect(out.result.results[0]).not.toHaveProperty('車號');
});

test('simplifyLine rounds to ~1 m and drops repeated points', () => {
  expect(simplifyLine([[120.673675, 24.343814], [120.6736751, 24.3438142], [120.673195, 24.344656]])).toEqual([
    [120.67368, 24.34381],
    [120.6732, 24.34466],
  ]);
});
