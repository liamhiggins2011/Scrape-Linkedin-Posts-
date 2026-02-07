import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from config import COOKIE_FILE, save_credentials, load_credentials, has_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


class CredentialsRequest(BaseModel):
    email: str
    password: str


class AuthStatus(BaseModel):
    configured: bool
    method: str | None = None


@router.get("/status", response_model=AuthStatus)
def auth_status():
    creds = load_credentials()
    if creds:
        return {"configured": True, "method": "credentials"}
    if os.path.isfile(COOKIE_FILE):
        return {"configured": True, "method": "cookies"}
    return {"configured": False, "method": None}


@router.post("/credentials")
def save_login(req: CredentialsRequest):
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required.")
    save_credentials(req.email, req.password)
    return {"status": "ok"}


@router.post("/cookies/upload")
async def upload_cookies(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")

    has_linkedin = any(
        ".linkedin.com" in line for line in text.splitlines() if not line.startswith("#")
    )
    if not has_linkedin:
        raise HTTPException(
            status_code=400,
            detail="Cookie file does not contain LinkedIn cookies. Ensure it is in Netscape format.",
        )

    with open(COOKIE_FILE, "w", encoding="utf-8") as f:
        f.write(text)

    return {"status": "ok", "filename": file.filename}
