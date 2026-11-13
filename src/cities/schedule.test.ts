import { describe, expect, test } from 'bun:test';
import { nextServiceDay, servesOn, typesOn } from './schedule';
import { compareRouteOrder, fetchMultipleCities, getCitiesInViewport, getPointStatus } from '../api';
import { cityRegistry } from './cityRegistry';
import { getCityFromPointId } from '../utils/share';
import { taipeiClock, weekdayLabel } from '../utils/taipeiTime';
import type { UnifiedTrashCollectionPoint } from '../types';

describe('taipeiClock', () => {
  test('uses Taiwan time whatever the device timezone', () => {
    // 2026-11-11 (Wed) 17:30 UTC is Thursday 01:30 in Taiwan
    expect(taipeiClock(new Date('2026-11-11T17:30:00Z'))).toEqual({ minutes: 90, weekday: 4 });
  });

  test('midnight is minute 0, not 24:00', () => {
    expect(taipeiClock(new Date('2026-11-15T16:00:00Z'))).toEqual({ minutes: 0, weekday: 1 });
  });

  test('labels', () => expect([1, 3, 7].map(weekdayLabel)).toEqual(['週一', '週三', '週日']));
});

const point = (over: Partial<UnifiedTrashCollectionPoint> = {}): UnifiedTrashCollectionPoint => ({
  id: 'p', city: '新北市', district: '板橋區', village: '', location: '文化路', route: 'A',
  arrivalTime: '1830', departureTime: '1840', longitude: '121.4', latitude: '25.0', source: 'new-taipei',
  ...over,
});

describe('schedule helpers', () => {
  const monThu = { garbage: [1, 4], recycling: [4] };

  test('servesOn: any type counts; no schedule means served', () => {
    expect(servesOn({ schedule: monThu }, 4)).toBe(true);
    expect(servesOn({ schedule: monThu }, 3)).toBe(false);
    expect(servesOn({}, 3)).toBe(true);
  });

  test('typesOn lists what is collected that day', () => {
    expect(typesOn(monThu, 4)).toEqual(['garbage', 'recycling']);
    expect(typesOn(monThu, 1)).toEqual(['garbage']);
  });

  test('nextServiceDay wraps around the week', () => {
    expect(nextServiceDay(monThu, 2)).toBe(4);
    expect(nextServiceDay(monThu, 5)).toBe(1);
    expect(nextServiceDay(monThu, 4)).toBe(1);
    expect(nextServiceDay({}, 1)).toBeNull();
  });
});

describe('getPointStatus', () => {
  const p = point({ schedule: { garbage: [1, 4] } });

  test('a stop not served today is off, not active', () => {
    expect(getPointStatus(p, { minutes: 18 * 60 + 35, weekday: 3 })).toBe('off');
    expect(getPointStatus(p, { minutes: 18 * 60 + 35, weekday: 4 })).toBe('active');
    expect(getPointStatus(p, { minutes: 17 * 60, weekday: 4 })).toBe('upcoming');
  });

  test('Taipei applies the citywide Wednesday/Sunday break', async () => {
    const taipei = cityRegistry.getAdapter('taipei').mapToUnified({
      路線: 'R', 車次: '1', 地點: 'X', 抵達時間: '1830', 離開時間: '1840',
    } as never);
    const at = (weekday: number) => getPointStatus(taipei, { minutes: 18 * 60 + 35, weekday });
    expect([1, 2, 3, 4, 5, 6, 7].map(at)).toEqual(['active', 'active', 'off', 'active', 'active', 'active', 'off']);
  });
});

test('compareRouteOrder prefers the published sequence', () => {
  const a = point({ sequence: 2, arrivalTime: '0700' });
  const b = point({ sequence: 1, arrivalTime: '0900' });
  expect([a, b].sort(compareRouteOrder)).toEqual([b, a]);
});

test('fetchMultipleCities keeps the cities that loaded', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) =>
    String(url).includes('kaohsiung')
      ? new Response('[]')
      : new Response('oops', { status: 500 })) as typeof fetch;
  try {
    const result = await fetchMultipleCities(['taichung', 'kaohsiung']);
    expect(result.loaded).toEqual(['kaohsiung']);
    expect(result.failed).toEqual(['taichung']);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('viewport and share helpers include changhua and yunlin', () => {
  expect(getCitiesInViewport({ north: 24.12, south: 24.02, east: 120.6, west: 120.48 }, 12)).toContain('changhua');
  expect(getCitiesInViewport({ north: 23.75, south: 23.65, east: 120.58, west: 120.45 }, 12)).toContain('yunlin');
  expect(getCitiesInViewport({ north: 24.12, south: 24.02, east: 120.6, west: 120.48 }, 8)).toEqual([]);
  expect(getCityFromPointId('changhua-abc123')).toBe('changhua');
  expect(getCityFromPointId('yunlin-xyz789')).toBe('yunlin');
});
