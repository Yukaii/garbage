#!/usr/bin/env bun
/**
 * Shrink the city files for publishing (replaces .github/actions/trim-data.sh).
 *
 *   bun scripts/data/publish.ts <dir>     # rewrites <dir>/*-trash-collection-points.json in place
 *
 * The data branch keeps upstream-shaped files; the site and the MCP server read these
 * published versions through the adapters in src/cities, which accept both shapes.
 *
 * - Taipei: keep only the fields the adapter reads.
 * - New Taipei: collapse the 21 per-day Y/N flags into compact ISO-weekday strings
 *   (Mon=1 .. Sun=7), e.g. garbageDays "1245".
 * - Taichung: upstream rows are one per (stop, weekday, collection type); merge the rows of
 *   one truck visit (same place, truck and times) into one row with compact weekday strings.
 *   ~164k rows → ~37k, 47 MB → ~8 MB.
 * - Kaohsiung: already compact.
 */
import { jsonLines } from './sources';

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

type Row = Record<string, unknown>;

const TAIPEI_FIELDS = ['_id', '行政區', '里別', '分隊', '地點', '路線', '車次', '抵達時間', '離開時間', '經度', '緯度'];

export function compactTaipei(file: { result: { count: number; results: Row[] } }) {
  const results = file.result.results.map(r => Object.fromEntries(TAIPEI_FIELDS.map(f => [f, r[f]])));
  return { result: { count: file.result.count, limit: results.length, offset: 0, sort: '', results } };
}

const NTPC_FIELDS = ['city', 'lineid', 'linename', 'rank', 'name', 'village', 'longitude', 'latitude', 'time'];

/** Y/N flags → "1245"; rows already compacted pass through unchanged. */
export function compactNewTaipei(rows: Row[]): Row[] {
  return rows.map(r => {
    if ('garbageDays' in r) return r;
    const days = (prefix: string) => WEEKDAYS.flatMap((day, i) => (r[prefix + day] === 'Y' ? [i + 1] : [])).join('');
    return {
      ...Object.fromEntries(NTPC_FIELDS.map(f => [f, r[f]])),
      garbageDays: days('garbage'),
      recyclingDays: days('recycling'),
      foodscrapsDays: days('foodscraps'),
    };
  });
}

interface TaichungRow {
  area: string;
  village: string;
  route: string;
  location: string;
  arrivalTime: string;
  departureTime: string;
  longitude: string;
  latitude: string;
  collectionType: 'garbage' | 'recycling';
  dayOfWeek: number;
}

/** One row per truck visit (place + truck + times) with the weekdays it happens, per type. */
export function compactTaichung(rows: Array<TaichungRow | Row>): Row[] {
  if (rows.length > 0 && !('dayOfWeek' in rows[0]!)) return rows as Row[]; // already compact
  const visits = new Map<string, Row & { days: Record<string, Set<number>> }>();
  for (const r of rows as TaichungRow[]) {
    const key = `${r.longitude},${r.latitude}|${r.route}|${r.arrivalTime}|${r.departureTime}`;
    let visit = visits.get(key);
    if (!visit) {
      const { area, village, route, location, arrivalTime, departureTime, longitude, latitude } = r;
      visit = { area, village, route, location, arrivalTime, departureTime, longitude, latitude, days: {} };
      visits.set(key, visit);
    }
    (visit.days[r.collectionType] ??= new Set()).add(r.dayOfWeek);
  }
  return [...visits.values()].map(({ days, ...visit }) => ({
    ...visit,
    ...Object.fromEntries(
      Object.entries(days).map(([type, set]) => [`${type}Days`, [...set].sort((a, b) => a - b).join('')]),
    ),
  }));
}

const FILES = {
  taipei: 'trash-collection-points.json',
  'new-taipei': 'new-taipei-trash-collection-points.json',
  taichung: 'taichung-trash-collection-points.json',
} as const;

if (import.meta.main) {
  const dir = Bun.argv[2];
  if (!dir) throw new Error('Usage: bun scripts/data/publish.ts <dir>');

  const rewrite = async (name: string, transform: (json: any) => unknown, count: (out: any) => number) => {
    const path = `${dir}/${name}`;
    const before = Bun.file(path).size;
    const out = transform(await Bun.file(path).json());
    const text = Array.isArray(out) ? jsonLines(out) : JSON.stringify(out);
    await Bun.write(path, text);
    const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
    console.log(`${name}: ${mb(before)} → ${mb(Bun.file(path).size)} (${count(out)} rows)`);
  };

  await rewrite(FILES.taipei, compactTaipei, (o: ReturnType<typeof compactTaipei>) => o.result.results.length);
  await rewrite(FILES['new-taipei'], compactNewTaipei, (o: Row[]) => o.length);
  await rewrite(FILES.taichung, compactTaichung, (o: Row[]) => o.length);
}
