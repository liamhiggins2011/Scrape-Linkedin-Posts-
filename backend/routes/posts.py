import csv
import io
import json
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from schemas import PostOut, PostsResponse
from database import get_db
from services.search_service import search_posts
from models import Post, Bookmark

router = APIRouter(prefix="/api/posts", tags=["posts"])


def _add_bookmark_flag(posts: list, db: Session) -> list[dict]:
    """Add is_bookmarked flag to post list."""
    post_ids = [p.id for p in posts]
    bookmarked_ids = set()
    if post_ids:
        bookmarks = db.query(Bookmark.post_id).filter(Bookmark.post_id.in_(post_ids)).all()
        bookmarked_ids = {b.post_id for b in bookmarks}

    result = []
    for p in posts:
        data = PostOut.model_validate(p).model_dump()
        data["is_bookmarked"] = p.id in bookmarked_ids
        result.append(data)
    return result


@router.get("", response_model=PostsResponse)
def list_posts(
    q: str | None = Query(None),
    author: str | None = Query(None),
    sort: str = Query("date"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    posts, total = search_posts(db, q=q, author=author, sort=sort, page=page, per_page=per_page)
    enriched = _add_bookmark_flag(posts, db)
    return {"posts": enriched, "total": total, "page": page, "per_page": per_page}


@router.get("/export")
def export_posts(
    format: str = Query("csv", pattern="^(csv|json)$"),
    q: str | None = Query(None),
    collection_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Post)

    if q:
        from sqlalchemy import or_
        pattern = f"%{q}%"
        query = query.filter(
            or_(
                Post.content.ilike(pattern),
                Post.author_name.ilike(pattern),
            )
        )

    if collection_id is not None:
        from models import Bookmark as BM
        bookmark_post_ids = db.query(BM.post_id).filter(BM.collection_id == collection_id).subquery()
        query = query.filter(Post.id.in_(bookmark_post_ids))

    posts = query.order_by(Post.date_collected.desc()).all()

    if format == "json":
        data = []
        for p in posts:
            data.append({
                "post_id": p.post_id,
                "post_url": p.post_url,
                "author_name": p.author_name,
                "author_jobtitle": p.author_jobtitle,
                "content": p.content,
                "reactions": p.reactions,
                "comments": p.comments,
                "impressions": p.impressions,
                "sentiment_label": p.sentiment_label,
                "engagement_score": p.engagement_score,
                "hashtags": p.hashtags,
                "topics": p.topics,
                "date_collected": p.date_collected.isoformat() if p.date_collected else None,
            })
        content = json.dumps(data, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=linkedin_posts.json"},
        )

    # CSV format
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "post_id", "post_url", "author_name", "author_jobtitle", "content",
        "reactions", "comments", "impressions", "sentiment_label",
        "engagement_score", "hashtags", "topics", "date_collected",
    ])
    for p in posts:
        writer.writerow([
            p.post_id, p.post_url, p.author_name, p.author_jobtitle, p.content,
            p.reactions, p.comments, p.impressions, p.sentiment_label,
            p.engagement_score, p.hashtags, p.topics,
            p.date_collected.isoformat() if p.date_collected else "",
        ])

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=linkedin_posts.csv"},
    )


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: str, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post
