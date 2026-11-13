/**
 * Upstream open-data sources, one per city.
 *
 * Each source fetches the full dataset and returns it in the exact shape the
 * `data` branch has always stored (the adapters in src/cities and
 * scripts/data/publish.ts read these files), plus a flat view of the
 * records used for validation.
 */
import { fetchJson } from './http';
import { fetchHwmsCountyStops, mergeHwmsStops, type HwmsCity } from './hwms';

export interface RecordView {
  name: string;
  time: string;
  lat: number;
  lng: number;
}

export interface SourceResult {
  /** Serialized file content for the data branch. */
  content: string;
  records: RecordView[];
  /** Upstream addresses with no coordinates in the geocode cache (geocoded cities only). */
  missingGeocodes?: string[];
  notes: string[];
}

export interface Source {
  city: 'taipei' | 'new-taipei' | 'taichung' | 'kaohsiung' | 'changhua' | 'yunlin';
  /** File name on the data branch. */
  file: string;
  /** A real refresh of this city never has fewer records than this. */
  minRecords: number;
  fetch(options: {
    loadGeocodes: (city: 'taichung' | 'kaohsiung' | 'changhua' | 'yunlin') => Promise<GeocodeLookup>;
  }): Promise<SourceResult>;
  /** Record count of a previously published file, for the shrink check. */
  countPrevious(content: string): number;
}

/** One JSON value per line: compact, but still line-diffable in the data branch history. */
export function jsonLines(rows: unknown[]): string {
  return rows.length === 0 ? '[]\n' : `[\n${rows.map(row => JSON.stringify(row)).join(',\n')}\n]\n`;
}

/** "07:12" → "0712" */
const hhmm = (time: string) => time.trim().replace(':', '');

/** Drop parenthesised notes: "中山路321號(中華路口)" → "中山路321號" */
export const cleanAddress = (address: string) => address.replace(/\([^)]*\)/g, '').trim();

/** Address → coordinates cache, stored on the data branch as geocode/<city>.json. */
export type GeocodeLookup = Record<string, { longitude: number; latitude: number }>;

// ---------------------------------------------------------------------------
// Taipei: data.taipei, paginated 1000 rows at a time
// ---------------------------------------------------------------------------

const TAIPEI_API = 'https://data.taipei/api/v1/dataset/a6e90031-7ec4-4089-afb5-361a4efe7202?scope=resourceAquire';
const TAIPEI_PAGE = 1000;

interface TaipeiPage {
  result: { count: number; results: Array<Record<string, unknown>> };
}

const taipei: Source = {
  city: 'taipei',
  file: 'trash-collection-points.json',
  minRecords: 2000,
  async fetch() {
    const results: Array<Record<string, unknown>> = [];
    let total = Infinity;
    for (let offset = 0; offset < total; offset += TAIPEI_PAGE) {
      const page = await fetchJson<TaipeiPage>(`${TAIPEI_API}&limit=${TAIPEI_PAGE}&offset=${offset}`);
      total = page.result.count;
      results.push(...page.result.results);
      if (page.result.results.length < TAIPEI_PAGE) break;
    }
    if (results.length !== total) throw new Error(`Taipei API reported ${total} rows but returned ${results.length}`);

    const importDate = (results[0]?._importdate as { date?: string } | undefined)?.date;
    const wrapper = { result: { count: total, limit: results.length, offset: 0, sort: '', results: '__RESULTS__' } };
    const content = JSON.stringify(wrapper).replace('"__RESULTS__"', jsonLines(results).trimEnd()) + '\n';
    return {
      content,
      records: results.map(r => ({
        name: String(r['地點'] ?? ''),
        time: String(r['抵達時間'] ?? ''),
        lat: Number(r['緯度']),
        lng: Number(r['經度']),
      })),
      notes: importDate ? [`Upstream import date: ${importDate}`] : [],
    };
  },
  countPrevious: content => (JSON.parse(content) as TaipeiPage).result.results.length,
};

// ---------------------------------------------------------------------------
// New Taipei: data.ntpc.gov.tw, pages of up to 10,000 rows
// ---------------------------------------------------------------------------

const NTPC_API = 'https://data.ntpc.gov.tw/api/datasets/edc3ad26-8ae7-4916-a00b-bc6048d19bf8/json';
const NTPC_PAGE = 10_000;

const newTaipei: Source = {
  city: 'new-taipei',
  file: 'new-taipei-trash-collection-points.json',
  minRecords: 10_000,
  async fetch() {
    const rows: Array<Record<string, string>> = [];
    for (let page = 0; ; page++) {
      const batch = await fetchJson<Array<Record<string, string>>>(`${NTPC_API}?page=${page}&size=${NTPC_PAGE}`);
      if (!Array.isArray(batch)) throw new Error(`New Taipei page ${page} is not an array`);
      rows.push(...batch);
      if (batch.length < NTPC_PAGE) break;
      if (page > 50) throw new Error('New Taipei pagination did not terminate');
    }
    const districts = new Set(rows.map(r => r.city)).size;
    return {
      content: jsonLines(rows),
      records: rows.map(r => ({ name: r.name ?? '', time: hhmm(r.time ?? ''), lat: Number(r.latitude), lng: Number(r.longitude) })),
      notes: [`${districts} districts`],
    };
  },
  countPrevious: content => (JSON.parse(content) as unknown[]).length,
};

// ---------------------------------------------------------------------------
// Taichung: schedule from the city's data center + cached TGOS geocodes
// ---------------------------------------------------------------------------

// The dataset moved off datacenter.taichung.gov.tw (that host no longer resolves).
// Listing: https://data.gov.tw/dataset/84004
const TAICHUNG_API = 'https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=68d1a87f-7baa-4b50-8408-c36a3a7eda68';

type TaichungRecord = Record<string, string | undefined> & {
  area: string;
  village: string;
  car_licence: string;
  caption: string;
  task_type: string;
};

export interface TaichungRow {
  area: string;
  village: string;
  route: string;
  location: string;
  type: string;
  arrivalTime: string;
  departureTime: string;
  longitude: string;
  latitude: string;
  collectionType: 'garbage' | 'recycling';
  dayOfWeek: number;
}

/** Expand each upstream record into one row per (weekday, collection type) it is served. */
export function expandTaichung(records: TaichungRecord[], geocodes: GeocodeLookup) {
  const rows = new Map<string, TaichungRow>();
  const missing = new Set<string>();

  for (const record of records) {
    const location = cleanAddress(record.caption ?? '');
    if (!location) continue;
    const address = `台中市${record.area}${location}`;
    const coords = geocodes[address];
    if (!coords) {
      missing.add(address);
      continue;
    }
    for (const [prefix, collectionType] of [['g', 'garbage'], ['r', 'recycling']] as const) {
      for (let day = 1; day <= 7; day++) {
        const start = record[`${prefix}_d${day}_time_s`]?.trim();
        const end = record[`${prefix}_d${day}_time_e`]?.trim();
        if (!start || !end) continue;
        const row: TaichungRow = {
          area: record.area,
          village: record.village,
          route: record.car_licence,
          location,
          type: record.task_type,
          arrivalTime: hhmm(start),
          departureTime: hhmm(end),
          longitude: String(coords.longitude),
          latitude: String(coords.latitude),
          collectionType,
          dayOfWeek: day,
        };
        // Several records can share coordinates; keep the earliest visit per (place, day, type)
        const key = `${row.longitude},${row.latitude}|${day}|${collectionType}`;
        const existing = rows.get(key);
        if (!existing || row.arrivalTime < existing.arrivalTime) rows.set(key, row);
      }
    }
  }
  return { rows: [...rows.values()], missing: [...missing].sort() };
}

const taichung: Source = {
  city: 'taichung',
  file: 'taichung-trash-collection-points.json',
  minRecords: 50_000,
  async fetch({ loadGeocodes }) {
    const records = await fetchJson<TaichungRecord[]>(TAICHUNG_API);
    if (!Array.isArray(records)) throw new Error('Taichung response is not an array');
    const geocodes = await loadGeocodes('taichung');
    const { rows, missing } = expandTaichung(records, geocodes);
    return {
      content: jsonLines(rows),
      records: rows.map(r => ({ name: r.location, time: r.arrivalTime, lat: Number(r.latitude), lng: Number(r.longitude) })),
      missingGeocodes: missing,
      notes: [`${records.length} upstream records`, `${missing.length} addresses without cached coordinates`],
    };
  },
  countPrevious: content => (JSON.parse(content) as unknown[]).length,
};

// ---------------------------------------------------------------------------
// Kaohsiung: data.kcg.gov.tw + cached TGOS geocodes
// ---------------------------------------------------------------------------

const KAOHSIUNG_API = 'https://data.kcg.gov.tw/Json/Get/14fe516d-ac62-4905-9325-70daae7616bd';
// data.kcg.gov.tw only answers Taiwan networks, so CI downloads it on a self-hosted runner in
// Taiwan and points this at the file (file://...). Locally the portal is fetched directly.
const kaohsiungUrl = () => process.env.KAOHSIUNG_SOURCE_URL || KAOHSIUNG_API;

interface KaohsiungRecord {
  area: string;
  village: string;
  car_licence: string;
  caption: string;
  today_s: string;
  today_e: string;
  task?: string;
}

export function mergeKaohsiung(records: KaohsiungRecord[], geocodes: GeocodeLookup) {
  const rows: Array<Record<string, string>> = [];
  const seen = new Set<string>();
  const missing = new Set<string>();
  let noHouseNumber = 0;

  for (const record of records) {
    const location = cleanAddress(record.caption ?? '');
    if (!location) continue;
    // Intersections and landmarks were never geocoded
    if (!/\d+號/.test(location)) {
      noHouseNumber++;
      continue;
    }
    const address = `高雄市${record.area}${location}`;
    const coords = geocodes[address];
    if (!coords) {
      missing.add(address);
      continue;
    }
    // One marker per location (the map shows a single stop per coordinate)
    const coordKey = `${coords.longitude},${coords.latitude}`;
    if (seen.has(coordKey)) continue;
    seen.add(coordKey);
    rows.push({
      area: record.area,
      village: record.village,
      route: record.car_licence,
      location,
      type: '定點',
      arrivalTime: hhmm(record.today_s),
      departureTime: hhmm(record.today_e),
      longitude: String(coords.longitude),
      latitude: String(coords.latitude),
      collectionType: record.task === '資收' ? 'recycling' : 'garbage',
    });
  }
  return { rows, missing: [...missing].sort(), noHouseNumber };
}

const kaohsiung: Source = {
  city: 'kaohsiung',
  file: 'kaohsiung-trash-collection-points.json',
  minRecords: 5_000,
  async fetch({ loadGeocodes }) {
    const json = await fetchJson<{ Data: KaohsiungRecord[] }>(kaohsiungUrl());
    if (!Array.isArray(json?.Data)) throw new Error('Kaohsiung response has no Data array');
    const geocodes = await loadGeocodes('kaohsiung');
    const { rows, missing, noHouseNumber } = mergeKaohsiung(json.Data, geocodes);
    return {
      content: jsonLines(rows),
      records: rows.map(r => ({ name: r.location!, time: r.arrivalTime!, lat: Number(r.latitude), lng: Number(r.longitude) })),
      missingGeocodes: missing,
      notes: [
        `${json.Data.length} upstream records`,
        `${noHouseNumber} skipped (no house number)`,
        `${missing.length} addresses without cached coordinates`,
      ],
    };
  },
  countPrevious: content => (JSON.parse(content) as unknown[]).length,
};

// ---------------------------------------------------------------------------
// Changhua & Yunlin: hwms.moenv.gov.tw + cached TGOS geocodes
// ---------------------------------------------------------------------------

function hwmsSource(city: HwmsCity, minRecords: number): Source {
  return {
    city,
    file: `${city}-trash-collection-points.json`,
    minRecords,
    async fetch({ loadGeocodes }) {
      const rawStops = await fetchHwmsCountyStops(city);
      const geocodes = await loadGeocodes(city);
      const { records, missingGeocodes } = mergeHwmsStops(city, rawStops, geocodes);
      return {
        content: jsonLines(records),
        records: records.map(r => ({
          name: r.location,
          time: r.arrivalTime,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
        })),
        missingGeocodes,
        notes: [
          `${rawStops.length} upstream stops`,
          `${missingGeocodes.length} addresses without cached coordinates`,
        ],
      };
    },
    countPrevious: content => (JSON.parse(content) as unknown[]).length,
  };
}

export const SOURCES: Record<Source['city'], Source> = {
  taipei,
  'new-taipei': newTaipei,
  taichung,
  kaohsiung,
  changhua: hwmsSource('changhua', 3_000),
  yunlin: hwmsSource('yunlin', 350),
};
