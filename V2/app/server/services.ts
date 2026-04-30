import type { Alert } from './types.js';

const BORDEAUX_DEFAULT = { lat: 44.8378, lng: -0.5792 };

function nowIso(): string {
  return new Date().toISOString();
}

function clampLevel(value: number, thresholds: { medium: number; high: number; critical: number }): Alert['level'] {
  if (value >= thresholds.critical) {
    return 'critical';
  }
  if (value >= thresholds.high) {
    return 'high';
  }
  if (value >= thresholds.medium) {
    return 'medium';
  }
  return 'low';
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchText(url: string, headers?: Record<string, string>): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) {
      return null;
    }
    return response.text();
  } catch {
    return null;
  }
}

export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  if (!query.trim()) {
    return null;
  }

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'phario-v2/2.0'
    }
  });

  if (!response.ok) {
    return null;
  }

  const items = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!items.length) {
    return null;
  }

  return {
    lat: Number(items[0].lat),
    lng: Number(items[0].lon),
    label: items[0].display_name
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ label: string } | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'phario-v2/2.0'
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { display_name?: string };
  return { label: data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
}

export async function fetchIndustrialRisks(lat: number, lng: number, rayon = 5000, pageSize = 8): Promise<Alert[]> {
  const url = `https://www.georisques.gouv.fr/api/v1/etablissements_industriels?lat=${lat}&lng=${lng}&rayon=${rayon}&page=1&page_size=${pageSize}`;
  const response = await fetch(url);

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { data?: Array<Record<string, unknown>> };
  const list = Array.isArray(payload.data) ? payload.data : [];

  return list
    .map((item, index): Alert | null => {
      const itemLat = Number(item.lat);
      const itemLng = Number(item.lng);
      if (!Number.isFinite(itemLat) || !Number.isFinite(itemLng)) {
        return null;
      }

      const severo = String(item.seveso ?? '').toUpperCase();
      const level = severo === 'H' ? 'critical' : 'high';
      const name = String(item.nom_etablissement ?? 'Site industriel');
      const city = String(item.commune ?? 'Agglomération bordelaise');
      const activity = String(item.libelle_activite_principale ?? 'Activité non renseignée');

      return {
        id: `industrial-${String(item.code_s3ic ?? index)}`,
        category: 'industrial',
        level,
        title: `Site SEVESO: ${name}`,
        description: `${severo === 'H' ? 'Seuil Haut' : 'Seuil Bas'} - ${activity}`,
        location: {
          lat: itemLat,
          lng: itemLng,
          name: city
        },
        timestamp: nowIso(),
        source: 'GéoRisques'
      };
    })
    .filter((item): item is Alert => item !== null);
}

export async function fetchWeatherAlerts(lat: number, lng: number): Promise<Alert[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,wind_speed_10m,weather_code`;
  const response = await fetch(url);

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      wind_speed_10m?: number;
      weather_code?: number;
    };
  };

  const current = payload.current;
  if (!current) {
    return [];
  }

  const alerts: Alert[] = [];
  const temp = Number(current.temperature_2m ?? 0);
  const wind = Number(current.wind_speed_10m ?? 0);
  const weatherCode = Number(current.weather_code ?? 0);

  if (temp >= 35) {
    alerts.push({
      id: 'weather-heat',
      category: 'weather',
      level: 'high',
      title: 'Canicule en cours',
      description: `Température mesurée ${temp.toFixed(1)}°C, hydratez-vous et évitez les sorties prolongées.`,
      location: {
        lat,
        lng,
        name: 'Bordeaux Métropole'
      },
      timestamp: nowIso(),
      source: 'Open-Meteo'
    });
  }

  if (wind >= 70) {
    alerts.push({
      id: 'weather-wind',
      category: 'weather',
      level: 'medium',
      title: 'Vent fort localisé',
      description: `Rafales estimées à ${wind.toFixed(1)} km/h. Limitez les déplacements non essentiels.`,
      location: {
        lat,
        lng,
        name: 'Bordeaux Métropole'
      },
      timestamp: nowIso(),
      source: 'Open-Meteo'
    });
  }

  if ([95, 96, 99].includes(weatherCode)) {
    alerts.push({
      id: 'weather-thunderstorm',
      category: 'storm',
      level: 'high',
      title: 'Orages intenses detectes',
      description: 'Risque d orages violents en cours selon les observations meteo en temps reel.',
      location: {
        lat,
        lng,
        name: 'Bordeaux Métropole'
      },
      timestamp: nowIso(),
      source: 'Open-Meteo'
    });
  }

  return alerts;
}

export async function fetchUsgsEarthquakes(lat: number, lng: number, radiusKm = 500): Promise<Alert[]> {
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${encodeURIComponent(startTime)}&latitude=${lat}&longitude=${lng}&maxradiuskm=${radiusKm}&minmagnitude=2.5`;
  const payload = await fetchJson<{
    features?: Array<{
      id?: string;
      properties?: { mag?: number; place?: string; time?: number };
      geometry?: { coordinates?: number[] };
    }>;
  }>(url);

  const features = payload?.features ?? [];
  return features
    .map((feature, index): Alert | null => {
      const coords = feature.geometry?.coordinates;
      const lon = Number(coords?.[0]);
      const la = Number(coords?.[1]);
      const depth = Number(coords?.[2] ?? 0);
      if (!Number.isFinite(la) || !Number.isFinite(lon)) {
        return null;
      }

      const magnitude = Number(feature.properties?.mag ?? 0);
      const level = clampLevel(magnitude, { medium: 3, high: 4.5, critical: 6 });
      const place = String(feature.properties?.place ?? 'Zone sismique');
      const eventTime = Number(feature.properties?.time ?? Date.now());

      return {
        id: `usgs-${feature.id ?? index}`,
        category: 'quake',
        level,
        title: `Seisme M${magnitude.toFixed(1)}`,
        description: `${place}. Profondeur ${depth.toFixed(1)} km.`,
        location: {
          lat: la,
          lng: lon,
          name: place
        },
        timestamp: new Date(eventTime).toISOString(),
        source: 'USGS Earthquake API'
      };
    })
    .filter((item): item is Alert => item !== null);
}

export async function fetchNasaEonetEvents(lat: number, lng: number, radiusKm = 1500): Promise<Alert[]> {
  const payload = await fetchJson<{
    events?: Array<{
      id?: string;
      title?: string;
      categories?: Array<{ id?: string; title?: string }>;
      geometry?: Array<{ date?: string; coordinates?: number[] }>;
    }>;
  }>('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=300');

  const events = payload?.events ?? [];
  return events
    .map((event, index): Alert | null => {
      const latest = event.geometry?.[event.geometry.length - 1];
      const lon = Number(latest?.coordinates?.[0]);
      const la = Number(latest?.coordinates?.[1]);
      if (!Number.isFinite(la) || !Number.isFinite(lon)) {
        return null;
      }

      const dist = distanceKm(lat, lng, la, lon);
      if (dist > radiusKm) {
        return null;
      }

      const catTitle = String(event.categories?.[0]?.title ?? '').toLowerCase();
      const category: Alert['category'] =
        catTitle.includes('wildfire') ? 'fire' :
        catTitle.includes('flood') ? 'flood' :
        catTitle.includes('storm') ? 'storm' :
        catTitle.includes('volcano') ? 'volcano' :
        catTitle.includes('earthquake') ? 'quake' :
        'other';

      return {
        id: `eonet-${event.id ?? index}`,
        category,
        level: dist < 150 ? 'high' : 'medium',
        title: event.title ?? 'Evenement naturel actif',
        description: `Evenement detecte par la NASA EONET a ${Math.round(dist)} km de la position recherchee.`,
        location: {
          lat: la,
          lng: lon,
          name: event.title ?? 'Evenement EONET'
        },
        timestamp: latest?.date ?? nowIso(),
        source: 'NASA EONET'
      };
    })
    .filter((item): item is Alert => item !== null);
}

export async function fetchNoaaStorms(): Promise<Alert[]> {
  const payload = await fetchJson<{
    activeStorms?: Array<{ id?: string; name?: string; lat?: number; lon?: number; movement?: string; pressure?: number }>;
  }>('https://www.nhc.noaa.gov/CurrentStorms.json');

  const storms = payload?.activeStorms ?? [];
  return storms
    .map((storm, index): Alert | null => {
      const la = Number(storm.lat);
      const lon = Number(storm.lon);
      if (!Number.isFinite(la) || !Number.isFinite(lon)) {
        return null;
      }

      return {
        id: `noaa-${storm.id ?? index}`,
        category: 'storm',
        level: 'high',
        title: `Tempete active: ${storm.name ?? 'Sans nom'}`,
        description: `Systeme cyclonique suivi en temps reel. Mouvement: ${storm.movement ?? 'N/A'}. Pression: ${storm.pressure ?? 'N/A'}.`,
        location: {
          lat: la,
          lng: lon,
          name: storm.name ?? 'Tempete NOAA'
        },
        timestamp: nowIso(),
        source: 'NOAA / NHC'
      };
    })
    .filter((item): item is Alert => item !== null);
}

export async function fetchNasaFirms(lat: number, lng: number, radiusKm = 400): Promise<Alert[]> {
  const apiKey = process.env.NASA_FIRMS_API_KEY;
  if (!apiKey) {
    return [];
  }

  const csvUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/VIIRS_SNPP_NRT/world/1`;
  const text = await fetchText(csvUrl);
  if (!text) {
    return [];
  }

  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((x) => x.trim().toLowerCase());
  const latIdx = headers.indexOf('latitude');
  const lonIdx = headers.indexOf('longitude');
  const brightIdx = headers.indexOf('bright_ti4');
  const dateIdx = headers.indexOf('acq_date');
  const timeIdx = headers.indexOf('acq_time');

  if (latIdx < 0 || lonIdx < 0) {
    return [];
  }

  const alerts: Alert[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',');
    const la = Number(cols[latIdx]);
    const lo = Number(cols[lonIdx]);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) {
      continue;
    }

    const dist = distanceKm(lat, lng, la, lo);
    if (dist > radiusKm) {
      continue;
    }

    const bright = Number(cols[brightIdx] ?? 0);
    const level = clampLevel(bright, { medium: 320, high: 340, critical: 360 });
    const acqDate = cols[dateIdx] ?? '';
    const acqTime = cols[timeIdx] ?? '';

    alerts.push({
      id: `firms-${i}`,
      category: 'fire',
      level,
      title: 'Point chaud detecte',
      description: `Detection satellite proche (${Math.round(dist)} km). Intensite thermique: ${Number.isFinite(bright) ? bright.toFixed(1) : 'N/A'}.`,
      location: {
        lat: la,
        lng: lo,
        name: 'Detection NASA FIRMS'
      },
      timestamp: acqDate ? `${acqDate}T${String(acqTime).padStart(4, '0').slice(0, 2)}:${String(acqTime).padStart(4, '0').slice(2)}:00.000Z` : nowIso(),
      source: 'NASA FIRMS'
    });
  }

  return alerts.slice(0, 40);
}

export async function fetchGdacsEvents(lat: number, lng: number, radiusKm = 4000): Promise<Alert[]> {
  const xml = await fetchText('https://www.gdacs.org/xml/rss.xml');
  if (!xml) {
    return [];
  }

  const items = xml.split('<item>').slice(1);
  const alerts: Alert[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i);
    const latMatch = item.match(/<geo:lat>(.*?)<\/geo:lat>/i);
    const lonMatch = item.match(/<geo:long>(.*?)<\/geo:long>/i);
    const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i);
    if (!latMatch || !lonMatch || !titleMatch) {
      continue;
    }

    const la = Number(latMatch[1]);
    const lo = Number(lonMatch[1]);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) {
      continue;
    }

    const dist = distanceKm(lat, lng, la, lo);
    if (dist > radiusKm) {
      continue;
    }

    const title = titleMatch[1];
    const low = title.toLowerCase();
    const category: Alert['category'] =
      low.includes('earthquake') ? 'quake' :
      low.includes('flood') ? 'flood' :
      low.includes('cyclone') || low.includes('storm') ? 'storm' :
      low.includes('volcano') ? 'volcano' :
      'other';

    alerts.push({
      id: `gdacs-${i}`,
      category,
      level: dist < 800 ? 'high' : 'medium',
      title,
      description: `Evenement global GDACS a ${Math.round(dist)} km de la zone ciblee.`,
      location: {
        lat: la,
        lng: lo,
        name: 'Alerte GDACS'
      },
      timestamp: dateMatch ? new Date(dateMatch[1]).toISOString() : nowIso(),
      source: 'GDACS'
    });
  }

  return alerts.slice(0, 30);
}

export async function fetchPotentialLocalRisks(lat: number, lng: number): Promise<Alert[]> {
  const industrial = await fetchIndustrialRisks(lat, lng, 10000, 12);
  const radonHint: Alert = {
    id: 'potential-radon',
    category: 'radiation',
    level: 'low',
    title: 'Potentiel radon a verifier',
    description: 'Verifier le potentiel radon communal via Georisques pour completer l analyse locale.',
    location: {
      lat,
      lng,
      name: 'Zone de residence'
    },
    timestamp: nowIso(),
    source: 'GéoRisques (potentiel)'
  };

  return [...industrial, radonHint];
}

export async function fetchOptionalExternalFeeds(_lat: number, _lng: number): Promise<Alert[]> {
  // Connecteurs optionnels: Vigicrues, Vigicrues Flash, APIC, EFFIS, EFAS, IRSN, EURDEP, BRGM.
  // Ils peuvent etre branches via endpoint custom sans casser l application.
  const urls = [
    { key: 'VIGICRUES_API_URL', source: 'Vigicrues' },
    { key: 'VIGICRUES_FLASH_API_URL', source: 'Vigicrues Flash' },
    { key: 'APIC_API_URL', source: 'APIC Météo-France' },
    { key: 'METEO_VIGILANCE_API_URL', source: 'Météo-France Vigilance' },
    { key: 'EFFIS_API_URL', source: 'Copernicus EFFIS' },
    { key: 'EFAS_API_URL', source: 'Copernicus EFAS' },
    { key: 'IRSN_API_URL', source: 'IRSN' },
    { key: 'EURDEP_API_URL', source: 'EURDEP' },
    { key: 'BRGM_API_URL', source: 'BRGM datasets' }
  ];

  const all: Alert[] = [];

  for (const item of urls) {
    const url = process.env[item.key];
    if (!url) {
      continue;
    }

    const payload = await fetchJson<{
      data?: Array<{
        id?: string;
        title?: string;
        description?: string;
        lat?: number;
        lng?: number;
        level?: Alert['level'];
        category?: Alert['category'];
        timestamp?: string;
      }>;
    }>(url);

    const list = payload?.data ?? [];
    for (let i = 0; i < list.length; i += 1) {
      const row = list[i];
      const la = Number(row.lat);
      const lo = Number(row.lng);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        continue;
      }

      all.push({
        id: `${item.source}-${row.id ?? i}`,
        category: row.category ?? 'other',
        level: row.level ?? 'medium',
        title: row.title ?? `Alerte ${item.source}`,
        description: row.description ?? `Signal recu depuis ${item.source}.`,
        location: {
          lat: la,
          lng: lo,
          name: item.source
        },
        timestamp: row.timestamp ?? nowIso(),
        source: item.source
      });
    }
  }

  return all;
}
