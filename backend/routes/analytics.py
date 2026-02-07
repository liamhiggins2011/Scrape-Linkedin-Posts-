from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from schemas import (
    AnalyticsOverview, AuthorStats, TopicFrequency,
    EngagementPoint, SentimentData, HashtagData,
)
from services.analytics_service import (
    get_overview, get_top_authors, get_trending_topics,
    get_engagement_over_time, get_sentiment_distribution, get_hashtag_frequency,
)
from services.analysis_service import enrich_all_posts

import threading

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", response_model=AnalyticsOverview)
def overview(db: Session = Depends(get_db)):
    return get_overview(db)


@router.get("/top-authors", response_model=list[AuthorStats])
def top_authors(limit: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    return get_top_authors(db, limit=limit)


@router.get("/trending-topics", response_model=list[TopicFrequency])
def trending_topics(limit: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    return get_trending_topics(db, limit=limit)


@router.get("/engagement-timeline", response_model=list[EngagementPoint])
def engagement_timeline(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db)):
    return get_engagement_over_time(db, days=days)


@router.get("/sentiment", response_model=list[SentimentData])
def sentiment(db: Session = Depends(get_db)):
    return get_sentiment_distribution(db)


@router.get("/hashtags", response_model=list[HashtagData])
def hashtags(limit: int = Query(30, ge=1, le=100), db: Session = Depends(get_db)):
    return get_hashtag_frequency(db, limit=limit)


@router.post("/enrich")
def enrich(db: Session = Depends(get_db)):
    count = enrich_all_posts(db)
    return {"enriched": count}


@router.post("/enrich-content")
def enrich_content(db: Session = Depends(get_db)):
    """Re-fetch full content for posts with truncated data or 0 engagement."""
    from sqlalchemy import func, and_, or_
    from models import Post

    count = (
        db.query(Post)
        .filter(
            or_(
                func.length(Post.content) < 400,
                and_(Post.reactions == 0, Post.comments == 0),
            )
        )
        .count()
    )

    if count > 0:
        def _run():
            from database import SessionLocal
            from services.content_fetcher import enrich_posts_needing_content
            s = SessionLocal()
            try:
                enrich_posts_needing_content(s)
            finally:
                s.close()

        threading.Thread(target=_run, daemon=True).start()

    return {"enriching": count}
