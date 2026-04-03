/**
 * BDX-Hackathon Frontend Application
 *
 * A web application for risk prevention and disaster management in Bordeaux.
 * Features include:
 * - Risk mapping and visualization
 * - Real-time alerts
 * - Emergency preparedness guides
 * - NASA FIRMS fire detection integration
 * - Interactive maps with Leaflet
 */

const API_BASE = localStorage.getItem('api_base') || 'http://127.0.0.1:7000';
const DEFAULT_LAT = 44.84;
const DEFAULT_LON = -0.58;
let homeMap = null;
let homeAlertMarkersLayer = null;
let homeNasaFiresLayer = null;
let homeLayersControl = null; // contrôle de couches Leaflet de la home
let homeFloodZonesLayer = null; // couche GeoJSON des zones potentiellement inondables

/**
 * Query selector shorthand.
 * Retrieves an HTML element by its ID.
 *
 * @param {string} id - The element's ID
 * @returns {HTMLElement|null} The element or null if not found
 */
function qs(id) {
  return document.getElementById(id);
}

/**
 * Retrieves the stored coordinates from local storage.
 * Falls back to default values if not set.
 *
 * @returns {Object} Object with lat and lon properties
 */
function getCoords() {
  const lat = Number(localStorage.getItem('lat') || DEFAULT_LAT);
  const lon = Number(localStorage.getItem('lon') || DEFAULT_LON);
  return { lat, lon };
}

/**
 * Stores coordinates in local storage for persistence.
 *
 * @param {number} lat - Latitude coordinate
 * @param {number} lon - Longitude coordinate
 */
function setCoords(lat, lon) {
  localStorage.setItem('lat', String(lat));
  localStorage.setItem('lon', String(lon));
}

/**
 * Checks if demonstration mode is currently enabled.
 *
 * @returns {boolean} True if demo mode is enabled, false otherwise
 */
function isDemoModeEnabled() {
  return localStorage.getItem('home_demo_mode') === '1';
}

/**
 * Enables or disables demonstration mode with simulated data.
 *
 * @param {boolean} enabled - Whether to enable demo mode
 */
function setDemoModeEnabled(enabled) {
  localStorage.setItem('home_demo_mode', enabled ? '1' : '0');
}

/**
 * Fetches data from the backend API.
 *
 * @async
 * @param {string} path - The API endpoint path (e.g., '/api/alerts')
 * @returns {Promise<Object>} The JSON response from the API
 * @throws {Error} If the HTTP response is not ok
 */
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return res.json();
}

/**
 * Returns CSS classes for styling alert severity levels.
 * Maps risk levels to Tailwind CSS color classes.
 *
 * @param {string} level - The alert level ('critique', 'élevé', or other)
 * @returns {string} CSS class string for styling
 */
function levelClass(level) {
  if (level === 'critique') return 'bg-red-700 text-white';
  if (level === 'élevé' || level === 'eleve') return 'bg-orange-600 text-white';
  return 'bg-yellow-400 text-veille-4';
}

/**
 * Normalizes a risk key by removing accents and converting to lowercase.
 * Used for consistent risk type matching across the application.
 *
 * @param {string|any} value - The value to normalize
 * @returns {string} Normalized key string
 */
function normalizeRiskKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Generates a link to the preparation page for a specific risk type.
 *
 * @param {string} riskType - The type of risk
 * @returns {string} URL link to the preparation page with risk type as query parameter
 */
function preparationLinkForRisk(riskType) {
  const safeType = encodeURIComponent(String(riskType || ''));
  return `preparation.html?risk=${safeType}`;
}

/**
 * Updates the visual label for the demo mode toggle button.
 * Currently maintains logo visibility without text changes.
 *
 * @param {HTMLElement|null} button - The toggle button element
 * @param {boolean} enabled - Whether demo mode is enabled
 */
function updateDemoToggleLabel(button, enabled) {
  if (!button) return;
}

/**
 * Extracts coordinates from various possible object property formats.
 * Handles multiple naming conventions (lat/latitude, lon/longitude, x/y).
 *
 * @param {Object} item - The object containing coordinate data
 * @returns {Object|null} Object with lat and lon properties, or null if not found
 */
function normalizeCoords(item) {
  const lat = Number(
    item.lat ?? item.latitude ?? item.y ?? item.coordonnees?.lat,
  );
  const lon = Number(
    item.lon ?? item.longitude ?? item.x ?? item.coordonnees?.lon,
  );
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }
  return null;
}

/**
 * Removes all NASA fire markers from the demo map.
 */
function clearDemoNasaFires() {
  if (homeNasaFiresLayer) {
    homeNasaFiresLayer.clearLayers();
  }
}

/**
 * Adds NASA FIRMS fire markers to the home map.
 * Attempts to fetch real fire data from the API; falls back to simulated fires.
 *
 * @async
 * @param {Object} center - Center point with lat and lon properties
 */
async function addDemoNasaFiresToMap(center) {
  if (!homeNasaFiresLayer) {
    homeNasaFiresLayer = L.layerGroup().addTo(homeMap);
  }
  homeNasaFiresLayer.clearLayers();

  // 1) Essayer de récupérer les feux réels via l'API backend NASA FIRMS
  let fires = [];
  try {
    const nasa = await apiGet(
      `/api/fires/nasa?lat=${center.lat}&lon=${center.lon}&radius_km=50&days=1`,
    );
    fires = Array.isArray(nasa.fires) ? nasa.fires : [];
  } catch (e) {
    // En cas d'erreur, on passera à la simulation ci-dessous
  }

  // 2) Si aucun feu réel, on génère 2 à 4 feux simulés autour du centre
  if (!fires.length) {
    // Pour la démo, on ne veut qu'un seul incendie simulé sur la carte
    const dLat = (Math.random() - 0.5) * 0.1; // ~quelques km
    const dLon = (Math.random() - 0.5) * 0.1;
    fires = [
      {
        latitude: center.lat + dLat,
        longitude: center.lon + dLon,
        _simulated: true,
      },
    ];
  }

  if (!fires.length) return;

  const fireIcon = L.divIcon({
    html: '<div style="background: #ef4444; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.35);">🔥</div>',
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  // Pour éviter de multiplier les icônes, on n'affiche qu'un seul feu (le premier)
  const fire = fires[0];
  const lat = Number(fire.latitude);
  const lon = Number(fire.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const isSimulated = Boolean(fire._simulated);
  let addressHtml = '';
  try {
    const info = await apiGet(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
    if (info) {
      // On privilégie l'adresse complète si disponible, sinon quartier/ville/code postal
      if (info.label) {
        addressHtml = `<br/>${info.label}`;
      } else {
        const parts = [];
        if (info.district) parts.push(info.district);
        if (info.postcode) parts.push(info.postcode);
        if (info.city) parts.push(info.city);
        if (parts.length) {
          addressHtml = `<br/>${parts.join(' ')}`;
        }
      }
    }
  } catch (e) {
    // En cas d'erreur, on affichera juste le texte de base
  }

  const popup =
    (isSimulated ? '🔥 Incendie simulé' : '🔥 Feu détecté (NASA FIRMS)') +
    addressHtml;

  L.marker([lat, lon], { icon: fireIcon })
    .addTo(homeNasaFiresLayer)
    .bindPopup(popup);
}

/**
 * Determines visual properties (emoji and CSS class) for an alert based on risk type.
 *
 * @param {string} type - The risk type
 * @returns {Object} Object with emoji and className properties
 */
function riskPingVisual(type) {
  if (key.includes('inond')) return { emoji: '🌊', className: 'ping-flood' };
  if (key.includes('incend') || key.includes('feu'))
    return { emoji: '🔥', className: 'ping-fire' };
  if (key.includes('canicule') || key.includes('chaleur'))
    return { emoji: '🌡️', className: 'ping-heat' };
  if (key.includes('tempete') || key.includes('vent') || key.includes('orage'))
    return { emoji: '🌪️', className: 'ping-storm' };
  if (key.includes('seisme') || key.includes('sism'))
    return { emoji: '🫨', className: 'ping-quake' };
  if (key.includes('industriel') || key.includes('chim'))
    return { emoji: '🏭', className: 'ping-industrial' };
  return { emoji: '⚠️', className: 'ping-default' };
}

/**
 * Renders alert markers on the home map with pulsing visual effects.
 * Creates circular markers with emojis positioned around alert locations.
 *
 * @param {Array<Object>} alerts - Array of alert objects with location data
 */
function renderAlertPingsOnMap(alerts) {
  if (!homeAlertMarkersLayer) {
    homeAlertMarkersLayer = L.layerGroup().addTo(homeMap);
  }
  homeAlertMarkersLayer.clearLayers();

  const alertsWithCoords = (Array.isArray(alerts) ? alerts : [])
    .map((alert, index) => {
      const coords = normalizeCoords(alert?.location || alert);
      if (!coords) return null;
      return { alert, coords, index };
    })
    .filter(Boolean);

  alertsWithCoords.forEach(({ alert, coords, index }) => {
    const visual = riskPingVisual(alert?.type);
    const angle = (index * 2 * Math.PI) / Math.max(alertsWithCoords.length, 1);
    const offset =
      index === 0
        ? { lat: 0, lon: 0 }
        : {
            lat: Math.sin(angle) * 0.003,
            lon: Math.cos(angle) * 0.003,
          };
    const marker = L.marker(
      [coords.lat + offset.lat, coords.lon + offset.lon],
      {
        icon: L.divIcon({
          className: '',
          html: `<div class="risk-ping ${visual.className}"><span>${visual.emoji}</span></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
      },
    );

    const title = alert?.titre || 'Alerte';
    const type = alert?.type || '-';
    const level = alert?.niveau || '-';
    const message = alert?.message || '';
    marker.bindPopup(
      `<strong>${title}</strong><br/>Type: ${type}<br/>Niveau: ${level}<br/>${message}`,
    );
    marker.addTo(homeAlertMarkersLayer);
  });
}

/**
 * Initializes and renders the home risk map.
 * Sets up Leaflet map with OSM tiles, markers, and flood zone overlays.
 * Loads risk data from the API and displays industrial sites.
 *
 * @async
 */
async function loadHomeMap() {
  if (!mapEl || typeof L === 'undefined') return;

  const status = qs('map-status');
  const { lat, lon } = getCoords();
  homeMap = L.map('home-map', {
    attributionControl: false,
    crs: L.CRS.EPSG3857,
  }).setView([lat, lon], 11);
  homeAlertMarkersLayer = L.layerGroup().addTo(homeMap);

  // Fond OSM nommé pour le contrôle de couches
  const osm = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '&copy; OpenStreetMap contributors',
    },
  ).addTo(homeMap);

  // Contrôle de couches (on commence avec juste le fond)
  homeLayersControl = L.control
    .layers({ OpenStreetMap: osm }, {})
    .addTo(homeMap);

  // Chargement des zones potentiellement inondables depuis un GeoJSON local
  // Fichier : Frontend/data/n_tri_bord_carte_risq_s_033.json
  try {
    const resp = await fetch('data/n_tri_bord_carte_risq_s_033.json');
    if (resp.ok) {
      const geojson = await resp.json();
      homeFloodZonesLayer = L.geoJSON(geojson, {
        style: () => ({
          color: 'transparent', // pas de contour visible
          weight: 0,
          fillColor: '#fb923c', // orange
          fillOpacity: 0.18, // beaucoup plus léger
        }),
      });
      // Ajoute la couche au contrôle pour avoir un ON/OFF "Zones inondables"
      homeLayersControl.addOverlay(homeFloodZonesLayer, 'Zones inondables');
    } else {
      console.warn(
        'Zones inondables GeoJSON introuvables sur la home (HTTP ' +
          resp.status +
          ').',
      );
    }
  } catch (e) {
    console.warn(
      'Erreur lors du chargement des zones inondables GeoJSON sur la home',
      e,
    );
  }

  try {
    const data = await apiGet(`/api/map?lat=${lat}&lon=${lon}&radius=20000`);
    const center = data.center || { lat, lon };
    const radius = Number(data.radius || 20000);

    homeMap.setView([center.lat, center.lon], 11);

    L.circle([center.lat, center.lon], {
      radius,
      color: '#0ea5e9',
      weight: 2,
      fillColor: '#38bdf8',
      fillOpacity: 0.12,
    }).addTo(homeMap);

    L.marker([center.lat, center.lon])
      .addTo(homeMap)
      .bindPopup('Centre de recherche');

    const incendies = Array.isArray(data.incendies) ? data.incendies : [];
    let markerCount = 0;
    incendies.forEach((site) => {
      const coords = normalizeCoords(site);
      if (!coords) return;
      markerCount += 1;
      const name = site.raisonSociale || 'Site industriel';
      L.marker([coords.lat, coords.lon]).addTo(homeMap).bindPopup(`🔥 ${name}`);
    });

    // En mode démo, ajouter aussi des feux NASA FIRMS (réels si dispo, sinon simulés)
    if (isDemoModeEnabled()) {
      // On ne montre pas systématiquement des incendies en démo :
      // par exemple ~60% de chances d'afficher des feux.
      if (Math.random() < 0.6) {
        await addDemoNasaFiresToMap(center);
      } else {
        clearDemoNasaFires();
      }
    } else {
      clearDemoNasaFires();
    }

    // Statut discret
    if (status) {
      status.textContent = '';
    }
  } catch (e) {
    if (status) status.textContent = `Erreur carte: ${e.message}`;
  }
}

/**
 * Main initialization function for the home page.
 * Sets up maps, alerts, demo mode toggle, and event listeners.
 * Fetches and displays current weather and risk alerts.
 *
 * @async
 */
async function loadHome() {
  if (!root) return;
  const mapSection = qs('home-map-section');

  const demoToggle = qs('home-demo-toggle');
  let demoMode = isDemoModeEnabled();
  updateDemoToggleLabel(demoToggle, demoMode);

  // Initialisation de la carte des risques (toujours visible, même sans alertes)
  if (mapSection) mapSection.classList.remove('hidden');
  await loadHomeMap();

  // Fetch alerts and show alert tiles if any
  const alertsSection = qs('alerts-home-section');
  const alertsContainer = qs('alerts-home-container');
  if (!alertsSection || !alertsContainer) return;

  const refreshHomeAlerts = async () => {
    try {
      const { lat, lon } = getCoords();
      const path = demoMode
        ? `/api/alerts/simulate?lat=${lat}&lon=${lon}&severity=danger&temp=39`
        : `/api/alerts?lat=${lat}&lon=${lon}`;
      console.log('[HOME DEBUG] Demo mode:', demoMode);
      console.log('[HOME DEBUG] Fetching alerts from:', path);
      const data = await apiGet(path);
      console.log('[HOME DEBUG] API response:', data);
      const fetchedAlerts = Array.isArray(data) ? data : [];
      let alerts = fetchedAlerts;

      // En mode démo, on enlève les incidents "Incendie" simulés
      // pour ne garder qu'une seule tuile personnalisée "Alerte Incendie".
      if (demoMode) {
        const filtered = fetchedAlerts.filter((a) => {
          const key = normalizeRiskKey(a?.type);
          return !(key.includes('incend') || key.includes('feu'));
        });
        alerts = [
          {
            type: 'Incendie',
            titre: 'Alerte Incendie',
            message: 'Alerte simulée Incendie - Niveau critique',
            niveau: 'critique',
            numero_urgence: '18',
            icone: '🔥',
          },
          ...filtered,
        ];
        console.log('[HOME DEBUG] Demo mode active. Final alerts:', alerts);
      }
      if (alerts.length) {
        console.log(
          '[HOME DEBUG] Showing alerts section. Count:',
          alerts.length,
        );
        // On affiche les pings sur la carte si des alertes existent
        renderAlertPingsOnMap(alerts);
        alertsSection.classList.remove('hidden');
        alertsContainer.innerHTML = alerts
          .map((a) => {
            const lvl = (a.niveau || '').toLowerCase();
            const preparationHref = preparationLinkForRisk(a.type);
            return `
					       <a href="${preparationHref}" class="block rounded-2xl bg-veille-3 p-4 border border-white/10 mb-3 hover:border-white/30 transition" aria-label="Voir la preparation pour ${a.type || 'ce risque'}">
						 <div class="flex items-center justify-between gap-2">
						   <h3 class="text-white font-semibold">${a.icone || ''} ${a.titre || 'Alerte'}</h3>
						   <span class="px-2 py-1 rounded-full text-xs font-semibold ${levelClass(lvl)}">${a.niveau || '-'}</span>
						 </div>
						 <p class="text-white/90 mt-2">${a.message || ''}</p>
						 <p class="text-white/70 text-sm mt-2">Type: ${a.type || '-'}</p>
						 <p class="text-white/70 text-sm">Urgence: ${a.numero_urgence || '-'}</p>
					       </a>
				       `;
          })
          .join('');
      } else {
        console.log('[HOME DEBUG] No alerts. Hiding section.');
        // Pas d'alertes : on vide simplement la liste, la carte reste visible
        renderAlertPingsOnMap([]);
        alertsSection.classList.add('hidden');
        alertsContainer.innerHTML = '';
      }
    } catch (e) {
      console.error('[HOME DEBUG] Error:', e.message);
      // En cas d'erreur API, on masque juste les alertes, la carte reste
      renderAlertPingsOnMap([]);
      alertsSection.classList.add('hidden');
      alertsContainer.innerHTML = '';
    }
  };

  await refreshHomeAlerts();

  if (demoToggle) {
    demoToggle.addEventListener('click', async () => {
      demoMode = !demoMode;
      setDemoModeEnabled(demoMode);
      updateDemoToggleLabel(demoToggle, demoMode);
      if (homeMap) {
        const center = homeMap.getCenter();
        if (demoMode) {
          await addDemoNasaFiresToMap({ lat: center.lat, lon: center.lng });
        } else {
          clearDemoNasaFires();
        }
      }
      await refreshHomeAlerts();
    });
  }

  const weatherSection = qs('weather-home-section');
  const weatherContainer = qs('weather-home-container');
  if (weatherSection && weatherContainer) {
    try {
      // On affiche Bordeaux car la météo est centrée sur la ville
      const city = 'Bordeaux';
      // Ajoute weathercode à la requête pour l'icône
      const weatherArr = await apiGet(
        `/api/weather/forecast?hourly=temperature_2m,weathercode`,
      );
      let html = '';
      if (Array.isArray(weatherArr) && weatherArr.length > 0) {
        const weather = weatherArr[0];
        // Logo météo selon weathercode (voir WMO)
        const code = weather.weathercode;
        let icon = '☀️';
        if (code !== undefined) {
          if (code === 0)
            icon = '☀️'; // Clear
          else if ([1, 2, 3].includes(code))
            icon = '⛅'; // Cloudy
          else if ([45, 48].includes(code))
            icon = '🌫️'; // Fog
          else if ([51, 53, 55, 56, 57].includes(code))
            icon = '🌦️'; // Drizzle
          else if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
            icon = '🌧️'; // Rain
          else if ([71, 73, 75, 77, 85, 86].includes(code))
            icon = '❄️'; // Snow
          else if ([95, 96, 99].includes(code)) icon = '⛈️'; // Thunderstorm
        }
        html += `<div class="flex items-center gap-3 mb-1">
											 <span style="font-size:2rem;">${icon}</span>
											 <span class="text-lg font-semibold">${city}</span>
										   </div>`;
        if (weather.temperature_mean !== undefined) {
          html += `<div><span class="font-semibold">Température :</span> ${weather.temperature_mean}°C</div>`;
        }
        if (weather.wind_mean !== undefined) {
          html += `<div><span class="font-semibold">Vent :</span> ${weather.wind_mean.toFixed(1)} km/h</div>`;
        }
        if (weather.air_quality !== undefined && weather.air_quality !== null) {
          // Détermine la couleur et le label AQI
          let aqi = weather.air_quality;
          let aqiLabel = '';
          let aqiColor = '';
          if (aqi <= 20) {
            aqiLabel = 'Très bon';
            aqiColor = '#22c55e';
          } else if (aqi <= 40) {
            aqiLabel = 'Bon';
            aqiColor = '#84cc16';
          } else if (aqi <= 60) {
            aqiLabel = 'Moyen';
            aqiColor = '#eab308';
          } else if (aqi <= 80) {
            aqiLabel = 'Médiocre';
            aqiColor = '#f59e42';
          } else if (aqi <= 100) {
            aqiLabel = 'Mauvais';
            aqiColor = '#ef4444';
          } else {
            aqiLabel = 'Très mauvais';
            aqiColor = '#991b1b';
          }
          html += `<div><span class=\"font-semibold\">Qualité de l'air :</span> <span>${aqi} (${aqiLabel})</span></div>`;
        }
      }
      weatherContainer.innerHTML =
        html || '<div>Aucune donnée météo disponible.</div>';
    } catch (e) {
      weatherContainer.innerHTML =
        '<div class="text-red-300">Erreur météo</div>';
    }
  }
}

async function loadGeorisquesResultsPage() {
  const root = qs('results-root');
  if (!root) return;

  const addressEl = qs('results-address');
  const coordsEl = qs('results-coords');
  const summaryEl = qs('results-summary');
  const cardsEl = qs('results-cards');
  const detailsEl = qs('results-details');

  const statusBadge = (status) => {
    const normalized = normalizeRiskKey(status);
    if (normalized.includes('pas de risque') || normalized.includes('faible')) {
      return { label: status, className: 'status-green' };
    }
    if (
      normalized.includes('existant') ||
      normalized.includes('fort') ||
      normalized.includes('eleve')
    ) {
      return { label: status, className: 'status-red' };
    }
    return { label: status, className: 'status-gray' };
  };

  const riskCardHtml = (risk) => {
    const addressBadge = statusBadge(risk.addressStatus);
    const cityBadge = statusBadge(risk.cityStatus);
    return `
			<article class="risk-card">
				<div class="risk-card-header">
					<div class="risk-icon" aria-hidden="true">${risk.icon}</div>
					<h3 class="risk-title text-2xl">${risk.title}</h3>
				</div>
				<div class="risk-lines">
					<div class="risk-line">
						<span class="risk-label"><i class="fa-solid fa-location-dot"></i> a mon adresse :</span>
						<span class="risk-status ${addressBadge.className}">${addressBadge.label}</span>
					</div>
					<div class="risk-line">
						<span class="risk-label"><i class="fa-solid fa-building"></i> sur ma commune :</span>
						<span class="risk-status ${cityBadge.className}">${cityBadge.label}</span>
					</div>
				</div>
				<a class="risk-link" href="https://www.georisques.gouv.fr/" target="_blank" rel="noopener noreferrer">
					Acceder aux informations detaillees
					<i class="fa-solid fa-arrow-right"></i>
				</a>
			</article>
		`;
  };

  const params = new URLSearchParams(window.location.search);
  const address = String(params.get('address') || '').trim();
  if (!address) {
    if (summaryEl)
      summaryEl.innerHTML =
        '<p class="text-red-300">Aucune adresse fournie.</p>';
    if (cardsEl) cardsEl.innerHTML = '';
    if (detailsEl) detailsEl.innerHTML = '';
    return;
  }

  if (addressEl) addressEl.textContent = `Adresse recherchee: ${address}`;
  if (summaryEl) summaryEl.textContent = 'Chargement des risques...';

  try {
    const data = await apiGet(
      `/api/georisques/by-address?address=${encodeURIComponent(address)}`,
    );
    const geocoding = data.geocoding || {};
    const georisques = data.georisques || {};
    const risks = georisques.risks || {};

    const installations = risks.installations?.data;
    const floods = risks.floods;
    const seismic = risks.seismic;

    const installationsCount = Array.isArray(installations)
      ? installations.length
      : 0;
    const hasFloodData = floods && !floods.error;
    const hasSeismicData = seismic && !seismic.error;

    const riskCards = [
      {
        title: 'INONDATION',
        icon: '🌊',
        addressStatus: hasFloodData ? 'EXISTANT' : 'INCONNU',
        cityStatus: hasFloodData ? 'EXISTANT' : 'INCONNU',
      },
      {
        title: 'REMONTEE DE NAPPE',
        icon: '💧',
        addressStatus: hasFloodData ? 'PAS DE RISQUE CONNU' : 'INCONNU',
        cityStatus: hasFloodData ? 'EXISTANT' : 'INCONNU',
      },
      {
        title: 'SEISME',
        icon: '🫨',
        addressStatus: hasSeismicData ? 'FAIBLE' : 'INCONNU',
        cityStatus: hasSeismicData ? 'FAIBLE' : 'INCONNU',
      },
      {
        title: 'MOUVEMENTS DE TERRAIN',
        icon: '⛰️',
        addressStatus: 'INCONNU',
        cityStatus: installationsCount > 0 ? 'EXISTANT' : 'INCONNU',
      },
    ];

    if (coordsEl) {
      const lat = geocoding.lat;
      const lon = geocoding.lon;
      coordsEl.textContent =
        Number.isFinite(lat) && Number.isFinite(lon)
          ? `Position geocodee: ${lat.toFixed(5)}, ${lon.toFixed(5)}`
          : '';
    }

    if (summaryEl) {
      summaryEl.textContent = `Installations classees trouvees autour de l'adresse : ${installationsCount}`;
    }

    if (cardsEl) {
      cardsEl.innerHTML = riskCards.map(riskCardHtml).join('');
    }

    if (detailsEl) {
      if (!hasFloodData || !hasSeismicData) {
        detailsEl.innerHTML =
          "Certaines donnees detaillees de l'API Georisques ne sont pas disponibles pour cette adresse (retour externe incomplet).";
      } else {
        detailsEl.innerHTML = '';
      }
    }
  } catch (e) {
    if (summaryEl)
      summaryEl.innerHTML = `<p class="text-red-300">Erreur: ${e.message}</p>`;
    if (cardsEl) cardsEl.innerHTML = '';
    if (detailsEl) detailsEl.innerHTML = '';
  }
}

function renderAlerts(alerts, options = {}) {
  const container = qs('alerts-container');
  console.log('[DEBUG] renderAlerts called. Container found:', !!container);
  if (!container) {
    console.warn('[DEBUG] alerts-container not found!');
    return;
  }
  const deletable = Boolean(options.deletable);

  if (!alerts.length) {
    container.innerHTML = '<p class="text-white/80">Aucune alerte.</p>';
    return;
  }

  const html = alerts
    .map((a) => {
      const lvl = (a.niveau || '').toLowerCase();
      const preparationHref = preparationLinkForRisk(a.type);
      const deleteButton = deletable
        ? `<button type="button" class="alert-delete-btn px-2 py-1 rounded-lg bg-red-700/80 hover:bg-red-700 text-white text-xs font-semibold" data-alert-id="${a.id || ''}">Supprimer</button>`
        : '';
      return `
        <a href="${preparationHref}" class="block rounded-2xl bg-veille-3 p-4 border border-white/10 hover:border-white/30 transition" aria-label="Voir la preparation pour ${a.type || 'ce risque'}">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-white font-semibold">${a.icone || ''} ${a.titre || 'Alerte'}</h3>
            <span class="px-2 py-1 rounded-full text-xs font-semibold ${levelClass(lvl)}">${a.niveau || '-'}</span>
          </div>
          <p class="text-white/90 mt-2">${a.message || ''}</p>
          <div class="mt-2 flex items-center justify-between gap-2">
            <p class="text-white/70 text-sm">Urgence: ${a.numero_urgence || '-'}</p>
            ${deleteButton}
          </div>
        </a>
      `;
    })
    .join('');

  container.innerHTML = html;
  console.log('[DEBUG] Alerts rendered. HTML length:', html.length);
}

function createMarkerOnMap(markersLayer, lat, lon, type) {
  const visual = riskPingVisual(type);
  const marker = L.marker([lat, lon], {
    icon: L.divIcon({
      className: '',
      html: `<div class="risk-ping ${visual.className}"><span>${visual.emoji}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
  });
  marker
    .addTo(markersLayer)
    .bindPopup(
      '' +
        `<strong>Signalement</strong><br/>` +
        `Type: ${type || 'Non renseigné'}<br/>`,
    );
  return marker;
}

async function loadAlertsMap() {
  const mapEl = qs('alerts-map');
  if (!mapEl || typeof L === 'undefined') return;

  const { lat, lon } = getCoords();
  const map = L.map('alerts-map', { attributionControl: false }).setView(
    [lat, lon],
    11,
  );
  const markersLayer = L.layerGroup().addTo(map);

  // Fond OSM simple pour la carte des alertes (sans couche inondation)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  // Restaure les marqueurs depuis localStorage pour les alertes persistantes
  const savedAlerts = JSON.parse(
    localStorage.getItem('bdx-hackathon-alerts') || '[]',
  );
  savedAlerts.forEach((alert) => {
    if (alert.lat && alert.lon) {
      createMarkerOnMap(markersLayer, alert.lat, alert.lon, alert.type);
    }
  });

  // Permet de "pin pointer" un signalement sur la carte avec l'icône adaptée
  const typeSelect = qs('mode');
  map.on('click', (e) => {
    const currentType = typeSelect ? typeSelect.value : '';
    const pingId = `ping-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const marker = createMarkerOnMap(
      markersLayer,
      e.latlng.lat,
      e.latlng.lng,
      currentType,
    );

    console.log(
      '[DEBUG] Map clicked. Type:',
      currentType,
      'Lat:',
      e.latlng.lat,
      'Lon:',
      e.latlng.lng,
    );

    document.dispatchEvent(
      new CustomEvent('alert-ping-created', {
        detail: {
          id: pingId,
          type: currentType || 'Incident',
          timestamp,
          lat: e.latlng.lat,
          lon: e.latlng.lng,
          marker,
        },
      }),
    );
    console.log('[DEBUG] Event alert-ping-created dispatched');
  });

  try {
    const data = await apiGet(`/api/map?lat=${lat}&lon=${lon}&radius=20000`);
    const center = data.center || { lat, lon };
    const radius = Number(data.radius || 20000);

    map.setView([center.lat, center.lon], 11);

    L.circle([center.lat, center.lon], {
      radius,
      color: '#0ea5e9',
      weight: 2,
      fillColor: '#38bdf8',
      fillOpacity: 0.12,
    }).addTo(map);
  } catch (e) {
    // En cas d'erreur, on laisse simplement la carte centrée sur la position
  }
}

async function loadAlertsPage() {
  if (!qs('alerts-container')) return;
  const mode = qs('mode'); // Type : Incendie / Inondation
  const refresh = qs('refresh-alerts');
  const clearBtn = qs('clear-alerts');
  const container = qs('alerts-container');

  // Charge depuis localStorage ou initialise vide
  const localAlerts = JSON.parse(
    localStorage.getItem('bdx-hackathon-alerts') || '[]',
  );

  // Fonction pour sauvegarder dans localStorage (sans le marker)
  const saveToStorage = () => {
    const toSave = localAlerts.map(({ marker, ...rest }) => rest);
    localStorage.setItem('bdx-hackathon-alerts', JSON.stringify(toSave));
  };

  // Initialise la carte dédiée à la page d'alertes
  loadAlertsMap();

  const renderFromPings = () => {
    let alerts = [...localAlerts];
    console.log('[DEBUG] Rendering alerts. Count:', alerts.length);
    console.log('[DEBUG] Alerts to render:', alerts);

    // Affiche tous les types d'alertes sans filtrage
    renderAlerts(alerts, { deletable: true });
  };

  if (container) {
    container.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest('.alert-delete-btn');
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const alertId = button.getAttribute('data-alert-id');
      if (!alertId) return;

      const idx = localAlerts.findIndex((a) => a.id === alertId);
      if (idx >= 0) {
        const alertToDelete = localAlerts[idx];
        if (
          alertToDelete?.marker &&
          typeof alertToDelete.marker.remove === 'function'
        ) {
          alertToDelete.marker.remove();
        }
        localAlerts.splice(idx, 1);
        saveToStorage();
        renderFromPings();
      }
    });
  }

  document.addEventListener('alert-ping-created', (event) => {
    const detail = event?.detail || {};
    const pingId = detail.id;
    const type = String(detail.type || 'Incident');
    const ts = String(detail.timestamp || new Date().toLocaleString('fr-FR'));
    const marker = detail.marker;

    if (!pingId) return;

    const newAlert = {
      id: pingId,
      type,
      niveau: 'Signalement utilisateur',
      titre: `Alerte ${type}`,
      message: `Ping ajouté le ${ts}`,
      numero_urgence: type.toLowerCase().includes('incend') ? '18' : '112',
      icone: type.toLowerCase().includes('incend') ? '🔥' : '🌊',
      lat: detail.lat,
      lon: detail.lon,
      marker,
    };

    localAlerts.unshift(newAlert);
    console.log('[DEBUG] Alert added:', newAlert);
    console.log('[DEBUG] Total alerts now:', localAlerts.length);

    saveToStorage();
    renderFromPings();
  });

  // Bouton pour vider toutes les alertes
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      localAlerts.forEach((a) => {
        if (a.marker && typeof a.marker.remove === 'function') {
          a.marker.remove();
        }
      });
      localAlerts.length = 0;
      localStorage.removeItem('bdx-hackathon-alerts');
      renderFromPings();
    });
  }

  refresh.addEventListener('click', renderFromPings);
  mode.addEventListener('change', renderFromPings);
  renderFromPings();
}

async function loadPreparationPage() {
  const select = qs('risk-select');
  if (!select) return;

  const before = qs('before-list');
  const during = qs('during-list');
  const title = qs('risk-title');
  const coolingPlacesSection = qs('cooling-places-section');

  const renderRisk = async (riskType) => {
    const risk = await apiGet(`/api/risks/${riskType}`);
    // On ne met plus le nom (ex: "Inondation") sous le sélecteur
    if (title) title.textContent = '';

    // Affiche la section lieux frais uniquement pour la canicule
    if (coolingPlacesSection) {
      const key = normalizeRiskKey(riskType);
      const isCanicule = key.includes('canicule');
      coolingPlacesSection.classList.toggle('hidden', !isCanicule);
    }

    // Checklists - emojis are in the text itself
    before.innerHTML = (risk.checklist_avant || [])
      .map((x) => {
        return `
					<li class="text-white/90">
						${x}
					</li>
				`;
      })
      .join('');
    during.innerHTML = (risk.checklist_pendant || [])
      .map((x) => {
        return `
					<li class="text-white/90">
						${x}
					</li>
				`;
      })
      .join('');
  };

  try {
    const risks = await apiGet('/api/risks');
    const params = new URLSearchParams(window.location.search);
    const selectedFromUrl = params.get('risk');
    const selectedKey = normalizeRiskKey(selectedFromUrl);

    select.innerHTML = risks
      .map((r) => {
        const label =
          typeof r === 'string' && r.length
            ? r.charAt(0).toUpperCase() + r.slice(1)
            : r;
        return `<option value="${r}">${label}</option>`;
      })
      .join('');

    let initialRisk = risks[0];
    if (selectedKey) {
      const matched = risks.find((r) => normalizeRiskKey(r) === selectedKey);
      if (matched) initialRisk = matched;
    }

    if (initialRisk) {
      select.value = initialRisk;
      await renderRisk(initialRisk);
    }
    select.addEventListener('change', (e) => renderRisk(e.target.value));
  } catch (e) {
    before.innerHTML = `<li class="text-red-300">Erreur API: ${e.message}</li>`;
  }
}

async function loadEmergencyPage() {
  const list = qs('emergency-list');
  if (!list) return;

  try {
    const types = await apiGet('/api/risks');
    const details = await Promise.all(
      types.map((t) => apiGet(`/api/risks/${t}`)),
    );
    const byNumber = new Map();

    details.forEach((risk) => {
      const n = risk.numero_urgence;
      if (!n) return;
      if (!byNumber.has(n)) byNumber.set(n, []);
      byNumber.get(n).push(risk.nom || risk.type || 'Risque');
    });

    list.innerHTML = [...byNumber.entries()]
      .map(
        ([num, labels]) => `
        <li class="rounded-xl bg-veille-3 p-4 border border-white/10">
          <p class="text-white text-2xl font-semibold">${num}</p>
          <p class="text-white/80 mt-1 text-sm">${labels.join(', ')}</p>
          <a href="tel:${num}" class="inline-block mt-3 px-3 py-2 rounded-lg bg-veille-2 text-white font-semibold">Appeler</a>
        </li>
      `,
      )
      .join('');
  } catch (e) {
    list.innerHTML = `<li class="text-red-300">Erreur API: ${e.message}</li>`;
  }
}

function loadAddressRiskSearch() {
  const form = qs('address-risk-form');
  const input = qs('address-input');
  const suggestions = qs('address-suggestions');
  if (!form || !input) return;

  let debounceTimer = null;
  let requestToken = 0;

  const renderSuggestions = (items) => {
    if (!suggestions) return;
    suggestions.innerHTML = (items || [])
      .map((item) => {
        const label = String(item?.label || '').trim();
        if (!label) return '';
        return `<option value="${label}"></option>`;
      })
      .filter(Boolean)
      .join('');
  };

  input.addEventListener('input', () => {
    const q = String(input.value || '').trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (q.length < 3) {
      renderSuggestions([]);
      return;
    }

    debounceTimer = setTimeout(async () => {
      requestToken += 1;
      const currentToken = requestToken;
      try {
        const data = await apiGet(
          `/api/geocode/suggest?q=${encodeURIComponent(q)}&limit=6`,
        );
        if (currentToken !== requestToken) return;
        renderSuggestions(
          Array.isArray(data?.suggestions) ? data.suggestions : [],
        );
      } catch (e) {
        renderSuggestions([]);
      }
    }, 220);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const address = String(input.value || '').trim();
    if (!address) return;
    window.location.href = `resultats.html?address=${encodeURIComponent(address)}`;
  });
}

async function loadGeorisquesResultsPage() {
  const root = qs('results-root');
  if (!root) return;
  const cardsEl = qs('results-cards');
  if (!cardsEl) return;

  const params = new URLSearchParams(window.location.search);
  const address = String(params.get('address') || '').trim();
  if (!address) {
    cardsEl.innerHTML = '<p class="text-red-300">Aucune adresse fournie.</p>';
    return;
  }

  const statusBadge = (status) => {
    const normalized = normalizeRiskKey(status);
    if (
      normalized.includes('niveau 1') ||
      normalized.includes('faible') ||
      normalized.includes('pas de risque')
    ) {
      return { label: status, className: 'status-green' };
    }
    if (
      normalized.includes('niveau 2') ||
      normalized.includes('modere') ||
      normalized.includes('a verifier')
    ) {
      return { label: status, className: 'status-amber' };
    }
    if (
      normalized.includes('niveau 3') ||
      normalized.includes('important') ||
      normalized.includes('fort') ||
      normalized.includes('eleve')
    ) {
      return { label: status, className: 'status-red' };
    }
    return { label: status, className: 'status-gray' };
  };

  const iconByRiskName = (riskName) => {
    const key = normalizeRiskKey(riskName);
    if (key.includes('inond')) return '<i class="fa-solid fa-water"></i>';
    if (key.includes('nappe')) return '<i class="fa-solid fa-droplet"></i>';
    if (key.includes('seisme'))
      return '<i class="fa-solid fa-house-crack"></i>';
    if (
      key.includes('mouvement') ||
      key.includes('terrain') ||
      key.includes('tassement') ||
      key.includes('affaissement')
    )
      return '<i class="fa-solid fa-mountain"></i>';
    if (key.includes('radon'))
      return '<i class="fa-solid fa-circle-radiation"></i>';
    if (key.includes('feu') || key.includes('incend'))
      return '<i class="fa-solid fa-fire"></i>';
    if (key.includes('avalanche'))
      return '<i class="fa-solid fa-snowflake"></i>';
    return '<i class="fa-solid fa-triangle-exclamation"></i>';
  };

  const riskCardHtml = (risk) => {
    const addressBadge = statusBadge(risk.addressStatus);
    const cityBadge = statusBadge(risk.cityStatus);
    return `
			<article class="risk-card">
				<div class="risk-card-header">
					<div class="risk-icon" aria-hidden="true">${risk.iconHtml}</div>
					<h3 class="risk-title text-2xl">${risk.title}</h3>
				</div>
				<div class="risk-lines">
					<div class="risk-line">
						<span class="risk-label"><i class="fa-solid fa-location-dot"></i> à mon adresse :</span>
						<span class="risk-status ${addressBadge.className}">${addressBadge.label}</span>
					</div>
					<div class="risk-line">
						<span class="risk-label"><i class="fa-solid fa-building"></i> sur ma commune :</span>
						<span class="risk-status ${cityBadge.className}">${cityBadge.label}</span>
					</div>
				</div>
				<a class="risk-link" href="https://www.georisques.gouv.fr/" target="_blank" rel="noopener noreferrer">
					Accéder aux informations détaillées
					<i class="fa-solid fa-arrow-right"></i>
				</a>
			</article>
		`;
  };

  cardsEl.innerHTML = '<p class="text-white/80">Chargement…</p>';

  try {
    const data = await apiGet(
      `/api/georisques/by-address?address=${encodeURIComponent(address)}`,
    );
    const georisques = data.georisques || {};
    const gaspar = data.gaspar || {};
    const radon = data.radon || {};
    const cavites = data.cavites || {};
    const ppr = data.ppr || {};
    const catnat = data.catnat || {};
    const risks = georisques.risks || {};
    const installations = risks.installations?.data;
    const floods = risks.floods;
    const seismic = risks.seismic;

    const hasInstallations =
      Array.isArray(installations) && installations.length > 0;
    const hasFloodData = floods && !floods.error;
    const hasSeismicData = seismic && !seismic.error;
    const hasCavitesData = Number(cavites?.results || 0) > 0;
    const hasPprData = Number(ppr?.results || 0) > 0;
    const hasCatnatData = Number(catnat?.results || 0) > 0;

    const gasparDetails = Array.isArray(gaspar?.data)
      ? gaspar.data[0]?.risques_detail || []
      : [];

    const groupLabel = (libelle) => {
      const key = normalizeRiskKey(libelle);
      if (key.includes('inond')) return 'INONDATION';
      if (key.includes('nappe')) return 'REMONTEE DE NAPPE';
      if (
        key.includes('mouvement') ||
        key.includes('terrain') ||
        key.includes('tassement') ||
        key.includes('affaissement')
      )
        return 'MOUVEMENTS DE TERRAIN';
      if (key.includes('seisme')) return 'SEISME';
      if (key.includes('radon')) return 'RADON';
      if (key.includes('feu') || key.includes('incend')) return 'FEUX DE FORET';
      if (key.includes('avalanche')) return 'AVALANCHE';
      return String(libelle || 'RISQUE').toUpperCase();
    };

    const grouped = new Map();
    gasparDetails.forEach((detail) => {
      const label = groupLabel(detail?.libelle_risque_long);
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(detail);
    });

    const LEVEL_1 = 'Niveau 1 - Faible';
    const LEVEL_2 = 'Niveau 2 - Modere';
    const LEVEL_3 = 'Niveau 3 - Eleve';
    const LEVEL_UNKNOWN = 'Niveau ? - Donnees manquantes';

    const radonClass =
      Array.isArray(radon?.data) && radon.data[0]
        ? String(radon.data[0].classe_potentiel || '')
        : '';
    const radonStatusByClass = {
      1: LEVEL_1,
      2: LEVEL_2,
      3: LEVEL_3,
    };
    const radonAddressStatus = radonStatusByClass[radonClass] || 'INCONNU';

    const extractSeismicZone = () => {
      for (const detail of gasparDetails) {
        const label = groupLabel(detail?.libelle_risque_long);
        if (label !== 'SEISME') continue;
        const zoneRaw = detail?.zone_sismicite;
        const zone = Number(zoneRaw);
        if (!Number.isFinite(zone)) continue;
        if (zone <= 1) return LEVEL_1;
        if (zone === 2 || zone === 3) return LEVEL_2;
        return LEVEL_3;
      }
      return null;
    };

    const seismeStatusFromZone = extractSeismicZone();

    const hasGasparGroup = (title) =>
      grouped.has(title) && grouped.get(title).length > 0;

    const normalizeCardStatus = (title) => {
      if (title === 'RADON') {
        if (radon?.error) {
          return { addressStatus: LEVEL_UNKNOWN, cityStatus: LEVEL_UNKNOWN };
        }

        if (hasGasparGroup('RADON') && radonAddressStatus === 'INCONNU') {
          return { addressStatus: LEVEL_2, cityStatus: LEVEL_2 };
        }

        return {
          addressStatus:
            radonAddressStatus === 'INCONNU'
              ? LEVEL_UNKNOWN
              : radonAddressStatus,
          cityStatus:
            radonAddressStatus === 'INCONNU'
              ? LEVEL_UNKNOWN
              : radonAddressStatus,
        };
      }

      if (title === 'INONDATION') {
        const hasCommuneFloodSignal =
          hasGasparGroup('INONDATION') || hasPprData || hasCatnatData;
        const hasLocalFloodSignal =
          hasFloodData &&
          (floods?.at_risk === true || Number(floods?.results || 0) > 0);

        if (hasLocalFloodSignal) {
          return { addressStatus: LEVEL_3, cityStatus: LEVEL_2 };
        }

        if (hasFloodData) {
          return {
            addressStatus: LEVEL_1,
            cityStatus: hasCommuneFloodSignal ? LEVEL_2 : LEVEL_1,
          };
        }

        if (hasCommuneFloodSignal) {
          return { addressStatus: LEVEL_2, cityStatus: LEVEL_2 };
        }

        return { addressStatus: LEVEL_UNKNOWN, cityStatus: LEVEL_UNKNOWN };
      }

      if (title === 'SEISME') {
        if (seismeStatusFromZone) {
          return {
            addressStatus: seismeStatusFromZone,
            cityStatus: seismeStatusFromZone,
          };
        }
        if (hasSeismicData) {
          return { addressStatus: LEVEL_2, cityStatus: LEVEL_2 };
        }
        if (hasGasparGroup('SEISME')) {
          return { addressStatus: LEVEL_2, cityStatus: LEVEL_2 };
        }
        return { addressStatus: LEVEL_UNKNOWN, cityStatus: LEVEL_UNKNOWN };
      }

      if (title === 'MOUVEMENTS DE TERRAIN') {
        if (hasCavitesData || hasPprData || hasCatnatData || hasInstallations) {
          return { addressStatus: LEVEL_2, cityStatus: LEVEL_2 };
        }
        if (!cavites?.error && !ppr?.error && !catnat?.error) {
          return { addressStatus: LEVEL_1, cityStatus: LEVEL_1 };
        }
        return { addressStatus: LEVEL_UNKNOWN, cityStatus: LEVEL_UNKNOWN };
      }

      if (hasGasparGroup(title) || hasInstallations) {
        return { addressStatus: LEVEL_2, cityStatus: LEVEL_2 };
      }

      return { addressStatus: LEVEL_UNKNOWN, cityStatus: LEVEL_UNKNOWN };
    };

    const baseRiskTitles = [
      'INONDATION',
      'SEISME',
      'MOUVEMENTS DE TERRAIN',
      'RADON',
    ];
    const allRiskTitles = [...new Set([...baseRiskTitles, ...grouped.keys()])];

    const riskCards = allRiskTitles.map((title) => {
      const statuses = normalizeCardStatus(title);

      return {
        title,
        iconHtml: iconByRiskName(title),
        addressStatus: statuses.addressStatus,
        cityStatus: statuses.cityStatus,
      };
    });

    if (!riskCards.length) {
      riskCards.push({
        title: 'AUCUN RISQUE IDENTIFIE',
        iconHtml: iconByRiskName('risque'),
        addressStatus: 'PAS DE RISQUE CONNU',
        cityStatus: 'PAS DE RISQUE CONNU',
      });
    }

    cardsEl.innerHTML = riskCards.map(riskCardHtml).join('');
  } catch (e) {
    cardsEl.innerHTML = `<p class="text-red-300">Erreur: ${e.message}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHome();
  loadAddressRiskSearch();
  loadGeorisquesResultsPage();
  loadAlertsPage();
  loadPreparationPage();
  loadEmergencyPage();
});
