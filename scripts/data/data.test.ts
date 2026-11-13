import { describe, expect, test } from 'bun:test';
import { cleanAddress, expandTaichung, jsonLines, mergeKaohsiung, type RecordView } from './sources';
import {
  buildHwmsGeocodeQuery,
  disambiguateRouteName,
  extractEmbeddedCoords,
  mergeHwmsStops,
  parseHwmsWeekdays,
  parseRouteDetailPage,
  parseRouteListPage,
  type HwmsRawStop,
} from './hwms';
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

describe('hwms helpers', () => {
  test('parseHwmsWeekdays parses Chinese weekday lists into compact ISO digits', () => {
    expect(parseHwmsWeekdays('一、二、四、五、六')).toBe('12456');
    expect(parseHwmsWeekdays('日、三')).toBe('37');
    expect(parseHwmsWeekdays('')).toBe('');
  });

  test('extractEmbeddedCoords extracts Shetou embedded WGS84 coordinates', () => {
    expect(extractEmbeddedCoords('崙雅巷12號23.888624, 120.587390')).toEqual({
      location: '崙雅巷12號',
      latitude: 23.888624,
      longitude: 120.58739,
    });
    expect(extractEmbeddedCoords('中華路10號')).toEqual({ location: '中華路10號' });
  });

  test('buildHwmsGeocodeQuery cleans satellite prefixes, notes, and prevents landmark false positives', () => {
    expect(buildHwmsGeocodeQuery('彰化縣', '埔鹽鄉', '(衛星=19) 彰化縣埔鹽鄉，埔港路62-7號')).toBe('彰化縣埔鹽鄉埔港路62-7號');
    expect(buildHwmsGeocodeQuery('雲林縣', '斗六市', '台灣銀行')).toBe('雲林縣斗六市台灣銀行');
    expect(buildHwmsGeocodeQuery('彰化縣', '福興鄉', '彰水路(彰化縣福興鄉農會)')).toBe('彰化縣福興鄉彰水路(彰化縣福興鄉農會)');
    expect(buildHwmsGeocodeQuery('彰化縣', '員林市', '2. 彰化縣員林市民生路42號')).toBe('彰化縣員林市民生路42號');
    expect(buildHwmsGeocodeQuery('雲林縣', '土庫鎮', '633台灣雲林縣土庫鎮雲98鄉道23號')).toBe('雲林縣土庫鎮雲98鄉道23號');
    expect(buildHwmsGeocodeQuery('彰化縣', '彰化市', '聖安路743-1號(二四六清運)')).toBe('彰化縣彰化市聖安路743-1號');
  });

  test('disambiguateRouteName prevents generic route collisions across townships', () => {
    expect(disambiguateRouteName('斗六市', '第1線')).toBe('斗六市 第1線');
    expect(disambiguateRouteName('斗六市', '斗六市A線')).toBe('斗六市A線');
  });

  test('parses HWMS list and detail HTML tables', () => {
    const listHtml = `
      <table class="table-striped"><tbody>
        <tr><td>彰化縣</td><td>員林市</td><td>沿街</td><td>N50020023</td><td><a href="/dispPageBox/trans.aspx?ddsPageID=LINEINFO&amp;dbid=123">第1線</a></td></tr>
      </tbody></table>
      <a data-page="1">1</a><a data-page="4">4</a>
    `;
    const parsedList = parseRouteListPage(listHtml);
    expect(parsedList.maxPage).toBe(4);
    expect(parsedList.routes).toEqual([
      { dbid: '123', county: '彰化縣', district: '員林市', method: '沿街', routeSeq: 'N50020023', routeName: '第1線' },
    ]);

    const detailHtml = `
      <table class="table-bordered"><tbody>
        <tr><td>1</td><td>民生路42號</td><td>18:05</td><td>一、二、四</td><td>一</td><td>二、四</td></tr>
      </tbody></table>
    `;
    expect(parseRouteDetailPage(detailHtml, parsedList.routes[0]!)).toHaveLength(1);
  });

  test('mergeHwmsStops prefers embedded coordinates, caches others, and skips blank times', () => {
    const stops: HwmsRawStop[] = [
      { dbid: '1', county: '彰化縣', district: '社頭鄉', method: '沿街', routeSeq: 'N1', routeName: 'A線', seq: 1, location: '崙雅巷12號23.888624, 120.587390', time: '18:00', garbageDays: '一、四', foodscrapsDays: '', recyclingDays: '四' },
      { dbid: '1', county: '彰化縣', district: '社頭鄉', method: '沿街', routeSeq: 'N1', routeName: 'A線', seq: 2, location: '社頭路10號', time: '18:10', garbageDays: '一、四', foodscrapsDays: '', recyclingDays: '' },
      { dbid: '1', county: '彰化縣', district: '社頭鄉', method: '沿街', routeSeq: 'N1', routeName: 'A線', seq: 3, location: '未知地點', time: '18:20', garbageDays: '一', foodscrapsDays: '', recyclingDays: '' },
      { dbid: '1', county: '彰化縣', district: '社頭鄉', method: '沿街', routeSeq: 'N1', routeName: 'A線', seq: 4, location: '空白時間', time: '', garbageDays: '一', foodscrapsDays: '', recyclingDays: '' },
    ];
    const geocodes = { '彰化縣社頭鄉社頭路10號': { longitude: 120.59, latitude: 23.89 } };
    const { records, missingGeocodes } = mergeHwmsStops('changhua', stops, geocodes);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ route: '社頭鄉 A線', arrivalTime: '1800', departureTime: '1805', garbageDays: '14', recyclingDays: '4', latitude: '23.888624' });
    expect(records[1]).toMatchObject({ location: '社頭路10號', arrivalTime: '1810', departureTime: '1815' });
    expect(missingGeocodes).toEqual(['彰化縣社頭鄉未知地點']);
  });
});
