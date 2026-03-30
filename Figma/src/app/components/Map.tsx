import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Shelter } from '../services/mockData';

interface MapProps {
  center: [number, number];
  shelters: Shelter[];
  userLocation?: [number, number];
}

export function Map({ center, shelters, userLocation }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialiser la carte
    const map = L.map(mapRef.current).setView(center, 13);

    // Ajouter le fond de carte OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Nettoyer les marqueurs existants
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Ajouter la position de l'utilisateur
    if (userLocation) {
      const userIcon = L.divIcon({
        html: '<div style="background: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);"></div>',
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      L.marker(userLocation, { icon: userIcon })
        .addTo(map)
        .bindPopup('<strong>Vous êtes ici</strong>');
    }

    // Ajouter les refuges
    shelters.forEach((shelter) => {
      const color = shelter.available ? '#10b981' : '#ef4444';
      const shelterIcon = L.divIcon({
        html: `<div style="background: ${color}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">🏠</div>`,
        className: '',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      L.marker([shelter.lat, shelter.lon], { icon: shelterIcon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width: 150px;">
            <strong>${shelter.name}</strong><br/>
            ${shelter.address}<br/>
            <small>Capacité: ${shelter.capacity} pers.</small><br/>
            <small style="color: ${shelter.available ? '#10b981' : '#ef4444'};">
              ${shelter.available ? '✓ Disponible' : '✗ Complet'}
            </small>
          </div>
        `);
    });

    // Centrer la carte sur la position
    map.setView(center, 13);
  }, [center, shelters, userLocation]);

  return (
    <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />
  );
}
