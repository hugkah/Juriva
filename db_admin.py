import os
import sys
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Erreur : DATABASE_URL non trouvée dans le fichier .env")
    sys.exit(1)

# Ajustement pour Render si nécessaire (remplacer postgres:// par postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def check_connection():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("✅ Connexion à PostgreSQL réussie !")
    except Exception as e:
        print(f"❌ Erreur de connexion : {e}")

def list_tables():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print("\n--- Tables dans la base de données ---")
    if not tables:
        print("Aucune table trouvée.")
    for table in tables:
        print(f" - {table}")

def list_users():
    print("\n--- Liste des utilisateurs ---")
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT id, email, display_name, created_at FROM users"))
            users = result.fetchall()
            if not users:
                print("Aucun utilisateur inscrit.")
            for user in users:
                print(f"ID: {user[0]} | Email: {user[1]} | Nom: {user[2]} | Créé le: {user[3]}")
    except Exception as e:
        print(f"Erreur lors de la lecture des utilisateurs : {e}")

def reset_database():
    confirm = input("\n⚠️ Êtes-vous sûr de vouloir supprimer TOUTES les données ? (oui/non) : ")
    if confirm.lower() == 'oui':
        try:
            from backend.database import Base
            from backend.models import User, Conversation, Message # Import pour s'assurer qu'ils sont chargés
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            print("✅ Base de données réinitialisée avec succès.")
        except Exception as e:
            print(f"Erreur lors de la réinitialisation : {e}")
    else:
        print("Opération annulée.")

def show_help():
    print("""
Usage: python db_admin.py [commande]
Commandes disponibles:
  check   : Vérifier la connexion à PostgreSQL
  tables  : Lister les tables existantes
  users   : Lister les utilisateurs inscrits
  reset   : Supprimer et recréer toutes les tables (ATTENTION !)
  help    : Afficher cette aide
    """)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        show_help()
    else:
        command = sys.argv[1].lower()
        if command == "check":
            check_connection()
        elif command == "tables":
            list_tables()
        elif command == "users":
            list_users()
        elif command == "reset":
            reset_database()
        elif command == "help":
            show_help()
        else:
            print(f"Commande inconnue : {command}")
            show_help()
