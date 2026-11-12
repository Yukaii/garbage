import { useEffect, useState } from 'react';
import type { City } from '../cities/cityRegistry';

export interface CityDataMeta {
  /** When the city's data last changed (ISO 8601). */
  updatedAt: string;
  /** When the refresh job last confirmed it against the upstream portal, if it has run. */
  checkedAt?: string;
  records?: number;
}

export type DataMeta = Partial<Record<City, CityDataMeta>>;

/** Per-city data dates, written at build time to /data-meta.json by scripts/dump-data.sh. */
export function useDataMeta(): DataMeta | null {
  const [meta, setMeta] = useState<DataMeta | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/data-meta.json')
      .then(res => (res.ok ? res.json() : null))
      .then(json => !cancelled && setMeta(json))
      .catch(() => {}); // Optional: the dates simply don't show
    return () => {
      cancelled = true;
    };
  }, []);
  return meta;
}

const TAIPEI_DATE = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' });

/** "2026-11-12" in Taiwan time, or null for a missing/invalid date. */
export function formatDataDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : TAIPEI_DATE.format(date);
}

/** The oldest update date among the given cities: the honest freshness of what's on screen. */
export function oldestUpdate(meta: DataMeta | null, cities: City[]): string | null {
  const dates = cities.map(city => meta?.[city]?.updatedAt).filter((d): d is string => !!d).sort();
  return formatDataDate(dates[0]);
}
