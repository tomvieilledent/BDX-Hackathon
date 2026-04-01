# Phario - BDX Hackathon

## Project Description

**Phario** is an innovative web application developed during the Bordeaux Agglomeration hackathon in **5 days**. The application allows citizens to stay informed about natural and technological risks near their homes, prepare for emergency situations, and quickly access emergency numbers.

### Objective

Raise awareness among residents of Bordeaux and its metropolitan area about various risks (floods, storms, heat waves, earthquakes, industrial hazards) and help them prepare better by providing geolocation-based information and practical advice.

---

## Features

### Home Page

- **Demo Mode** : Test the application with simulated alerts
- **Risk Search** : Locate risks near a specific address
- **Interactive Map** : View active alerts in real time
- **Weather** : Display current weather conditions and forecasts

### Preparation Page

- **Risk Type Selection** : Choose from 6 risk categories
- **Immediate Advice** : Actions to take in an emergency
- **Preparative Checklist** : List of preparations to make before a disaster
- **Cooling Spaces** : For heat wave situations, access to cool spaces in Bordeaux Metropolis

### Alerts Page

- **Incident Reporting** : Report local incidents
- **Alert Map** : Interactive visualization of reported incidents
- **Filters** : By type and severity of alerts
- **Simulation** : Test mode with simulated temperatures

### Emergency Page

- **Quick Access** : Emergency numbers for:
  - **Fire Department** : 18
  - **Emergency Medical** : 15
  - **Police** : 17
  - **European Emergency** : 112
- **Direct Calls** : Integrated call buttons for immediate access

### Results Page

- **Risk Details** : Complete information for each address
- **Risk Maps** : Geographic visualization of at-risk areas
- **History** : Historical data of incidents

---

## Technology Stack

### Frontend

- **HTML5** : Semantic structure
- **CSS3 + Tailwind CSS** : Responsive and modern interface
- **JavaScript** : Client-side interactivity and logic
- **Leaflet.js** : Interactive maps

### Backend

- **Python 3.10+**
- **Flask** : Lightweight and flexible web framework
- **External APIs** :
  - Geocoding (Nominatim/OpenStreetMap)
  - NASA FIRMS : Active fire data
  - GéoRisques API : France risk database
  - Weather APIs

### DevOps & Tools

- **Git** : Version control
- **GitHub** : Code hosting
- **Requirements.txt** : Python dependency management

---

## Project Structure

```
BDX-Hackathon/
├── Frontend/
│   ├── index.html              # Home page
│   ├── preparation.html        # Preparation guide
│   ├── alert.html              # Alert reporting
│   ├── emergency.html          # Emergency numbers
│   ├── resultats.html          # Search results
│   ├── styles.css              # Global styles
│   ├── app.js                  # JavaScript logic
│   └── images/                 # Resources (logos, icons)
│
├── backend/
│   ├── app.py                  # Flask main entry point
│   ├── config.py               # Configuration
│   ├── .env                    # Environment variables
│   ├── requirements.txt        # Python dependencies
│   ├── services/
│   │   ├── geocoding.py       # Geocoding service
│   │   ├── georisques.py      # GéoRisques API integration
│   │   └── nasa_firms.py      # Active fire data
│   └── __pycache__/           # Python cache
│
├── README.md                   # This file
├── Notes.txt                  # Project notes
└── Architecture               # Architecture documentation
```

---

## Installation & Setup

### Requirements

- Python 3.10+
- Git

### Backend Installation

```bash
# Clone the repository
git clone https://github.com/tomvieilledent/BDX-Hackathon.git
cd BDX-Hackathon

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt

# Configure environment variables
cp backend/.env.example backend/.env
# Edit .env with your API keys
```

### Launch Backend

```bash
cd backend
python app.py
```

The application will be accessible at `http://localhost:5000`

### Frontend

The frontend is served by the Flask backend. Simply access the server URL in your browser.

Alternatively, for development:

```bash
# With a local Python server
cd Frontend
python -m http.server 8000
# Accessible at http://localhost:8000
```

---

## Development Team

### Tom Vieilledent - Frontend Developer

- **Responsibility** : User interface, UX/Design, Leaflet integration
- **Technologies** : HTML, CSS, JavaScript, Tailwind CSS
- **Contributions** : Responsive design, main pages, frontend API integration

### Florian Roosebeke - Backend Developer

- **Responsibility** : Server architecture, APIs, external services integration
- **Technologies** : Python, Flask, GéoRisques API
- **Contributions** : Main endpoints, business logic

### Nabil Zinini - Backend Developer

- **Responsibility** : Database, specialized services, caching
- **Technologies** : Python, NASA FIRMS API
- **Contributions** : Data services, optimizations

---

## External APIs and Services Used

| Service                       | Usage                             | Endpoint                             |
| ----------------------------- | --------------------------------- | ------------------------------------ |
| **OpenStreetMap / Nominatim** | Geocoding (address → coordinates) | https://nominatim.openstreetmap.org  |
| **GéoRisques API**            | Natural risks database            | https://georisques.gouv.fr           |
| **NASA FIRMS**                | Active fire detection             | https://firms.modaps.eosdis.nasa.gov |
| **Leaflet.js**                | Interactive maps                  | https://leafletjs.com                |

---

## Future Features

- [ ] Push notifications for critical alerts
- [ ] Authentication system and user accounts
- [ ] Multi-language support (EN, ES, etc.)
- [ ] Admin dashboard for data management
- [ ] Risk occurrence predictions (ML)
- [ ] Addition of different risk types

---

## Remerciements

- L'agglomération de Bordeaux pour l'opportunité du hackathon
- Holberton School pour la formation
- Les APIs publiques (OpenStreetMap, GéoRisques, NASA) pour les données
- Les devs qui ont participé et supporté le projet

---

## Statistiques du Projet

- **Duration** : Hackathon (5 days)
- **Team** : 3 developers (Holberton School - Promotion 1A)
- **Stack** : Flask, HTML/CSS, JavaScript
- **Pages** : 5 pages principales
- **Services** : 3+ APIs externes intégrées

**Version** : 1.0 (Hackathon Release)
