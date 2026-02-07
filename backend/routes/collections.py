from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Collection, Bookmark, Post
from schemas import CollectionCreate, CollectionOut, BookmarkCreate, BookmarkOut

router = APIRouter(prefix="/api", tags=["collections"])


@router.get("/collections", response_model=list[CollectionOut])
def list_collections(db: Session = Depends(get_db)):
    collections = db.query(Collection).order_by(Collection.created_at.desc()).all()
    result = []
    for c in collections:
        count = db.query(Bookmark).filter(Bookmark.collection_id == c.id).count()
        result.append({
            "id": c.id,
            "name": c.name,
            "description": c.description,
            "color": c.color,
            "created_at": c.created_at,
            "post_count": count,
        })
    return result


@router.post("/collections", response_model=CollectionOut)
def create_collection(req: CollectionCreate, db: Session = Depends(get_db)):
    collection = Collection(name=req.name, description=req.description, color=req.color)
    db.add(collection)
    db.commit()
    db.refresh(collection)
    return {
        "id": collection.id,
        "name": collection.name,
        "description": collection.description,
        "color": collection.color,
        "created_at": collection.created_at,
        "post_count": 0,
    }


@router.delete("/collections/{collection_id}")
def delete_collection(collection_id: int, db: Session = Depends(get_db)):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    db.delete(collection)
    db.commit()
    return {"status": "ok"}


@router.post("/bookmarks", response_model=BookmarkOut)
def create_bookmark(req: BookmarkCreate, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == req.post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(Bookmark).filter(Bookmark.post_id == req.post_id).first()
    if existing:
        if req.collection_id and existing.collection_id != req.collection_id:
            existing.collection_id = req.collection_id
            db.commit()
            db.refresh(existing)
        return existing

    bookmark = Bookmark(post_id=req.post_id, collection_id=req.collection_id)
    db.add(bookmark)
    db.commit()
    db.refresh(bookmark)
    return bookmark


@router.delete("/bookmarks/{post_id}")
def delete_bookmark(post_id: int, db: Session = Depends(get_db)):
    bookmark = db.query(Bookmark).filter(Bookmark.post_id == post_id).first()
    if not bookmark:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    db.delete(bookmark)
    db.commit()
    return {"status": "ok"}


@router.get("/bookmarks", response_model=list[BookmarkOut])
def list_bookmarks(
    collection_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Bookmark)
    if collection_id is not None:
        query = query.filter(Bookmark.collection_id == collection_id)
    bookmarks = query.order_by(Bookmark.created_at.desc()).all()
    return bookmarks
