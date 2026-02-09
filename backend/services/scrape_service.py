import uuid
import threading
from models import Post
from scraper import scrape_linkedin_posts, search_linkedin_posts
from database import SessionLocal

# In-memory job tracking
jobs: dict[str, dict] = {}


def start_scrape_job(
    profile_url: str,
    max_posts: int,
    cookie_path: str | None = None,
    email: str | None = None,
    password: str | None = None,
) -> str:
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "running",
        "posts_found": 0,
        "error": None,
        "profile_url": profile_url,
        "query": None,
    }
    thread = threading.Thread(
        target=_run_scrape,
        args=(job_id, profile_url, max_posts, cookie_path, email, password),
        daemon=True,
    )
    thread.start()
    return job_id


def start_search_job(
    query: str,
    max_posts: int,
    content_type: str = "posts",
    time_range: str = "any",
    location: str = "any",
) -> str:
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "running",
        "posts_found": 0,
        "error": None,
        "profile_url": None,
        "query": query,
    }
    thread = threading.Thread(
        target=_run_search,
        args=(job_id, query, max_posts, content_type, time_range, location),
        daemon=True,
    )
    thread.start()
    return job_id


def _save_posts(job_id: str, post_dicts: list[dict]):
    db = SessionLocal()
    try:
        added = 0
        for p in post_dicts:
            existing = db.query(Post).filter(Post.post_id == p["post_id"]).first()
            if not existing:
                p["scrape_job_id"] = job_id
                db.add(Post(**p))
                added += 1
        db.commit()

        # Mark completed immediately so the frontend can show results
        # Use total DDG results if more were found than newly added (duplicates)
        jobs[job_id]["posts_found"] = max(added, len(post_dicts))
        jobs[job_id]["status"] = "completed"

        # Run enrichment in the background — don't block the user
        try:
            from services.content_fetcher import enrich_posts_with_content
            enrich_posts_with_content(job_id, db)
        except Exception:
            pass

        try:
            from services.analysis_service import enrich_posts
            enrich_posts(job_id, db)
        except Exception:
            pass
    finally:
        db.close()


def _run_scrape(
    job_id: str,
    profile_url: str,
    max_posts: int,
    cookie_path: str | None,
    email: str | None,
    password: str | None,
):
    try:
        def on_progress(count):
            jobs[job_id]["posts_found"] = count

        post_dicts = scrape_linkedin_posts(
            profile_url=profile_url,
            max_posts=max_posts,
            cookie_path=cookie_path,
            email=email,
            password=password,
            on_post_found=on_progress,
        )
        _save_posts(job_id, post_dicts)
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)


def _run_search(job_id: str, query: str, max_posts: int, content_type: str = "posts", time_range: str = "any", location: str = "any"):
    try:
        def on_progress(count):
            jobs[job_id]["posts_found"] = count

        post_dicts = search_linkedin_posts(
            query=query,
            max_posts=max_posts,
            content_type=content_type,
            time_range=time_range,
            location=location,
            on_post_found=on_progress,
        )
        _save_posts(job_id, post_dicts)
    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["error"] = str(e)


def get_job(job_id: str) -> dict | None:
    return jobs.get(job_id)


def get_all_jobs() -> list[dict]:
    return [{"job_id": jid, **info} for jid, info in jobs.items()]
