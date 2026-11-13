/**
 * Scraper and normalizer for the Ministry of Environment (環境部) national
 * garbage truck route portal: https://hwms.moenv.gov.tw/dispPageBox/route/routeCP.aspx?ddsPageID=ROUTE
 *
 * Used by both scripts/data/sources.ts (weekly refresh) and
 * scripts/geocoding/prepare-hwms-batch.ts (TGOS batch CSV generation) so address
 * normalization and geocode cache keys stay identical.
 */

import type { HwmsTrashCollectionPoint } from '../../src/types';

export const HWMS_ROUTE_URL = 'https://hwms.moenv.gov.tw/dispPageBox/route/routeCP.aspx?ddsPageID=ROUTE';
export const HWMS_DETAIL_BASE = 'https://hwms.moenv.gov.tw';

export const HWMS_COUNTIES = {
  changhua: { code: 'N', name: '彰化縣' },
  yunlin: { code: 'P', name: '雲林縣' },
} as const;

export type HwmsCity = keyof typeof HWMS_COUNTIES;

export interface HwmsRawRoute {
  dbid: string;
  county: string;
  district: string;
  method: string;
  routeSeq: string;
  routeName: string;
}

export interface HwmsRawStop extends HwmsRawRoute {
  seq: number;
  location: string;
  time: string;
  garbageDays: string;
  foodscrapsDays: string;
  recyclingDays: string;
}

const WEEKDAY_MAP: Record<string, string> = {
  一: '1',
  二: '2',
  三: '3',
  四: '4',
  五: '5',
  六: '6',
  日: '7',
};

const TAIWAN_BOUNDS = { south: 21.8, north: 25.4, west: 119.9, east: 122.1 };

export function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Parse HWMS weekday strings like "一、二、四、五、六" into compact ISO digits "12456". */
export function parseHwmsWeekdays(raw: string): string {
  const digits = new Set<string>();
  for (const char of raw) {
    const mapped = WEEKDAY_MAP[char];
    if (mapped) digits.add(mapped);
  }
  return [...digits].sort().join('');
}

/** Normalize "13:00" or "8:05" into "1300" / "0805", or null if invalid/blank. */
export function normalizeHwmsTime(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 24 || minute > 59 || (hour === 24 && minute > 0)) return null;
  return `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
}

/** Add minutes to an HHMM string, clamping at 2359. */
export function addMinutesHHMM(hhmm: string, deltaMinutes: number): string {
  const hours = Number.parseInt(hhmm.slice(0, 2), 10);
  const mins = Number.parseInt(hhmm.slice(2, 4), 10);
  const total = Math.min(23 * 60 + 59, hours * 60 + mins + deltaMinutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}${String(total % 60).padStart(2, '0')}`;
}

/**
 * Extract embedded WGS84 coordinates when a township puts them directly in the stop description
 * (e.g. "崙雅巷12號23.888624, 120.587390" in Changhua's Shetou Township).
 */
export function extractEmbeddedCoords(rawLocation: string): {
  location: string;
  latitude?: number;
  longitude?: number;
} {
  const match = rawLocation.match(/(2\d\.\d{4,})\s*,\s*(12\d\.\d{4,})/);
  if (!match) return { location: rawLocation.trim() };

  const latitude = Number.parseFloat(match[1]!);
  const longitude = Number.parseFloat(match[2]!);
  const cleaned = rawLocation.replace(match[0]!, '').replace(/[，,\s]+$/, '').trim();

  if (
    latitude >= TAIWAN_BOUNDS.south &&
    latitude <= TAIWAN_BOUNDS.north &&
    longitude >= TAIWAN_BOUNDS.west &&
    longitude <= TAIWAN_BOUNDS.east
  ) {
    return { location: cleaned || rawLocation.trim(), latitude, longitude };
  }
  return { location: rawLocation.trim() };
}

/** Clean display location by stripping embedded coordinates and leading satellite tags. */
export function cleanHwmsLocation(rawLocation: string): string {
  const { location } = extractEmbeddedCoords(rawLocation);
  return location
    .replace(/^\s*[（(]衛星=\d+[）)]\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize a stop description into the full query string used both for TGOS batch CSVs
 * and as the lookup key in `geocode/<city>.json`.
 */
export function buildHwmsGeocodeQuery(countyName: string, district: string, rawLocation: string): string {
  let cleaned = cleanHwmsLocation(rawLocation)
    // Remove schedule/dwell annotations like "(二四六清運)", "(停留10分鐘)", "(一二五)", "(每日清運)"
    .replace(/[（(](?:[一二三四五六日、\s]+清運?|每日清運|停留[^）)]*|週[一二三四五六日][^）)]*)[）)]/g, '')
    .trim();

  // For numbered street addresses, strip extra parenthetical hints (same rule as Taichung/Kaohsiung)
  if (/\d+號/.test(cleaned)) {
    cleaned = cleaned.replace(/[（(][^）)]*[）)]/g, '').trim();
  }

  cleaned = cleaned
    .replace(/^[\uff0c,\s]+|[\uff0c,\s]+$/g, '')
    .replace(/^\d+\.\s*(?=彰化縣|雲林縣)/, '')
    .replace(/^(?:\d{1,6}\s*)?(?:台灣|臺灣)\s*(?=彰化縣|雲林縣)/, '')
    .trim();
  if (!cleaned) return '';

  // Avoid duplicating county/district if already embedded as a leading prefix or reverse-geocoded suffix
  if (cleaned.startsWith(countyName) || cleaned.includes(`${district}${countyName}`)) {
    return cleaned.replace(/^([彰化雲林]+[縣市][^\uff0c,\s]+)[\uff0c,]\s*/, '$1');
  }
  if (cleaned.startsWith(district)) {
    return `${countyName}${cleaned.replace(new RegExp(`^(${district})[\uff0c,]\\s*`), '$1')}`;
  }
  return `${countyName}${district}${cleaned}`;
}

/** Ensure route names stay unique across townships within the same county. */
export function disambiguateRouteName(district: string, routeName: string): string {
  const cleanName = routeName.trim();
  if (!cleanName) return district;
  const prefix2 = district.slice(0, 2);
  if (cleanName.includes(district) || (prefix2.length === 2 && cleanName.startsWith(prefix2))) {
    return cleanName;
  }
  return `${district} ${cleanName}`;
}

export function extractHiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const m of html.matchAll(/<input[^>]+type=["']hidden["'][^>]+name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi)) {
    fields[m[1]!] = decodeHtml(m[2]!);
  }
  return fields;
}

export function parseRouteListPage(html: string): { routes: HwmsRawRoute[]; maxPage: number } {
  const routes: HwmsRawRoute[] = [];
  const tbody = html.match(/<table[^>]*class=["'][^"']*table-striped[^"']*["'][^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  for (const rowMatch of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1]!);
    if (cells.length < 5) continue;
    const dbid = cells[4]!.match(/dbid=(\d+)/)?.[1];
    if (!dbid) continue;
    routes.push({
      dbid,
      county: stripTags(cells[0]!),
      district: stripTags(cells[1]!),
      method: stripTags(cells[2]!),
      routeSeq: stripTags(cells[3]!),
      routeName: stripTags(cells[4]!),
    });
  }

  let maxPage = 1;
  for (const m of html.matchAll(/data-page=["'](\d+)["']/gi)) {
    const page = Number.parseInt(m[1]!, 10);
    if (page > maxPage) maxPage = page;
  }
  return { routes, maxPage };
}

export function parseRouteDetailPage(html: string, route: HwmsRawRoute): HwmsRawStop[] {
  const stops: HwmsRawStop[] = [];
  const tbody = html.match(/<table[^>]*class=["'][^"']*table-bordered[^"']*["'][^>]*>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i)?.[1] ?? '';
  for (const rowMatch of tbody.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => stripTags(c[1]!));
    if (cells.length < 6) continue;
    stops.push({
      ...route,
      seq: Number.parseInt(cells[0]!, 10) || stops.length + 1,
      location: cells[1]!,
      time: cells[2]!,
      garbageDays: cells[3]!,
      foodscrapsDays: cells[4]!,
      recyclingDays: cells[5]!,
    });
  }
  return stops;
}

async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
      if (response.ok) return response;
      lastError = new Error(`${response.status} ${response.statusText} for ${url}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < retries) await Bun.sleep(500 * (attempt + 1));
  }
  throw lastError;
}

function mergeCookies(existing: string, response: Response): string {
  const incoming = response.headers.getSetCookie?.() ?? [];
  if (!incoming.length) return existing;
  const map = new Map<string, string>();
  for (const part of existing.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq > 0) map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  for (const cookie of incoming) {
    const pair = cookie.split(';')[0]!.trim();
    const eq = pair.indexOf('=');
    if (eq > 0) map.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

/** Fetch all routes and stops for a county from hwms.moenv.gov.tw, deduplicated by routeSeq. */
export async function fetchHwmsCountyStops(city: HwmsCity): Promise<HwmsRawStop[]> {
  const { code, name } = HWMS_COUNTIES[city];
  console.log(`Fetching HWMS route index for ${name} (${code})...`);

  const initRes = await fetchWithRetry(HWMS_ROUTE_URL);
  let cookie = mergeCookies('', initRes);
  const initHtml = await initRes.text();
  const fields = extractHiddenFields(initHtml);

  const searchRes = await fetchWithRetry(HWMS_ROUTE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: new URLSearchParams({
      ...fields,
      'ctl01$ddl_QVhlPathCity': code,
      'ctl01$ddl_QVhlPathZone': '請選擇',
      'ctl01$ddl_QVhlPathMethod': '請選擇',
      'ctl01$btn_Search': '查詢',
    }),
  });
  cookie = mergeCookies(cookie, searchRes);
  const page1Html = await searchRes.text();
  const page1 = parseRouteListPage(page1Html);

  const allRoutes: HwmsRawRoute[] = [...page1.routes];
  for (let p = 2; p <= page1.maxPage; p++) {
    const pageRes = await fetchWithRetry(`${HWMS_ROUTE_URL}&p=${p}`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    const pageHtml = await pageRes.text();
    allRoutes.push(...parseRouteListPage(pageHtml).routes);
  }

  // Deduplicate routes that appear under multiple dbids with the same routeSeq
  const uniqueRoutes = new Map<string, HwmsRawRoute>();
  for (const route of allRoutes) {
    const key = route.routeSeq || route.dbid;
    if (!uniqueRoutes.has(key)) uniqueRoutes.set(key, route);
  }

  const routes = [...uniqueRoutes.values()];
  console.log(`  ${name}: ${allRoutes.length} listed routes → ${routes.length} unique routes (${page1.maxPage} page(s))`);

  const stops: HwmsRawStop[] = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < routes.length; i += CONCURRENCY) {
    const batch = routes.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async route => {
        const detailUrl = `${HWMS_DETAIL_BASE}/dispPageBox/trans.aspx?ddsPageID=LINEINFO&dbid=${route.dbid}`;
        const res = await fetchWithRetry(detailUrl);
        return parseRouteDetailPage(await res.text(), route);
      }),
    );
    for (const routeStops of batchResults) stops.push(...routeStops);
  }

  console.log(`  ${name}: fetched ${stops.length} total stops`);
  return stops;
}

/**
 * Merge raw HWMS stops with cached TGOS geocodes (plus any embedded lat/lng in the stop text).
 * Ungeocoded stops are skipped and returned in `missingGeocodes` for batch TGOS reporting.
 */
export function mergeHwmsStops(
  city: HwmsCity,
  rawStops: HwmsRawStop[],
  geocodes: Record<string, { longitude: number; latitude: number }>,
): { records: HwmsTrashCollectionPoint[]; missingGeocodes: string[] } {
  const countyName = HWMS_COUNTIES[city].name;
  const records: HwmsTrashCollectionPoint[] = [];
  const missing = new Set<string>();

  for (const stop of rawStops) {
    const arrivalTime = normalizeHwmsTime(stop.time);
    if (!arrivalTime) continue;

    const embedded = extractEmbeddedCoords(stop.location);
    const query = buildHwmsGeocodeQuery(countyName, stop.district, stop.location);
    if (!query) continue;

    const cached = geocodes[query];
    const latitude = cached?.latitude ?? embedded.latitude;
    const longitude = cached?.longitude ?? embedded.longitude;

    if (latitude === undefined || longitude === undefined) {
      missing.add(query);
      continue;
    }

    const cleanLoc = cleanHwmsLocation(stop.location);
    if (!cleanLoc) continue;

    const garbageDays = parseHwmsWeekdays(stop.garbageDays);
    const recyclingDays = parseHwmsWeekdays(stop.recyclingDays);
    const foodscrapsDays = parseHwmsWeekdays(stop.foodscrapsDays);

    records.push({
      district: stop.district,
      routeSeq: stop.routeSeq || stop.dbid,
      route: disambiguateRouteName(stop.district, stop.routeName),
      seq: stop.seq,
      location: cleanLoc,
      arrivalTime,
      departureTime: addMinutesHHMM(arrivalTime, 5),
      longitude: String(longitude),
      latitude: String(latitude),
      ...(garbageDays ? { garbageDays } : {}),
      ...(recyclingDays ? { recyclingDays } : {}),
      ...(foodscrapsDays ? { foodscrapsDays } : {}),
    });
  }

  return { records, missingGeocodes: [...missing] };
}
