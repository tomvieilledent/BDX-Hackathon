from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from dotenv import load_dotenv
import os
import json
import random
import math

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
    """Fetch current weather data using Open-Meteo aggregated endpoint.
    Returns dict with current temperature from the aggregated forecast."""
    try:
        # Call our Open-Meteo endpoint to get aggregated Bordeaux region forecast
        data = fetch_weather_multi_points(BORDEAUX_POINTS)

        if data is None or len(data) == 0:
            return None

        # Extract current/first hour temperature from the first location
        hourly_data = compute_hourly_mean(data)
        if hourly_data and len(hourly_data) > 0:
            # Return first hour's temperature as "current"
            return {"temperature_mean": hourly_data[0]["temperature_mean"]}

        return None
    except Exception as e:
        print(f"Warning: Could not fetch weather data: {e}")
        return None


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


def _safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _coords_from_mapping(obj):
    if not isinstance(obj, dict):
        return None

    lat = _safe_float(obj.get("lat") or obj.get("latitude") or obj.get("y"))
    lon = _safe_float(
        obj.get("lon") or obj.get("lng") or obj.get(
            "longitude") or obj.get("x")
    )
    if lat is not None and lon is not None and math.isfinite(lat) and math.isfinite(lon):
        return {"lat": lat, "lon": lon}

    coords = obj.get("coordinates")
    if isinstance(coords, (list, tuple)) and len(coords) >= 2:
        lon2 = _safe_float(coords[0])
        lat2 = _safe_float(coords[1])
        if lat2 is not None and lon2 is not None and math.isfinite(lat2) and math.isfinite(lon2):
            return {"lat": lat2, "lon": lon2}

    for key in [
        "geometry",
        "geom",
        "geometrie",
        "coordonnees",
        "location",
        "position",
        "point",
        "center",
        "centre",
    ]:
        nested = obj.get(key)
        nested_coords = _coords_from_mapping(nested)
        if nested_coords:
            return nested_coords

    return None


def extract_alert_location(payload, default_lat, default_lon, max_depth=4):
    """Find first valid lat/lon in nested API payload, fallback to requested point."""
    if max_depth < 0:
        return {"lat": default_lat, "lon": default_lon}

    if isinstance(payload, dict):
        direct = _coords_from_mapping(payload)
        if direct:
            return direct

        for value in payload.values():
            found = extract_alert_location(
                value, default_lat, default_lon, max_depth - 1)
            if found["lat"] != default_lat or found["lon"] != default_lon:
                return found

    elif isinstance(payload, list):
        for item in payload:
            found = extract_alert_location(
                item, default_lat, default_lon, max_depth - 1)
            if found["lat"] != default_lat or found["lon"] != default_lon:
                return found

    return {"lat": default_lat, "lon": default_lon}


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
                            alert_location = extract_alert_location(
                                inst, lat, lon)
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
                                "location": alert_location,
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
                        alert_location = extract_alert_location(
                            flood_risks, lat, lon)
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
                            "location": alert_location,
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

                if value is not None and value >= seuil_min:
                    niveau = detection_config.get("niveau_alerte")
                    if risk_type == "canicule":
                        if value >= 40:
                            niveau = "critique"
                        elif value >= 37:
                            niveau = "élevé"
                        else:
                            niveau = "modéré"

                    alerts.append({
                        "id": alert_id,
                        "type": risk_type,
                        "niveau": niveau,
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
    # Récupère les coordonnées depuis la requête
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)
    if lat is None or lon is None:
        return jsonify({"error": "Missing lat or lon parameter"}), 400

    # Récupère les données risques et météo
    georisques_data = georisques_service.get_risks_by_coordinates(lat, lon)
    # Pour la météo, on prend la première heure de la prévision
    weather_arr = fetch_weather_multi_points(BORDEAUX_POINTS)
    weather_data = None
    if weather_arr and isinstance(weather_arr, list):
        hourly = compute_hourly_mean(weather_arr)
        if hourly and len(hourly) > 0:
            weather_data = hourly[0]

    alerts = generate_alerts_from_risks(
        georisques_data, weather_data, lat, lon)
    return jsonify(alerts)


@app.route('/api/alerts/simulate', methods=['GET'])
def simulate_alerts():
    """
    Get simulated alerts for demonstration.
    Requires 'lat' and 'lon' query parameters.
    Optional 'severity' parameter: 'danger', 'warning', or 'mixed' (default: 'mixed')
    Optional 'temp' parameter: simulated temperature in C for canicule logic.
    """
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    severity = request.args.get('severity', 'mixed').lower()
    temp = request.args.get('temp')

    if not lat or not lon:
        return jsonify({"error": "Missing lat or lon parameter"}), 400

    try:
        lat = float(lat)
        lon = float(lon)
    except ValueError:
        return jsonify({"error": "lat and lon must be numeric values"}), 400

    if severity not in ['danger', 'warning', 'mixed']:
        return jsonify({"error": "severity must be 'danger', 'warning', or 'mixed'"}), 400

    simulated_temp = None
    if temp is not None:
        try:
            simulated_temp = float(temp)
        except ValueError:
            return jsonify({"error": "temp must be a numeric value"}), 400

    canicule_config = mock_risks.get("canicule", {}).get("detection", {})
    canicule_threshold = canicule_config.get("seuil_min", 35)

    # If no explicit temperature is provided, generate a realistic one for simulation.
    if simulated_temp is None:
        if severity == 'danger':
            simulated_temp = round(random.uniform(38, 44), 1)
        elif severity == 'warning':
            simulated_temp = round(random.uniform(35, 38), 1)
        else:  # mixed
            simulated_temp = round(random.uniform(33, 41), 1)

    # Build simulated alerts from configured risks
    alerts = []
    alert_id = 1

    risk_types = list(mock_risks.keys())
    random.shuffle(risk_types)

    # Select 2-3 random risks to simulate
    num_alerts = random.randint(2, min(3, len(risk_types)))
    selected_risks = risk_types[:num_alerts]

    # Demo positions around Bordeaux center by risk type (lat, lon)
    demo_points_by_risk = {
        "Industriel": (44.8563, -0.5364),
        "Inondation": (44.8374, -0.5668),
        "Canicule": (44.8292, -0.6051),
    }

    for risk_type in selected_risks:
        risk_info = mock_risks.get(risk_type)
        if not risk_info:
            continue

        # Canicule should only be simulated when the simulated temperature reaches threshold.
        if risk_type == 'canicule' and simulated_temp < canicule_threshold:
            continue

        # Determine alert level from temperature for canicule, else keep severity-based simulation.
        if risk_type == 'canicule':
            if simulated_temp >= 40:
                niveau = 'critique'
            elif simulated_temp >= 37:
                niveau = 'élevé'
            else:
                niveau = 'modéré'
        else:
            if severity == 'danger':
                niveau = 'critique'
            elif severity == 'warning':
                niveau = 'modéré'
            else:  # mixed
                niveau = random.choice(['critique', 'modéré', 'élevé'])

        # Build message with temperature for canicule only
        if risk_type == 'canicule':
            message = f"Température simulée : {simulated_temp}°C - Niveau {niveau}"
        else:
            message = f"Alerte simulée {risk_info.get('nom')} - Niveau {niveau}"

        # Build a simulated location per risk type with a tiny random jitter
        base_point = demo_points_by_risk.get(risk_type, (lat, lon))
        jitter_lat = random.uniform(-0.002, 0.002)
        jitter_lon = random.uniform(-0.002, 0.002)
        sim_lat = round(base_point[0] + jitter_lat, 6)
        sim_lon = round(base_point[1] + jitter_lon, 6)

        # Build alert object
        alert = {
            "id": alert_id,
            "type": risk_type,
            "niveau": niveau,
            "titre": risk_info.get("detection", {}).get("titre_alerte", risk_info.get("nom")),
            "message": message,
            "icone": risk_info.get("icone"),
            "couleur": risk_info.get("couleur"),
            "numero_urgence": risk_info.get("numero_urgence"),
            "consignes_urgence": risk_info.get("consignes_urgence", []),
            "location": {"lat": sim_lat, "lon": sim_lon}
        }
        if risk_type == 'canicule':
            alert["temperature"] = simulated_temp
        alerts.append(alert)
        alert_id += 1

    return jsonify(alerts)


# Bordeaux region points for weather aggregation
BORDEAUX_POINTS = [
    (44.84, -0.58),  # centre
    (44.99, -0.58),  # nord
    (44.69, -0.58),  # sud
    (44.84, -0.38),  # est
    (44.84, -0.78),  # ouest
]


def fetch_weather_multi_points(points):
    """Fetch temperature data from Open-Meteo API for multiple points.
    Returns list of results, one per point."""
    base_url = "https://api.open-meteo.com/v1/forecast"
    latitudes = ",".join(str(lat) for lat, _ in points)
    longitudes = ",".join(str(lon) for _, lon in points)

    params = {
        "latitude": latitudes,
        "longitude": longitudes,
        "hourly": "temperature_2m,windspeed_10m,weathercode",
        "timezone": "Europe/Paris"
    }

    try:
        resp = requests.get(base_url, params=params, timeout=10)
        resp.raise_for_status()
        return resp.json()  # Returns list of location results
    except requests.exceptions.RequestException as e:
        print(f"Error fetching weather from Open-Meteo: {e}")
        return None


def compute_hourly_mean(response_list):
    """Compute hourly mean temperature across all locations.
    response_list is a list of result objects from Open-Meteo (one per location)"""
    if not response_list or not isinstance(response_list, list) or len(response_list) == 0:
        return []

    # Extract hourly data from first location to get times
    first_result = response_list[0]
    if "hourly" not in first_result or "time" not in first_result["hourly"]:
        return []

    times = first_result["hourly"]["time"]

    # Gather temperature, windspeed, and weathercode arrays from all locations
    temps_all_locations = []
    winds_all_locations = []
    weathercodes_all_locations = []
    for result in response_list:
        if "hourly" in result:
            if "temperature_2m" in result["hourly"]:
                temps_all_locations.append(result["hourly"]["temperature_2m"])
            if "windspeed_10m" in result["hourly"]:
                winds_all_locations.append(result["hourly"]["windspeed_10m"])
            if "weathercode" in result["hourly"]:
                weathercodes_all_locations.append(
                    result["hourly"]["weathercode"])

    if not temps_all_locations:
        return []

    nb_locations = len(temps_all_locations)
    nb_hours = len(times)

    result = []
    for i in range(nb_hours):
        temp_sum = sum(temps_all_locations[loc][i]
                       for loc in range(nb_locations))
        mean_temp = temp_sum / nb_locations

        wind_mean = None
        if winds_all_locations:
            wind_sum = sum(winds_all_locations[loc][i]
                           for loc in range(len(winds_all_locations)))
            wind_mean = wind_sum / len(winds_all_locations)

        weathercode = None
        if weathercodes_all_locations:
            # Use the most frequent weathercode for this hour
            codes = [weathercodes_all_locations[loc][i]
                     for loc in range(len(weathercodes_all_locations))]
            weathercode = max(set(codes), key=codes.count)

        result.append({
            "time": times[i],
            "temperature_mean": mean_temp,
            "wind_mean": wind_mean,
            "weathercode": weathercode
        })

    return result


@app.route('/api/weather/forecast', methods=['GET'])
def get_weather_forecast():
    """
    Get weather forecast using Open-Meteo API aggregated over Bordeaux region.
    Optional 'lat' and 'lon' parameters (ignored, uses Bordeaux region).
    Returns hourly temperature mean across 5 points (center, N, S, E, W).
    """
    data = fetch_weather_multi_points(BORDEAUX_POINTS)
    hourly_mean = compute_hourly_mean(data)

    if not hourly_mean:
        return jsonify({"error": "Could not fetch weather data"}), 500

    # Ajout qualité de l'air (indice) via Open-Meteo Air Quality API (centre Bordeaux)
    air_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
    air_params = {
        "latitude": 44.84,
        "longitude": -0.58,
        "hourly": "european_aqi",
        "timezone": "Europe/Paris"
    }
    air_quality = None
    try:
        air_resp = requests.get(air_url, params=air_params, timeout=10)
        air_resp.raise_for_status()
        air_data = air_resp.json()
        if "hourly" in air_data and "european_aqi" in air_data["hourly"]:
            # AQI for first hour
            air_quality = air_data["hourly"]["european_aqi"][0]
    except Exception as e:
        air_quality = None

    # Ajoute la qualité de l'air et le vent à la première heure (résumé)
    if hourly_mean:
        hourly_mean[0]["air_quality"] = air_quality

    return jsonify(hourly_mean)


@app.route('/api/weather/bordeaux-radius', methods=['GET'])
def get_weather_bordeaux_radius():
    """
    Alias for /api/weather/forecast - weather aggregated over Bordeaux region.
    """
    return get_weather_forecast()


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


def geocode_address(address):
    """Geocode a postal address using api-adresse.data.gouv.fr."""
    try:
        resp = requests.get(
            "https://api-adresse.data.gouv.fr/search/",
            params={"q": address, "limit": 1},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException as e:
        return {"error": f"Geocoding request failed: {e}"}

    features = payload.get("features", []) if isinstance(payload, dict) else []
    if not features:
        return {"error": "Address not found"}

    first = features[0] if isinstance(features[0], dict) else {}
    geometry = first.get("geometry", {}) if isinstance(first, dict) else {}
    coordinates = geometry.get(
        "coordinates", []) if isinstance(geometry, dict) else []
    properties = first.get("properties", {}) if isinstance(first, dict) else {}

    if not isinstance(coordinates, list) or len(coordinates) < 2:
        return {"error": "Geocoder did not return valid coordinates"}

    lon = coordinates[0]
    lat = coordinates[1]

    try:
        lon = float(lon)
        lat = float(lat)
    except (TypeError, ValueError):
        return {"error": "Geocoder coordinates are invalid"}

    return {
        "lat": lat,
        "lon": lon,
        "label": properties.get("label") or address,
        "city": properties.get("city"),
        "postcode": properties.get("postcode"),
        "citycode": properties.get("citycode"),
        "type": properties.get("type"),
    }


@app.route('/api/geocode/suggest', methods=['GET'])
def suggest_addresses():
    """Return address suggestions while user types."""
    query = (request.args.get('q') or '').strip()
    limit = request.args.get('limit', default=6, type=int)

    if len(query) < 3:
        return jsonify({"success": True, "suggestions": []})

    limit = max(1, min(limit, 10))

    try:
        resp = requests.get(
            "https://api-adresse.data.gouv.fr/search/",
            params={"q": query, "limit": limit,
                    "autocomplete": 1, "type": "housenumber"},
            timeout=10,
        )
        resp.raise_for_status()
        payload = resp.json()
    except requests.RequestException as e:
        return jsonify({"error": f"Suggestion request failed: {e}"}), 502

    features = payload.get("features", []) if isinstance(payload, dict) else []
    suggestions = []
    for feature in features:
        if not isinstance(feature, dict):
            continue
        props = feature.get("properties", {}) if isinstance(
            feature.get("properties"), dict) else {}
        geometry = feature.get("geometry", {}) if isinstance(
            feature.get("geometry"), dict) else {}
        coords = geometry.get("coordinates", []) if isinstance(
            geometry.get("coordinates"), list) else []
        lon = coords[0] if len(coords) >= 2 else None
        lat = coords[1] if len(coords) >= 2 else None

        suggestions.append(
            {
                "label": props.get("label"),
                "city": props.get("city"),
                "postcode": props.get("postcode"),
                "citycode": props.get("citycode"),
                "type": props.get("type"),
                "lat": lat,
                "lon": lon,
            }
        )

    return jsonify({"success": True, "suggestions": suggestions})


def build_georisques_report_url(geocoded):
    """Build official georisques rapport2 URL from geocoded address metadata."""
    base_url = "https://www.georisques.gouv.fr/mes-risques/connaitre-les-risques-pres-de-chez-moi/rapport2"
    params = {
        "form-adresse": "true",
        "isCadastre": "false",
        "city": geocoded.get("city") or "",
        "type": geocoded.get("type") or "housenumber",
        "typeForm": "adresse",
        "codeInsee": geocoded.get("citycode") or "",
        "lon": geocoded.get("lon"),
        "lat": geocoded.get("lat"),
        "go_back": "/",
        "propertiesType": geocoded.get("type") or "housenumber",
        "adresse": geocoded.get("label") or "",
    }
    query = requests.compat.urlencode(params)
    return f"{base_url}?{query}"


@app.route('/api/georisques/report-url', methods=['GET'])
def get_georisques_report_url():
    """Geocode an address and return the official Georisques rapport2 URL."""
    address = (request.args.get('address') or '').strip()
    if not address:
        return jsonify({"error": "Missing address parameter"}), 400

    geocoded = geocode_address(address)
    if geocoded.get("error"):
        return jsonify({"error": geocoded["error"]}), 404

    report_url = build_georisques_report_url(geocoded)
    return jsonify({"success": True, "url": report_url, "geocoding": geocoded})


@app.route('/api/georisques/by-address', methods=['GET'])
def get_georisques_by_address():
    """Geocode an address and return Géorisques data for that location."""
    address = (request.args.get('address') or '').strip()
    radius = request.args.get('radius', default=10000, type=int)

    if not address:
        return jsonify({"error": "Missing address parameter"}), 400

    geocoded = geocode_address(address)
    if geocoded.get("error"):
        return jsonify({"error": geocoded["error"]}), 404

    risks_data = georisques_service.get_risks_by_coordinates(
        geocoded["lat"], geocoded["lon"], radius
    )

    return jsonify(
        {
            "success": True,
            "query": address,
            "geocoding": geocoded,
            "radius": radius,
            "georisques": risks_data,
        }
    )


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
