import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { MapPin, Navigation, AlertTriangle } from 'lucide-react';
import { RiskBadge } from '../components/RiskBadge';
import { getCurrentPosition, GeoLocation } from '../services/geolocation';
import {
  getAlertsByLocation,
  getOverallRiskLevel,
  Alert,
  RiskLevel,
} from '../services/mockData';

export default function StatusPage() {
  const navigate = useNavigate();
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('safe');

  useEffect(() => {
    loadLocation();
  }, []);

  async function loadLocation() {
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      setLocation(pos);
      
      // Charger les alertes pour cette position
      const alertsData = getAlertsByLocation(pos.lat, pos.lon);
      setAlerts(alertsData);
      setRiskLevel(getOverallRiskLevel(alertsData));
    } catch (error) {
      console.error('Erreur géolocalisation:', error);
    } finally {
      setLoading(false);
    }
  }

  const riskMessages = {
    safe: {
      title: 'Aucun risque détecté',
      message: 'Votre zone est sécurisée',
      emoji: '✓',
    },
    warning: {
      title: 'Vigilance requise',
      message: 'Risques modérés détectés',
      emoji: '⚠️',
    },
    danger: {
      title: 'Alerte danger !',
      message: 'Action immédiate requise',
      emoji: '🚨',
    },
  };

  const riskColors = {
    safe: 'from-green-600 to-green-700',
    warning: 'from-amber-600 to-amber-700',
    danger: 'from-red-600 to-red-700',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Navigation className="w-12 h-12 text-blue-400 animate-pulse mx-auto mb-4" />
          <p className="text-gray-300">Localisation en cours...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* En-tête avec position */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">RiskAlert</h1>
          <button
            onClick={loadLocation}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            aria-label="Actualiser position"
          >
            <Navigation className="w-5 h-5 text-gray-300" />
          </button>
        </div>
        
        {location && (
          <div className="flex items-center text-sm text-gray-400">
            <MapPin className="w-4 h-4 mr-1" />
            <span>
              {location.lat.toFixed(4)}°N, {location.lon.toFixed(4)}°E
            </span>
          </div>
        )}
      </div>

      {/* Carte de statut principale */}
      <div
        className={`rounded-2xl p-6 mb-6 bg-gradient-to-br ${riskColors[riskLevel]} shadow-xl`}
      >
        <div className="text-center">
          <div className="text-6xl mb-4">{riskMessages[riskLevel].emoji}</div>
          <h2 className="text-3xl font-bold mb-2">
            {riskMessages[riskLevel].title}
          </h2>
          <p className="text-lg opacity-90 mb-4">
            {riskMessages[riskLevel].message}
          </p>
          <RiskBadge level={riskLevel} size="lg" />
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400">
            {alerts.filter((a) => a.level === 'danger').length}
          </div>
          <div className="text-xs text-gray-400 mt-1">Dangers</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {alerts.filter((a) => a.level === 'warning').length}
          </div>
          <div className="text-xs text-gray-400 mt-1">Vigilances</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-400">
            {alerts.filter((a) => a.level === 'safe').length}
          </div>
          <div className="text-xs text-gray-400 mt-1">Sécurisés</div>
        </div>
      </div>

      {/* Alertes récentes */}
      {alerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            Alertes à proximité
          </h3>
          <div className="space-y-3">
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
                onClick={() => navigate('/alertes')}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-2xl mr-2">
                      {alert.type === 'flood' && '🌊'}
                      {alert.type === 'heatwave' && '🌡️'}
                      {alert.type === 'seveso' && '⚠️'}
                    </span>
                    <div>
                      <div className="font-semibold">{alert.title}</div>
                      <div className="text-sm text-gray-400">
                        {alert.distance > 0
                          ? `${alert.distance} km`
                          : 'Dans votre zone'}
                      </div>
                    </div>
                  </div>
                  <RiskBadge level={alert.level} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Boutons d'action */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/alertes')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors text-lg"
        >
          Voir toutes les alertes
        </button>
        
        <button
          onClick={() => navigate('/consignes')}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-4 rounded-xl transition-colors"
        >
          Consignes de sécurité
        </button>
      </div>
    </div>
  );
}
