import { useEffect, useState } from 'react';
import { fetchRouteGeometry, fetchRouteMetadata } from '../api';
import type { RouteGeometry, UnifiedTrashCollectionPoint } from '../types';

type RouteMetadata = Record<string, Record<string, string>>;

// Shared across route selections; dropped on failure so the next selection retries
let metadataRequest: Promise<RouteMetadata | null> | null = null;
function loadRouteMetadata(): Promise<RouteMetadata | null> {
  metadataRequest ??= fetchRouteMetadata().then(metadata => {
    if (!metadata) metadataRequest = null;
    return metadata;
  });
  return metadataRequest;
}

/**
 * Road-following geometry for the selected route (Valhalla, served from /routes/).
 * A route can be driven by several trucks (car sequences); each has its own line, and all
 * are combined. Returns null while loading or when no geometry exists, in which case the
 * map falls back to straight lines between stops.
 */
export function useRouteGeometry(routePoints: UnifiedTrashCollectionPoint[], enabled: boolean): RouteGeometry | null {
  const [geometry, setGeometry] = useState<RouteGeometry | null>(null);

  useEffect(() => {
    const first = routePoints[0];
    setGeometry(null);
    if (!enabled || !first) return;

    let cancelled = false;
    (async () => {
      const cityMetadata = (await loadRouteMetadata())?.[first.source];
      if (!cityMetadata) return;

      const carSeqs = [...new Set(routePoints.map(point => point.carSeq).filter((seq): seq is string => !!seq))];
      const routeIds = carSeqs
        .map(carSeq => cityMetadata[`${first.route}|${carSeq}`])
        .filter((id): id is string => !!id);
      const geometries = await Promise.all(routeIds.map(id => fetchRouteGeometry(first.source, id)));

      const features = geometries.flatMap(g => g?.features ?? []);
      // A newer selection may have started while these were loading
      if (!cancelled && features.length > 0) setGeometry({ type: 'FeatureCollection', features });
    })().catch(error => console.warn('Failed to load route geometry:', error));

    return () => {
      cancelled = true;
    };
  }, [routePoints, enabled]);

  return geometry;
}
