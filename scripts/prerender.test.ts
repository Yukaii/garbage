import { expect, test } from 'bun:test';
import { aggregateStops, escapeHtml, formatSchedule } from './prerender';
import type { UnifiedTrashCollectionPoint } from '../src/types';

const stop: UnifiedTrashCollectionPoint = {
  id: 'taichung-same-id', city: '台中市', district: '大安區', village: '中庄里',
  location: '中山南路一號', route: 'KEQ-0001', arrivalTime: '1800', departureTime: '1805',
  longitude: '120.6', latitude: '24.3', source: 'taichung', schedule: { garbage: [1] },
};

test('combines weekdays and collection types without changing source schedules', () => {
  const result = aggregateStops([
    stop, { ...stop, schedule: { garbage: [5, 1] } },
    { ...stop, schedule: { recycling: [2] } },
  ]);
  expect(result).toHaveLength(1);
  expect(result[0].schedule).toEqual({ garbage: [1, 5], recycling: [2] });
  expect(stop.schedule).toEqual({ garbage: [1] });
});

test('retains separate locations, districts, visits and truck identities even with colliding IDs', () => {
  expect(aggregateStops([
    stop, { ...stop, location: '中山南路二號' }, { ...stop, district: '大甲區' },
    { ...stop, arrivalTime: '1900' }, { ...stop, departureTime: '1810' },
    { ...stop, carSeq: '第2車' }, { ...stop, longitude: '120.7' },
  ])).toHaveLength(7);
});

test('escapes source strings in table cells and attributes', () => {
  expect(escapeHtml('<站點 & "路線" \'車次\'>')).toBe('&lt;站點 &amp; &quot;路線&quot; &#39;車次&#39;&gt;');
});

test('types sharing the same days are listed together', () => {
  expect(formatSchedule({ ...stop, schedule: { garbage: [1, 2, 4, 5, 6], recycling: [1, 2, 4, 5, 6], foodscraps: [3] } }))
    .toBe('垃圾、資源回收：週一、週二、週四、週五、週六；廚餘：週三');
});
