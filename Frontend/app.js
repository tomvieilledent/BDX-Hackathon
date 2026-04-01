const API_BASE = localStorage.getItem('api_base') || 'http://127.0.0.1:7000';
const DEFAULT_LAT = 44.84;
const DEFAULT_LON = -0.58;
let homeMap = null;
let homeAlertMarkersLayer = null;

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

function normalizeCoords(item) {
	const lat = Number(item.lat ?? item.latitude ?? item.y ?? item.coordonnees?.lat);
	const lon = Number(item.lon ?? item.longitude ?? item.x ?? item.coordonnees?.lon);
	if (Number.isFinite(lat) && Number.isFinite(lon)) {
		return { lat, lon };
	}
	return null;
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

		// Remove incendies and forests counter from status
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

	await loadHomeMap();

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
			const alerts = demoMode ? fetchedAlerts.slice(0, 1) : fetchedAlerts;
			renderAlertPingsOnMap(alerts);
			if (alerts.length) {
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
				alertsSection.classList.add('hidden');
				alertsContainer.innerHTML = '';
			}
		} catch (e) {
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
	const mode = qs('mode');
	const severity = qs('severity');
	const temp = qs('temp');
	const refresh = qs('refresh-alerts');

	const update = async () => {
		const { lat, lon } = getCoords();
		try {
			const path =
				mode.value === 'live'
					? `/api/alerts?lat=${lat}&lon=${lon}`
					: `/api/alerts/simulate?lat=${lat}&lon=${lon}&severity=${severity.value}${temp.value ? `&temp=${encodeURIComponent(temp.value)}` : ''}`;
			const data = await apiGet(path);
			renderAlerts(Array.isArray(data) ? data : []);
		} catch (e) {
			qs('alerts-container').innerHTML = `<p class="text-red-300">Erreur: ${e.message}</p>`;
		}
	};

	refresh.addEventListener('click', update);
	mode.addEventListener('change', update);
	severity.addEventListener('change', update);
	update();
}

async function loadPreparationPage() {
	const select = qs('risk-select');
	if (!select) return;

	const before = qs('before-list');
	const during = qs('during-list');
	const title = qs('risk-title');

	const renderRisk = async (riskType) => {
		const risk = await apiGet(`/api/risks/${riskType}`);
		// On ne met plus le nom (ex: "Inondation") sous le sélecteur
		if (title) title.textContent = '';
		before.innerHTML = (risk.checklist_avant || []).map((x) => `<li class="text-white/90">- ${x}</li>`).join('');
		during.innerHTML = (risk.checklist_pendant || []).map((x) => `<li class="text-white/90">- ${x}</li>`).join('');
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
	loadAlertsPage();
	loadPreparationPage();
	loadEmergencyPage();
});
