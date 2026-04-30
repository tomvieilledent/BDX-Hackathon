import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Alert, UserReport } from '../types';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

interface MapPanelProps {
  center: [number, number];
  alerts: Alert[];
  reports: UserReport[];
}

export default function MapPanel({ center, alerts, reports }: MapPanelProps) {
  return (
    <div className="map-shell">
      <MapContainer className="map" center={center} zoom={12} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {alerts.map((alert) => (
          <Marker key={alert.id} position={[alert.location.lat, alert.location.lng]}>
            <Popup>
              <strong>{alert.title}</strong>
              <div>{alert.description}</div>
              <small>{alert.location.name}</small>
            </Popup>
          </Marker>
        ))}

        {reports.map((report) => (
          <Marker key={report.id} position={[report.location.lat, report.location.lng]}>
            <Popup>
              <strong>Signalement: {report.category}</strong>
              <div>{report.description}</div>
              <small>{report.reporter}</small>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
