import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import MapLibre, { Source, Layer, Popup, NavigationControl, Marker } from 'react-map-gl/maplibre';
import type { MapRef, LayerProps, StyleSpecification } from 'react-map-gl/maplibre';
import type { UnifiedTrashCollectionPoint } from './types';
import {
  formatTime,
  getPointStatus,
  type PointStatus,
  getTimeDifferenceInMinutes,
  formatTimeDifference,
  interpolateTruckPosition,
  compareRouteOrder,
} from './api';
import { useRouteGeometry } from './hooks/useRouteGeometry';
import type { TaipeiClock } from './utils/taipeiTime';
import { weekdayLabel } from './utils/taipeiTime';
import { COLLECTION_TYPE_LABELS, nextServiceDay, typesOn } from './cities/schedule';
import { Navigation, Route, X, Star, Share2 } from 'lucide-react';
import RouteSelector from './RouteSelector';
import { sharePoint, getPointIdFromUrl, clearPointFromUrl } from './utils/share';
import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

// maplibre-gl v6 no longer inlines its worker; it must be bundled and registered explicitly.
setWorkerUrl(maplibreWorkerUrl);

// Hook to detect if user is on desktop
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isDesktop;
}

interface MapComponentProps {
  points: UnifiedTrashCollectionPoint[];
  darkMode: boolean;
  onMapLoaded?: () => void;
  selectedRoute?: string | null; // routeKey to highlight
  onRouteSelect?: (routeKey: string | null) => void;
  onViewportChange?: (bounds: { north: number; south: number; east: number; west: number }, zoom: number) => void;
  /** Taiwan time and weekday (App owns the clock; debug time overrides its minutes). */
  clock: TaipeiClock;
  // Favorites feature props
  starredPointIds?: string[];
  onToggleStar?: (pointId: string) => void;
  // Starred list panel
  isStarredListOpen?: boolean;
  onCloseStarredList?: () => void;
  allPoints?: UnifiedTrashCollectionPoint[]; // All points for starred list lookup
}

type MapStyleType = 'street' | 'satellite';

const STATUS_COLORS: Record<PointStatus, string> = {
  active: '#22c55e',
  upcoming: '#eab308',
  past: '#a3a3a3',
  off: '#a3a3a3',
};
const STATUS_TEXT: Record<PointStatus, string> = {
  active: '收運中',
  upcoming: '即將抵達',
  past: '已結束',
  off: '今日停收',
};

// Minimum zoom level required to show time labels
const MIN_LABEL_ZOOM_DESKTOP = 16.5;
const MIN_LABEL_ZOOM_MOBILE = 17;

export default function MapComponent({ points, darkMode, onMapLoaded, selectedRoute, onRouteSelect, onViewportChange, clock, starredPointIds = [], onToggleStar, isStarredListOpen = false, onCloseStarredList, allPoints = [] }: MapComponentProps) {
  const isDesktop = useIsDesktop();
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<UnifiedTrashCollectionPoint | null>(null);
  const [mapStyleType, setMapStyleType] = useState<MapStyleType>('street');
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [shareToast, setShareToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const hasHandledSharedPoint = useRef(false);

  const currentTimeMinutes = clock.minutes;
  const hasNotifiedMapLoaded = useRef(false);
  const hasRequestedGeolocation = useRef(false);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [viewportBounds, setViewportBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  // Request geolocation permission on first load
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount (ref-guarded); later isDesktop changes must not re-prompt
  useEffect(() => {
    if (hasRequestedGeolocation.current || !navigator.geolocation) return;

    // Only request geolocation if there are no URL params (first time visit)
    const params = new URLSearchParams(window.location.search);
    if (params.has('lat') || params.has('lng') || params.has('zoom') || params.has('point')) {
      hasRequestedGeolocation.current = true;
      return;
    }

    hasRequestedGeolocation.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lng: longitude, lat: latitude });
        // Fly to user location on first load
        mapRef.current?.flyTo({
          center: [longitude, latitude],
          zoom: isDesktop ? MIN_LABEL_ZOOM_DESKTOP : MIN_LABEL_ZOOM_MOBILE,
          duration: 1200,
          essential: true,
        });
      },
      () => {
        // Denied or unavailable: keep the default view
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  }, []);

  // Fly to a point, then open its popup once the camera has (mostly) arrived
  const flyToPoint = useCallback((point: UnifiedTrashCollectionPoint, duration = 800) => {
    mapRef.current?.flyTo({
      center: [parseFloat(point.longitude), parseFloat(point.latitude)],
      zoom: isDesktop ? MIN_LABEL_ZOOM_DESKTOP : MIN_LABEL_ZOOM_MOBILE,
      duration,
      essential: true,
    });
    setTimeout(() => setPopupInfo(point), duration + 100);
    // The starred list covers the map on mobile
    if (!isDesktop && onCloseStarredList) onCloseStarredList();
  }, [isDesktop, onCloseStarredList]);

  // Handle shared point from URL
  useEffect(() => {
    if (hasHandledSharedPoint.current || points.length === 0) return;

    const sharedPointId = getPointIdFromUrl();
    if (!sharedPointId) return;

    const sharedPoint = points.find(p => p.id === sharedPointId);
    if (sharedPoint) {
      hasHandledSharedPoint.current = true;
      flyToPoint(sharedPoint, 1200);
      // Clear the point from URL to avoid re-triggering
      clearPointFromUrl();
    }
  }, [points, flyToPoint]);

  // Auto-hide share toast
  useEffect(() => {
    if (shareToast) {
      const timer = setTimeout(() => {
        setShareToast(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [shareToast]);

  // Compute starred points for the list view
  const pointsById = useMemo(
    () => new Map((allPoints.length > 0 ? allPoints : points).map(point => [point.id, point])),
    [allPoints, points],
  );
  const starredPoints = useMemo(
    () => starredPointIds.map(id => pointsById.get(id)).filter((p): p is UnifiedTrashCollectionPoint => p !== undefined),
    [starredPointIds, pointsById],
  );

  // Filter points based on selected route
  const filteredPoints = useMemo(() => {
    if (!selectedRoute) return points;
    return points.filter(point => `${point.source}-${point.route}` === selectedRoute);
  }, [points, selectedRoute]);

  // Calculate truck position for selected route
  const truckPosition = useMemo(() => {
    if (!selectedRoute || filteredPoints.length === 0) return null;

    // Sort filtered points
    const sortedPoints = [...filteredPoints].sort(compareRouteOrder);

    return interpolateTruckPosition(sortedPoints, currentTimeMinutes);
  }, [selectedRoute, filteredPoints, currentTimeMinutes]);

  // Road-following geometry for the selected route (null → straight-line fallback below)
  const routeGeometry = useRouteGeometry(filteredPoints, !!selectedRoute);

  // Auto-fit bounds when route is selected
  useEffect(() => {
    if (selectedRoute && filteredPoints.length > 0 && mapRef.current) {
      const bounds = filteredPoints.reduce(
        (acc, point) => {
          const lng = parseFloat(point.longitude);
          const lat = parseFloat(point.latitude);
          return {
            minLng: Math.min(acc.minLng, lng),
            maxLng: Math.max(acc.maxLng, lng),
            minLat: Math.min(acc.minLat, lat),
            maxLat: Math.max(acc.maxLat, lat),
          };
        },
        {
          minLng: Infinity,
          maxLng: -Infinity,
          minLat: Infinity,
          maxLat: -Infinity,
        }
      );

      mapRef.current.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        {
          padding: 50,
          duration: 800,
        }
      );
    }
  }, [selectedRoute, filteredPoints]);

  // Convert points to GeoJSON with time status (memoized to prevent unnecessary re-renders)
  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: filteredPoints.map((point) => {
      const timeStatus = getPointStatus(point, clock);
      const isInSelectedRoute = !selectedRoute || `${point.source}-${point.route}` === selectedRoute;
      const isStarred = starredPointIds.includes(point.id);
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [parseFloat(point.longitude), parseFloat(point.latitude)],
        },
        properties: {
          id: point.id,
          district: point.district,
          village: point.village,
          location: point.location,
          route: point.route,
          arrivalTime: point.arrivalTime,
          departureTime: point.departureTime,
          arrivalTimeFormatted: formatTime(point.arrivalTime),
          departureTimeFormatted: formatTime(point.departureTime),
          timeStatus: timeStatus,
          isInSelectedRoute: isInSelectedRoute,
          isStarred: isStarred,
        },
      };
    }),
  }), [filteredPoints, clock, selectedRoute, starredPointIds]);

  // Create route line GeoJSON for selected route
  // Use Valhalla geometry if available, otherwise fall back to straight-line connection
  const routeLineGeoJson = useMemo(() => {
    if (!selectedRoute || filteredPoints.length === 0) return null;

    // If we have fetched route geometry from Valhalla, use it
    if (routeGeometry && routeGeometry.features.length > 0) {
      return routeGeometry;
    }

    // Fallback: create straight-line connection between points
    const sortedPoints = [...filteredPoints].sort(compareRouteOrder);

    return {
      type: 'FeatureCollection' as const,
      features: [{
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: sortedPoints.map(point => [
            parseFloat(point.longitude),
            parseFloat(point.latitude)
          ]),
        },
        properties: {
          route: selectedRoute,
        },
      }],
    };
  }, [selectedRoute, filteredPoints, routeGeometry]);

  // Filter points to only those visible in viewport (for label rendering)
  // Show labels at high zoom OR when route is selected
  const visiblePoints = useMemo(() => {
    // If route is selected, show all labels for that route
    if (selectedRoute && filteredPoints.length > 0) {
      return filteredPoints;
    }

    // Determine minimum zoom based on device type
    const minZoom = isDesktop ? MIN_LABEL_ZOOM_DESKTOP : MIN_LABEL_ZOOM_MOBILE;

    // Otherwise, only show at close zoom levels
    if (!viewportBounds || currentZoom < minZoom) return [];

    return filteredPoints.filter((point) => {
      const lat = parseFloat(point.latitude);
      const lng = parseFloat(point.longitude);
      return (
        lat >= viewportBounds.south &&
        lat <= viewportBounds.north &&
        lng >= viewportBounds.west &&
        lng <= viewportBounds.east
      );
    });
  }, [filteredPoints, viewportBounds, currentZoom, selectedRoute, isDesktop]);

  // Cluster layer styles - monotone black/gray design (memoized to prevent re-renders)
  const clusterLayer: LayerProps = useMemo(() => ({
    id: 'clusters',
    type: 'circle',
    source: 'trash-points',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#4a4a4a', 10, '#333333', 30, '#1a1a1a'],
      'circle-radius': ['step', ['get', 'point_count'], 20, 10, 30, 30, 40],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  }), []);

  const clusterCountLayer: LayerProps = useMemo(() => ({
    id: 'cluster-count',
    type: 'symbol',
    source: 'trash-points',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-size': 14,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 1,
    },
  }), []);

  // Color-code unclustered points by time status (memoized to prevent re-renders)
  // Starred points get a gold/yellow stroke
  const unclusteredPointLayer: LayerProps = useMemo(() => ({
    id: 'unclustered-point',
    type: 'circle',
    source: 'trash-points',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'match',
        ['get', 'timeStatus'],
        'active', '#22c55e',    // Green for active
        'upcoming', '#eab308',  // Yellow for upcoming
        'past', '#a3a3a3',      // Gray for past
        'off', '#d4d4d4',       // Light gray: not collected today
        '#1a1a1a'               // Default black
      ],
      'circle-radius': [
        'case',
        ['get', 'isStarred'],
        ['match', ['get', 'timeStatus'], 'active', 14, 10], // Larger for starred
        ['match', ['get', 'timeStatus'], 'active', 12, 8]   // Normal size
      ],
      'circle-stroke-width': [
        'case',
        ['get', 'isStarred'],
        4,                      // Thicker stroke for starred
        ['match', ['get', 'timeStatus'], 'active', 3, 2] // Normal stroke
      ],
      'circle-stroke-color': [
        'case',
        ['get', 'isStarred'],
        '#f59e0b',              // Gold/amber stroke for starred
        ['match', ['get', 'timeStatus'], 'active', '#22c55e', '#fff'] // Normal colors
      ],
      'circle-opacity': [
        'match',
        ['get', 'timeStatus'],
        'active', 0.9,          // More visible for active
        'off', 0.45,            // Fade stops not collected today
        0.8                     // Normal opacity
      ],
    },
  }), []);

  const [cursor, setCursor] = useState<string>('auto');

  const onMouseEnter = () => setCursor('pointer');
  const onMouseLeave = () => setCursor('auto');

  // Handle sharing a point
  const handleShare = useCallback(async (point: UnifiedTrashCollectionPoint) => {
    const pointName = `${point.district} - ${point.village} (${point.location})`;
    const result = await sharePoint(point.id, pointName);
    setShareToast({
      message: result.message,
      type: result.success ? 'success' : 'error',
    });
  }, []);

  const handleMapClick = (event: any) => {
    const features = event.features;
    if (!features || features.length === 0) return;

    const feature = features[0];

    // Handle cluster click
    if (feature.layer.id === 'clusters') {
      const clusterId = feature.properties.cluster_id;
      const source: any = mapRef.current?.getMap().getSource('trash-points');

      source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
        if (err) return;
        mapRef.current?.flyTo({
          center: feature.geometry.coordinates,
          zoom: zoom,
          duration: 500,
        });
      });
    }

    // Handle point click
    if (feature.layer.id === 'unclustered-point') {
      const point = filteredPoints.find((p) => p.id === feature.properties.id);
      if (point) {
        setPopupInfo(point);
      }
    }
  };

  // Map style based on style type and dark mode
  const getMapStyle = (): StyleSpecification | string => {
    if (mapStyleType === 'satellite') {
      // Using satellite imagery with labels overlay for better navigation
      return {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'satellite-tiles': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          },
          'labels-tiles': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '&copy; Esri'
          }
        },
        layers: [
          {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite-tiles',
            minzoom: 0,
            maxzoom: 22
          },
          {
            id: 'labels-layer',
            type: 'raster',
            source: 'labels-tiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      };
    }
    return darkMode
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
  };

  // Handle geolocation
  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert('你的瀏覽器不支援定位功能');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lng: longitude, lat: latitude });
        mapRef.current?.flyTo({
          center: [longitude, latitude],
          zoom: isDesktop ? MIN_LABEL_ZOOM_DESKTOP : MIN_LABEL_ZOOM_MOBILE,
          duration: 800,
          essential: true,
        });
        setIsLocating(false);
      },
      (error) => {
        console.error('定位錯誤:', error);
        alert('無法取得目前位置，請確認已開啟瀏覽器的定位權限');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  };

  // Toggle map style
  const toggleMapStyle = () => {
    setMapStyleType(prev => prev === 'street' ? 'satellite' : 'street');
  };

  const handleMapLoad = () => {
    if (!hasNotifiedMapLoaded.current && onMapLoaded) {
      hasNotifiedMapLoaded.current = true;
      onMapLoaded();
    }
  };

  // Debounce timer for URL updates
  const urlUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const updateViewport = () => {
    const map = mapRef.current?.getMap();
    if (map) {
      const zoom = map.getZoom();
      setCurrentZoom(zoom);
      const bounds = map.getBounds();
      if (bounds) {
        const newBounds = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        };
        setViewportBounds(newBounds);
        // Notify parent of viewport change with zoom level
        if (onViewportChange) {
          onViewportChange(newBounds, zoom);
        }
      }

      // Debounce URL updates to avoid interfering with touch events on mobile
      if (urlUpdateTimerRef.current) {
        clearTimeout(urlUpdateTimerRef.current);
      }

      urlUpdateTimerRef.current = setTimeout(() => {
        const center = map.getCenter();
        const params = new URLSearchParams(window.location.search);
        params.set('lat', center.lat.toFixed(6));
        params.set('lng', center.lng.toFixed(6));
        params.set('zoom', zoom.toFixed(2));

        // Use replaceState to avoid cluttering browser history
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
      }, 500); // Wait 500ms after user stops moving before updating URL
    }
  };

  // Get initial view state from URL or use defaults
  const getInitialViewState = () => {
    const params = new URLSearchParams(window.location.search);
    const lat = params.get('lat');
    const lng = params.get('lng');
    const zoom = params.get('zoom');

    if (lat && lng && zoom) {
      return {
        longitude: parseFloat(lng),
        latitude: parseFloat(lat),
        zoom: parseFloat(zoom),
      };
    }

    // Default view (Taipei center)
    return {
      longitude: 121.5654,
      latitude: 25.033,
      zoom: 11,
    };
  };

  return (
    <div className='absolute h-full w-full'>
      <MapLibre
        ref={mapRef}
        initialViewState={getInitialViewState()}
        style={{ width: '100%', height: '100%' }}
        mapStyle={getMapStyle()}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        onClick={handleMapClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        cursor={cursor}
        onLoad={handleMapLoad}
        onMove={updateViewport}
        onZoomEnd={updateViewport}
      >
      <Source
        id="trash-points"
        type="geojson"
        data={geojson as any}
        cluster={!selectedRoute} // Disable clustering when route is selected
        clusterMaxZoom={14}
        clusterRadius={50}
      >
        {!selectedRoute && <Layer {...clusterLayer} />}
        {!selectedRoute && <Layer {...clusterCountLayer} />}
        <Layer {...unclusteredPointLayer} />
      </Source>

      {/* Route line layer */}
      {routeLineGeoJson && (
        <Source
          id="route-line"
          type="geojson"
          data={routeLineGeoJson as any}
        >
          <Layer
            id="route-line-layer"
            type="line"
            paint={{
              'line-color': '#3b82f6',
              'line-width': 4,
              'line-opacity': 0.8,
            }}
            layout={{
              'line-join': 'round',
              'line-cap': 'round',
            }}
          />
          {/* Animated line on top */}
          <Layer
            id="route-line-animated"
            type="line"
            paint={{
              'line-color': '#60a5fa',
              'line-width': 6,
              'line-opacity': 0.4,
              'line-dasharray': [0, 4, 3],
            }}
            layout={{
              'line-join': 'round',
              'line-cap': 'round',
            }}
          />
        </Source>
      )}

      {/* Custom label markers for high zoom levels - only render visible points */}
      {visiblePoints.map((point) => {
        const timeStatus = getPointStatus(point, clock);
        const isActive = timeStatus === 'active';
        const bgColor = isActive ? '#16a34a' : timeStatus === 'upcoming' ? '#ca8a04' : timeStatus === 'off' ? '#a3a3a3' : '#525252';

        return (
          <Marker
            key={point.id}
            longitude={parseFloat(point.longitude)}
            latitude={parseFloat(point.latitude)}
            anchor="top"
            offset={[0, 12]}
          >
            <div className="relative flex items-center justify-center" style={{ pointerEvents: 'none' }}>
              {/* Wave animation for active stops */}
              {isActive && (
                <>
                  <div className="absolute -top-1 h-8 w-8 animate-ping rounded-full bg-green-500 opacity-20" style={{ animationDuration: '2s' }} />
                  <div className="absolute -top-1 h-6 w-6 animate-ping rounded-full bg-green-500 opacity-30" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
                </>
              )}

              <div
                onPointerDown={(e) => {
                  // Use pointerdown instead of click for better mobile response
                  e.stopPropagation();
                  setPopupInfo(point);
                }}
                className="relative z-10 cursor-pointer rounded-md px-1.5 py-0.5 text-center text-[11px] leading-tight font-bold whitespace-nowrap text-white tabular-nums"
                style={{
                  backgroundColor: bgColor,
                  border: isActive ? '2px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(0, 0, 0, 0.2)',
                  boxShadow: isActive ? '0 0 12px rgba(34, 197, 94, 0.6), 0 2px 6px rgba(0,0,0,0.35)' : '0 2px 6px rgba(0,0,0,0.35)',
                  pointerEvents: 'auto',
                }}
              >
                {formatTime(point.arrivalTime)} - {formatTime(point.departureTime)}
              </div>
            </div>
          </Marker>
        );
      })}

      {popupInfo && (() => {
        const timeStatus = getPointStatus(popupInfo, clock);
        const timeDiff = getTimeDifferenceInMinutes(popupInfo.arrivalTime, currentTimeMinutes);
        const statusColor = STATUS_COLORS[timeStatus];
        const statusText = STATUS_TEXT[timeStatus];
        const todaysTypes = typesOn(popupInfo.schedule, clock.weekday);
        const nextDay = timeStatus === 'off' ? nextServiceDay(popupInfo.schedule, clock.weekday) : null;
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${popupInfo.latitude},${popupInfo.longitude}`;
        const isPointStarred = starredPointIds.includes(popupInfo.id);

        return (
          <Popup
            longitude={parseFloat(popupInfo.longitude)}
            latitude={parseFloat(popupInfo.latitude)}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
          >
            <div className="min-w-[240px] p-3.5 text-neutral-900 dark:text-neutral-100">
              <div className="mb-2.5 flex items-start justify-between gap-2 border-b border-neutral-200/80 pb-2.5 pr-7 dark:border-neutral-800">
                <h3 className="m-0 flex-1 text-sm leading-snug font-semibold text-neutral-900 dark:text-neutral-100">
                  {popupInfo.district} - {popupInfo.village}
                </h3>
                <span
                  className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                  style={{
                    color: statusColor,
                    backgroundColor: `${statusColor}20`,
                  }}
                >
                  {statusText}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300">
                <p className="m-0">
                  <strong className="font-semibold text-neutral-900 dark:text-neutral-100">地點：</strong>
                  {popupInfo.location}
                </p>
                <p className="m-0">
                  <strong className="font-semibold text-neutral-900 dark:text-neutral-100">路線：</strong>
                  {popupInfo.route}
                </p>
                <p className="m-0">
                  <strong className="font-semibold text-neutral-900 dark:text-neutral-100">抵達：</strong>
                  <span className="tabular-nums">{formatTime(popupInfo.arrivalTime)}</span>
                  {timeStatus === 'upcoming' && (
                    <span className="ml-1.5 text-[11px] font-medium" style={{ color: statusColor }}>
                      ({formatTimeDifference(timeDiff)})
                    </span>
                  )}
                </p>
                <p className="m-0">
                  <strong className="font-semibold text-neutral-900 dark:text-neutral-100">離開：</strong>
                  <span className="tabular-nums">{formatTime(popupInfo.departureTime)}</span>
                </p>
                {(todaysTypes.length > 0 || nextDay) && (
                  <p className="m-0">
                    <strong className="font-semibold text-neutral-900 dark:text-neutral-100">今日：</strong>
                    {todaysTypes.length > 0
                      ? todaysTypes.map(type => COLLECTION_TYPE_LABELS[type]).join('、')
                      : `停收，下次收運${weekdayLabel(nextDay!)}`}
                  </p>
                )}
              </div>

              {/* Action buttons row */}
              <div className="mt-3 flex items-center gap-2">
                {/* Navigation button */}
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-100/80 px-3 text-xs font-medium text-neutral-800 no-underline transition-colors hover:border-neutral-300 hover:bg-neutral-200/70 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:border-neutral-700 dark:hover:bg-neutral-700"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>導航</span>
                </a>
                {/* Star button */}
                {onToggleStar && (
                  <button
                    type="button"
                    onClick={() => onToggleStar(popupInfo.id)}
                    className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
                      isPointStarred
                        ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600'
                        : 'border-neutral-200 bg-neutral-100/80 text-neutral-700 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-600 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-amber-500/60 dark:hover:bg-amber-950/40 dark:hover:text-amber-400'
                    }`}
                    title={isPointStarred ? '取消收藏' : '收藏此站點'}
                    aria-label={isPointStarred ? '取消收藏' : '收藏此站點'}
                  >
                    <Star className="h-3.5 w-3.5" fill={isPointStarred ? 'currentColor' : 'none'} />
                  </button>
                )}
                {/* Share button */}
                <button
                  type="button"
                  onClick={() => handleShare(popupInfo)}
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100/80 text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-200/70 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:border-neutral-700 dark:hover:bg-neutral-700"
                  title="分享此站點"
                  aria-label="分享此站點"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Popup>
        );
      })()}

      {/* Truck Position Marker */}
      {truckPosition && (
        <Marker
          longitude={truckPosition.lng}
          latitude={truckPosition.lat}
          anchor="center"
          style={{ transition: 'all 1s ease-out' }}
        >
          <div className="relative flex items-center justify-center" style={{ transition: 'transform 1s ease-out' }}>
            {/* Pulsing ring effect - only for active trucks */}
            {truckPosition.status === 'active' && (
              <>
                <div className="absolute h-12 w-12 animate-ping rounded-full bg-green-500 opacity-30" />
                <div className="absolute h-10 w-10 rounded-full bg-green-500 opacity-50" />
              </>
            )}

            {/* Truck icon with status-based colors */}
            <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white shadow-lg dark:border-neutral-900 ${
              truckPosition.status === 'active'
                ? 'bg-green-600'
                : truckPosition.status === 'before'
                ? 'bg-neutral-400'
                : 'bg-neutral-500'
            }`}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-5 w-5 text-white"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
                <path d="M15 18H9" />
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
                <circle cx="17" cy="18" r="2" />
                <circle cx="7" cy="18" r="2" />
              </svg>
            </div>

            {/* Progress label with status */}
            <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-lg px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow-md ${
              truckPosition.status === 'active'
                ? 'bg-green-600'
                : truckPosition.status === 'before'
                ? 'bg-neutral-500'
                : 'bg-neutral-600'
            }`}>
              {truckPosition.status === 'active' && `🚛 行駛中 ${Math.round(truckPosition.progress * 100)}%`}
              {truckPosition.status === 'before' && '⏰ 尚未出發'}
              {truckPosition.status === 'after' && `✓ 已完成 (${filteredPoints.length} 站)`}
            </div>
          </div>
        </Marker>
      )}

      {/* User Location Marker */}
      {userLocation && (
        <Marker
          longitude={userLocation.lng}
          latitude={userLocation.lat}
          anchor="center"
        >
          <div className="relative flex h-10 w-10 items-center justify-center">
            {/* Radio wave animations */}
            <div className="radio-wave absolute h-5 w-5 rounded-full bg-sky-500 opacity-60" />
            <div className="radio-wave absolute h-5 w-5 rounded-full bg-sky-500 opacity-60" style={{ animationDelay: '1s' }} />
            {/* Center dot */}
            <div
              className="relative z-10 h-3 w-3 rounded-full border-2 border-white bg-sky-500"
              style={{ boxShadow: '0 0 8px rgba(14, 165, 233, 0.8)' }}
            />
          </div>
        </Marker>
      )}

      <NavigationControl position="top-right" />
    </MapLibre>

    {/* Route Name Label - Top Center */}
    {selectedRoute && filteredPoints.length > 0 && (
      <div className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 rounded-xl border border-neutral-200 bg-white/95 px-3.5 py-2 shadow-lg backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95">
        <Route className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <div className="flex items-center gap-3">
          <div>
            <div className="text-sm leading-tight font-semibold text-neutral-900 dark:text-neutral-100">
              {filteredPoints[0].route}
            </div>
            <div className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {filteredPoints[0].district} • {filteredPoints.length} 站
            </div>
          </div>
          {onRouteSelect && (
            <button
              type="button"
              onClick={() => onRouteSelect(null)}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-800 dark:text-neutral-400 dark:hover:border-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              aria-label="取消選取路線"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )}

    {/* Route Selector */}
    {onRouteSelect && (
      <RouteSelector
        points={points}
        selectedRoute={selectedRoute || null}
        onRouteSelect={onRouteSelect}
        darkMode={darkMode}
        viewportBounds={viewportBounds}
        mapStyleType={mapStyleType}
        onMapStyleToggle={toggleMapStyle}
        onLocateClick={handleLocate}
        isLocating={isLocating}
      />
    )}

    {/* Starred List Panel */}
    {isStarredListOpen && (
      <div className="fixed inset-0 z-[60] md:absolute md:inset-auto md:top-3 md:right-14 md:bottom-auto md:left-auto md:z-40 md:max-h-[calc(100vh-8rem)] md:w-80">
        {/* Backdrop for mobile */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-xs md:hidden"
          onClick={onCloseStarredList}
        />
        {/* Panel */}
        <div className="absolute bottom-0 left-0 right-0 flex max-h-[80vh] flex-col overflow-hidden rounded-t-2xl border border-neutral-200 bg-white/95 shadow-2xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95 md:relative md:bottom-auto md:max-h-[calc(100vh-8rem)] md:rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-200/80 px-4 py-3 dark:border-neutral-800/80">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" fill="currentColor" />
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                收藏站點
              </h3>
              <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                {starredPoints.length}
              </span>
            </div>
            <button
              type="button"
              onClick={onCloseStarredList}
              aria-label="關閉收藏列表"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* List */}
          <div className="flex-1 space-y-1.5 overflow-y-auto p-2.5">
            {starredPoints.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Star className="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-700" />
                <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  尚未收藏任何站點
                </p>
                <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  點選地圖上的站標並按星號即可加入收藏
                </p>
              </div>
            ) : (
              starredPoints.map((point) => {
                const timeStatus = getPointStatus(point, clock);
                const statusColor = timeStatus === 'active' ? 'bg-green-500' : timeStatus === 'upcoming' ? 'bg-amber-500' : timeStatus === 'off' ? 'bg-neutral-300 dark:bg-neutral-600' : 'bg-neutral-400';
                return (
                  <button
                    key={point.id}
                    type="button"
                    onClick={() => flyToPoint(point)}
                    className="w-full rounded-lg border border-neutral-200 bg-white p-3 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${statusColor}`} />
                          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                            {point.district} - {point.village}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {point.location}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-neutral-400 dark:text-neutral-500">
                          {formatTime(point.arrivalTime)} - {formatTime(point.departureTime)}
                        </p>
                      </div>
                      <Navigation className="mt-1 h-4 w-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    )}

    {/* Share Toast */}
    {shareToast && (
      <div
        className={`absolute bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-xs font-semibold shadow-lg transition-all duration-300 ${
          shareToast.type === 'success'
            ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
            : 'bg-red-600 text-white'
        }`}
      >
        {shareToast.message}
      </div>
    )}
  </div>
  );
}
