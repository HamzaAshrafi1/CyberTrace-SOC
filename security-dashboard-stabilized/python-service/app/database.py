import os
import psycopg2
from dotenv import load_dotenv

# Load environment configurations
load_dotenv()
load_dotenv(dotenv_path="../.env")

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set")
    return psycopg2.connect(DATABASE_URL)
