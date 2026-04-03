"""
BDX-Hackathon Backend Package

This package implements the Flask REST API for the BDX-Hackathon risk prevention
application. It provides endpoints for risk assessment, weather data, and alert
generation based on geographic location and environmental conditions.

Modules:
    app: Main Flask application and route handlers
    config: Configuration and environment variable management
    services: External API integrations (Georisques, NASA FIRMS, Meteo)

Services:
    georisques: Risk assessment API client
    nasa_firms: Active fire detection API client
    meteo_france: Weather (placeholder for future use)
"""
