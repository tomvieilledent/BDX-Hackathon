# Phario - BDX Hackathon (V2)

## Description du Projet

**Phario** est une application web de vigilance territoriale qui aide les citoyens a:

- rester informes sur les risques naturels et technologiques pres de leur domicile
- se preparer aux situations d'urgence
- acceder rapidement aux numeros d'urgence
- signaler des incidents locaux

### Objectif

Sensibiliser les habitants de Bordeaux et de son agglomeration aux differents risques (inondations, tempetes, canicules, risques industriels, etc.) et leur fournir des informations geolocalisees et actionnables.

---

## Fonctionnalites

### Dashboard

- Recherche d'adresse geolocalisee
- Carte interactive (Leaflet)
- Visualisation des alertes actives
- Consolidation des donnees risques + signalements
- Aggregation multi-sources avec priorite temps reel

### Signalements

- Creation de signalements citoyens
- Suppression de signalements
- Persistance locale JSON cote backend

### Preparation

- Guides pratiques par type de risque
- Checklist d'actions immediates

### Urgence

- Acces rapide aux numeros d'urgence:
  - Pompiers: 18
  - SAMU: 15
  - Police: 17
  - Urgence europeenne: 112

---

## Stack Technologique

### Frontend

- React 19
- TypeScript
- Vite
- Leaflet / React-Leaflet
- CSS custom responsive

### Backend

- Node.js + Express
- TypeScript
- Zod (validation des payloads)
- API geocodage Nominatim
- API GéoRisques (risques potentiels autour du domicile)
- API Open-Meteo (meteo temps reel)
- USGS Earthquake API (temps reel)
- NASA EONET (evenements naturels actifs)
- GDACS (catastrophes globales)
- NOAA/NHC (tempetes actives)
- NASA FIRMS (optionnel via cle API)
- Connecteurs optionnels configurables (Vigicrues, APIC, EFFIS, EFAS, IRSN, EURDEP, BRGM)

### Dev Tools

- npm scripts (`dev`, `lint`, `build`, `start`)
- Type checking via `tsc --noEmit`

---

## Structure du Projet

```text
V2/
├── README.md
└── app/
		├── server/
		│   ├── data/
		│   │   └── reports.seed.json
		│   ├── index.ts
		│   ├── services.ts
		│   ├── store.ts
		│   └── types.ts
		├── src/
		│   ├── components/
		│   ├── App.tsx
		│   ├── api.ts
		│   ├── constants.ts
		│   ├── main.tsx
		│   ├── styles.css
		│   └── types.ts
		├── .env.example
		├── package.json
		├── tsconfig.json
		└── vite.config.ts
```

---

## Installation et Demarrage

### Prerequis

- Node.js 20+
- npm

### Installation

```bash
cd V2/app
npm install
```

### Lancer en developpement

```bash
npm run dev
```

Application accessible sur `http://localhost:3000`.

### Verifications qualite

```bash
npm run lint
npm run build
```

---

## APIs et Services Externes Utilises

| Service                   | Utilite                               | Endpoint                             |
| ------------------------- | ------------------------------------- | ------------------------------------ |
| OpenStreetMap / Nominatim | Geocodage et reverse geocodage        | https://nominatim.openstreetmap.org  |
| Open-Meteo                | Donnees meteo et vigilance locale     | https://api.open-meteo.com           |
| USGS Earthquake API       | Seismes en temps reel                 | https://earthquake.usgs.gov          |
| NASA EONET                | Evenements naturels actifs            | https://eonet.gsfc.nasa.gov          |
| GDACS                     | Catastrophes globales                 | https://www.gdacs.org                |
| NOAA / NHC                | Tempetes et cyclones actifs           | https://www.nhc.noaa.gov             |
| NASA FIRMS (optionnel)    | Points chauds / incendies             | https://firms.modaps.eosdis.nasa.gov |
| GéoRisques API            | Risques potentiels autour du domicile | https://georisques.gouv.fr           |
| Leaflet                   | Carte interactive                     | https://leafletjs.com                |

---

## Couverture Risques (V2)

Politique appliquee:

- **Temps reel prioritaire** pour les alertes actives
- **Exception**: risques potentiels autour de chez vous (statique/contextuel via Georisques)

| Risque                              | Source                           | Statut V2                            | Mode                          |
| ----------------------------------- | -------------------------------- | ------------------------------------ | ----------------------------- |
| Incendies foret                     | NASA FIRMS                       | Actif si cle API fournie             | Temps reel                    |
| Incendies / risques naturels        | NASA EONET                       | Actif                                | Quasi temps reel              |
| Inondations / meteo locale          | Open-Meteo + EONET + connecteurs | Actif + extensible                   | Temps reel / quasi temps reel |
| Crues / pluie intense FR            | Vigicrues / APIC / Vigilance     | Connecteurs prets via env            | Temps reel                    |
| Seismes                             | USGS Earthquake API              | Actif                                | Temps reel                    |
| Catastrophes globales               | GDACS                            | Actif                                | Temps reel                    |
| Tempetes monde                      | NOAA/NHC                         | Actif                                | Temps reel                    |
| Radiologique FR/EU                  | IRSN / EURDEP                    | Connecteurs prets via env            | Quasi temps reel              |
| Sites SEVESO / ICPE                 | Georisques                       | Actif                                | Potentiel local               |
| Radon / multi-risques / sols / BRGM | Georisques / BRGM                | Connecteurs prets + base potentielle | Potentiel local               |

### Variables d'environnement pour etendre les flux

Configurer dans `V2/app/.env` (voir `.env.example`):

- `NASA_FIRMS_API_KEY`
- `VIGICRUES_API_URL`
- `VIGICRUES_FLASH_API_URL`
- `APIC_API_URL`
- `METEO_VIGILANCE_API_URL`
- `EFFIS_API_URL`
- `EFAS_API_URL`
- `IRSN_API_URL`
- `EURDEP_API_URL`
- `BRGM_API_URL`

---

## Mise a jour V1 -> V2

Cette V2 est une **refonte complete** de l'application avec nettoyage de l'architecture et modernisation de la stack.

### Ce qui a ete refait

- Refactor complet du projet dans `V2/app` (application autonome fullstack)
- Refonte frontend vers React + TypeScript + Vite
- Refonte backend vers Express + TypeScript
- Ajout d'une API interne claire (`/api/health`, `/api/alerts`, `/api/reports`, `/api/geocode`, etc.)
- Passage a un agregateur multi-risques orienté temps reel
- Validation serveur des payloads avec Zod
- Refonte UI/UX: dashboard, carte, panneaux signalements, preparation et urgence
- Uniformisation des types metier (alertes, categories, signalements)
- Documentation et scripts npm standardises

### Nettoyage et suppression des doublons

- Suppression des dependances non necessaires a la version finale
- Conservation d'une seule source de verite: `V2/app`

### Gains concrets

- Codebase plus lisible, modulaire et maintenable
- Build et verification type-safe
- Deploiement simplifie (un seul dossier applicatif)
- Application independante de dossiers externes

---

## Remerciements

- L'agglomeration de Bordeaux pour l'opportunite du hackathon
- Holberton School pour la formation
- Les APIs publiques (OpenStreetMap, GéoRisques, Open-Meteo)

---

## Version

- V1: Hackathon initial (Flask + HTML/CSS/JS)
- V2: Refonte complete fullstack TypeScript (React + Express)
