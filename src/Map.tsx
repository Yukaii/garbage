import { useEffect, useRef, useState } from 'react';
import Map, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl';
import type { CircleLayer, SymbolLayer } from 'maplibre-gl';
import type { TrashCollectionPoint } from './types';
import { formatTime } from './api';
import { Layers, Locate } from 'lucide-react';
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

  // Convert points to GeoJSON
  const geojson = {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
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
      },
    })),
  };

  // Cluster layer styles - monotone black/gray design
  const clusterLayer: CircleLayer = {
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
  };

  const clusterCountLayer: SymbolLayer = {
    id: 'cluster-count',
    type: 'symbol',
    source: 'trash-points',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': 14,
    },
    paint: {
      'text-color': '#ffffff',
    },
  };

  const unclusteredPointLayer: CircleLayer = {
    id: 'unclustered-point',
    type: 'circle',
    source: 'trash-points',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#1a1a1a',
      'circle-radius': 8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  };

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
      // Using a custom style that loads satellite imagery
      return {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          }
        },
        layers: [
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
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

      {popupInfo && (
        <Popup
          longitude={parseFloat(popupInfo.經度)}
          latitude={parseFloat(popupInfo.緯度)}
          anchor="bottom"
          onClose={() => setPopupInfo(null)}
          closeButton={true}
          closeOnClick={false}
        >
          <div style={{ minWidth: '200px', padding: '12px' }}>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: darkMode ? '#ffffff' : '#000000',
              borderBottom: `1px solid ${darkMode ? '#404040' : '#e5e5e5'}`,
              paddingBottom: '6px'
            }}>
              {popupInfo.行政區} - {popupInfo.里別}
            </h3>
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
            </p>
            <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#d4d4d4' : '#262626' }}>
              <strong style={{ color: darkMode ? '#ffffff' : '#000000' }}>離開:</strong> {formatTime(popupInfo.離開時間)}
            </p>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '11px',
              color: darkMode ? '#a3a3a3' : '#737373',
              borderTop: `1px solid ${darkMode ? '#404040' : '#e5e5e5'}`,
              paddingTop: '6px'
            }}>
              {popupInfo.分隊}
            </p>
          </div>
        </Popup>
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
