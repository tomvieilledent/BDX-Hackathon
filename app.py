"""Point d'entrée pour démarrer le backend Flask depuis la racine du projet.

Permet de lancer `python app.py` à la racine sans manipuler les chemins à la main.
"""

from backend.app import app  # importe l'objet Flask défini dans backend/app.py


if __name__ == "__main__":
    # Lance le serveur en debug sur le port 5000
    app.run(debug=True, port=5000)
