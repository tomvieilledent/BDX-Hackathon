"""Point d'entrée pour lancer l'application Flask du backend.

Ce fichier permet de démarrer le serveur avec :
    .venv/bin/python app.py

Il importe simplement l'objet `app` défini dans `backend/app.py`.
"""

from backend.app import app  # importe l'objet Flask défini dans backend/app.py


if __name__ == "__main__":
    # On utilise le port 7000 pour être cohérent avec le frontend (API_BASE = http://127.0.0.1:7000)
    app.run(debug=True, port=7000)
