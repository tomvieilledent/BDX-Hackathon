import requests
from typing import Dict, Any, Optional

class GeorisquesService:
    """Service to interact with the Géorisques API"""
    
    BASE_URL = "https://www.georisques.gouv.fr/api/v1"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def get_risks_by_coordinates(self, lat: float, lon: float, radius: int = 10000) -> Dict[str, Any]:
        """
        Get all risks for a given location.
        
        Args:
            lat: Latitude
            lon: Longitude
            radius: Search radius in meters (default: 10km)
        
        Returns:
            Dictionary containing risks data
        """
        try:
            # Get classified installations (SEVESO, etc.)
            installations = self._get_classified_installations(lat, lon, radius)
            
            # Get flood risks
            flood_risks = self._get_flood_risks(lat, lon)
            
            # Get seismic risks
            seismic_risks = self._get_seismic_risks(lat, lon)
            
            return {
                "success": True,
                "location": {
                    "lat": lat,
                    "lon": lon,
                    "radius": radius
                },
                "risks": {
                    "installations": installations,
                    "floods": flood_risks,
                    "seismic": seismic_risks
                }
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def _get_classified_installations(self, lat: float, lon: float, radius: int) -> Dict[str, Any]:
        """Get classified installations (SEVESO, etc.) near coordinates"""
        try:
            url = f"{self.BASE_URL}/installations_classees"
            params = {
                "lat": lat,
                "lon": lon,
                "rayon": radius
            }
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"Failed to fetch classified installations: {str(e)}"}
    
    def _get_flood_risks(self, lat: float, lon: float) -> Dict[str, Any]:
        """Get flood risks at coordinates"""
        try:
            url = f"{self.BASE_URL}/risques_inondations"
            params = {
                "lat": lat,
                "lon": lon
            }
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"Failed to fetch flood risks: {str(e)}"}
    
    def _get_seismic_risks(self, lat: float, lon: float) -> Dict[str, Any]:
        """Get seismic risks at coordinates"""
        try:
            url = f"{self.BASE_URL}/risques_seismiques"
            params = {
                "lat": lat,
                "lon": lon
            }
            response = requests.get(url, headers=self.headers, params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            return {"error": f"Failed to fetch seismic risks: {str(e)}"}
    