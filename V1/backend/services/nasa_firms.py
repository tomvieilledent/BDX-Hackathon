"""
NASA FIRMS (Fire Information and Management System) API client module.

This module provides integration with NASA FIRMS API for detecting active fires
using MODIS and VIIRS satellite data. The data helps identify wildfire and
uncontrolled fire incidents near user locations for real-time risk assessment.

NASA FIRMS provides near real-time fire detection data with 375m resolution
(MODIS) or 375m resolution (VIIRS), updated multiple times daily.
"""

import csv
from io import StringIO
from typing import Any, Dict, List, Optional

import requests


class NasaFirmsService:
    """
    Client for the NASA FIRMS API to retrieve active fire detections.

    Uses the FIRMS area API endpoint to fetch fire detections within
    a bounding box over a specified time period. Supports both MODIS and VIIRS
    satellite data products.

    Attributes:
        api_key (str): API key for NASA FIRMS service
        BASE_URL (str): Base URL for the FIRMS API
    """

    # NASA FIRMS area API endpoint format:
    # /api/area/csv/{api_key}/{product}/{minLon},{minLat},{maxLon},{maxLat}/{day_range}
    BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

    def __init__(self, api_key: Optional[str]):
        """
        Initialize the NASA FIRMS service client.

        Args:
            api_key: API key for authentication (get from https://firms.modaps.eosdis.nasa.gov/api/)
        """
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
        """
        Retrieve active fire detections within a geographic bounding box.

        Queries the NASA FIRMS API for fire hotspots detected by satellite
        within the specified area and time window.

        Args:
            min_lat: Minimum latitude of bounding box
            min_lon: Minimum longitude of bounding box
            max_lat: Maximum latitude of bounding box
            max_lon: Maximum longitude of bounding box
            product: Satellite product - 'MODIS_NRT' or 'VIIRS_SNPP_NRT' (default: 'MODIS_NRT')
            day_range: Time window in days, 1-5 (default: 1 for last 24 hours)

        Returns:
            List[Dict]: List of fire detection objects with properties:
                - latitude, longitude: Fire location coordinates
                - brightness: Thermal radiation/brightness
                - confidence: Detection confidence level
                - acq_date, acq_time: Detection timestamp
                - frp: Fire Radiative Power

        Raises:
            ValueError: If API key is not configured
        """
        if not self.api_key:
            raise ValueError("NASA_FIRMS_API_KEY is not configured")

        # Build request URL with bounding box coordinates
        bbox_str = f"{min_lon},{min_lat},{max_lon},{max_lat}"
        # Clamp day_range between 1 and 5 as per NASA FIRMS specification
        if day_range < 1:
            day_range = 1
        if day_range > 5:
            day_range = 5

        url = f"{self.BASE_URL}/{self.api_key}/{product}/{bbox_str}/{day_range}"

        resp = requests.get(url, timeout=20)
        resp.raise_for_status()

        # Parse CSV response into list of dictionaries
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
                        # Keep raw row for debugging and future enhancements
                        "_raw": row,
                    }
                )
            except Exception:
                # Skip malformed rows without failing entire request
                continue

        return fires
