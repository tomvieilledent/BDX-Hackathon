import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    METEO_FRANCE_API_KEY = os.getenv('METEO_FRANCE_API_KEY')
    GEORISQUES_API_KEY = os.getenv('GEORISQUES_API_KEY')
    NASA_FIRMS_API_KEY = os.getenv('NASA_FIRMS_API_KEY')

