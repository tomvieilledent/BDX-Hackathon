"""Point d'entrée pour lancer l'application Flask du backend.

Ce fichier permet de démarrer le serveur avec :
    .venv/bin/python app.py

Il importe simplement l'objet `app` défini dans `backend/app.py`.
"""

from backend.app import app  # importe l'objet Flask défini dans backend/app.py


if __name__ == "__main__":
    # On utilise le port 5000 pour être cohérent avec les appels depuis le front (index.html, etc.)
    app.run(debug=True, port=5000)
