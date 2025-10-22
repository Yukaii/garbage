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
} from './api';
import { Layers, Locate, Navigation, Route, X } from 'lucide-react';
import RouteSelector from './RouteSelector';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapComponentProps {
  points: UnifiedTrashCollectionPoint[];
  darkMode: boolean;
  onMapLoaded?: () => void;
  selectedRoute?: string | null; // routeKey to highlight
  onRouteSelect?: (routeKey: string | null) => void;
  onViewportChange?: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

type MapStyleType = 'street' | 'satellite';

// Minimum zoom level required to show time labels
const MIN_LABEL_ZOOM = 17;

export default function MapComponent({ points, darkMode, onMapLoaded, selectedRoute, onRouteSelect, onViewportChange }: MapComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<UnifiedTrashCollectionPoint | null>(null);
  const [mapStyleType, setMapStyleType] = useState<MapStyleType>('street');
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(getCurrentTimeInMinutes());
  const hasNotifiedMapLoaded = useRef(false);
  const [currentZoom, setCurrentZoom] = useState(11);
  const [viewportBounds, setViewportBounds] = useState<{
    north: number;
    south: number;
    east: number;
    west: number;
  } | null>(null);

  useEffect(() => {
    // Update current time every minute for popup countdowns
    const interval = setInterval(() => {
      setCurrentTimeMinutes(getCurrentTimeInMinutes());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Filter points based on selected route
  const filteredPoints = useMemo(() => {
    if (!selectedRoute) return points;
    return points.filter(point => `${point.source}-${point.route}` === selectedRoute);
  }, [points, selectedRoute]);

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

    // Otherwise, only show at close zoom levels
    if (!viewportBounds || currentZoom < MIN_LABEL_ZOOM) return [];

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
  }, [filteredPoints, viewportBounds, currentZoom, selectedRoute]);

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
        'active', 10,           // Larger for active
        8                       // Normal size for others
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
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
          zoom: MIN_LABEL_ZOOM,
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
      setCurrentZoom(map.getZoom());
      const bounds = map.getBounds();
      if (bounds) {
        const newBounds = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        };
        setViewportBounds(newBounds);
        // Notify parent of viewport change
        if (onViewportChange) {
          onViewportChange(newBounds);
        }
      }
    }
  };

  return (
    <div className='absolute h-full w-full'>
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: 121.5654,
          latitude: 25.033,
          zoom: 11,
        }}
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
        // Use solid, high-contrast colors
        const bgColor = timeStatus === 'active' ? '#16a34a' : timeStatus === 'upcoming' ? '#ca8a04' : '#525252';
        const textColor = '#ffffff';

        return (
          <Marker
            key={point.id}
            longitude={parseFloat(point.longitude)}
            latitude={parseFloat(point.latitude)}
            anchor="top"
            offset={[0, 12]}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                setPopupInfo(point);
              }}
              style={{
                backgroundColor: bgColor,
                padding: '4px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(0, 0, 0, 0.2)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
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

    {/* Map Controls Container */}
    <div className="absolute left-[10px] top-[10px] md:top-[60px] flex flex-col gap-2 z-10"
      style={{
        // On mobile: top-[10px] (no sidebar button)
        // On desktop (md+): top-[60px] (avoid sidebar button overlap)
      }}
    >
      {/* Layer Toggle Button */}
      <button
        onClick={toggleMapStyle}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '4px',
          border: darkMode ? '1px solid #404040' : '1px solid #d4d4d4',
          backgroundColor: darkMode ? '#000' : '#fff',
          color: darkMode ? '#fff' : '#000',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = darkMode ? '#fff' : '#000';
          e.currentTarget.style.backgroundColor = darkMode ? '#1a1a1a' : '#f5f5f5';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = darkMode ? '#404040' : '#d4d4d4';
          e.currentTarget.style.backgroundColor = darkMode ? '#000' : '#fff';
        }}
        title={mapStyleType === 'street' ? '切換至衛星圖' : '切換至街道圖'}
      >
        <Layers size={18} />
      </button>

      {/* Geolocation Button */}
      <button
        onClick={handleLocate}
        disabled={isLocating}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '4px',
          border: darkMode ? '1px solid #404040' : '1px solid #d4d4d4',
          backgroundColor: darkMode ? '#000' : '#fff',
          color: darkMode ? '#fff' : '#000',
          cursor: isLocating ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'all 0.2s',
          opacity: isLocating ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isLocating) {
            e.currentTarget.style.borderColor = darkMode ? '#fff' : '#000';
            e.currentTarget.style.backgroundColor = darkMode ? '#1a1a1a' : '#f5f5f5';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = darkMode ? '#404040' : '#d4d4d4';
          e.currentTarget.style.backgroundColor = darkMode ? '#000' : '#fff';
        }}
        title="定位到我的位置"
      >
        <Locate size={18} className={isLocating ? 'animate-pulse' : ''} />
      </button>
    </div>

    {/* Route Selector */}
    {onRouteSelect && (
      <RouteSelector
        points={points}
        selectedRoute={selectedRoute || null}
        onRouteSelect={onRouteSelect}
        darkMode={darkMode}
        viewportBounds={viewportBounds}
      />
    )}
  </div>
  );
}
