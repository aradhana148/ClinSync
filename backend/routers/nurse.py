from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
from models import OpdVisit, Vitals, User, UserRole, VisitStatus, AuditLog
from auth import require_role
from schemas import VitalsCreate, VitalsOut, VisitDetail
from datetime import datetime

router = APIRouter(prefix="/api/nurse", tags=["nurse"])
_require = require_role(UserRole.nurse)


@router.get("/queue", response_model=List[VisitDetail])
def get_queue(db: Session = Depends(get_db), _=Depends(_require)):
    """Patients who are checked-in and need nursing assessment."""
    visits = (
        db.query(OpdVisit)
        .options(joinedload(OpdVisit.patient), joinedload(OpdVisit.doctor))
        .filter(OpdVisit.status.in_([VisitStatus.checked_in, VisitStatus.waiting]))
        .filter(~OpdVisit.vitals.has(Vitals.ready_for_doctor == True))
        .order_by(OpdVisit.created_at)
        .all()
    )
    return visits


@router.post("/vitals/{visit_id}", response_model=VitalsOut)
def record_vitals(
    visit_id: int,
    data: VitalsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require)
):
    visit = db.query(OpdVisit).filter_by(id=visit_id).first()
    if not visit:
        raise HTTPException(404, "Visit not found")

    if visit.status not in (VisitStatus.checked_in, VisitStatus.waiting):
        raise HTTPException(403, "Visit is not in the nursing queue")
    existing = db.query(Vitals).filter_by(visit_id=visit_id).first()
    if existing:
        for k, v in data.model_dump().items():
            if v is not None:
                setattr(existing, k, v)
        existing.recorded_at = datetime.utcnow()
        existing.ready_for_doctor = True
        db.commit()
        db.refresh(existing)
        vitals = existing
    else:
        vitals = Vitals(
            visit_id=visit_id,
            nurse_id=current_user.id,
            ready_for_doctor=True,
            **data.model_dump()
        )
        db.add(vitals)

    visit.status = VisitStatus.waiting
    db.commit()
    db.refresh(vitals)

    db.add(AuditLog(user_id=current_user.id, action="record_vitals", entity_type="visit", entity_id=str(visit_id)))
    db.commit()
    return vitals


@router.get("/vitals/{visit_id}", response_model=VitalsOut)
def get_vitals(visit_id: int, db: Session = Depends(get_db), _=Depends(_require)):
    vitals = db.query(Vitals).options(joinedload(Vitals.nurse)).filter_by(visit_id=visit_id).first()
    if not vitals:
        raise HTTPException(404, "Vitals not found")
    return vitals
