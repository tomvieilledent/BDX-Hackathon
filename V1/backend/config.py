"""
Configuration module for BDX-Hackathon backend.

Loads environment variables for API credentials and external service access.
Provides centralized configuration for third-party API integrations:
- Météo-France API
- Géorisques API
- NASA FIRMS API (Fire Information and Management System)
"""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Configuration class for Flask application.

    Attributes:
        METEO_FRANCE_API_KEY: API key for Météo-France weather data service
        GEORISQUES_API_KEY: API key for Géorisques risk assessment service
        NASA_FIRMS_API_KEY: API key for NASA FIRMS active fire detection
    """
    METEO_FRANCE_API_KEY = os.getenv('METEO_FRANCE_API_KEY')
    GEORISQUES_API_KEY = os.getenv('GEORISQUES_API_KEY')
    NASA_FIRMS_API_KEY = os.getenv('NASA_FIRMS_API_KEY')
