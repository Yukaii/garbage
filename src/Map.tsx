import { useEffect, useRef, useState, useMemo } from 'react';
import Map, { Source, Layer, Popup, NavigationControl, Marker } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl';
import type { CircleLayer, SymbolLayer } from 'maplibre-gl';
import type { UnifiedTrashCollectionPoint } from './types';
import {
  formatTime,
  getCurrentTimeInMinutes,
  getTimeStatus,
  getTimeDifferenceInMinutes,
  formatTimeDifference,
  parseTimeToMinutes,
  interpolateTruckPosition,
} from './api';
import { Layers, Locate, Navigation, Route, X } from 'lucide-react';
import RouteSelector from './RouteSelector';
import 'maplibre-gl/dist/maplibre-gl.css';

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
  currentTimeMinutes?: number; // Override for debug mode
}

type MapStyleType = 'street' | 'satellite';

// Minimum zoom level required to show time labels
const MIN_LABEL_ZOOM_DESKTOP = 16.5;
const MIN_LABEL_ZOOM_MOBILE = 17;

export default function MapComponent({ points, darkMode, onMapLoaded, selectedRoute, onRouteSelect, onViewportChange, currentTimeMinutes: propCurrentTimeMinutes }: MapComponentProps) {
  const isDesktop = useIsDesktop();
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<UnifiedTrashCollectionPoint | null>(null);
  const [mapStyleType, setMapStyleType] = useState<MapStyleType>('street');
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [internalCurrentTimeMinutes, setInternalCurrentTimeMinutes] = useState(getCurrentTimeInMinutes());

  // Use prop if provided (debug mode), otherwise use internal state
  const currentTimeMinutes = propCurrentTimeMinutes ?? internalCurrentTimeMinutes;
  const hasNotifiedMapLoaded = useRef(false);
  const hasRequestedGeolocation = useRef(false);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [viewportBounds, setViewportBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  useEffect(() => {
    // Update current time every minute for popup countdowns (only if not using prop)
    if (propCurrentTimeMinutes !== undefined) return;

    const interval = setInterval(() => {
      setInternalCurrentTimeMinutes(getCurrentTimeInMinutes());
    }, 60000);

    return () => clearInterval(interval);
  }, [propCurrentTimeMinutes]);

  // Request geolocation permission on first load
  useEffect(() => {
    if (hasRequestedGeolocation.current || !navigator.geolocation) return;

    // Only request geolocation if there are no URL params (first time visit)
    const params = new URLSearchParams(window.location.search);
    if (params.has('lat') || params.has('lng') || params.has('zoom')) {
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
      (error) => {
        // Silently fail - user will see default map view
        console.log('Geolocation not available or denied:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  }, []);

  // Filter points based on selected route
  const filteredPoints = useMemo(() => {
    if (!selectedRoute) return points;
    return points.filter(point => `${point.source}-${point.route}` === selectedRoute);
  }, [points, selectedRoute]);

  // Calculate truck position for selected route
  const truckPosition = useMemo(() => {
    if (!selectedRoute || filteredPoints.length === 0) return null;

    // Sort filtered points
    const sortedPoints = [...filteredPoints].sort((a, b) => {
      if (a.source === 'new-taipei') {
        const rankA = parseInt(a.id.split('-').pop() || '0');
        const rankB = parseInt(b.id.split('-').pop() || '0');
        return rankA - rankB;
      }
      return parseTimeToMinutes(a.arrivalTime) - parseTimeToMinutes(b.arrivalTime);
    });

    return interpolateTruckPosition(sortedPoints, currentTimeMinutes);
  }, [selectedRoute, filteredPoints, currentTimeMinutes]);

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
      const timeStatus = getTimeStatus(point.arrivalTime, point.departureTime, currentTimeMinutes);
      const isInSelectedRoute = !selectedRoute || `${point.source}-${point.route}` === selectedRoute;
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
        },
      };
    }),
  }), [filteredPoints, currentTimeMinutes, selectedRoute]);

  // Create route line GeoJSON for selected route
  const routeLineGeoJson = useMemo(() => {
    if (!selectedRoute || filteredPoints.length === 0) return null;

    // Sort points by time/rank
    const sortedPoints = [...filteredPoints].sort((a, b) => {
      if (a.source === 'new-taipei') {
        const rankA = parseInt(a.id.split('-').pop() || '0');
        const rankB = parseInt(b.id.split('-').pop() || '0');
        return rankA - rankB;
      }
      return parseTimeToMinutes(a.arrivalTime) - parseTimeToMinutes(b.arrivalTime);
    });

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
  }, [selectedRoute, filteredPoints]);

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
  const clusterLayer: CircleLayer = useMemo(() => ({
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

  const clusterCountLayer: SymbolLayer = useMemo(() => ({
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
  const unclusteredPointLayer: CircleLayer = useMemo(() => ({
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
        '#1a1a1a'               // Default black
      ],
      'circle-radius': [
        'match',
        ['get', 'timeStatus'],
        'active', 12,           // Larger for active (increased from 10)
        8                       // Normal size for others
      ],
      'circle-stroke-width': [
        'match',
        ['get', 'timeStatus'],
        'active', 3,            // Thicker stroke for active
        2                       // Normal stroke
      ],
      'circle-stroke-color': [
        'match',
        ['get', 'timeStatus'],
        'active', '#22c55e',    // Green stroke for active (pulsing effect)
        '#fff'                  // White stroke for others
      ],
      'circle-opacity': [
        'match',
        ['get', 'timeStatus'],
        'active', 0.9,          // More visible for active
        0.8                     // Normal opacity
      ],
    },
  }), []);

  const [cursor, setCursor] = useState<string>('auto');

  const onMouseEnter = () => setCursor('pointer');
  const onMouseLeave = () => setCursor('auto');

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
  const getMapStyle = () => {
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
      alert('您的瀏覽器不支援定位功能');
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
        alert('無法取得您的位置，請檢查瀏覽器權限設定');
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

      // Update URL with current position and zoom
      const center = map.getCenter();
      const params = new URLSearchParams(window.location.search);
      params.set('lat', center.lat.toFixed(6));
      params.set('lng', center.lng.toFixed(6));
      params.set('zoom', zoom.toFixed(2));

      // Use replaceState to avoid cluttering browser history
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
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
      <Map
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
        const timeStatus = getTimeStatus(point.arrivalTime, point.departureTime, currentTimeMinutes);
        const isActive = timeStatus === 'active';
        // Use solid, high-contrast colors
        const bgColor = isActive ? '#16a34a' : timeStatus === 'upcoming' ? '#ca8a04' : '#525252';
        const textColor = '#ffffff';

        return (
          <Marker
            key={point.id}
            longitude={parseFloat(point.longitude)}
            latitude={parseFloat(point.latitude)}
            anchor="top"
            offset={[0, 12]}
          >
            <div className="relative flex items-center justify-center">
              {/* Wave animation for active stops */}
              {isActive && (
                <>
                  <div className="absolute h-8 w-8 -top-1 rounded-full bg-green-500 opacity-20 animate-ping" style={{ animationDuration: '2s' }} />
                  <div className="absolute h-6 w-6 -top-1 rounded-full bg-green-500 opacity-30 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
                </>
              )}

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setPopupInfo(point);
                }}
                className="relative z-10"
                style={{
                  backgroundColor: bgColor,
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: isActive ? '2px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(0, 0, 0, 0.2)',
                  boxShadow: isActive ? '0 0 12px rgba(34, 197, 94, 0.6), 0 2px 6px rgba(0,0,0,0.4)' : '0 2px 6px rgba(0,0,0,0.4)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  lineHeight: '1.2',
                  fontWeight: '700',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'auto',
                  color: textColor,
                }}
              >
                {formatTime(point.arrivalTime)} - {formatTime(point.departureTime)}
              </div>
            </div>
          </Marker>
        );
      })}

      {popupInfo && (() => {
        const timeStatus = getTimeStatus(popupInfo.arrivalTime, popupInfo.departureTime, currentTimeMinutes);
        const timeDiff = getTimeDifferenceInMinutes(popupInfo.arrivalTime, currentTimeMinutes);
        const statusColor = timeStatus === 'active' ? '#22c55e' : timeStatus === 'upcoming' ? '#eab308' : '#a3a3a3';
        const statusText = timeStatus === 'active' ? '營運中' : timeStatus === 'upcoming' ? '即將抵達' : '已結束';
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${popupInfo.latitude},${popupInfo.longitude}`;

        return (
          <Popup
            longitude={parseFloat(popupInfo.longitude)}
            latitude={parseFloat(popupInfo.latitude)}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
          >
            <div style={{ minWidth: '220px', padding: '12px', paddingTop: '10px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '6px',
                marginBottom: '8px',
                borderBottom: `1px solid ${darkMode ? '#404040' : '#e5e5e5'}`,
                paddingBottom: '6px',
                paddingRight: '24px'
              }}>
                <h3 style={{
                  margin: '0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: darkMode ? '#ffffff' : '#000000',
                  flex: 1,
                  lineHeight: '1.4',
                }}>
                  {popupInfo.district} - {popupInfo.village}
                </h3>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  color: statusColor,
                  backgroundColor: `${statusColor}20`,
                  padding: '3px 6px',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginTop: '1px',
                }}>
                  {statusText}
                </span>
              </div>
              <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#d4d4d4' : '#262626' }}>
                <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>地點:</strong> {popupInfo.location}
              </p>
              <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#d4d4d4' : '#262626' }}>
                <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>路線:</strong> {popupInfo.route}
              </p>
              <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#d4d4d4' : '#262626' }}>
                <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>到達:</strong> {formatTime(popupInfo.arrivalTime)}
                {timeStatus === 'upcoming' && (
                  <span style={{ marginLeft: '6px', fontSize: '11px', color: statusColor, fontWeight: '500' }}>
                    ({formatTimeDifference(timeDiff)})
                  </span>
                )}
              </p>
              <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#d4d4d4' : '#262626' }}>
                <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>離開:</strong> {formatTime(popupInfo.departureTime)}
              </p>
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '8px',
                  backgroundColor: darkMode ? '#1a1a1a' : '#f5f5f5',
                  color: darkMode ? '#ffffff' : '#000000',
                  border: `1px solid ${darkMode ? '#404040' : '#d4d4d4'}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  marginTop: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = darkMode ? '#fff' : '#000';
                  e.currentTarget.style.backgroundColor = darkMode ? '#262626' : '#e5e5e5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = darkMode ? '#404040' : '#d4d4d4';
                  e.currentTarget.style.backgroundColor = darkMode ? '#1a1a1a' : '#f5f5f5';
                }}
              >
                <Navigation size={14} />
                <span>導航至此地點</span>
              </a>
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
                <div className="absolute h-12 w-12 rounded-full bg-green-500 opacity-30 animate-ping" />
                <div className="absolute h-10 w-10 rounded-full bg-green-500 opacity-50" />
              </>
            )}

            {/* Truck icon with status-based colors */}
            <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full shadow-lg border-2 border-white dark:border-neutral-900 ${
              truckPosition.status === 'active'
                ? 'bg-green-600'
                : truckPosition.status === 'before'
                ? 'bg-gray-400'
                : 'bg-neutral-500'
            }`}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6 text-white"
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
            <div className={`absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold text-white shadow-md ${
              truckPosition.status === 'active'
                ? 'bg-green-600'
                : truckPosition.status === 'before'
                ? 'bg-gray-500'
                : 'bg-neutral-600'
            }`}>
              {truckPosition.status === 'active' && `🚛 行駛中 ${Math.round(truckPosition.progress * 100)}%`}
              {truckPosition.status === 'before' && '⏰ 尚未出發'}
              {truckPosition.status === 'after' && `✓ 已完成 (${filteredPoints.length}站)`}
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
          <div style={{
            position: 'relative',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Radio wave animations */}
            <div className="radio-wave" style={{
              position: 'absolute',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              opacity: 0.6,
            }} />
            <div className="radio-wave" style={{
              position: 'absolute',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              opacity: 0.6,
              animationDelay: '1s',
            }} />
            {/* Center dot */}
            <div style={{
              position: 'relative',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              border: '2px solid white',
              boxShadow: '0 0 8px rgba(59, 130, 246, 0.8)',
              zIndex: 1,
            }} />
          </div>
        </Marker>
      )}

      <NavigationControl position="top-right" />
    </Map>

    {/* Route Name Label - Top Center */}
    {selectedRoute && filteredPoints.length > 0 && (
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-lg border border-neutral-300 bg-white/95 backdrop-blur-sm px-4 py-2 shadow-lg dark:border-neutral-700 dark:bg-black/90">
        <Route className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <div className="flex items-center gap-3">
          <div>
            <div className="text-sm font-semibold text-black dark:text-white">
              {filteredPoints[0].route}
            </div>
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              {filteredPoints[0].district} • {filteredPoints.length} 站
            </div>
          </div>
          {onRouteSelect && (
            <button
              onClick={() => onRouteSelect(null)}
              className="ml-2 flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-neutral-700 transition-all hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
              aria-label="Clear route selection"
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
  </div>
  );
}
