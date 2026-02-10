"""Background scheduler for saved searches / monitoring."""

import logging
import threading
import uuid
from datetime import datetime, timedelta

from database import SessionLocal
from models import SavedSearch, MonitorResult, Post
from scraper import search_linkedin_posts, search_linkedin_native, HAS_SELENIUM

logger = logging.getLogger(__name__)

_scheduler_running = False
_timer: threading.Timer | None = None

CHECK_INTERVAL_SECONDS = 60


def start_scheduler():
    """Start the background scheduler loop. Call once at app startup."""
    global _scheduler_running
    if _scheduler_running:
        return
    _scheduler_running = True
    _schedule_next()
    logger.info("Monitor scheduler started")


def stop_scheduler():
    """Stop the background scheduler."""
    global _scheduler_running, _timer
    _scheduler_running = False
    if _timer:
        _timer.cancel()
        _timer = None


def _schedule_next():
    """Schedule the next check."""
    global _timer
    if not _scheduler_running:
        return
    _timer = threading.Timer(CHECK_INTERVAL_SECONDS, _tick)
    _timer.daemon = True
    _timer.start()


def _tick():
    """Check all enabled saved searches and run any that are due."""
    try:
        db = SessionLocal()
        try:
            searches = db.query(SavedSearch).filter(SavedSearch.enabled == True).all()
            now = datetime.utcnow()

            for search in searches:
                interval = timedelta(hours=search.schedule_hours)
                if search.last_run is None or (now - search.last_run) >= interval:
                    try:
                        _execute_saved_search(search, db)
                    except Exception:
                        logger.exception(f"Error running saved search {search.id}")
        finally:
            db.close()
    except Exception:
        logger.exception("Scheduler tick error")

    _schedule_next()


def _execute_saved_search(search: SavedSearch, db):
    """Run a single saved search and record results."""
    import os
    from config import COOKIE_FILE, load_credentials, has_auth

    job_id = str(uuid.uuid4())

    post_dicts = None

    # Try native LinkedIn search when auth is configured
    if HAS_SELENIUM and has_auth():
        creds = load_credentials()
        cookie_path = COOKIE_FILE if os.path.isfile(COOKIE_FILE) and not creds else None
        email = creds["email"] if creds else None
        password = creds["password"] if creds else None
        try:
            post_dicts = search_linkedin_native(
                query=search.query,
                max_posts=search.max_posts,
                content_type=search.content_type,
                time_range=search.time_range,
                location=search.location,
                cookie_path=cookie_path,
                email=email,
                password=password,
            )
        except Exception:
            logger.warning(f"Native search failed for '{search.name}', falling back to DDG")
            post_dicts = None

    # Fall back to DDG search
    if post_dicts is None:
        post_dicts = search_linkedin_posts(
            query=search.query,
            max_posts=search.max_posts,
            content_type=search.content_type,
            time_range=search.time_range,
            location=search.location,
        )

    # Save new posts (skip duplicates)
    added = 0
    for p in post_dicts:
        existing = db.query(Post).filter(Post.post_id == p["post_id"]).first()
        if not existing:
            p["scrape_job_id"] = job_id
            db.add(Post(**p))
            added += 1
    db.commit()

    # Run content enrichment on new posts
    try:
        from services.content_fetcher import enrich_posts_with_content
        enrich_posts_with_content(job_id, db)
    except Exception:
        pass

    # Run sentiment/topic analysis
    try:
        from services.analysis_service import enrich_posts
        enrich_posts(job_id, db)
    except Exception:
        pass

    # Record result
    result = MonitorResult(
        saved_search_id=search.id,
        new_posts_count=added,
        run_at=datetime.utcnow(),
        job_id=job_id,
    )
    db.add(result)
    search.last_run = datetime.utcnow()
    db.commit()

    logger.info(f"Saved search '{search.name}' found {added} new posts")


def run_saved_search(search_id: int) -> dict:
    """Manually trigger a saved search. Returns result info."""
    db = SessionLocal()
    try:
        search = db.query(SavedSearch).get(search_id)
        if not search:
            return {"error": "Saved search not found"}

        _execute_saved_search(search, db)

        latest = (
            db.query(MonitorResult)
            .filter(MonitorResult.saved_search_id == search_id)
            .order_by(MonitorResult.run_at.desc())
            .first()
        )
        return {
            "new_posts_count": latest.new_posts_count if latest else 0,
            "job_id": latest.job_id if latest else None,
        }
    finally:
        db.close()
