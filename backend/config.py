import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(BASE_DIR, "data"))
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(BASE_DIR, "uploads"))
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{os.path.join(DATA_DIR, 'posts.db')}")
COOKIE_FILE = os.path.join(UPLOAD_DIR, "linkedin_cookies.txt")
CREDENTIALS_FILE = os.path.join(DATA_DIR, "credentials.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def save_credentials(email: str, password: str):
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump({"email": email, "password": password}, f)


def load_credentials() -> dict | None:
    if not os.path.isfile(CREDENTIALS_FILE):
        return None
    with open(CREDENTIALS_FILE, "r") as f:
        return json.load(f)


def has_auth() -> bool:
    return os.path.isfile(CREDENTIALS_FILE) or os.path.isfile(COOKIE_FILE)
