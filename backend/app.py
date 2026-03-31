from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from dotenv import load_dotenv
import os

try:
    # Imports relatifs quand le module est chargé comme package (backend.app)
    from .config import Config
    from .services.georisques import GeorisquesService
except (ImportError, ValueError):
    # Fallback quand on exécute directement backend/app.py
    from config import Config
    from services.georisques import GeorisquesService

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)  # This will enable CORS for all routes

# Initialize Géorisques service
georisques_service = GeorisquesService(app.config['GEORISQUES_API_KEY'])

# Mock data for risks and emergency methods
mock_risks = {
    "inondation": {
        "name": "Inondation",
        "consignes": [
            "Montez en hauteur",
            "Coupez l'électricité",
            "Ne prenez pas votre voiture"
        ],
        "checklist": [
            "Eau potable",
            "Lampe torche",
            "Radio",
            "Médicaments",
            "Papiers importants"
        ]
    },
    "incendie": {
        "name": "Incendie de forêt",
        "consignes": [
            "Fermez les volets et les fenêtres",
            "Arrosez les abords de votre maison",
            "Préparez-vous à évacuer"
        ],
        "checklist": [
            "Vêtements de protection",
            "Masques",
            "Eau en grande quantité"
        ]
    },
    "seveso": {
        "name": "Risque industriel (SEVESO)",
        "consignes": [
            "Restez à l'intérieur et calfeutrez portes et fenêtres",
            "Écoutez la radio pour les consignes des autorités",
            "Ne fumez pas"
        ],
        "checklist": [
            "Kit de confinement",
            "Numéros d'urgence",
            "Radio à piles"
        ]
    }
}

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

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    # For the hackathon, we can simulate alerts.
    # In a real app, this would fetch data from external APIs.
    simulated_alerts = [
        {
            "id": 1,
            "type": "inondation",
            "zone": "Bordeaux Nord",
            "niveau": "élevé",
            "message": "Risque d'inondation élevé dans la zone de Bordeaux Nord. Préparez-vous."
        },
        {
            "id": 2,
            "type": "seveso",
            "zone": "Bassens",
            "niveau": "modéré",
            "message": "Incident sur un site SEVESO à Bassens. Restez informés."
        }
    ]
    return jsonify(simulated_alerts)

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

@app.route('/api/georisques/ppr', methods=['GET'])
def get_ppr_risks():
    """
    Get Plan de Prévention des Risques (PPR) data.
    Requires 'lat' and 'lon' query parameters.
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

    # Use the Géorisques service to fetch PPR data
    ppr_data = georisques_service.get_ppr_risks(lat, lon)
    return jsonify(ppr_data)


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

    risks_data = georisques_service.get_risks_by_coordinates(lat_f, lon_f, radius)

    installations = risks_data.get("risks", {}).get("installations", {})
    data = installations.get("data", []) if isinstance(installations, dict) else []

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

if __name__ == '__main__':
    app.run(debug=True, port=7000)
