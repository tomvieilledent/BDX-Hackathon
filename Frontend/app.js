const API_BASE = localStorage.getItem('api_base') || 'http://127.0.0.1:7000';
const DEFAULT_LAT = 44.84;
const DEFAULT_LON = -0.58;

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

function normalizeCoords(item) {
	const lat = Number(item.lat ?? item.latitude ?? item.y ?? item.coordonnees?.lat);
	const lon = Number(item.lon ?? item.longitude ?? item.x ?? item.coordonnees?.lon);
	if (Number.isFinite(lat) && Number.isFinite(lon)) {
		return { lat, lon };
	}
	return null;
}

async function loadHomeMap() {
	const mapEl = qs('home-map');
	if (!mapEl || typeof L === 'undefined') return;

	const status = qs('map-status');
	const { lat, lon } = getCoords();
	const map = L.map('home-map').setView([lat, lon], 11);

	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '&copy; OpenStreetMap',
	}).addTo(map);

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

		L.marker([center.lat, center.lon])
			.addTo(map)
			.bindPopup('Centre de recherche');

		const incendies = Array.isArray(data.incendies) ? data.incendies : [];
		let markerCount = 0;
		incendies.forEach((site) => {
			const coords = normalizeCoords(site);
			if (!coords) return;
			markerCount += 1;
			const name = site.raisonSociale || 'Site industriel';
			L.marker([coords.lat, coords.lon])
				.addTo(map)
				.bindPopup(`🔥 ${name}`);
		});

		if (status) {
			status.textContent = `Incendies: ${markerCount} | Forets: ${data.has_forest_data ? 'oui' : 'non'}`;
		}
	} catch (e) {
		if (status) status.textContent = `Erreur carte: ${e.message}`;
	}
}

async function loadHome() {
	const root = qs('home-content');
	if (!root) return;

	loadHomeMap();
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
		select.innerHTML = risks
			.map((r) => {
				const label = typeof r === 'string' && r.length
					? r.charAt(0).toUpperCase() + r.slice(1)
					: r;
				return `<option value="${r}">${label}</option>`;
			})
			.join('');
		if (risks.length) await renderRisk(risks[0]);
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
