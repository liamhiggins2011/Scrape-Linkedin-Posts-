from sqlalchemy.orm import Session
from sqlalchemy import text
from models import Post


def search_posts(
    db: Session,
    q: str | None = None,
    author: str | None = None,
    sort: str = "date",
    page: int = 1,
    per_page: int = 20,
    job_id: str | None = None,
) -> tuple[list[Post], int]:
    # If job_id is provided, filter to only posts from that scrape job
    if job_id:
        query = db.query(Post).filter(Post.scrape_job_id == job_id)

        if author:
            query = query.filter(Post.author_name.ilike(f"%{author}%"))

        if sort == "reactions":
            query = query.order_by(Post.reactions.desc())
        elif sort == "comments":
            query = query.order_by(Post.comments.desc())
        else:
            query = query.order_by(Post.date_collected.desc())

        total = query.count()
        posts = query.offset((page - 1) * per_page).limit(per_page).all()
        return posts, total

    if q:
        # Escape FTS5 special characters and build query
        fts_q = _fts_escape(q)

        # Default to relevance sort when searching
        if sort == "date" and not author:
            sort = "relevance"

        # Determine ORDER BY clause
        if sort == "relevance":
            order_clause = "-bm25(posts_fts)"
        elif sort == "reactions":
            order_clause = "posts.reactions DESC"
        elif sort == "comments":
            order_clause = "posts.comments DESC"
        else:
            order_clause = "posts.date_collected DESC"

        # Build author filter
        author_clause = ""
        params: dict = {"query": fts_q, "limit": per_page, "offset": (page - 1) * per_page}
        if author:
            author_clause = "AND posts.author_name LIKE :author"
            params["author"] = f"%{author}%"

        results = db.execute(
            text(f"""
                SELECT posts.* FROM posts
                JOIN posts_fts ON posts.id = posts_fts.rowid
                WHERE posts_fts MATCH :query
                {author_clause}
                ORDER BY {order_clause}
                LIMIT :limit OFFSET :offset
            """),
            params,
        ).fetchall()

        count_params: dict = {"query": fts_q}
        count_clause = ""
        if author:
            count_clause = "AND p.author_name LIKE :author"
            count_params["author"] = f"%{author}%"

        total = db.execute(
            text(f"""
                SELECT COUNT(*) FROM posts p
                JOIN posts_fts ON p.id = posts_fts.rowid
                WHERE posts_fts MATCH :query
                {count_clause}
            """),
            count_params,
        ).scalar()

        # Convert row results to Post objects
        posts = []
        for row in results:
            post = db.get(Post, row.id)
            if post:
                posts.append(post)

        return posts, total or 0
    else:
        # No query — return all posts sorted (original logic)
        query = db.query(Post)

        if author:
            query = query.filter(Post.author_name.ilike(f"%{author}%"))

        if sort == "reactions":
            query = query.order_by(Post.reactions.desc())
        elif sort == "comments":
            query = query.order_by(Post.comments.desc())
        else:
            query = query.order_by(Post.date_collected.desc())

        total = query.count()
        posts = query.offset((page - 1) * per_page).limit(per_page).all()
        return posts, total


def _fts_escape(query: str) -> str:
    """Escape an FTS5 query string for safe use with MATCH.

    Wraps each token in double quotes to avoid FTS5 syntax errors from
    special characters (colons, hyphens, etc.).
    """
    tokens = query.split()
    escaped = []
    for token in tokens:
        # Strip surrounding quotes if user already added them
        clean = token.strip('"')
        if clean:
            escaped.append(f'"{clean}"')
    return " ".join(escaped)
