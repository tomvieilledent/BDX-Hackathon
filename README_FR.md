# Phario - BDX Hackathon

## Description du Projet

**Phario** est une application web innovante développée lors du hackathon de l'agglomération de Bordeaux en **5 jours**. L'application permet aux citoyens de rester informés sur les risques naturels et technologiques près de leur domicile, de se préparer aux situations d'urgence, et d'accéder rapidement aux numéros d'urgence.

### Objectif

Sensibiliser les habitants de Bordeaux et de son agglomération aux différents risques (inondations, tempêtes, canicules, tremblements de terre, risques industriels) et les aider à mieux se préparer en leur fournissant des informations géolocalisées et des conseils pratiques.

---

## Fonctionnalités

### Page d'Accueil

- **Mode démo** : Permet de tester l'application avec des alertes simulées
- **Recherche de risques** : Localiser les risques près d'une adresse spécifique
- **Carte interactive** : Visualiser les alertes actives en temps réel
- **Météo** : Affichage des conditions météorologiques actuelles et des prévisions

### Page Préparation

- **Sélection du type de risque** : Choisir parmi 6 catégories de risques
- **Conseils immédiats** : Actions à mener dans l'urgence
- **Checklist préparative** : Liste des préparatifs à faire avant une catastrophe
- **Lieux rafraîchissants** : Pour les situations de canicule, accès aux espaces frais de Bordeaux Métropole

### Page Alertes

- **Signalisation d'incidents** : Rapporter les incidents locaux
- **Carte des alertes** : Visualisation interactive des incidents signalés
- **Filtres** : Par type et sévérité des alertes
- **Simulation** : Mode test avec températures simulées

### Page Urgence

- **Accès rapide** : Numéros d'urgence pour :
  - **Pompiers** : 18
  - **SAMU** : 15
  - **Police** : 17
  - **Urgence européenne** : 112
- **Appels directs** : Boutons d'appel intégrés pour un accès immédiat

### Page Résultats

- **Détails des risques** : Informations complètes pour chaque adresse
- **Cartes des risques** : Visualisation géographique des zones à risque
- **Historique** : Données historiques des incidents

---

## Stack Technologique

### Frontend

- **HTML5** : Structure sémantique
- **CSS3 + Tailwind CSS** : Interface responsive et moderne
- **JavaScript** : Interactivité et logique client
- **Leaflet.js** : Cartes interactives

### Backend

- **Python 3.10+**
- **Flask** : Framework web léger et flexible
- **APIs externes** :
  - Géocodage (Nominatim/OpenStreetMap)
  - NASA FIRMS : Données des incendies actifs
  - GéoRisques API : Base de données des risques en France
  - APIs météorologiques

### DevOps & Tools

- **Git** : Contrôle de version
- **GitHub** : Hébergement du code
- **Requirements.txt** : Gestion des dépendances Python

---

## Structure du Projet

```
BDX-Hackathon/
├── Frontend/
│   ├── index.html              # Page d'accueil
│   ├── preparation.html        # Guide de préparation
│   ├── alert.html              # Signalement d'alertes
│   ├── emergency.html          # Numéros d'urgence
│   ├── resultats.html          # Résultats de recherche
│   ├── styles.css              # Styles globaux
│   ├── app.js                  # Logique JavaScript
│   └── images/                 # Ressources (logos, icônes)
│
├── backend/
│   ├── app.py                  # Entrée principale Flask
│   ├── config.py               # Configuration
│   ├── .env                    # Variables d'environnement
│   ├── requirements.txt        # Dépendances Python
│   ├── services/
│   │   ├── geocoding.py       # Service de géocodage
│   │   ├── georisques.py      # Intégration GéoRisques API
│   │   └── nasa_firms.py      # Données d'incendies actifs
│   └── __pycache__/           # Cache Python
│
├── README.md                   # Ce fichier
├── Notes.txt                  # Notes du projet
└── Architecture               # Documentation d'architecture
```

---

## Installation et Démarrage

### Prérequis

- Python 3.10+
- Git

### Installation du Backend

```bash
# Cloner le repository
git clone https://github.com/tomvieilledent/BDX-Hackathon.git
cd BDX-Hackathon

# Créer un environnement virtuel
python -m venv .venv
source .venv/bin/activate  # Sur Windows: .venv\Scripts\activate

# Installer les dépendances
pip install -r backend/requirements.txt

# Configurer les variables d'environnement
cp backend/.env.example backend/.env
# Éditer .env avec vos clés API
```

### Lancer le Backend

```bash
cd backend
python app.py
```

L'application sera accessible à `http://localhost:5000`

### Frontend

Le frontend est servi par le backend Flask. Accédez simplement à l'URL du serveur dans votre navigateur.

Alternativement, for development:

```bash
# Avec un serveur local (Python)
cd Frontend
python -m http.server 8000
# Accessible à http://localhost:8000
```

---

## Équipe de Développement

### Tom Vieilledent - Frontend Developer

- **Responsabilité** : Interface utilisateur, UX/Design, intégration Leaflet
- **Technologies** : HTML, CSS, JavaScript, Tailwind CSS
- **Contributions** : Design responsive, pages principales, intégration des APIs frontend

### Florian Roosebeke - Backend Developer

- **Responsabilité** : Architecture serveur, APIs, intégration des services externes
- **Technologies** : Python, Flask, GéoRisques API
- **Contributions** : Endpoints principaux, logique métier

### Nabil Zinini - Backend Developer

- **Responsabilité** : Base de données, services spécialisés, caching
- **Technologies** : Python, NASA FIRMS API
- **Contributions** : Services de données, optimisations

---

## APIs et Services Externes Utilisés

| Service                       | Utilité                              | Endpoint                             |
| ----------------------------- | ------------------------------------ | ------------------------------------ |
| **OpenStreetMap / Nominatim** | Géocodage (adresse → coordonnées)    | https://nominatim.openstreetmap.org  |
| **GéoRisques API**            | Base de données des risques naturels | https://georisques.gouv.fr           |
| **NASA FIRMS**                | Détection des incendies actifs       | https://firms.modaps.eosdis.nasa.gov |
| **Leaflet.js**                | Cartes interactives                  | https://leafletjs.com                |

---

## Fonctionnalités Futures

- [ ] Notifications push pour les alertes critique
- [ ] Système d'authentification et comptes utilisateurs
- [ ] Support multilingue (EN, ES, etc.)
- [ ] Dashboard administrateur pour la gestion des données
- [ ] Prédictions d'occurrence des risques (ML)
- [ ] Ajout de différents types de risques

---

## Remerciements

- L'agglomération de Bordeaux pour l'opportunité du hackathon
- Holberton School pour la formation
- Les APIs publiques (OpenStreetMap, GéoRisques, NASA) pour les données
- Les devs qui ont participé et supporté le projet

---

## Statistiques du Projet

- **Durée** : Hackathon (5 jours)
- **Équipe** : 3 développeurs (Holberton School - Promotion 1A)
- **Stack** : Flask, HTML/CSS, JavaScript
- **Pages** : 5 pages principales
- **Services** : 3+ APIs externes intégrées

**Version** : 1.0 (Hackathon Release)
