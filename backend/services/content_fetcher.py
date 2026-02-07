"""Fetch full post content from LinkedIn public pages to enrich DDG snippets."""

import json
import time
import logging

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from models import Post

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def fetch_post_content(post_url: str) -> dict | None:
    """Fetch a LinkedIn post page and extract richer metadata.

    Returns a dict with any of: content, reactions, comments,
    author_name, author_jobtitle. Returns None on failure.
    """
    try:
        resp = requests.get(post_url, headers=_HEADERS, timeout=10)
        if resp.status_code != 200:
            return None
    except Exception:
        return None

    try:
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception:
        return None

    result: dict = {}

    # Extract og:description — typically longer than DDG snippet
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        result["content"] = og_desc["content"].strip()

    # Extract og:title — may include author name
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        title_text = og_title["content"].strip()
        if " on LinkedIn:" in title_text:
            parts = title_text.split(" on LinkedIn:", 1)
            result["author_name"] = parts[0].strip()

    # Extract <meta name="author">
    meta_author = soup.find("meta", attrs={"name": "author"})
    if meta_author and meta_author.get("content"):
        result["author_name"] = meta_author["content"].strip()

    # Look for JSON-LD structured data
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, dict):
                _extract_jsonld(data, result)
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict):
                        _extract_jsonld(item, result)
        except (json.JSONDecodeError, TypeError):
            continue

    return result if result else None


def _extract_jsonld(data: dict, result: dict):
    """Extract useful fields from a JSON-LD object."""
    # Author info
    author = data.get("author")
    if isinstance(author, dict):
        if author.get("name"):
            result["author_name"] = author["name"]
        if author.get("jobTitle"):
            result["author_jobtitle"] = author["jobTitle"]

    # Interaction statistics
    stats = data.get("interactionStatistic")
    if isinstance(stats, list):
        for stat in stats:
            if not isinstance(stat, dict):
                continue
            itype = stat.get("interactionType", "")
            count = stat.get("userInteractionCount", 0)
            try:
                count = int(count)
            except (ValueError, TypeError):
                continue
            if "Like" in itype or "React" in itype:
                result["reactions"] = count
            elif "Comment" in itype:
                result["comments"] = count

    # Article body text
    if data.get("articleBody"):
        body = data["articleBody"].strip()
        if len(body) > len(result.get("content", "")):
            result["content"] = body


def enrich_posts_with_content(job_id: str, db: Session):
    """Fetch full content for posts that have truncated data or 0 engagement."""
    posts = (
        db.query(Post)
        .filter(Post.scrape_job_id == job_id)
        .all()
    )

    enriched = 0
    for post in posts:
        content_len = len(post.content or "")
        needs_enrichment = content_len < 400 or (post.reactions == 0 and post.comments == 0)
        if not needs_enrichment:
            continue

        data = fetch_post_content(post.post_url)
        if not data:
            time.sleep(1.5)
            continue

        updated = False

        # Update content if fetched version is longer
        if data.get("content") and len(data["content"]) > content_len:
            post.content = data["content"]
            updated = True

        # Update engagement if we got non-zero values
        if data.get("reactions") and data["reactions"] > (post.reactions or 0):
            post.reactions = data["reactions"]
            updated = True
        if data.get("comments") and data["comments"] > (post.comments or 0):
            post.comments = data["comments"]
            updated = True

        # Update author info if missing
        if data.get("author_name") and not post.author_name:
            post.author_name = data["author_name"]
            updated = True
        if data.get("author_jobtitle") and not post.author_jobtitle:
            post.author_jobtitle = data["author_jobtitle"]
            updated = True

        if updated:
            enriched += 1

        time.sleep(1.5)

    if enriched:
        db.commit()
        logger.info(f"Enriched {enriched} posts for job {job_id}")

    return enriched


def enrich_posts_needing_content(db: Session) -> int:
    """Find and enrich all posts with truncated content or 0 engagement."""
    from sqlalchemy import func, and_, or_

    posts = (
        db.query(Post)
        .filter(
            or_(
                func.length(Post.content) < 400,
                and_(Post.reactions == 0, Post.comments == 0),
            )
        )
        .limit(50)  # Process in batches to avoid long-running requests
        .all()
    )

    enriched = 0
    for post in posts:
        data = fetch_post_content(post.post_url)
        if not data:
            time.sleep(1.5)
            continue

        content_len = len(post.content or "")
        updated = False

        if data.get("content") and len(data["content"]) > content_len:
            post.content = data["content"]
            updated = True
        if data.get("reactions") and data["reactions"] > (post.reactions or 0):
            post.reactions = data["reactions"]
            updated = True
        if data.get("comments") and data["comments"] > (post.comments or 0):
            post.comments = data["comments"]
            updated = True
        if data.get("author_name") and not post.author_name:
            post.author_name = data["author_name"]
            updated = True
        if data.get("author_jobtitle") and not post.author_jobtitle:
            post.author_jobtitle = data["author_jobtitle"]
            updated = True

        if updated:
            enriched += 1

        time.sleep(1.5)

    if enriched:
        db.commit()

    return enriched
