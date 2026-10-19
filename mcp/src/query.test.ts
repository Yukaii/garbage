import { describe, expect, test } from 'bun:test';
import type { UnifiedTrashCollectionPoint } from '../../src/types';
import { circleIntersectsBounds, findNearby, formatTime, haversineMeters, routeStops, searchPoints, taipeiIsoWeekday, toDto } from './query';

const pt = (over: Partial<UnifiedTrashCollectionPoint>): UnifiedTrashCollectionPoint => ({
  id: 'taipei-1',
  city: '台北市',
  district: '大安區',
  village: '安和里',
  location: '安和路一段',
  route: 'A1',
  arrivalTime: '1830',
  departureTime: '1835',
  longitude: '121.55',
  latitude: '25.03',
  source: 'taipei',
  ...over,
});

describe('haversineMeters', () => {
  test('is zero for identical points', () => expect(haversineMeters(25, 121, 25, 121)).toBe(0));
  test('one degree of latitude is about 111 km', () => {
    expect(haversineMeters(25, 121, 26, 121)).toBeGreaterThan(110_500);
    expect(haversineMeters(25, 121, 26, 121)).toBeLessThan(111_800);
  });
});

describe('circleIntersectsBounds', () => {
  const taipei = { north: 25.21, south: 24.96, east: 121.67, west: 121.46 };
  test('inside', () => expect(circleIntersectsBounds(25.03, 121.55, 500, taipei)).toBe(true));
  test('near an edge, circle crosses it', () => expect(circleIntersectsBounds(25.03, 121.455, 2000, taipei)).toBe(true));
  test('far away', () => expect(circleIntersectsBounds(22.6, 120.3, 2000, taipei)).toBe(false));
});

describe('formatTime', () => {
  test('HHMM', () => expect(formatTime('0930')).toBe('09:30'));
  test('short HMM', () => expect(formatTime('930')).toBe('09:30'));
  test('already formatted', () => expect(formatTime('09:30')).toBe('09:30'));
  test('garbage passes through', () => expect(formatTime('n/a')).toBe('n/a'));
});

describe('findNearby', () => {
  const points = [
    pt({ id: 'far', latitude: '25.10', longitude: '121.55' }),
    pt({ id: 'near', latitude: '25.0305', longitude: '121.55' }),
    pt({ id: 'nearer', latitude: '25.0301', longitude: '121.55' }),
    pt({ id: 'bad', latitude: 'x', longitude: '' }),
  ];
  test('filters by radius, sorts by distance, skips invalid coordinates', () => {
    const res = findNearby(points, 25.03, 121.55, 1000, 10);
    expect(res.map(r => r.id)).toEqual(['nearer', 'near']);
    expect(res[0]?.distanceMeters).toBeLessThan(res[1]!.distanceMeters!);
  });
  test('respects limit', () => expect(findNearby(points, 25.03, 121.55, 100_000, 1)).toHaveLength(1));
});

describe('searchPoints', () => {
  const points = [pt({ id: 'a' }), pt({ id: 'b', district: '信義區', village: '松隆里', location: '松隆路' })];
  test('matches all terms across fields', () => expect(searchPoints(points, '信義 松隆', 10).map(p => p.id)).toEqual(['b']));
  test('empty query returns nothing', () => expect(searchPoints(points, '  ', 10)).toEqual([]));
});

describe('routeStops', () => {
  test('same route and district, ordered by arrival', () => {
    const a = pt({ id: 'a', arrivalTime: '1900' });
    const b = pt({ id: 'b', arrivalTime: '1815' });
    const other = pt({ id: 'c', route: 'B2' });
    expect(routeStops([a, b, other], a).map(s => s.id)).toEqual(['b', 'a']);
  });
});

describe('taipeiIsoWeekday', () => {
  test('uses Taiwan time, not UTC', () => {
    // 2026-10-19 is a Monday. 20:00 UTC Monday is already 04:00 Tuesday in Taipei.
    expect(taipeiIsoWeekday(new Date('2026-10-19T02:00:00Z'))).toBe(1);
    expect(taipeiIsoWeekday(new Date('2026-10-19T20:00:00Z'))).toBe(2);
  });
  test('Sunday is 7', () => expect(taipeiIsoWeekday(new Date('2026-10-18T04:00:00Z'))).toBe(7));
});

describe('toDto schedule', () => {
  const monday = new Date('2026-10-19T02:00:00Z');
  test('no schedule -> no schedule or servesToday', () => {
    const dto = toDto(pt({}), undefined, monday);
    expect(dto.schedule).toBeUndefined();
    expect(dto.servesToday).toBeUndefined();
  });
  test('servesToday is true when any type runs today', () => {
    const dto = toDto(pt({ schedule: { garbage: [2, 4], recycling: [1] } }), undefined, monday);
    expect(dto.servesToday).toBe(true);
    expect(dto.schedule).toEqual({ garbage: [2, 4], recycling: [1] });
  });
  test('servesToday is false when no type runs today', () => {
    expect(toDto(pt({ schedule: { garbage: [2, 4] } }), undefined, monday).servesToday).toBe(false);
  });
});
