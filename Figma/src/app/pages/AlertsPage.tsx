import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Clock, MapPin, ChevronRight } from 'lucide-react';
import { RiskBadge } from '../components/RiskBadge';
import { getCurrentPosition, GeoLocation } from '../services/geolocation';
import { getAlertsByLocation, Alert, getAlertIcon } from '../services/mockData';

export default function AlertsPage() {
  const navigate = useNavigate();
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'danger' | 'warning' | 'safe'>('all');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const pos = await getCurrentPosition();
    setLocation(pos);
    const alertsData = getAlertsByLocation(pos.lat, pos.lon);
    setAlerts(alertsData);
  }

  const filteredAlerts = alerts.filter((alert) =>
    filter === 'all' ? true : alert.level === filter
  );

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center">
          <AlertTriangle className="w-7 h-7 mr-2" />
          Alertes en cours
        </h1>

        {/* Filtres */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Toutes ({alerts.length})
          </button>
          <button
            onClick={() => setFilter('danger')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === 'danger'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Danger ({alerts.filter((a) => a.level === 'danger').length})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === 'warning'
                ? 'bg-amber-600 text-gray-900'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Vigilance ({alerts.filter((a) => a.level === 'warning').length})
          </button>
          <button
            onClick={() => setFilter('safe')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
              filter === 'safe'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Sécurisés ({alerts.filter((a) => a.level === 'safe').length})
          </button>
        </div>
      </div>

      {/* Liste des alertes */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">✓</div>
            <p className="text-gray-400">Aucune alerte dans cette catégorie</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition-all cursor-pointer shadow-lg"
              onClick={() => navigate('/consignes', { state: { alertType: alert.type } })}
            >
              {/* En-tête de l'alerte */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center flex-1">
                  <span className="text-4xl mr-3">{getAlertIcon(alert.type)}</span>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-1">{alert.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-400">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {alert.time}
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-1" />
                        {alert.distance > 0 ? `${alert.distance} km` : 'Ici'}
                      </div>
                    </div>
                  </div>
                </div>
                <RiskBadge level={alert.level} size="md" />
              </div>

              {/* Description */}
              <p className="text-gray-300 mb-3">{alert.description}</p>

              {/* Bouton d'action */}
              <div className="flex items-center justify-end text-blue-400 font-medium">
                <span>Voir les consignes</span>
                <ChevronRight className="w-5 h-5 ml-1" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message d'info en bas */}
      {filteredAlerts.length > 0 && (
        <div className="mt-6 bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-sm text-gray-300">
            💡 <strong>Conseil :</strong> Cliquez sur une alerte pour consulter les
            consignes de sécurité adaptées.
          </p>
        </div>
      )}
    </div>
  );
}
