import type { Alert, GeocodedLocation, RiskCategory, UserReport } from './types';

interface ApiListResponse<T> {
  data: T[];
}

const api = {
  async health(): Promise<{ ok: boolean; service: string; timestamp: string }> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async geocode(query: string): Promise<GeocodedLocation> {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      throw new Error('Adresse introuvable');
    }
    return res.json();
  },

  async getAlerts(lat: number, lng: number): Promise<Alert[]> {
    const res = await fetch(`/api/alerts?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error('Impossible de charger les alertes');
    const payload = (await res.json()) as ApiListResponse<Alert>;
    return payload.data;
  },

  async getReports(): Promise<UserReport[]> {
    const res = await fetch('/api/reports');
    if (!res.ok) throw new Error('Impossible de charger les signalements');
    const payload = (await res.json()) as ApiListResponse<UserReport>;
    return payload.data;
  },

  async createReport(input: {
    category: RiskCategory;
    description: string;
    reporter?: string;
    location: { lat: number; lng: number; name: string };
  }): Promise<UserReport> {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!res.ok) {
      throw new Error('Impossible de créer le signalement');
    }

    const payload = (await res.json()) as { data: UserReport };
    return payload.data;
  },

  async deleteReport(id: string): Promise<void> {
    const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Suppression impossible');
  }
};

export default api;
