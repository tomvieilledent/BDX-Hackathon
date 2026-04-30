import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  fetchGdacsEvents,
  fetchNasaEonetEvents,
  fetchNasaFirms,
  fetchNoaaStorms,
  fetchOptionalExternalFeeds,
  fetchPotentialLocalRisks,
  fetchUsgsEarthquakes,
  fetchWeatherAlerts,
  geocodeAddress,
  reverseGeocode
} from './services.js';
import { readReports, writeReports } from './store.js';
import type { UserReport } from './types.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json());

const coordsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180)
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'phario-v2', timestamp: new Date().toISOString() });
});

app.get('/api/geocode', async (req, res) => {
  const query = String(req.query.q ?? '');
  const data = await geocodeAddress(query);
  if (!data) {
    return res.status(404).json({ error: 'Adresse introuvable' });
  }
  return res.json(data);
});

app.get('/api/reverse-geocode', async (req, res) => {
  const parsed = coordsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Coordonnées invalides' });
  }

  const data = await reverseGeocode(parsed.data.lat, parsed.data.lng);
  if (!data) {
    return res.status(404).json({ error: 'Aucune adresse trouvée' });
  }

  return res.json(data);
});

app.get('/api/risks/industrial', async (req, res) => {
  const parsed = coordsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Coordonnées invalides' });
  }

  const rayon = Number(req.query.rayon ?? 5000);
  const pageSize = Number(req.query.page_size ?? 8);
  const alerts = await fetchPotentialLocalRisks(parsed.data.lat, parsed.data.lng);
  const industrialOnly = alerts.filter((x) => x.category === 'industrial').slice(0, pageSize);
  return res.json({ data: industrialOnly });
});

app.get('/api/weather', async (req, res) => {
  const parsed = coordsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Coordonnées invalides' });
  }

  const alerts = await fetchWeatherAlerts(parsed.data.lat, parsed.data.lng);
  return res.json({ data: alerts });
});

app.get('/api/alerts', async (req, res) => {
  const parsed = coordsSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Coordonnées invalides' });
  }

  const [weather, usgs, eonet, gdacs, noaa, firms, potential, optionalFeeds] = await Promise.all([
    fetchWeatherAlerts(parsed.data.lat, parsed.data.lng),
    fetchUsgsEarthquakes(parsed.data.lat, parsed.data.lng),
    fetchNasaEonetEvents(parsed.data.lat, parsed.data.lng),
    fetchGdacsEvents(parsed.data.lat, parsed.data.lng),
    fetchNoaaStorms(),
    fetchNasaFirms(parsed.data.lat, parsed.data.lng),
    fetchPotentialLocalRisks(parsed.data.lat, parsed.data.lng),
    fetchOptionalExternalFeeds(parsed.data.lat, parsed.data.lng)
  ]);

  const reports = readReports().map((r) => ({
    id: `report-${r.id}`,
    category: r.category,
    level: 'medium' as const,
    title: `Signalement citoyen: ${r.category}`,
    description: r.description,
    location: r.location,
    timestamp: r.timestamp,
    source: 'Signalement utilisateur'
  }));

  const realtime = [...weather, ...usgs, ...eonet, ...gdacs, ...noaa, ...firms, ...optionalFeeds];
  const merged = [...realtime, ...potential, ...reports];

  // Dedupe by id and sort by timestamp desc
  const map = new Map<string, (typeof merged)[number]>();
  for (const alert of merged) {
    if (!map.has(alert.id)) {
      map.set(alert.id, alert);
    }
  }

  const data = Array.from(map.values()).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  return res.json({
    data,
    meta: {
      counts: {
        realtime: realtime.length,
        potential: potential.length,
        reports: reports.length,
        total: data.length
      }
    }
  });
});

app.get('/api/reports', (_req, res) => {
  const reports = readReports().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return res.json({ data: reports });
});

app.post('/api/reports', (req, res) => {
  const bodySchema = z.object({
    category: z.enum(['weather', 'fire', 'flood', 'industrial', 'other', 'quake', 'radiation', 'storm', 'volcano']),
    description: z.string().min(10).max(400),
    reporter: z.string().min(2).max(80).optional(),
    location: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      name: z.string().min(2).max(150)
    })
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload invalide', details: parsed.error.flatten() });
  }

  const reports = readReports();
  const report: UserReport = {
    id: crypto.randomUUID(),
    category: parsed.data.category,
    description: parsed.data.description,
    reporter: parsed.data.reporter ?? 'Citoyen anonyme',
    location: parsed.data.location,
    timestamp: new Date().toISOString()
  };

  reports.unshift(report);
  writeReports(reports.slice(0, 250));

  return res.status(201).json({ data: report });
});

app.delete('/api/reports/:id', (req, res) => {
  const id = String(req.params.id);
  const reports = readReports();
  const next = reports.filter((report) => report.id !== id);

  if (next.length === reports.length) {
    return res.status(404).json({ error: 'Signalement introuvable' });
  }

  writeReports(next);
  return res.status(204).send();
});

async function boot(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Phario V2 running on http://localhost:${PORT}`);
  });
}

boot().catch((error) => {
  console.error('Server boot failed:', error);
  process.exit(1);
});
