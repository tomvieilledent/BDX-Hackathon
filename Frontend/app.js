const API_BASE = localStorage.getItem('api_base') || 'http://127.0.0.1:7000';
const DEFAULT_LAT = 44.84;
const DEFAULT_LON = -0.58;
let homeMap = null;
let homeAlertMarkersLayer = null;
let homeNasaFiresLayer = null;

function qs(id) {
	return document.getElementById(id);
}

function getCoords() {
	const lat = Number(localStorage.getItem('lat') || DEFAULT_LAT);
	const lon = Number(localStorage.getItem('lon') || DEFAULT_LON);
	return { lat, lon };
}

function setCoords(lat, lon) {
	localStorage.setItem('lat', String(lat));
	localStorage.setItem('lon', String(lon));
}

function isDemoModeEnabled() {
	return localStorage.getItem('home_demo_mode') === '1';
}

function setDemoModeEnabled(enabled) {
	localStorage.setItem('home_demo_mode', enabled ? '1' : '0');
}

function updateDemoToggleLabel(button, enabled) {
	if (!button) return;
	button.textContent = enabled ? 'Désactiver' : 'Activer';
}

async function apiGet(path) {
	const res = await fetch(`${API_BASE}${path}`);
	if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
	return res.json();
}

function levelClass(level) {
	if (level === 'critique') return 'bg-red-700 text-white';
	if (level === 'élevé' || level === 'eleve') return 'bg-orange-600 text-white';
	return 'bg-yellow-400 text-veille-4';
}

function normalizeRiskKey(value) {
	return String(value || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.toLowerCase();
}

function preparationLinkForRisk(riskType) {
	const safeType = encodeURIComponent(String(riskType || ''));
	return `preparation.html?risk=${safeType}`;
}

function checklistIconForLine(text) {
	const t = String(text || '').toLowerCase();
	if (!t) return '•';
	if (t.includes('électr') || t.includes('electr')) return '⚡️';
	if (t.includes('gaz')) return '🔥';
	if (t.includes('eau') || t.includes('boire')) return '💧';
	if (t.includes('médicament') || t.includes('medicament')) return '💊';
	if (t.includes('document')) return '📄';
	if (t.includes('radio')) return '📻';
	if (t.includes('lampe') || t.includes('torche')) return '🔦';
	if (t.includes('extincteur')) return '🧯';
	if (t.includes('issue') || t.includes('évacuation') || t.includes('evacuation')) return '🚪';
	if (t.includes('monter') || t.includes('hauteur')) return '⬆️';
	if (t.includes('ne pas sortir')) return '🏠';
	if (t.includes('appeler')) return '📞';
	if (t.includes('volet') || t.includes('fenêtre') || t.includes('fenetre')) return '🪟';
	if (t.includes('ascenseur')) return '🚫';
	return '•';
}

function normalizeCoords(item) {
	const lat = Number(item.lat ?? item.latitude ?? item.y ?? item.coordonnees?.lat);
	const lon = Number(item.lon ?? item.longitude ?? item.x ?? item.coordonnees?.lon);
	if (Number.isFinite(lat) && Number.isFinite(lon)) {
		return { lat, lon };
	}
	return null;
}

function clearDemoNasaFires() {
	if (homeNasaFiresLayer) {
		homeNasaFiresLayer.clearLayers();
	}
}

async function addDemoNasaFiresToMap(center) {
	if (!homeMap || typeof L === 'undefined') return;
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
		fires = [{
			latitude: center.lat + dLat,
			longitude: center.lon + dLon,
			_simulated: true,
		}];
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

	const popup = (isSimulated
		? '🔥 Incendie simulé'
		: '🔥 Feu détecté (NASA FIRMS)') + addressHtml;

	L.marker([lat, lon], { icon: fireIcon })
		.addTo(homeNasaFiresLayer)
		.bindPopup(popup);
}

function riskPingVisual(type) {
	const key = normalizeRiskKey(type);
	if (key.includes('inond')) return { emoji: '🌊', className: 'ping-flood' };
	if (key.includes('incend') || key.includes('feu')) return { emoji: '🔥', className: 'ping-fire' };
	if (key.includes('canicule') || key.includes('chaleur')) return { emoji: '🌡️', className: 'ping-heat' };
	if (key.includes('tempete') || key.includes('vent') || key.includes('orage')) return { emoji: '🌪️', className: 'ping-storm' };
	if (key.includes('seisme') || key.includes('sism')) return { emoji: '🫨', className: 'ping-quake' };
	if (key.includes('industriel') || key.includes('chim')) return { emoji: '🏭', className: 'ping-industrial' };
	return { emoji: '⚠️', className: 'ping-default' };
}

function renderAlertPingsOnMap(alerts) {
	if (!homeMap || typeof L === 'undefined') return;
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
		const offset = index === 0 ? { lat: 0, lon: 0 } : {
			lat: Math.sin(angle) * 0.003,
			lon: Math.cos(angle) * 0.003,
		};
		const marker = L.marker([coords.lat + offset.lat, coords.lon + offset.lon], {
			icon: L.divIcon({
				className: '',
				html: `<div class="risk-ping ${visual.className}"><span>${visual.emoji}</span></div>`,
				iconSize: [36, 36],
				iconAnchor: [18, 18],
			}),
		});

		const title = alert?.titre || 'Alerte';
		const type = alert?.type || '-';
		const level = alert?.niveau || '-';
		const message = alert?.message || '';
		marker.bindPopup(`<strong>${title}</strong><br/>Type: ${type}<br/>Niveau: ${level}<br/>${message}`);
		marker.addTo(homeAlertMarkersLayer);
	});
}

async function loadHomeMap() {
	const mapEl = qs('home-map');
	if (!mapEl || typeof L === 'undefined') return;

	const status = qs('map-status');
	const { lat, lon } = getCoords();
	homeMap = L.map('home-map', { attributionControl: false }).setView([lat, lon], 11);
	homeAlertMarkersLayer = L.layerGroup().addTo(homeMap);

	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {

	}).addTo(homeMap);

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
			L.marker([coords.lat, coords.lon])
				.addTo(homeMap)
				.bindPopup(`🔥 ${name}`);
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

async function loadHome() {
	const root = qs('home-content');
	if (!root) return;
	const mapSection = qs('home-map-section');
	let homeMapInitialized = false;

	const demoToggle = qs('home-demo-toggle');
	let demoMode = isDemoModeEnabled();
	updateDemoToggleLabel(demoToggle, demoMode);

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
			const data = await apiGet(path);
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
			}
			if (alerts.length) {
				if (mapSection) mapSection.classList.remove('hidden');
				if (!homeMapInitialized) {
					await loadHomeMap();
					homeMapInitialized = true;
				}
				renderAlertPingsOnMap(alerts);
				alertsSection.classList.remove('hidden');
				alertsContainer.innerHTML = alerts.map(a => {
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
				}).join('');
			} else {
				if (mapSection) mapSection.classList.add('hidden');
				renderAlertPingsOnMap([]);
				alertsSection.classList.add('hidden');
				alertsContainer.innerHTML = '';
			}
		} catch (e) {
			if (mapSection) mapSection.classList.add('hidden');
			renderAlertPingsOnMap([]);
			alertsSection.classList.add('hidden');
			alertsContainer.innerHTML = '';
		}
	};

	if (demoToggle) {
		demoToggle.addEventListener('click', async () => {
			demoMode = !demoMode;
			setDemoModeEnabled(demoMode);
			updateDemoToggleLabel(demoToggle, demoMode);
			// Mettre à jour la couche de feux NASA en même temps que le mode démo
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

	await refreshHomeAlerts();

	// Fetch and display weather below the map
	const weatherSection = qs('weather-home-section');
	const weatherContainer = qs('weather-home-container');
	if (weatherSection && weatherContainer) {
		try {
			// On affiche Bordeaux car la météo est centrée sur la ville
			const city = 'Bordeaux';
			// Ajoute weathercode à la requête pour l'icône
			const weatherArr = await apiGet(`/api/weather/forecast?hourly=temperature_2m,weathercode`);
			let html = '';
			if (Array.isArray(weatherArr) && weatherArr.length > 0) {
				const weather = weatherArr[0];
				// Logo météo selon weathercode (voir WMO)
				const code = weather.weathercode;
				let icon = '☀️';
				if (code !== undefined) {
					if (code === 0) icon = '☀️'; // Clear
					else if ([1, 2, 3].includes(code)) icon = '⛅'; // Cloudy
					else if ([45, 48].includes(code)) icon = '🌫️'; // Fog
					else if ([51, 53, 55, 56, 57].includes(code)) icon = '🌦️'; // Drizzle
					else if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) icon = '🌧️'; // Rain
					else if ([71, 73, 75, 77, 85, 86].includes(code)) icon = '❄️'; // Snow
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
					if (aqi <= 20) { aqiLabel = 'Très bon'; aqiColor = '#22c55e'; }
					else if (aqi <= 40) { aqiLabel = 'Bon'; aqiColor = '#84cc16'; }
					else if (aqi <= 60) { aqiLabel = 'Moyen'; aqiColor = '#eab308'; }
					else if (aqi <= 80) { aqiLabel = 'Médiocre'; aqiColor = '#f59e42'; }
					else if (aqi <= 100) { aqiLabel = 'Mauvais'; aqiColor = '#ef4444'; }
					else { aqiLabel = 'Très mauvais'; aqiColor = '#991b1b'; }
					html += `<div><span class=\"font-semibold\">Qualité de l'air :</span> <span>${aqi} (${aqiLabel})</span></div>`;
				}
			}
			weatherContainer.innerHTML = html || '<div>Aucune donnée météo disponible.</div>';
		} catch (e) {
			weatherContainer.innerHTML = '<div class="text-red-300">Erreur météo</div>';
		}
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
				const data = await apiGet(`/api/geocode/suggest?q=${encodeURIComponent(q)}&limit=6`);
				if (currentToken !== requestToken) return;
				renderSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
			} catch (e) {
				renderSuggestions([]);
			}
		}, 220);
	});

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const address = String(input.value || '').trim();
		if (!address) return;
		try {
			const data = await apiGet(`/api/georisques/report-url?address=${encodeURIComponent(address)}`);
			if (!data?.url) throw new Error('URL Georisques introuvable');
			window.location.href = data.url;
		} catch (e) {
			alert(`Impossible d'ouvrir Georisques: ${e.message}`);
		}
	});
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
		if (normalized.includes('existant') || normalized.includes('fort') || normalized.includes('eleve')) {
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
		if (summaryEl) summaryEl.innerHTML = '<p class="text-red-300">Aucune adresse fournie.</p>';
		if (cardsEl) cardsEl.innerHTML = '';
		if (detailsEl) detailsEl.innerHTML = '';
		return;
	}

	if (addressEl) addressEl.textContent = `Adresse recherchee: ${address}`;
	if (summaryEl) summaryEl.textContent = 'Chargement des risques...';

	try {
		const data = await apiGet(`/api/georisques/by-address?address=${encodeURIComponent(address)}`);
		const geocoding = data.geocoding || {};
		const georisques = data.georisques || {};
		const risks = georisques.risks || {};

		const installations = risks.installations?.data;
		const floods = risks.floods;
		const seismic = risks.seismic;

		const installationsCount = Array.isArray(installations) ? installations.length : 0;
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
			coordsEl.textContent = Number.isFinite(lat) && Number.isFinite(lon)
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
				detailsEl.innerHTML = 'Certaines donnees detaillees de l\'API Georisques ne sont pas disponibles pour cette adresse (retour externe incomplet).';
			} else {
				detailsEl.innerHTML = '';
			}
		}
	} catch (e) {
		if (summaryEl) summaryEl.innerHTML = `<p class="text-red-300">Erreur: ${e.message}</p>`;
		if (cardsEl) cardsEl.innerHTML = '';
		if (detailsEl) detailsEl.innerHTML = '';
	}
}

function renderAlerts(alerts) {
	const container = qs('alerts-container');
	if (!container) return;

	if (!alerts.length) {
		container.innerHTML = '<p class="text-white/80">Aucune alerte.</p>';
		return;
	}

	container.innerHTML = alerts
		.map((a) => {
			const lvl = (a.niveau || '').toLowerCase();
			return `
        <article class="rounded-2xl bg-veille-3 p-4 border border-white/10">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-white font-semibold">${a.icone || ''} ${a.titre || 'Alerte'}</h3>
            <span class="px-2 py-1 rounded-full text-xs font-semibold ${levelClass(lvl)}">${a.niveau || '-'}</span>
          </div>
          <p class="text-white/90 mt-2">${a.message || ''}</p>
          <p class="text-white/70 text-sm">Urgence: ${a.numero_urgence || '-'}</p>
        </article>
      `;
		})
		.join('');
}

async function loadAlertsPage() {
	if (!qs('alerts-container')) return;
	const mode = qs('mode'); // Type : Incendie / Inondation
	const refresh = qs('refresh-alerts');

	const update = async () => {
		const { lat, lon } = getCoords();
		try {
			// On utilise toujours l'API de simulation mais on filtre côté frontend
			const path = `/api/alerts/simulate?lat=${lat}&lon=${lon}`;
			const data = await apiGet(path);
			let alerts = Array.isArray(data) ? data : [];

			// Filtre par type (Incendie / Inondation)
			const selectedType = normalizeRiskKey(mode.value);
			if (selectedType) {
				alerts = alerts.filter((a) => {
					const key = normalizeRiskKey(a.type);
					if (selectedType.includes('incend')) return key.includes('incend') || key.includes('feu');
					if (selectedType.includes('inond')) return key.includes('inond');
					return true;
				});
			}

			renderAlerts(alerts);
		} catch (e) {
			// Si l'API n'est pas disponible (backend arrêté, réseau, etc.),
			// on affiche simplement qu'aucune alerte n'est disponible au lieu du message technique "Failed to fetch".
			qs('alerts-container').innerHTML = '<p class="text-white/80">Aucune alerte disponible pour le moment.</p>';
		}
	};

	refresh.addEventListener('click', update);
	mode.addEventListener('change', update);
	update();
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

		// Checklists avec icônes adaptées à chaque ligne
		before.innerHTML = (risk.checklist_avant || [])
			.map((x) => {
				const icon = checklistIconForLine(x);
				return `
					<li class="flex items-start gap-2 text-white/90">
						<span class="mt-0.5">${icon}</span>
						<span>${x}</span>
					</li>
				`;
			})
			.join('');
		during.innerHTML = (risk.checklist_pendant || [])
			.map((x) => {
				const icon = checklistIconForLine(x);
				return `
					<li class="flex items-start gap-2 text-white/90">
						<span class="mt-0.5">${icon}</span>
						<span>${x}</span>
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
				const label = typeof r === 'string' && r.length
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
		const details = await Promise.all(types.map((t) => apiGet(`/api/risks/${t}`)));
		const byNumber = new Map();

		details.forEach((risk) => {
			const n = risk.numero_urgence;
			if (!n) return;
			if (!byNumber.has(n)) byNumber.set(n, []);
			byNumber.get(n).push(risk.nom || risk.type || 'Risque');
		});

		list.innerHTML = [...byNumber.entries()]
			.map(([num, labels]) => `
        <li class="rounded-xl bg-veille-3 p-4 border border-white/10">
          <p class="text-white text-2xl font-semibold">${num}</p>
          <p class="text-white/80 mt-1 text-sm">${labels.join(', ')}</p>
          <a href="tel:${num}" class="inline-block mt-3 px-3 py-2 rounded-lg bg-veille-2 text-white font-semibold">Appeler</a>
        </li>
      `)
			.join('');
	} catch (e) {
		list.innerHTML = `<li class="text-red-300">Erreur API: ${e.message}</li>`;
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
