import type { RecordView } from './sources';

// Generous box around Taiwan's main island (Kinmen/Matsu are not served)
const TAIWAN = { south: 21.8, north: 25.4, west: 119.9, east: 122.1 };

export interface ValidationInput {
  records: RecordView[];
  minRecords: number;
  previousCount?: number;
  /** Fraction of the previous count a refresh may lose before it is rejected. */
  maxShrink?: number;
}

/**
 * Reject a refresh that looks broken rather than publish it: an outage page,
 * a truncated download, or a schema change all show up as one of these.
 * Returns a list of problems; empty means OK.
 */
export function validateRecords({ records, minRecords, previousCount, maxShrink = 0.2 }: ValidationInput): string[] {
  const problems: string[] = [];
  const n = records.length;

  if (n < minRecords) problems.push(`only ${n} records (expected at least ${minRecords})`);
  if (previousCount && n < previousCount * (1 - maxShrink)) {
    const pct = Math.round((1 - n / previousCount) * 100);
    problems.push(`${n} records is ${pct}% fewer than the published ${previousCount} (limit ${Math.round(maxShrink * 100)}%)`);
  }
  if (n === 0) return problems;

  const share = (count: number) => count / n;
  const badCoords = records.filter(
    r => !(r.lat >= TAIWAN.south && r.lat <= TAIWAN.north && r.lng >= TAIWAN.west && r.lng <= TAIWAN.east),
  ).length;
  if (share(badCoords) > 0.02) problems.push(`${badCoords} records have missing or out-of-Taiwan coordinates`);

  const badTimes = records.filter(r => !/^([01]?\d|2[0-4])[0-5]\d$/.test(r.time)).length;
  if (share(badTimes) > 0.02) problems.push(`${badTimes} records have no valid HHMM time`);

  const noName = records.filter(r => !r.name.trim()).length;
  if (share(noName) > 0.02) problems.push(`${noName} records have no stop name`);

  return problems;
}
