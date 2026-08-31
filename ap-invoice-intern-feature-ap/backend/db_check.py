import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

# We need to run inside host database connection since we are executing on host
# Host port is 5432
db_url = "postgresql://postgres:postgres@localhost:5432/ap_db"
engine = create_engine(db_url)
SessionLocal = sessionmaker(bind=engine)

db = SessionLocal()
try:
    print("Checking users table...")
    result = db.execute(text("SELECT id, name, email, password_hash, role FROM users")).all()
    if not result:
        print("No users found in the database!")
    for row in result:
        print(f"User: {row[1]} | Email: {row[2]} | Hash: {row[3]} | Role: {row[4]}")
except Exception as e:
    print(f"Error querying database: {e}")
finally:
    db.close()
