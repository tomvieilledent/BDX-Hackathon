import { useState, useEffect } from 'react';
import { CheckSquare, Package, Home, Users, MapIcon } from 'lucide-react';
import { Map } from '../components/Map';
import {
  getChecklistItems,
  getShelters,
  ChecklistItem,
  Shelter,
} from '../services/mockData';
import { getCurrentPosition, GeoLocation } from '../services/geolocation';

export default function ChecklistPage() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const checklistData = getChecklistItems();
    setItems(checklistData);

    const pos = await getCurrentPosition();
    setLocation(pos);
    
    const sheltersData = getShelters(pos.lat, pos.lon);
    setShelters(sheltersData);
  }

  function toggleItem(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  }

  const categories = [
    { key: 'immediate', label: 'Immédiat', icon: AlertCircle, color: 'text-red-400' },
    { key: 'preparation', label: 'Préparation', icon: Package, color: 'text-amber-400' },
    { key: 'evacuation', label: 'Évacuation', icon: Home, color: 'text-blue-400' },
  ] as const;

  const getItemsByCategory = (category: string) =>
    items.filter((item) => item.category === category);

  const totalItems = items.length;
  const checkedItems = items.filter((item) => item.checked).length;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-900 p-4">
      {/* En-tête */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4 flex items-center">
          <CheckSquare className="w-7 h-7 mr-2" />
          Checklist d'urgence
        </h1>

        {/* Barre de progression */}
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Progression</span>
            <span className="font-semibold">
              {checkedItems} / {totalItems}
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Toggle Carte */}
      <div className="mb-6">
        <button
          onClick={() => setShowMap(!showMap)}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <MapIcon className="w-5 h-5" />
          {showMap ? 'Masquer la carte' : 'Voir la carte des refuges'}
        </button>
      </div>

      {/* Carte des refuges */}
      {showMap && location && (
        <div className="mb-6 bg-gray-800 rounded-xl p-4">
          <h3 className="font-semibold mb-3 flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Refuges à proximité
          </h3>
          <div className="h-[300px] rounded-lg overflow-hidden mb-4">
            <Map
              center={[location.lat, location.lon]}
              shelters={shelters}
              userLocation={[location.lat, location.lon]}
            />
          </div>
          
          {/* Liste des refuges */}
          <div className="space-y-2">
            {shelters.map((shelter) => (
              <div
                key={shelter.id}
                className="bg-gray-900 rounded-lg p-3 flex items-start justify-between"
              >
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    🏠 {shelter.name}
                  </div>
                  <div className="text-sm text-gray-400">{shelter.address}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Capacité: {shelter.capacity} pers.
                  </div>
                </div>
                <div>
                  {shelter.available ? (
                    <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                      Disponible
                    </span>
                  ) : (
                    <span className="text-xs bg-red-500 text-white px-2 py-1 rounded-full">
                      Complet
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checklist par catégorie */}
      <div className="space-y-6">
        {categories.map((category) => {
          const categoryItems = getItemsByCategory(category.key);
          const Icon = category.icon;
          const checkedCount = categoryItems.filter((item) => item.checked).length;

          return (
            <div key={category.key}>
              <div className={`flex items-center mb-3 ${category.color}`}>
                <Icon className="w-5 h-5 mr-2" />
                <h3 className="font-semibold text-lg uppercase tracking-wide">
                  {category.label}
                </h3>
                <span className="ml-auto text-sm">
                  {checkedCount} / {categoryItems.length}
                </span>
              </div>

              <div className="space-y-2">
                {categoryItems.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center bg-gray-800 rounded-xl p-4 cursor-pointer transition-all hover:bg-gray-750 ${
                      item.checked ? 'opacity-60' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItem(item.id)}
                      className="w-6 h-6 rounded border-2 border-gray-600 bg-gray-700 checked:bg-blue-600 checked:border-blue-600 cursor-pointer mr-4"
                    />
                    <span
                      className={`flex-1 ${
                        item.checked
                          ? 'line-through text-gray-500'
                          : 'text-gray-200'
                      }`}
                    >
                      {item.text}
                    </span>
                    {item.checked && (
                      <span className="text-green-400 text-xl">✓</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Message de félicitations */}
      {progress === 100 && (
        <div className="mt-6 bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-5 text-center shadow-xl">
          <div className="text-5xl mb-2">🎉</div>
          <h3 className="text-xl font-bold mb-1">Bien préparé !</h3>
          <p className="text-white/90">
            Vous avez complété toute la checklist d'urgence
          </p>
        </div>
      )}
    </div>
  );
}

function AlertCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
