import csv
from io import StringIO
from typing import Any, Dict, List, Optional

import requests


class NasaFirmsService:
    """Client léger pour l'API NASA FIRMS (données feux actifs MODIS/VIIRS).

    Cette implémentation utilise l'endpoint "area" qui permet de récupérer les
    feux actifs dans une bounding box (lat/lon min/max) sur une fenêtre
    temporelle (ex: dernières 24h).

    L'URL exacte et les produits disponibles peuvent évoluer, donc cette classe
    est volontairement simple et facile à adapter si besoin.
    """

    # Selon la doc NASA FIRMS, le schéma standard est :
    #   /api/area/csv/{api_key}/{product}/{minLon},{minLat},{maxLon},{maxLat}/{day_range}
    # On garde BASE_URL jusqu'à /csv et on complète le chemin avec la clé + le reste.
    BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

    def __init__(self, api_key: Optional[str]):
        self.api_key = api_key

    def get_active_fires_bbox(
        self,
    min_lat: float,
    min_lon: float,
    max_lat: float,
    max_lon: float,
    product: str = "MODIS_NRT",
    day_range: int = 1,
    ) -> List[Dict[str, Any]]:
        """Retourne les feux actifs MODIS/VIIRS dans une bbox donnée.

        Args:
            min_lat, min_lon, max_lat, max_lon: bounding box
            product: ex. "MODIS_NRT", "VIIRS_SNPP_NRT"...
            day_range: fenêtre temporelle en jours (entre 1 et 5)
        """
        if not self.api_key:
            raise ValueError("NASA_FIRMS_API_KEY is not configured")

        # Schéma NASA FIRMS (area API) :
        #   .../area/csv/{api_key}/{product}/{minLon},{minLat},{maxLon},{maxLat}/{DAY_RANGE}
        bbox_str = f"{min_lon},{min_lat},{max_lon},{max_lat}"
        # Clamp du nombre de jours entre 1 et 5 comme indiqué dans la doc
        if day_range < 1:
            day_range = 1
        if day_range > 5:
            day_range = 5

        url = f"{self.BASE_URL}/{self.api_key}/{product}/{bbox_str}/{day_range}"

        resp = requests.get(url, timeout=20)
        resp.raise_for_status()

        # La réponse est un CSV ; on l'analyse en dictionnaires.
        text = resp.text
        reader = csv.DictReader(StringIO(text))
        fires: List[Dict[str, Any]] = []
        for row in reader:
            try:
                fires.append(
                    {
                        "latitude": float(row.get("latitude")),
                        "longitude": float(row.get("longitude")),
                        "brightness": float(row.get("brightness")) if row.get("brightness") else None,
                        "confidence": row.get("confidence"),
                        "acq_date": row.get("acq_date"),
                        "acq_time": row.get("acq_time"),
                        "frp": float(row.get("frp")) if row.get("frp") else None,
                        # On garde aussi la ligne brute pour debug/évolution.
                        "_raw": row,
                    }
                )
            except Exception:
                # Si une ligne est malformée, on la saute.
                continue

        return fires
