import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import type { TrashCollectionPoint } from './types';
import { formatTime } from './api';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
  points: TrashCollectionPoint[];
}

export default function Map({ points }: MapProps) {
  const [mapCenter] = useState<[number, number]>([25.0330, 121.5654]); // Taipei center
  const [mapZoom] = useState(12);

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((point) => {
          const lat = parseFloat(point.緯度);
          const lng = parseFloat(point.經度);

          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker key={point._id} position={[lat, lng]}>
              <Popup>
                <div style={{ minWidth: '200px' }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold' }}>
                    {point.行政區} - {point.里別}
                  </h3>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <strong>地點:</strong> {point.地點}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <strong>路線:</strong> {point.路線} ({point.車次})
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '14px' }}>
                    <strong>車號:</strong> {point.車號}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '14px', color: '#059669' }}>
                    <strong>到達:</strong> {formatTime(point.抵達時間)}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '14px', color: '#dc2626' }}>
                    <strong>離開:</strong> {formatTime(point.離開時間)}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '12px', color: '#6b7280' }}>
                    {point.分隊}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
