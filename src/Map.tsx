import { useEffect, useRef, useState, useMemo } from 'react';
import Map, { Source, Layer, Popup, NavigationControl, Marker } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl';
import type { CircleLayer, SymbolLayer } from 'maplibre-gl';
import type { TrashCollectionPoint } from './types';
import {
  formatTime,
  getCurrentTimeInMinutes,
  getTimeStatus,
  getTimeDifferenceInMinutes,
  formatTimeDifference,
} from './api';
import { Layers, Locate, Navigation } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapComponentProps {
  points: TrashCollectionPoint[];
  darkMode: boolean;
}

type MapStyleType = 'street' | 'satellite';

export default function MapComponent({ points, darkMode }: MapComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<TrashCollectionPoint | null>(null);
  const [mapStyleType, setMapStyleType] = useState<MapStyleType>('street');
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState(getCurrentTimeInMinutes());

  useEffect(() => {
    // Update current time every minute for popup countdowns
    const interval = setInterval(() => {
      setCurrentTimeMinutes(getCurrentTimeInMinutes());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Convert points to GeoJSON with time status (memoized to prevent unnecessary re-renders)
  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: points.map((point) => {
      const timeStatus = getTimeStatus(point.抵達時間, point.離開時間, currentTimeMinutes);
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [parseFloat(point.經度), parseFloat(point.緯度)],
        },
        properties: {
          id: point._id,
          district: point.行政區,
          village: point.里別,
          location: point.地點,
          route: point.路線,
          trip: point.車次,
          vehicleNumber: point.車號,
          arrivalTime: point.抵達時間,
          departureTime: point.離開時間,
          squad: point.分隊,
          timeStatus: timeStatus,
        },
      };
    }),
  }), [points, currentTimeMinutes]);

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
      const point = points.find((p) => p._id === feature.properties.id);
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
          zoom: 15,
          duration: 1000,
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
      >
      <Source
        id="trash-points"
        type="geojson"
        data={geojson as any}
        cluster={true}
        clusterMaxZoom={14}
        clusterRadius={50}
      >
        <Layer {...clusterLayer} />
        <Layer {...clusterCountLayer} />
        <Layer {...unclusteredPointLayer} />
      </Source>

      {popupInfo && (() => {
        const timeStatus = getTimeStatus(popupInfo.抵達時間, popupInfo.離開時間, currentTimeMinutes);
        const timeDiff = getTimeDifferenceInMinutes(popupInfo.抵達時間, currentTimeMinutes);
        const statusColor = timeStatus === 'active' ? '#22c55e' : timeStatus === 'upcoming' ? '#eab308' : '#a3a3a3';
        const statusText = timeStatus === 'active' ? '營運中' : timeStatus === 'upcoming' ? '即將抵達' : '已結束';
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${popupInfo.緯度},${popupInfo.經度}`;

        return (
          <Popup
            longitude={parseFloat(popupInfo.經度)}
            latitude={parseFloat(popupInfo.緯度)}
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
                  {popupInfo.行政區} - {popupInfo.里別}
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
                <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>地點:</strong> {popupInfo.地點}
              </p>
              <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#d4d4d4' : '#262626' }}>
                <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>路線:</strong> {popupInfo.路線} ({popupInfo.車次})
              </p>
              <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#d4d4d4' : '#262626' }}>
                <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>車號:</strong> {popupInfo.車號}
              </p>
              <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#d4d4d4' : '#262626' }}>
                <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>到達:</strong> {formatTime(popupInfo.抵達時間)}
                {timeStatus === 'upcoming' && (
                  <span style={{ marginLeft: '6px', fontSize: '11px', color: statusColor, fontWeight: '500' }}>
                    ({formatTimeDifference(timeDiff)})
                  </span>
                )}
              </p>
              <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#d4d4d4' : '#262626' }}>
                <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>離開:</strong> {formatTime(popupInfo.離開時間)}
              </p>
              <p style={{
                margin: '8px 0 0 0',
                fontSize: '11px',
                color: darkMode ? '#a3a3a3' : '#737373',
                borderTop: `1px solid ${darkMode ? '#404040' : '#e5e5e5'}`,
                paddingTop: '6px',
                paddingBottom: '6px'
              }}>
                {popupInfo.分隊}
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

    {/* Map Controls Container */}
    <div style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 10,
    }}>
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
  </div>
  );
}
