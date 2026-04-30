# Phario V2

Application fullstack de vigilance territoriale pour Bordeaux Metropole.

## Objectif

Phario V2 fournit une application autonome (frontend + backend) pour:

- visualiser les alertes de risques sur carte
- rechercher une adresse et centrer les donnees sur cette zone
- consulter les recommandations de preparation
- acceder rapidement aux numeros d'urgence
- creer et supprimer des signalements citoyens

Cette version est completement autonome et n'a pas de dependance externe a un autre dossier V2.

## Stack technique

- Frontend: React 19 + TypeScript + Vite + Leaflet
- Backend: Express + TypeScript
- Validation payload: Zod
- Persistance locale: JSON (`server/data/reports.json`)
- APIs externes:
  - Nominatim (geocodage / reverse geocodage)
  - GéoRisques (sites industriels / SEVESO)
  - Open-Meteo (conditions meteo)

## Arborescence

```text
app/
  server/
    data/
      reports.seed.json
    index.ts
    services.ts
    store.ts
    types.ts
  src/
    components/
    App.tsx
    api.ts
    constants.ts
    main.tsx
    styles.css
    types.ts
  .env.example
  package.json
  tsconfig.json
  vite.config.ts
```

## Installation

```bash
cd V2/app
npm install
```

## Lancement en developpement

```bash
npm run dev
```

Application disponible sur `http://localhost:3000`.

## Build production

```bash
npm run build
npm run start
```

## Endpoints backend

- `GET /api/health`
- `GET /api/geocode?q=<adresse>`
- `GET /api/reverse-geocode?lat=<lat>&lng=<lng>`
- `GET /api/risks/industrial?lat=<lat>&lng=<lng>&rayon=5000&page_size=8`
- `GET /api/weather?lat=<lat>&lng=<lng>`
- `GET /api/alerts?lat=<lat>&lng=<lng>`
- `GET /api/reports`
- `POST /api/reports`
- `DELETE /api/reports/:id`

## Donnees de signalements

Au premier demarrage, le backend initialise `server/data/reports.json` depuis `server/data/reports.seed.json`.

## Qualite et maintenance

- Code TypeScript strict
- API validee avec Zod
- Architecture simple, lisible, sans dependance Firebase
- Dossier autonome et supprimable/transportable tel quel
