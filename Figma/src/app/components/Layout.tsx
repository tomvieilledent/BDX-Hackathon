import { Outlet, useLocation, useNavigate } from 'react-router';
import { MapPin, Bell, FileText, CheckSquare } from 'lucide-react';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: MapPin, label: 'Statut' },
    { path: '/alertes', icon: Bell, label: 'Alertes' },
    { path: '/consignes', icon: FileText, label: 'Consignes' },
    { path: '/checklist', icon: CheckSquare, label: 'Checklist' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col max-w-[430px] mx-auto">
      {/* Contenu principal avec padding pour la navigation en bas */}
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>

      {/* Navigation en bas (fixe) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 max-w-[430px] mx-auto">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive
                    ? 'text-blue-400 bg-gray-700/50'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
