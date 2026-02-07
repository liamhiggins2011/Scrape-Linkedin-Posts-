import json
from datetime import datetime, timedelta
from collections import Counter
from sqlalchemy.orm import Session
from sqlalchemy import func, distinct
from models import Post


def get_overview(db: Session) -> dict:
    total_posts = db.query(func.count(Post.id)).scalar() or 0
    total_authors = db.query(func.count(distinct(Post.author_name))).scalar() or 0
    avg_engagement = db.query(func.avg(Post.engagement_score)).scalar() or 0.0

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    posts_today = db.query(func.count(Post.id)).filter(
        Post.date_collected >= today_start
    ).scalar() or 0

    posts_this_week = db.query(func.count(Post.id)).filter(
        Post.date_collected >= week_start
    ).scalar() or 0

    return {
        "total_posts": total_posts,
        "total_authors": total_authors,
        "avg_engagement": round(avg_engagement, 1),
        "posts_today": posts_today,
        "posts_this_week": posts_this_week,
    }


def get_top_authors(db: Session, limit: int = 10) -> list[dict]:
    results = (
        db.query(
            Post.author_name,
            func.count(Post.id).label("post_count"),
            func.avg(Post.engagement_score).label("avg_engagement"),
        )
        .filter(Post.author_name.isnot(None))
        .group_by(Post.author_name)
        .order_by(func.count(Post.id).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "author_name": r.author_name or "Unknown",
            "post_count": r.post_count,
            "avg_engagement": round(r.avg_engagement or 0, 1),
        }
        for r in results
    ]


def get_trending_topics(db: Session, limit: int = 20) -> list[dict]:
    posts = db.query(Post.topics).filter(Post.topics.isnot(None)).all()
    counter: Counter = Counter()
    for (topics_json,) in posts:
        try:
            topics = json.loads(topics_json)
            for t in topics:
                counter[t] += 1
        except (json.JSONDecodeError, TypeError):
            pass

    return [{"topic": topic, "count": count} for topic, count in counter.most_common(limit)]


def get_engagement_over_time(db: Session, days: int = 30) -> list[dict]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    posts = (
        db.query(Post)
        .filter(Post.date_collected >= cutoff)
        .order_by(Post.date_collected)
        .all()
    )

    daily: dict[str, list[float]] = {}
    for p in posts:
        if not p.date_collected:
            continue
        day = p.date_collected.strftime("%Y-%m-%d")
        if day not in daily:
            daily[day] = []
        daily[day].append(p.engagement_score or 0)

    return [
        {
            "date": day,
            "avg_engagement": round(sum(scores) / len(scores), 1),
            "post_count": len(scores),
        }
        for day, scores in sorted(daily.items())
    ]


def get_sentiment_distribution(db: Session) -> list[dict]:
    results = (
        db.query(Post.sentiment_label, func.count(Post.id))
        .filter(Post.sentiment_label.isnot(None))
        .group_by(Post.sentiment_label)
        .all()
    )
    return [{"label": label, "count": count} for label, count in results]


def get_hashtag_frequency(db: Session, limit: int = 30) -> list[dict]:
    posts = db.query(Post.hashtags).filter(Post.hashtags.isnot(None)).all()
    counter: Counter = Counter()
    for (hashtags_str,) in posts:
        if hashtags_str:
            for tag in hashtags_str.split(","):
                tag = tag.strip()
                if tag:
                    counter[tag] += 1

    return [{"hashtag": tag, "count": count} for tag, count in counter.most_common(limit)]
