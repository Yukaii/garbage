import type { UnifiedTrashCollectionPoint } from '../../src/types';

export interface PointDto {
  id: string;
  city: string;
  district: string;
  village: string;
  location: string;
  route: string;
  arrivalTime: string;
  departureTime: string;
  latitude: number;
  longitude: number;
  distanceMeters?: number;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Whether the bounding box of a circle overlaps a city's bounds (cheap pre-filter before loading data). */
export function circleIntersectsBounds(lat: number, lng: number, radiusM: number, b: Bounds): boolean {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos(toRad(lat)), 0.01);
  return lat + dLat >= b.south && lat - dLat <= b.north && lng + dLng >= b.west && lng - dLng <= b.east;
}

/** "0930" / "930" / "09:30" -> "09:30"; anything unparseable is returned unchanged. */
export function formatTime(raw: string): string {
  const digits = raw.replace(':', '').padStart(4, '0');
  return /^\d{4}$/.test(digits) ? `${digits.slice(0, 2)}:${digits.slice(2)}` : raw;
}

function timeKey(raw: string): number {
  const digits = raw.replace(':', '');
  return /^\d{1,4}$/.test(digits) ? Number(digits) : Number.MAX_SAFE_INTEGER;
}

export function toDto(p: UnifiedTrashCollectionPoint, distanceMeters?: number): PointDto {
  return {
    id: p.id,
    city: p.city,
    district: p.district,
    village: p.village,
    location: p.location,
    route: p.route,
    arrivalTime: formatTime(p.arrivalTime),
    departureTime: formatTime(p.departureTime),
    latitude: Number(p.latitude),
    longitude: Number(p.longitude),
    ...(distanceMeters === undefined ? {} : { distanceMeters: Math.round(distanceMeters) }),
  };
}

export function findNearby(
  points: UnifiedTrashCollectionPoint[],
  lat: number,
  lng: number,
  radiusM: number,
  limit: number,
): PointDto[] {
  const hits: Array<{ p: UnifiedTrashCollectionPoint; d: number }> = [];
  for (const p of points) {
    const plat = Number(p.latitude);
    const plng = Number(p.longitude);
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
    const d = haversineMeters(lat, lng, plat, plng);
    if (d <= radiusM) hits.push({ p, d });
  }
  hits.sort((a, b) => a.d - b.d || timeKey(a.p.arrivalTime) - timeKey(b.p.arrivalTime));
  return hits.slice(0, limit).map(({ p, d }) => toDto(p, d));
}

export function searchPoints(points: UnifiedTrashCollectionPoint[], query: string, limit: number): PointDto[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const hits = points.filter(p => {
    const haystack = `${p.district} ${p.village} ${p.location} ${p.route}`.toLowerCase();
    return terms.every(t => haystack.includes(t));
  });
  hits.sort((a, b) => timeKey(a.arrivalTime) - timeKey(b.arrivalTime));
  return hits.slice(0, limit).map(p => toDto(p));
}

/** Stops of the same route as `point`, in arrival order. */
export function routeStops(points: UnifiedTrashCollectionPoint[], point: UnifiedTrashCollectionPoint): PointDto[] {
  return points
    .filter(p => p.route === point.route && p.district === point.district)
    .sort((a, b) => timeKey(a.arrivalTime) - timeKey(b.arrivalTime))
    .map(p => toDto(p));
}
