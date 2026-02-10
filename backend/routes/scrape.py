import os
from fastapi import APIRouter, HTTPException
from schemas import ScrapeRequest, SearchScrapeRequest, ScrapeJobOut
from services.scrape_service import start_scrape_job, start_search_job, get_job, get_all_jobs
from config import COOKIE_FILE, load_credentials, has_auth

router = APIRouter(prefix="/api/scrape", tags=["scrape"])


def _get_auth():
    """Get auth params (creds or cookie path)."""
    if not has_auth():
        raise HTTPException(
            status_code=400,
            detail="No login configured. Go to Settings and enter your LinkedIn credentials.",
        )
    creds = load_credentials()
    cookie_path = COOKIE_FILE if os.path.isfile(COOKIE_FILE) and not creds else None
    email = creds["email"] if creds else None
    password = creds["password"] if creds else None
    return cookie_path, email, password


@router.post("", response_model=ScrapeJobOut)
def start_scrape(req: ScrapeRequest):
    cookie_path, email, password = _get_auth()
    job_id = start_scrape_job(
        profile_url=req.profile_url,
        max_posts=req.max_posts,
        cookie_path=cookie_path,
        email=email,
        password=password,
    )
    job = get_job(job_id)
    return {"job_id": job_id, **job}


@router.post("/search", response_model=ScrapeJobOut)
def start_search(req: SearchScrapeRequest):
    # Pass auth if available — enables native LinkedIn search via Selenium.
    # If no auth configured, search falls back to DDG (no error).
    cookie_path = None
    email = None
    password = None
    if has_auth():
        creds = load_credentials()
        cookie_path = COOKIE_FILE if os.path.isfile(COOKIE_FILE) and not creds else None
        email = creds["email"] if creds else None
        password = creds["password"] if creds else None

    job_id = start_search_job(
        query=req.query,
        max_posts=req.max_posts,
        content_type=req.content_type,
        time_range=req.time_range,
        location=req.location,
        cookie_path=cookie_path,
        email=email,
        password=password,
    )
    job = get_job(job_id)
    return {"job_id": job_id, **job}


@router.get("/history", response_model=list[ScrapeJobOut])
def scrape_history():
    return get_all_jobs()


@router.get("/{job_id}", response_model=ScrapeJobOut)
def scrape_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job_id": job_id, **job}
