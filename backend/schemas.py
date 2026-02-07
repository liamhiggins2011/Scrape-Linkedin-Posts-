from pydantic import BaseModel
from datetime import datetime


class PostOut(BaseModel):
    id: int
    post_id: str
    post_url: str | None
    author_name: str | None
    author_profile: str | None
    author_jobtitle: str | None
    post_time: str | None
    content: str | None
    reactions: int
    comments: int
    impressions: int
    date_collected: datetime | None
    scrape_job_id: str | None
    sentiment: float | None = None
    sentiment_label: str | None = None
    topics: str | None = None
    hashtags: str | None = None
    engagement_score: float | None = None
    is_bookmarked: bool = False

    class Config:
        from_attributes = True


class PostsResponse(BaseModel):
    posts: list[PostOut]
    total: int
    page: int
    per_page: int


class ScrapeRequest(BaseModel):
    profile_url: str
    max_posts: int = 20


class SearchScrapeRequest(BaseModel):
    query: str
    max_posts: int = 20
    content_type: str = "posts"
    time_range: str = "any"
    location: str = "any"


class ScrapeJobOut(BaseModel):
    job_id: str
    status: str
    posts_found: int
    error: str | None
    profile_url: str | None = None
    query: str | None = None


class CookieStatus(BaseModel):
    uploaded: bool


# Analytics schemas
class AnalyticsOverview(BaseModel):
    total_posts: int
    total_authors: int
    avg_engagement: float
    posts_today: int
    posts_this_week: int


class AuthorStats(BaseModel):
    author_name: str
    post_count: int
    avg_engagement: float


class TopicFrequency(BaseModel):
    topic: str
    count: int


class EngagementPoint(BaseModel):
    date: str
    avg_engagement: float
    post_count: int


class SentimentData(BaseModel):
    label: str
    count: int


class HashtagData(BaseModel):
    hashtag: str
    count: int


# Collection schemas
class CollectionCreate(BaseModel):
    name: str
    description: str | None = None
    color: str = "#3B82F6"


class CollectionOut(BaseModel):
    id: int
    name: str
    description: str | None
    color: str
    created_at: datetime
    post_count: int = 0

    class Config:
        from_attributes = True


class BookmarkCreate(BaseModel):
    post_id: int
    collection_id: int | None = None


class BookmarkOut(BaseModel):
    id: int
    post_id: int
    collection_id: int | None
    created_at: datetime
    post: PostOut

    class Config:
        from_attributes = True


# Monitor / Saved Search schemas
class SavedSearchCreate(BaseModel):
    name: str
    query: str
    content_type: str = "posts"
    time_range: str = "week"
    location: str = "any"
    max_posts: int = 20
    schedule_hours: int = 24
    enabled: bool = True


class SavedSearchUpdate(BaseModel):
    name: str | None = None
    query: str | None = None
    content_type: str | None = None
    time_range: str | None = None
    location: str | None = None
    max_posts: int | None = None
    schedule_hours: int | None = None
    enabled: bool | None = None


class SavedSearchOut(BaseModel):
    id: int
    name: str
    query: str
    content_type: str
    time_range: str
    location: str
    max_posts: int
    schedule_hours: int
    enabled: bool
    last_run: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class MonitorResultOut(BaseModel):
    id: int
    saved_search_id: int
    new_posts_count: int
    run_at: datetime
    job_id: str | None

    class Config:
        from_attributes = True
