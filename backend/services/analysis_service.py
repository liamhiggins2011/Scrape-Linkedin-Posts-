import re
import json
from textblob import TextBlob
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Post


def analyze_sentiment(text: str) -> tuple[float, str]:
    blob = TextBlob(text)
    score = blob.sentiment.polarity
    if score > 0.1:
        label = "positive"
    elif score < -0.1:
        label = "negative"
    else:
        label = "neutral"
    return score, label


def extract_topics(text: str, n: int = 5) -> list[str]:
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        # Use TF-IDF on the single document split into sentences
        sentences = re.split(r'[.!?\n]+', text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
        if not sentences:
            return []

        vectorizer = TfidfVectorizer(
            max_features=50,
            stop_words='english',
            ngram_range=(1, 2),
            min_df=1,
        )
        tfidf = vectorizer.fit_transform(sentences)
        feature_names = vectorizer.get_feature_names_out()

        # Sum TF-IDF scores across sentences
        scores = tfidf.sum(axis=0).A1
        top_indices = scores.argsort()[-n:][::-1]
        return [feature_names[i] for i in top_indices if scores[i] > 0]
    except Exception:
        return []


def extract_hashtags(text: str) -> list[str]:
    return re.findall(r'#(\w+)', text)


def compute_engagement_score(reactions: int, comments: int, max_engagement: float) -> float:
    raw = reactions * 1 + comments * 2
    if max_engagement <= 0:
        return 0.0
    return min(round((raw / max_engagement) * 100, 1), 100.0)


def enrich_posts(job_id: str, db: Session):
    posts = db.query(Post).filter(Post.scrape_job_id == job_id).all()
    if not posts:
        return

    # Compute max engagement for normalization
    max_eng = max((p.reactions + p.comments * 2) for p in posts) if posts else 1
    if max_eng == 0:
        max_eng = 1

    for post in posts:
        text = post.content or ""
        if not text.strip():
            continue

        score, label = analyze_sentiment(text)
        post.sentiment = score
        post.sentiment_label = label

        topics = extract_topics(text)
        post.topics = json.dumps(topics)

        hashtags = extract_hashtags(text)
        post.hashtags = ",".join(hashtags) if hashtags else None

        post.engagement_score = compute_engagement_score(
            post.reactions or 0, post.comments or 0, max_eng
        )

    db.commit()


def enrich_all_posts(db: Session):
    """Enrich all posts that haven't been analyzed yet."""
    posts = db.query(Post).filter(Post.sentiment.is_(None)).all()
    if not posts:
        return 0

    max_result = db.query(
        func.max(Post.reactions + Post.comments * 2)
    ).scalar() or 1

    count = 0
    for post in posts:
        text = post.content or ""
        if not text.strip():
            continue

        score, label = analyze_sentiment(text)
        post.sentiment = score
        post.sentiment_label = label

        topics = extract_topics(text)
        post.topics = json.dumps(topics)

        hashtags = extract_hashtags(text)
        post.hashtags = ",".join(hashtags) if hashtags else None

        post.engagement_score = compute_engagement_score(
            post.reactions or 0, post.comments or 0, max_result
        )
        count += 1

    db.commit()
    return count
