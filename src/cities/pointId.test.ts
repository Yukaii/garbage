import { describe, expect, test } from 'bun:test';
import { ensureUniqueIds, legacyIdCity, stablePointId } from './pointId';
import { TaipeiAdapter } from './adapters/TaipeiAdapter';
import { NewTaipeiAdapter } from './adapters/NewTaipeiAdapter';
import type { NewTaipeiTrashCollectionPoint, TaipeiTrashCollectionPoint } from '../types';

describe('stablePointId', () => {
  // These IDs are stored in users' browsers and in shared links. If this test fails,
  // the hash changed: every saved star and link would break. Don't update the snapshot.
  test('is frozen', () => {
    expect(stablePointId('taipei', '天母-1', '第1車', '臺北市士林區天母西路48號')).toBe('taipei-s1avvxuv7fzp');
  });

  test('ignores surrounding whitespace, not content', () => {
    expect(stablePointId('x', ' a ', 'b')).toBe(stablePointId('x', 'a', 'b'));
    expect(stablePointId('x', 'a', 'b')).not.toBe(stablePointId('x', 'ab', ''));
  });
});

describe('ensureUniqueIds', () => {
  test('breaks ties with the arrival time, then a counter', () => {
    const points = [
      { id: 'a', arrivalTime: '0700' },
      { id: 'a', arrivalTime: '0900' },
      { id: 'a', arrivalTime: '0900' },
      { id: 'b', arrivalTime: '0700' },
    ];
    expect(ensureUniqueIds(points).map(p => p.id)).toEqual(['a', 'a-0900', 'a-0900-2', 'b']);
  });
});

describe('IDs survive upstream renumbering', () => {
  const taipeiRow = (over: Partial<TaipeiTrashCollectionPoint>) =>
    ({ _id: 1, 路線: '天母-1', 車次: '第1車', 地點: '天母西路48號', 抵達時間: '1830', 離開時間: '1835', ...over }) as TaipeiTrashCollectionPoint;

  test('Taipei ignores the row number', () => {
    const adapter = new TaipeiAdapter();
    expect(adapter.mapToUnified(taipeiRow({ _id: 1 })).id).toBe(adapter.mapToUnified(taipeiRow({ _id: 999 })).id);
  });

  test('New Taipei ignores the rank but keeps it as the stop order', () => {
    const adapter = new NewTaipeiAdapter();
    const row = (rank: string) =>
      ({ lineid: '207001', linename: 'A路線', rank, name: '獅頭路15-1號', time: '13:00' }) as NewTaipeiTrashCollectionPoint;
    expect(adapter.mapToUnified(row('1')).id).toBe(adapter.mapToUnified(row('2')).id);
    expect(adapter.mapToUnified(row('7')).sequence).toBe(7);
  });
});

describe('legacyIdCity', () => {
  test.each([
    ['taipei-1234', 'taipei'],
    ['new-taipei-207001-12', 'new-taipei'],
    ['taichung-KEQ-0315-321-d1-garbage', 'taichung'],
    ['taichung-KEQ-0315--d7-recycling', 'taichung'],
    ['kaohsiung-120.423699_22.659096-KEM-1760', 'kaohsiung'],
  ])('%s is legacy (%s)', (id, city) => expect(legacyIdCity(id)).toBe(city as never));

  test.each([
    'taipei-s1avvxuv7fzp',
    'new-taipei-s1n8gmh7cejk',
    'new-taipei-s1n8gmh7cejk-1830', // tie-broken stable ID
    'taichung-sl53mlmwom2',
    'kaohsiung-s2b3c4d5e6f',
  ])('%s is current', id => expect(legacyIdCity(id)).toBeNull());
});
