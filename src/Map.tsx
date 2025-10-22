import { useEffect, useRef, useState } from 'react';
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl';
import type { CircleLayer, SymbolLayer } from 'maplibre-gl';
import type { TrashCollectionPoint } from './types';
import { formatTime } from './api';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapComponentProps {
  points: TrashCollectionPoint[];
}

export default function MapComponent({ points }: MapComponentProps) {
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

  // Cluster layer styles
  const clusterLayer: CircleLayer = {
    id: 'clusters',
    type: 'circle',
    source: 'trash-points',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#667eea', 10, '#764ba2', 30, '#5a3d7d'],
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
      'circle-color': '#10b981',
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

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: 121.5654,
        latitude: 25.033,
        zoom: 11,
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
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
          <div style={{ minWidth: '200px', padding: '8px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
              {popupInfo.行政區} - {popupInfo.里別}
            </h3>
            <p style={{ margin: '4px 0', fontSize: '12px' }}>
              <strong>地點:</strong> {popupInfo.地點}
            </p>
            <p style={{ margin: '4px 0', fontSize: '12px' }}>
              <strong>路線:</strong> {popupInfo.路線} ({popupInfo.車次})
            </p>
            <p style={{ margin: '4px 0', fontSize: '12px' }}>
              <strong>車號:</strong> {popupInfo.車號}
            </p>
            <p style={{ margin: '4px 0', fontSize: '12px', color: '#059669' }}>
              <strong>到達:</strong> {formatTime(popupInfo.抵達時間)}
            </p>
            <p style={{ margin: '4px 0', fontSize: '12px', color: '#dc2626' }}>
              <strong>離開:</strong> {formatTime(popupInfo.離開時間)}
            </p>
            <p style={{ margin: '4px 0', fontSize: '11px', color: '#6b7280' }}>
              {popupInfo.分隊}
            </p>
          </div>
        </Popup>
      )}
    </Map>
  );
}
