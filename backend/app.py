from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from dotenv import load_dotenv
import os
import json
import random

try:
    # Imports relatifs quand le module est chargé comme package (backend.app)
    from .config import Config
    from .services.georisques import GeorisquesService
    from .services.nasa_firms import NasaFirmsService
except (ImportError, ValueError):
    # Fallback quand on exécute directement backend/app.py
    from config import Config
    from services.georisques import GeorisquesService
    from services.nasa_firms import NasaFirmsService

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)  # This will enable CORS for all routes

# Initialize Géorisques service
georisques_service = GeorisquesService(app.config['GEORISQUES_API_KEY'])

# Initialize NASA FIRMS service (feux actifs MODIS/VIIRS)
nasa_firms_service = NasaFirmsService(app.config.get('NASA_FIRMS_API_KEY'))

# Load risks data from JSON file


def load_risks_data():
    """Load risks data from risques.json file"""
    try:
        # Get the directory of the current file
        base_dir = os.path.dirname(os.path.abspath(__file__))
        json_path = os.path.join(base_dir, 'data', 'risques.json')

        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Transform the data structure: from {"risques": [...]} to {type: risk_obj}
        risks_dict = {}
        for risk in data.get('risques', []):
            risks_dict[risk.get('type')] = risk

        return risks_dict
    except Exception as e:
        print(f"Error loading risks data: {e}")
        return {}


# Load risks at app startup
mock_risks = load_risks_data()


def _default_endpoint_for_source(source):
    if source == "meteo":
        return "/api/weather/forecast"
    if source == "georisques":
        return "/api/georisques"
    return None


def get_required_detection_endpoints():
    """Return the set of endpoints declared in risques.json detection config."""
    endpoints = set()
    for risk_info in mock_risks.values():
        detection = risk_info.get("detection", {})
        endpoint = detection.get("endpoint") or _default_endpoint_for_source(
            detection.get("source")
        )
        if endpoint:
            endpoints.add(endpoint)
    return endpoints


def fetch_weather_data(lat, lon):
    """Fetch Météo-France data once when at least one risk needs it."""
    weather_data = None
    try:
        api_key = app.config.get('METEO_FRANCE_API_KEY')
        if api_key:
            url = f"https://public-api.meteofrance.fr/public/arpege/v2/forecast?lat={lat}&lon={lon}"
            headers = {"apikey": api_key}
            response = requests.get(url, headers=headers, timeout=5)
            if response.status_code == 200:
                weather_data = response.json()
    except Exception as e:
        print(f"Warning: Could not fetch weather data: {e}")
    return weather_data


@app.route('/')
def index():
    return "Backend for Risk Prevention App is running!"


@app.route('/api/risks', methods=['GET'])
def get_risks():
    """
    Returns the list of all documented risks.
    """
    return jsonify(list(mock_risks.keys()))


@app.route('/api/risks/<risk_type>', methods=['GET'])
def get_risk_details(risk_type):
    """
    Returns the details for a specific risk type.
    """
    risk = mock_risks.get(risk_type)
    if risk:
        return jsonify(risk)
    return jsonify({"error": "Risk not found"}), 404


def generate_alerts_from_risks(georisques_data, weather_data, lat, lon):
    """
    Generate alerts by combining Géorisques and Météo France data.
    Uses detection rules from risques.json for each risk type.

    Args:
        georisques_data: Risk data from Géorisques API
        weather_data: Weather forecast from Météo France API
        lat, lon: Location coordinates

    Returns:
        List of alert objects
    """
    alerts = []
    alert_id = 1

    # Iterate through all configured risks
    for risk_type, risk_info in mock_risks.items():
        detection_config = risk_info.get("detection", {})
        if not detection_config:
            continue  # Skip risks without detection config

        source = detection_config.get("source")
        endpoint = detection_config.get(
            "endpoint") or _default_endpoint_for_source(source)

        # ===== GEORISQUES-based detection =====
        if source == "georisques":
            type_check = detection_config.get("type_check")

            # Check for SEVESO sites
            if type_check == "seveso" and endpoint in [
                "/api/georisques",
                "/api/georisques/incendies-seveso",
                "/api/map",
            ]:
                try:
                    installations = georisques_data.get(
                        "risks", {}).get("installations", {})
                    inst_data = installations.get("data", []) if isinstance(
                        installations, dict) else []

                    for inst in inst_data:
                        statut_seveso = (
                            inst.get("statutSeveso") or "").strip()
                        if statut_seveso and statut_seveso.lower() != "non seveso":
                            alerts.append({
                                "id": alert_id,
                                "type": risk_type,
                                "niveau": detection_config.get("niveau_alerte"),
                                "titre": detection_config.get("titre_alerte"),
                                "message": detection_config.get("message_template", "").format(
                                    name=inst.get(
                                        'raisonSociale', 'Site industriel'),
                                    status=statut_seveso
                                ),
                                "icone": risk_info.get("icone"),
                                "couleur": risk_info.get("couleur"),
                                "numero_urgence": risk_info.get("numero_urgence"),
                                "consignes_urgence": risk_info.get("consignes_urgence"),
                                "location": {"lat": lat, "lon": lon}
                            })
                            alert_id += 1
                except Exception as e:
                    print(f"Error processing {risk_type}: {e}")

            # Check for flood risks
            elif type_check == "flood" and endpoint == "/api/georisques":
                try:
                    flood_risks = georisques_data.get(
                        "risks", {}).get("floods", {})
                    if flood_risks.get("at_risk") or flood_risks.get("level"):
                        alerts.append({
                            "id": alert_id,
                            "type": risk_type,
                            "niveau": detection_config.get("niveau_alerte"),
                            "titre": detection_config.get("titre_alerte"),
                            "message": "Zone en risque d'inondation selon Géorisques",
                            "icone": risk_info.get("icone"),
                            "couleur": risk_info.get("couleur"),
                            "numero_urgence": risk_info.get("numero_urgence"),
                            "consignes_urgence": risk_info.get("consignes_urgence"),
                            "location": {"lat": lat, "lon": lon}
                        })
                        alert_id += 1
                except Exception as e:
                    print(f"Error processing {risk_type}: {e}")

        # ===== METEO-based detection =====
        elif source == "meteo":
            if endpoint != "/api/weather/forecast":
                continue

            if not weather_data:
                continue

            meteo_field = detection_config.get("meteo_field")
            seuil_min = detection_config.get("seuil_min")
            message_template = detection_config.get(
                "message_template", "Alerte {type}")

            try:
                # Try multiple possible field names for flexibility
                value = weather_data.get(meteo_field)
                if not value:
                    # Try alternate names (e.g., temperature vs temp_max, wind_speed vs vitesseVent)
                    if meteo_field == "temperature":
                        value = weather_data.get(
                            "temp_max") or weather_data.get("temperature")
                    elif meteo_field == "wind_speed":
                        value = weather_data.get(
                            "vitesseVent") or weather_data.get("wind_speed")

                if value and value >= seuil_min:
                    alerts.append({
                        "id": alert_id,
                        "type": risk_type,
                        "niveau": detection_config.get("niveau_alerte"),
                        "titre": detection_config.get("titre_alerte"),
                        "message": message_template.format(value=value),
                        "icone": risk_info.get("icone"),
                        "couleur": risk_info.get("couleur"),
                        "numero_urgence": risk_info.get("numero_urgence"),
                        "consignes_urgence": risk_info.get("consignes_urgence"),
                        "location": {"lat": lat, "lon": lon}
                    })
                    alert_id += 1
            except Exception as e:
                print(f"Error processing {risk_type}: {e}")

    return alerts


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """
    Get alerts for a specific location.
    Requires 'lat' and 'lon' query parameters.
    Returns intelligent alerts combining:
    - Géorisques data (SEVESO sites, flood risks, seismic risks)
    - Météo France data (temperature, wind, weather conditions)
    """
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon parameter"}), 400

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"error": "lat and lon must be numeric values"}), 400

    endpoints = get_required_detection_endpoints()

    needs_georisques = bool(
        endpoints.intersection(
            {
                "/api/georisques",
                "/api/georisques/incendies-seveso",
                "/api/map",
            }
        )
    )
    needs_weather = "/api/weather/forecast" in endpoints

    # Fetch only the sources declared in risques.json
    georisques_data = (
        georisques_service.get_risks_by_coordinates(
            lat, lon) if needs_georisques else {}
    )
    weather_data = fetch_weather_data(lat, lon) if needs_weather else None

    # Generate combined alerts
    alerts = generate_alerts_from_risks(
        georisques_data, weather_data, lat, lon)

    return jsonify(alerts)


@app.route('/api/alerts/simulate', methods=['GET'])
def simulate_alerts():
    """
    Get simulated alerts for demonstration.
    Requires 'lat' and 'lon' query parameters.
    Optional 'severity' parameter: 'danger', 'warning', or 'mixed' (default: 'mixed')
    """
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    severity = request.args.get('severity', 'mixed').lower()

    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon parameter"}), 400

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"error": "lat and lon must be numeric values"}), 400

    if severity not in ['danger', 'warning', 'mixed']:
        return jsonify({"error": "severity must be 'danger', 'warning', or 'mixed'"}), 400

    # Build simulated alerts from configured risks
    alerts = []
    alert_id = 1

    risk_types = list(mock_risks.keys())
    random.shuffle(risk_types)

    # Select 2-3 random risks to simulate
    num_alerts = random.randint(2, min(3, len(risk_types)))
    selected_risks = risk_types[:num_alerts]

    for risk_type in selected_risks:
        risk_info = mock_risks.get(risk_type)
        if not risk_info:
            continue

        # Determine alert level based on severity parameter
        if severity == 'danger':
            niveau = 'critique'
        elif severity == 'warning':
            niveau = 'modéré'
        else:  # mixed
            niveau = random.choice(['critique', 'modéré', 'élevé'])

        # Build alert object
        alert = {
            "id": alert_id,
            "type": risk_type,
            "niveau": niveau,
            "titre": risk_info.get("detection", {}).get("titre_alerte", risk_info.get("nom")),
            "message": f"Alerte simulée {risk_info.get('nom')} - Niveau {niveau}",
            "icone": risk_info.get("icone"),
            "couleur": risk_info.get("couleur"),
            "numero_urgence": risk_info.get("numero_urgence"),
            "consignes_urgence": risk_info.get("consignes_urgence", []),
            "location": {"lat": lat, "lon": lon}
        }
        alerts.append(alert)
        alert_id += 1

    return jsonify(alerts)


@app.route('/api/weather/forecast', methods=['GET'])
def get_weather_forecast():
    """
    Get weather forecast from Météo-France API.
    Requires 'lat' and 'lon' query parameters.
    """
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon parameter"}), 400

    api_key = app.config['METEO_FRANCE_API_KEY']
    if not api_key:
        return jsonify({"error": "Météo-France API key is not configured."}), 500

    url = f"https://public-api.meteofrance.fr/public/arpege/v2/forecast?lat={lat}&lon={lon}"
    headers = {"apikey": api_key}

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise an exception for bad status codes
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/weather/canicule', methods=['GET'])
def get_canicule():
    """Récupère les informations de vigilance canicule via l'API Météo-France.

    Cette route réutilise la clé API de Météo-France déjà configurée et appelle
    l'endpoint de vigilance. L'URL exacte dépend de la doc Météo-France ;
    adapte-la si besoin pendant le hackathon.
    """

    api_key = app.config.get('METEO_FRANCE_API_KEY')
    if not api_key:
        return jsonify({"error": "Météo-France API key is not configured."}), 500

    # TODO: ajuster cette URL à l'endpoint de vigilance que tu utilises réellement
    vigilance_url = "https://public-api.meteofrance.fr/public/vigilance"

    headers = {"apikey": api_key}

    try:
        resp = requests.get(vigilance_url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()

        # Filtre les phénomènes de type "canicule" si la structure correspond
        vigilance_list = data.get("vigilance", [])
        canicule = [
            item
            for item in vigilance_list
            if str(item.get("phenomenon_id")) == "canicule"
        ]

        return jsonify({"canicule": canicule})

    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/fires/nasa', methods=['GET'])
def get_nasa_fires():
    """Retourne les feux actifs autour d'un point via NASA FIRMS/MODIS.

        Query params :
            - lat, lon : centre (obligatoire)
            - radius_km : rayon en kilomètres (défaut = 50)
            - days : fenêtre temporelle en jours (1 à 5, défaut = 1)
            - product : produit NASA (défaut = "MODIS_NRT")

    Réponse :
      {
    "center": {"lat": ..., "lon": ...},
    "radius_km": 50,
    "days": 1,
    "product": "MODIS_NRT",
        "fires": [
          { "latitude": ..., "longitude": ..., ... },
          ...
        ]
      }
    """

    if not nasa_firms_service or not nasa_firms_service.api_key:
        return jsonify({"error": "NASA_FIRMS_API_KEY is not configured."}), 500

    lat = request.args.get('lat')
    lon = request.args.get('lon')
    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon parameter"}), 400

    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except ValueError:
        return jsonify({"error": "lat and lon must be numeric values"}), 400

    radius_km = request.args.get('radius_km', default=50, type=float)
    days = request.args.get('days', default=1, type=int)
    product = request.args.get('product', default='MODIS_NRT')

    # Approximation simple : 1° ~ 111 km (ok pour un hackathon)
    radius_deg = radius_km / 111.0
    min_lat = lat_f - radius_deg
    max_lat = lat_f + radius_deg
    min_lon = lon_f - radius_deg
    max_lon = lon_f + radius_deg

    try:
        fires = nasa_firms_service.get_active_fires_bbox(
            min_lat=min_lat,
            min_lon=min_lon,
            max_lat=max_lat,
            max_lon=max_lon,
            product=product,
            day_range=days,
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 500
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502

    return jsonify(
        {
            "center": {"lat": lat_f, "lon": lon_f},
            "radius_km": radius_km,
            "days": days,
            "product": product,
            "fires": fires,
        }
    )


# --- Routes FireCaster supprimées à la demande :
# /api/firecaster/init, /api/firecaster/step, /api/firecaster/state

@app.route('/api/georisques', methods=['GET'])
def get_georisques():
    """
    Get comprehensive risk data from Géorisques API.
    Requires 'lat' and 'lon' query parameters.
    Optional 'radius' parameter (in meters, default: 10000)
    """
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    radius = request.args.get('radius', default=10000, type=int)

    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon parameter"}), 400

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"error": "lat and lon must be numeric values"}), 400

    # Use the Géorisques service to fetch comprehensive risk data
    risks_data = georisques_service.get_risks_by_coordinates(lat, lon, radius)
    return jsonify(risks_data)


@app.route('/api/georisques/incendies-seveso', methods=['GET'])
def get_fire_and_seveso_risks():
    """Retourne uniquement les installations liées à Seveso et aux risques d'incendie.

    Query params :
      - lat, lon (obligatoires)
      - radius (optionnel, en mètres, défaut 10000)
    """
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    radius = request.args.get('radius', default=10000, type=int)

    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon parameter"}), 400

    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except ValueError:
        return jsonify({"error": "lat and lon must be numeric values"}), 400

    risks_data = georisques_service.get_risks_by_coordinates(
        lat_f, lon_f, radius)

    installations = risks_data.get("risks", {}).get("installations", {})
    data = installations.get("data", []) if isinstance(
        installations, dict) else []

    seveso_sites = []
    fire_risk_sites = []

    for inst in data:
        statut_seveso = (inst.get("statutSeveso") or "").strip()
        if statut_seveso and statut_seveso.lower() != "non seveso":
            seveso_sites.append(inst)

        # Heuristique simple : on cherche "incend" dans les rubriques ou raisons sociales
        raison = (inst.get("raisonSociale") or "").lower()
        rubriques = inst.get("rubriques", []) or []
        has_fire_keyword = "incend" in raison
        if not has_fire_keyword:
            for rub in rubriques:
                nature = (rub.get("nature") or "").lower()
                if "incend" in nature:
                    has_fire_keyword = True
                    break
        if has_fire_keyword:
            fire_risk_sites.append(inst)

    return jsonify(
        {
            "success": True,
            "location": {"lat": lat_f, "lon": lon_f, "radius": radius},
            "seveso_sites": seveso_sites,
            "fire_risk_sites": fire_risk_sites,
        }
    )


@app.route('/api/map', methods=['GET'])
def get_map_data():
    """Combine forêts (IGN) + risques incendie (Géorisques) pour la carte.

    Query params optionnels :
      - lat, lon : position à analyser (défaut = Bordeaux)
      - radius : rayon de recherche en mètres (défaut = 20000)
    """
    # Coordonnées par défaut : Bordeaux
    default_lat = 44.84
    default_lon = -0.58

    lat = request.args.get('lat', type=float) or default_lat
    lon = request.args.get('lon', type=float) or default_lon
    radius = request.args.get('radius', default=20000, type=int)

    # 🔥 Risques incendie via Géorisques
    risks_data = georisques_service.get_risks_by_coordinates(lat, lon, radius)

    installations = risks_data.get("risks", {}).get("installations", {})
    inst_list = installations.get("data", []) if isinstance(
        installations, dict) else []

    incendie_risks = []
    for inst in inst_list:
        raison = (inst.get("raisonSociale") or "").lower()
        rubriques = inst.get("rubriques", []) or []
        has_fire_keyword = "incend" in raison or "feu" in raison
        if not has_fire_keyword:
            for rub in rubriques:
                nature = (rub.get("nature") or "").lower()
                if "incend" in nature or "feu" in nature:
                    has_fire_keyword = True
                    break
        if has_fire_keyword:
            incendie_risks.append(inst)

    # 🌲 Forêts via API Carto Nature (IGN)
    forets_data = {"features": []}
    try:
        nature_url = f"https://apicarto.ign.fr/api/nature?geom={lon},{lat}"
        nature_resp = requests.get(nature_url, timeout=10)

        if nature_resp.status_code == 404:
            forets_data = {"features": [],
                           "info": "Aucune donnée forêt IGN (404)"}
        else:
            nature_resp.raise_for_status()
            forets_data = nature_resp.json()

    except requests.RequestException as e:
        forets_data = {"error": str(e)}

    # Indicateurs pour le frontend
    has_forest_data = False
    if isinstance(forets_data, dict):
        features = forets_data.get("features")
        if isinstance(features, list) and len(features) > 0:
            has_forest_data = True

    has_fire_risks = len(incendie_risks) > 0

    return jsonify(
        {
            "center": {"lat": lat, "lon": lon},
            "radius": radius,
            "forets": forets_data,
            "incendies": incendie_risks,
            "has_forest_data": has_forest_data,
            "has_fire_risks": has_fire_risks,
        }
    )


if __name__ == '__main__':
    app.run(debug=True, port=7000)
