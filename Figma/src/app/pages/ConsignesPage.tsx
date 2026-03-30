import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { getConsignesByAlertType, Consigne } from '../services/mockData';

export default function ConsignesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [alertType, setAlertType] = useState<string>('flood');
  const [consignes, setConsignes] = useState<Consigne[]>([]);

  useEffect(() => {
    // Récupérer le type d'alerte depuis la navigation
    const type = (location.state as any)?.alertType || 'flood';
    setAlertType(type);
    loadConsignes(type);
  }, [location]);

  function loadConsignes(type: string) {
    const data = getConsignesByAlertType(type);
    setConsignes(data);
  }

  const alertTypes = [
    { value: 'flood', label: 'Inondation', icon: '🌊' },
    { value: 'heatwave', label: 'Canicule', icon: '🌡️' },
    { value: 'seveso', label: 'SEVESO', icon: '⚠️' },
  ];

  const currentAlert = alertTypes.find((a) => a.value === alertType);

  // Séparer par priorité
  const highPriority = consignes.filter((c) => c.priority === 'high');
  const mediumPriority = consignes.filter((c) => c.priority === 'medium');

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center">
          <FileText className="w-7 h-7 mr-2" />
          Consignes de sécurité
        </h1>

        {/* Sélecteur de type d'alerte */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {alertTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => {
                setAlertType(type.value);
                loadConsignes(type.value);
              }}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 transition-colors ${
                alertType === type.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <span className="text-xl">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bandeau d'alerte */}
      {currentAlert && (
        <div className="mb-6 bg-gradient-to-r from-red-600 to-red-700 rounded-xl p-5 shadow-xl">
          <div className="flex items-center mb-2">
            <span className="text-4xl mr-3">{currentAlert.icon}</span>
            <h2 className="text-2xl font-bold">Alerte {currentAlert.label}</h2>
          </div>
          <p className="text-white/90">
            Suivez ces consignes pour assurer votre sécurité
          </p>
        </div>
      )}

      {/* Consignes prioritaires */}
      {highPriority.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center mb-3 text-red-400">
            <AlertCircle className="w-5 h-5 mr-2" />
            <h3 className="font-semibold text-lg uppercase tracking-wide">
              Actions immédiates
            </h3>
          </div>
          <div className="space-y-3">
            {highPriority.map((consigne) => (
              <div
                key={consigne.id}
                className="bg-red-900/30 border-2 border-red-500 rounded-xl p-4 hover:bg-red-900/40 transition-colors"
              >
                <div className="flex items-center">
                  <span className="text-3xl mr-3">{consigne.icon}</span>
                  <p className="text-lg text-white flex-1">{consigne.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consignes complémentaires */}
      {mediumPriority.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center mb-3 text-amber-400">
            <CheckCircle className="w-5 h-5 mr-2" />
            <h3 className="font-semibold text-lg uppercase tracking-wide">
              Recommandations
            </h3>
          </div>
          <div className="space-y-3">
            {mediumPriority.map((consigne) => (
              <div
                key={consigne.id}
                className="bg-gray-800 rounded-xl p-4 hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center">
                  <span className="text-3xl mr-3">{consigne.icon}</span>
                  <p className="text-base text-gray-200 flex-1">{consigne.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Numéros d'urgence */}
      <div className="mb-6 bg-gray-800 rounded-xl p-5">
        <h3 className="font-semibold mb-3 flex items-center">
          <span className="text-2xl mr-2">📞</span>
          Numéros d'urgence
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-300">Pompiers</span>
            <a
              href="tel:18"
              className="text-blue-400 font-semibold text-lg hover:text-blue-300"
            >
              18
            </a>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-300">SAMU</span>
            <a
              href="tel:15"
              className="text-blue-400 font-semibold text-lg hover:text-blue-300"
            >
              15
            </a>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-700">
            <span className="text-gray-300">Police / Gendarmerie</span>
            <a
              href="tel:17"
              className="text-blue-400 font-semibold text-lg hover:text-blue-300"
            >
              17
            </a>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-300">Urgence européenne</span>
            <a
              href="tel:112"
              className="text-blue-400 font-semibold text-lg hover:text-blue-300"
            >
              112
            </a>
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="space-y-3">
        <button
          onClick={() => navigate('/checklist')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors text-lg"
        >
          Voir la checklist d'urgence
        </button>
        
        <button
          onClick={() => navigate('/alertes')}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-4 rounded-xl transition-colors"
        >
          Retour aux alertes
        </button>
      </div>
    </div>
  );
}
