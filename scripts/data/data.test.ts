import { describe, expect, test } from 'bun:test';
import { cleanAddress, expandTaichung, jsonLines, mergeKaohsiung, type RecordView } from './sources';
import { validateRecords } from './validate';

describe('expandTaichung', () => {
  const geocodes = { '台中市中區中山路321號': { longitude: 120.67, latitude: 24.14 } };
  const record = (over: Record<string, string> = {}) => ({
    area: '中區', village: '中華里', car_licence: 'KEQ-0315', caption: '中山路321號(中華路口)', task_type: '定點',
    g_d1_time_s: '07:12', g_d1_time_e: '07:20', g_d3_time_s: '', g_d3_time_e: '', r_d2_time_s: '07:12', r_d2_time_e: '07:20',
    ...over,
  });

  test('one row per served weekday and type; blank times are not served', () => {
    const { rows, missing } = expandTaichung([record()], geocodes);
    expect(missing).toEqual([]);
    expect(rows.map(r => [r.dayOfWeek, r.collectionType, r.arrivalTime])).toEqual([
      [1, 'garbage', '0712'],
      [2, 'recycling', '0712'],
    ]);
    expect(rows[0]!.location).toBe('中山路321號');
  });

  test('keeps the earliest visit per place/day/type', () => {
    const { rows } = expandTaichung([record(), record({ g_d1_time_s: '06:00', g_d1_time_e: '06:05' })], geocodes);
    expect(rows.filter(r => r.dayOfWeek === 1)[0]!.arrivalTime).toBe('0600');
  });

  test('reports addresses missing from the geocode cache', () => {
    expect(expandTaichung([record({ caption: '不存在路1號' })], geocodes).missing).toEqual(['台中市中區不存在路1號']);
  });
});

describe('mergeKaohsiung', () => {
  const geocodes = { '高雄市大樹區九曲路616號前': { longitude: 120.42, latitude: 22.65 } };
  const record = (over = {}) => ({
    area: '大樹區', village: '九曲里', car_licence: 'KEM-1760', caption: '九曲路616號前', today_s: '16:25', today_e: '16:31', task: '垃圾',
    ...over,
  });

  test('labels recycling runs and keeps one stop per coordinate', () => {
    const { rows } = mergeKaohsiung([record({ task: '資收' }), record()], geocodes);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ collectionType: 'recycling', arrivalTime: '1625', departureTime: '1631' });
  });

  test('skips places without a house number', () => {
    expect(mergeKaohsiung([record({ caption: '九曲路口' })], geocodes).noHouseNumber).toBe(1);
  });
});

test('cleanAddress drops parenthesised notes', () => expect(cleanAddress(' 九大路686巷16號(凱群大樓) ')).toBe('九大路686巷16號'));

test('jsonLines writes one record per line', () => {
  expect(jsonLines([{ a: 1 }, { b: 2 }])).toBe('[\n{"a":1},\n{"b":2}\n]\n');
  expect(JSON.parse(jsonLines([{ a: 1 }, { b: 2 }]))).toEqual([{ a: 1 }, { b: 2 }]);
});

describe('validateRecords', () => {
  const good = (n: number): RecordView[] => Array.from({ length: n }, () => ({ name: '站', time: '1830', lat: 25.03, lng: 121.5 }));

  test('accepts a healthy refresh', () => expect(validateRecords({ records: good(100), minRecords: 50, previousCount: 110 })).toEqual([]));

  test('rejects a big drop against what is published', () => {
    expect(validateRecords({ records: good(70), minRecords: 50, previousCount: 100 })[0]).toContain('30% fewer');
  });

  test('rejects an empty or tiny response', () => {
    expect(validateRecords({ records: [], minRecords: 50 })).toHaveLength(1);
  });

  test('rejects broken coordinates and times', () => {
    const records = good(100).map((r, i) => (i < 10 ? { ...r, lat: 0, time: 'xx' } : r));
    expect(validateRecords({ records, minRecords: 50 })).toHaveLength(2);
  });
});
