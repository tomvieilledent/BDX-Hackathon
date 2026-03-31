import requests
from config import METEO_FRANCE_API_KEY

BASE_URL = "https://api.meteo.fr/vigilance"

def get_meteo_alert(lat, lon):
    """
    Récupère les alertes météo pour une position donnée
    """
    headers = {
        "Authorization": f"Bearer {METEO_FRANCE_API_KEY}"
    }
    params = {
        "lat": lat,
        "lon": lon
    }
    
    try:
        response = requests.get(BASE_URL, headers=headers, params=params)
        if response.status_code == 200:
            return response.json()
        else:
            return {"error": f"API Météo-France status {response.status_code}"}
    except Exception as e:
        return {"error": str(e)}