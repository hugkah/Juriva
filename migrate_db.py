import sqlite3
import os

# Chemin vers la base de données (à adapter si différent)
db_path = "juriva.db" 

if not os.path.exists(db_path):
    print(f"Base de données non trouvée au chemin : {db_path}")
else:
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Tentative d'ajout de la colonne reset_token...")
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token TEXT")
            print("Colonne reset_token ajoutée avec succès.")
        except sqlite3.OperationalError:
            print("La colonne reset_token existe déjà.")

        print("Tentative d'ajout de la colonne reset_token_expiry...")
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN reset_token_expiry DATETIME")
            print("Colonne reset_token_expiry ajoutée avec succès.")
        except sqlite3.OperationalError:
            print("La colonne reset_token_expiry existe déjà.")
            
        conn.commit()
        conn.close()
        print("Migration terminée !")
    except Exception as e:
        print(f"Erreur lors de la migration : {e}")
