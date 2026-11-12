/**
 * Stable collection-point IDs.
 *
 * IDs are persisted by users (starred stops in localStorage, shared `?point=` links),
 * so they must survive data refreshes. They are derived from what identifies a stop
 * (route + stop name, etc.), never from row numbers or ranks, which open-data
 * portals renumber on every import.
 *
 * Format: `<city>-s<hash>`; the `s` marks the stable scheme so legacy IDs can be told apart.
 */

/** cyrb53: fast, deterministic 53-bit string hash (no crypto needed, collisions ~1 in 2^53). */
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function stablePointId(city: string, ...identity: Array<string | number | undefined>): string {
  const key = identity.map(part => String(part ?? '').trim()).join('|');
  return `${city}-s${cyrb53(key).toString(36)}`;
}

/**
 * Make IDs unique within one city's output. The identity fields rarely collide
 * (a truck visiting the same stop twice on one trip); the arrival time breaks the tie,
 * then a counter as a last resort. Mutates and returns the array.
 */
export function ensureUniqueIds<T extends { id: string; arrivalTime: string }>(points: T[]): T[] {
  const seen = new Set<string>();
  for (const point of points) {
    if (!seen.has(point.id)) {
      seen.add(point.id);
      continue;
    }
    let candidate = `${point.id}-${point.arrivalTime}`;
    for (let n = 2; seen.has(candidate); n++) candidate = `${point.id}-${point.arrivalTime}-${n}`;
    point.id = candidate;
    seen.add(candidate);
  }
  return points;
}

/** Pre-Nov-2026 ID formats (row numbers, ranks, license plates) that need a one-time migration. */
export const LEGACY_ID_PATTERNS = {
  taipei: /^taipei-\d+$/,
  // lineid and rank are always numeric; stable IDs start with `s`, so they never match
  'new-taipei': /^new-taipei-\d+-\d+$/,
  taichung: /^taichung-.+-d[1-7]-(garbage|recycling)$/,
  // `kaohsiung-<lng>_<lat>-<plate>`
  kaohsiung: /^kaohsiung-\d+\.\d+_\d+\.\d+-/,
} as const;

export type LegacyIdCity = keyof typeof LEGACY_ID_PATTERNS;

export function legacyIdCity(id: string): LegacyIdCity | null {
  for (const [city, pattern] of Object.entries(LEGACY_ID_PATTERNS)) {
    if (pattern.test(id)) return city as LegacyIdCity;
  }
  return null;
}
