import { useEffect, useMemo, useState } from 'react';
import { Activity, MapPin, ShieldAlert, Siren, TriangleAlert } from 'lucide-react';
import api from './api';
import type { Alert, GeocodedLocation, RiskCategory, UserReport } from './types';
import { BORDEAUX_CENTER } from './constants';
import MapPanel from './components/MapPanel';
import AlertList from './components/AlertList';
import ReportsPanel from './components/ReportsPanel';
import PreparationPanel from './components/PreparationPanel';
import EmergencyPanel from './components/EmergencyPanel';

type Tab = 'dashboard' | 'reports' | 'preparation' | 'emergency';

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [center, setCenter] = useState<[number, number]>(BORDEAUX_CENTER);
  const [locationLabel, setLocationLabel] = useState('Bordeaux');
  const [query, setQuery] = useState('Bordeaux centre');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const criticalCount = useMemo(
    () => alerts.filter((alert) => alert.level === 'critical' || alert.level === 'high').length,
    [alerts]
  );

  async function refresh(lat: number, lng: number): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [nextAlerts, nextReports] = await Promise.all([api.getAlerts(lat, lng), api.getReports()]);
      setAlerts(nextAlerts);
      setReports(nextReports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(BORDEAUX_CENTER[0], BORDEAUX_CENTER[1]);
  }, []);

  const handleSearch = async (): Promise<void> => {
    try {
      const result: GeocodedLocation = await api.geocode(query);
      setCenter([result.lat, result.lng]);
      setLocationLabel(result.label);
      await refresh(result.lat, result.lng);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recherche impossible');
    }
  };

  const createReport = async (payload: {
    category: RiskCategory;
    description: string;
    reporter?: string;
  }): Promise<void> => {
    await api.createReport({
      ...payload,
      location: {
        lat: center[0],
        lng: center[1],
        name: locationLabel
      }
    });
    const nextReports = await api.getReports();
    setReports(nextReports);
    const nextAlerts = await api.getAlerts(center[0], center[1]);
    setAlerts(nextAlerts);
  };

  const deleteReport = async (id: string): Promise<void> => {
    await api.deleteReport(id);
    const nextReports = await api.getReports();
    setReports(nextReports);
    const nextAlerts = await api.getAlerts(center[0], center[1]);
    setAlerts(nextAlerts);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <ShieldAlert size={24} />
          <div>
            <h1>Phario V2</h1>
            <p>Plateforme de vigilance territoriale</p>
          </div>
        </div>

        <div className="search-box">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une adresse..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSearch();
              }
            }}
          />
          <button type="button" onClick={() => void handleSearch()}>
            <MapPin size={16} />
            Localiser
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>
          <Activity size={16} /> Dashboard
        </button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
          <TriangleAlert size={16} /> Signalements
        </button>
        <button className={tab === 'preparation' ? 'active' : ''} onClick={() => setTab('preparation')}>
          <ShieldAlert size={16} /> Preparation
        </button>
        <button className={tab === 'emergency' ? 'active' : ''} onClick={() => setTab('emergency')}>
          <Siren size={16} /> Urgence
        </button>
      </nav>

      <main className="content">
        {error ? <div className="error">{error}</div> : null}

        {tab === 'dashboard' ? (
          <>
            <section className="stats">
              <article>
                <h2>Position</h2>
                <p>{locationLabel}</p>
              </article>
              <article>
                <h2>Alertes actives</h2>
                <p>{alerts.length}</p>
              </article>
              <article>
                <h2>Critiques/hautes</h2>
                <p>{criticalCount}</p>
              </article>
              <article>
                <h2>Signalements</h2>
                <p>{reports.length}</p>
              </article>
            </section>

            <section className="grid-2">
              <MapPanel center={center} alerts={alerts} reports={reports} />
              <div className="panel">
                <h2>Flux des alertes</h2>
                {loading ? <div className="empty">Chargement en cours...</div> : <AlertList alerts={alerts} />}
              </div>
            </section>
          </>
        ) : null}

        {tab === 'reports' ? (
          <ReportsPanel reports={reports} onCreate={createReport} onDelete={deleteReport} />
        ) : null}

        {tab === 'preparation' ? <PreparationPanel /> : null}

        {tab === 'emergency' ? <EmergencyPanel /> : null}
      </main>
    </div>
  );
}
