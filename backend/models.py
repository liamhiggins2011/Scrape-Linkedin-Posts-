from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(String, unique=True, index=True)
    post_url = Column(String)
    author_name = Column(String, index=True)
    author_profile = Column(String)
    author_jobtitle = Column(String)
    post_time = Column(String)
    content = Column(Text)
    reactions = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    date_collected = Column(DateTime, default=datetime.utcnow)
    scrape_job_id = Column(String, index=True)

    # Analysis fields
    sentiment = Column(Float, nullable=True)
    sentiment_label = Column(String, nullable=True)
    topics = Column(Text, nullable=True)  # JSON list
    hashtags = Column(Text, nullable=True)  # comma-separated
    engagement_score = Column(Float, nullable=True)

    bookmarks = relationship("Bookmark", back_populates="post", cascade="all, delete-orphan")


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String, default="#3B82F6")
    created_at = Column(DateTime, default=datetime.utcnow)

    bookmarks = relationship("Bookmark", back_populates="collection", cascade="all, delete-orphan")


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    collection_id = Column(Integer, ForeignKey("collections.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="bookmarks")
    collection = relationship("Collection", back_populates="bookmarks")


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    query = Column(String, nullable=False)
    content_type = Column(String, default="posts")
    time_range = Column(String, default="week")
    location = Column(String, default="any")
    max_posts = Column(Integer, default=20)
    schedule_hours = Column(Integer, default=24)
    enabled = Column(Boolean, default=True)
    last_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    results = relationship("MonitorResult", back_populates="saved_search", cascade="all, delete-orphan")


class MonitorResult(Base):
    __tablename__ = "monitor_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    saved_search_id = Column(Integer, ForeignKey("saved_searches.id"), nullable=False)
    new_posts_count = Column(Integer, default=0)
    run_at = Column(DateTime, default=datetime.utcnow)
    job_id = Column(String, nullable=True)

    saved_search = relationship("SavedSearch", back_populates="results")
