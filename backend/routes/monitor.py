import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import SavedSearch, MonitorResult
from schemas import (
    SavedSearchCreate, SavedSearchOut, SavedSearchUpdate, MonitorResultOut,
)

router = APIRouter(prefix="/api/monitor", tags=["monitor"])


@router.get("/searches", response_model=list[SavedSearchOut])
def list_searches(db: Session = Depends(get_db)):
    return db.query(SavedSearch).order_by(SavedSearch.created_at.desc()).all()


@router.post("/searches", response_model=SavedSearchOut)
def create_search(data: SavedSearchCreate, db: Session = Depends(get_db)):
    search = SavedSearch(**data.model_dump())
    db.add(search)
    db.commit()
    db.refresh(search)
    return search


@router.put("/searches/{search_id}", response_model=SavedSearchOut)
def update_search(search_id: int, data: SavedSearchUpdate, db: Session = Depends(get_db)):
    search = db.query(SavedSearch).get(search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(search, field, value)

    db.commit()
    db.refresh(search)
    return search


@router.delete("/searches/{search_id}")
def delete_search(search_id: int, db: Session = Depends(get_db)):
    search = db.query(SavedSearch).get(search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")
    db.delete(search)
    db.commit()
    return {"deleted": True}


@router.post("/searches/{search_id}/run")
def run_search_now(search_id: int, db: Session = Depends(get_db)):
    search = db.query(SavedSearch).get(search_id)
    if not search:
        raise HTTPException(status_code=404, detail="Saved search not found")

    def _run():
        from services.scheduler_service import run_saved_search
        run_saved_search(search_id)

    threading.Thread(target=_run, daemon=True).start()
    return {"status": "running", "search_id": search_id}


@router.get("/results", response_model=list[MonitorResultOut])
def list_results(limit: int = 50, db: Session = Depends(get_db)):
    return (
        db.query(MonitorResult)
        .order_by(MonitorResult.run_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/results/unread")
def unread_count(db: Session = Depends(get_db)):
    """Count new posts found in the last 24 hours by scheduled searches."""
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(hours=24)
    from sqlalchemy import func
    total = (
        db.query(func.sum(MonitorResult.new_posts_count))
        .filter(MonitorResult.run_at >= since)
        .scalar()
    )
    return {"unread": total or 0}
