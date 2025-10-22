import { useEffect, useRef, useState } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl';
import type { CircleLayer, SymbolLayer } from 'maplibre-gl';
import type { TrashCollectionPoint } from './types';
import { formatTime } from './api';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapComponentProps {
  points: TrashCollectionPoint[];
  darkMode: boolean;
}

export default function MapComponent({ points, darkMode }: MapComponentProps) {
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<TrashCollectionPoint | null>(null);

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

  const mapStyle = darkMode
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: 121.5654,
        latitude: 25.033,
        zoom: 11,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
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
              color: darkMode ? '#ffffff' : '#1a1a1a',
              borderBottom: `1px solid ${darkMode ? '#444444' : '#e5e5e5'}`,
              paddingBottom: '6px'
            }}>
              {popupInfo.行政區} - {popupInfo.里別}
            </h3>
            <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#cccccc' : '#333333' }}>
              <strong style={{ color: darkMode ? '#ffffff' : '#1a1a1a' }}>地點:</strong> {popupInfo.地點}
            </p>
            <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#cccccc' : '#333333' }}>
              <strong style={{ color: darkMode ? '#ffffff' : '#1a1a1a' }}>路線:</strong> {popupInfo.路線} ({popupInfo.車次})
            </p>
            <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#cccccc' : '#333333' }}>
              <strong style={{ color: darkMode ? '#ffffff' : '#1a1a1a' }}>車號:</strong> {popupInfo.車號}
            </p>
            <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#cccccc' : '#333333' }}>
              <strong style={{ color: darkMode ? '#ffffff' : '#1a1a1a' }}>到達:</strong> {formatTime(popupInfo.抵達時間)}
            </p>
            <p style={{ margin: '5px 0', fontSize: '12px', color: darkMode ? '#cccccc' : '#333333' }}>
              <strong style={{ color: darkMode ? '#ffffff' : '#1a1a1a' }}>離開:</strong> {formatTime(popupInfo.離開時間)}
            </p>
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '11px',
              color: darkMode ? '#aaaaaa' : '#666666',
              borderTop: `1px solid ${darkMode ? '#444444' : '#e5e5e5'}`,
              paddingTop: '6px'
            }}>
              {popupInfo.分隊}
            </p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
