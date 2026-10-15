from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from database import get_db
from auth import require_role
from models import FollowUpRequest, OpdVisit, User, UserRole, VisitStatus, AuditLog
from routers.receptionist import _gen_visit_id

router = APIRouter(prefix="/api", tags=["follow-ups"])
doctor_only = require_role(UserRole.doctor)
reception_only = require_role(UserRole.receptionist)

class RequestData(BaseModel):
    requested_date: date
    reason: str = Field(min_length=1, max_length=2000)

class BookingData(BaseModel):
    appointment_time: datetime

def serialize(r):
    return dict(id=r.id, patient_id=r.patient_id, patient=r.patient.full_name, uhid=r.patient.uhid,
                doctor=r.doctor.full_name, requested_date=r.requested_date, reason=r.reason,
                status=r.status, appointment_time=r.booked_visit.appointment_time if r.booked_visit else None)

def authorized(db, patient_id, user):
    visit = db.query(OpdVisit).filter_by(patient_id=patient_id, doctor_id=user.id).order_by(OpdVisit.id.desc()).first()
    if not visit:
        raise HTTPException(403, "Not authorized for this patient")
    return visit

@router.get("/doctor/patients/{patient_id}/follow-ups")
def doctor_requests(patient_id: int, db: Session = Depends(get_db), user: User = Depends(doctor_only)):
    authorized(db, patient_id, user)
    return [serialize(r) for r in db.query(FollowUpRequest).filter_by(patient_id=patient_id, doctor_id=user.id).order_by(FollowUpRequest.id.desc()).all()]

@router.post("/doctor/patients/{patient_id}/follow-ups")
def request_followup(patient_id: int, data: RequestData, db: Session = Depends(get_db), user: User = Depends(doctor_only)):
    visit = authorized(db, patient_id, user)
    if data.requested_date < date.today() or not data.reason.strip():
        raise HTTPException(400, "Choose today or a future date and enter a reason")
    if db.query(FollowUpRequest).filter_by(patient_id=patient_id, doctor_id=user.id, status="pending").first():
        raise HTTPException(409, "A follow-up request is already waiting for reception")
    r = FollowUpRequest(patient_id=patient_id, doctor_id=user.id, department=visit.department,
                        requested_date=data.requested_date.isoformat(), reason=data.reason.strip())
    db.add(r)
    db.flush()
    db.add(AuditLog(user_id=user.id, action="request_follow_up", entity_type="follow_up", entity_id=str(r.id)))
    db.commit()
    return serialize(r)

@router.get("/receptionist/follow-ups")
def reception_requests(db: Session = Depends(get_db), user: User = Depends(reception_only)):
    return [serialize(r) for r in db.query(FollowUpRequest).order_by(FollowUpRequest.id.desc()).all()]

@router.post("/receptionist/follow-ups/{request_id}/book")
def book_followup(request_id: int, data: BookingData, db: Session = Depends(get_db), user: User = Depends(reception_only)):
    # Conditional update claims the request before booking, including concurrent retries.
    if data.appointment_time.replace(tzinfo=None) < datetime.now():
        raise HTTPException(400, "Choose a future appointment time")
    claimed = db.query(FollowUpRequest).filter_by(id=request_id, status="pending").update({"status": "booked"})
    if not claimed:
        db.rollback()
        raise HTTPException(409, "Request is already booked or no longer available")
    r = db.get(FollowUpRequest, request_id)
    if not r.doctor.is_active:
        db.rollback()
        raise HTTPException(400, "The requesting doctor is inactive")
    visit = OpdVisit(visit_id=_gen_visit_id(db), patient_id=r.patient_id, doctor_id=r.doctor_id,
                     department=r.department, appointment_time=data.appointment_time, status=VisitStatus.scheduled)
    db.add(visit)
    db.flush()
    r.booked_visit_id = visit.id
    db.add(AuditLog(user_id=user.id, action="book_follow_up", entity_type="follow_up", entity_id=str(r.id)))
    db.commit()
    return serialize(r)
