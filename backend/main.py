from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text, or_
from database import Base, engine
from routes import cookies, scrape, posts, analytics, collections, monitor

# Create tables
Base.metadata.create_all(bind=engine)

# Migrate existing posts table if needed (add new columns)
with engine.connect() as conn:
    inspector = inspect(engine)
    existing_cols = {c["name"] for c in inspector.get_columns("posts")}
    migrations = {
        "sentiment": "FLOAT",
        "sentiment_label": "VARCHAR",
        "topics": "TEXT",
        "hashtags": "TEXT",
        "engagement_score": "FLOAT",
    }
    for col, col_type in migrations.items():
        if col not in existing_cols:
            conn.execute(text(f"ALTER TABLE posts ADD COLUMN {col} {col_type}"))
    conn.commit()

# Set up FTS5 full-text search
with engine.connect() as conn:
    conn.execute(text("""
        CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
            post_id,
            content,
            author_name,
            author_jobtitle,
            hashtags,
            topics,
            content=posts,
            content_rowid=id
        )
    """))
    conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
            INSERT INTO posts_fts(rowid, post_id, content, author_name, author_jobtitle, hashtags, topics)
            VALUES (new.id, new.post_id, new.content, new.author_name, new.author_jobtitle, new.hashtags, new.topics);
        END
    """))
    conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
            INSERT INTO posts_fts(posts_fts, rowid, post_id, content, author_name, author_jobtitle, hashtags, topics)
            VALUES ('delete', old.id, old.post_id, old.content, old.author_name, old.author_jobtitle, old.hashtags, old.topics);
        END
    """))
    conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
            INSERT INTO posts_fts(posts_fts, rowid, post_id, content, author_name, author_jobtitle, hashtags, topics)
            VALUES ('delete', old.id, old.post_id, old.content, old.author_name, old.author_jobtitle, old.hashtags, old.topics);
            INSERT INTO posts_fts(rowid, post_id, content, author_name, author_jobtitle, hashtags, topics)
            VALUES (new.id, new.post_id, new.content, new.author_name, new.author_jobtitle, new.hashtags, new.topics);
        END
    """))
    # Rebuild FTS index to ensure consistency with posts table
    conn.execute(text("INSERT INTO posts_fts(posts_fts) VALUES('rebuild')"))
    conn.commit()

# Fix date_collected for existing posts using LinkedIn activity ID timestamps
from scraper import _activity_id_to_datetime
from database import SessionLocal
from models import Post

# Delete junk posts that slipped through old filters
_db = SessionLocal()
try:
    _junk = _db.query(Post).filter(
        or_(
            Post.post_url.like('%business.linkedin.com%'),
            Post.post_url.like('%training.linkedin.com%'),
            Post.post_url.like('%training.talent.linkedin.com%'),
            Post.post_url.like('%news.linkedin.com%'),
            Post.post_url.like('%engineering.linkedin.com%'),
            Post.post_url.like('%/jobs/%'),
            Post.post_url.like('%/help/%'),
            Post.post_url.like('%/learning/%'),
            Post.post_url.like('%/company/%'),
            Post.post_url.like('%/school/%'),
            Post.post_url.like('%/events/%'),
            Post.post_url.like('%/advice/%'),
            Post.post_url.like('%/legal/%'),
        )
    ).delete(synchronize_session=False)
    if _junk:
        _db.commit()
        print(f"Cleaned up {_junk} junk posts")
finally:
    _db.close()

# Fix date_collected for existing posts using LinkedIn activity ID timestamps
_db = SessionLocal()
try:
    _posts = _db.query(Post).all()
    _fixed = 0
    for _p in _posts:
        actual = _activity_id_to_datetime(_p.post_id)
        if actual and _p.date_collected:
            # Only fix if dates differ by more than 1 hour (i.e. wrong date)
            diff = abs((_p.date_collected - actual).total_seconds())
            if diff > 3600:
                _p.date_collected = actual
                if not _p.post_time:
                    _p.post_time = actual.strftime("%b %d, %Y")
                _fixed += 1
    if _fixed:
        _db.commit()
finally:
    _db.close()

app = FastAPI(title="LinkedIn Intelligence Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cookies.router)
app.include_router(scrape.router)
app.include_router(posts.router)
app.include_router(analytics.router)
app.include_router(collections.router)
app.include_router(monitor.router)


@app.on_event("startup")
def on_startup():
    from services.scheduler_service import start_scheduler
    start_scheduler()


@app.get("/api/health")
def health():
    return {"status": "ok"}
