from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from database import get_db
from models import Patient, OpdVisit, User, UserRole, VisitStatus, AuditLog, AbhaStatus
from auth import require_role, get_current_user
from schemas import PatientCreate, PatientOut, VisitCreate, VisitOut, VisitDetail, UserOut
from datetime import datetime
import random, string

router = APIRouter(prefix="/api/receptionist", tags=["receptionist"])
_require = require_role(UserRole.receptionist)


def _gen_uhid(db: Session) -> str:
    while True:
        uid = "UHID-" + "".join(random.choices(string.digits, k=4))
        if not db.query(Patient).filter_by(uhid=uid).first():
            return uid


def _gen_visit_id(db: Session) -> str:
    while True:
        vid = "VID-" + "".join(random.choices(string.digits, k=5))
        if not db.query(OpdVisit).filter_by(visit_id=vid).first():
            return vid


@router.get("/patients", response_model=List[PatientOut])
def search_patients(q: Optional[str] = Query(None), db: Session = Depends(get_db), _=Depends(_require)):
    qry = db.query(Patient)
    if q:
        like = f"%{q}%"
        qry = qry.filter(
            Patient.full_name.ilike(like) |
            Patient.uhid.ilike(like) |
            Patient.phone.ilike(like)
        )
    return qry.order_by(Patient.id.desc()).limit(50).all()


@router.post("/patients", response_model=PatientOut)
def register_patient(data: PatientCreate, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    p = Patient(uhid=_gen_uhid(db), **data.model_dump())
    p.abha_status = AbhaStatus.unverified if p.abha_number else AbhaStatus.not_linked
    db.add(p)
    db.commit()
    db.refresh(p)
    db.add(AuditLog(user_id=current_user.id, action="register_patient", entity_type="patient", entity_id=p.uhid))
    db.commit()
    return p


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db), _=Depends(_require)):
    p = db.query(Patient).filter_by(id=patient_id).first()
    if not p:
        raise HTTPException(404, "Patient not found")
    return p


@router.get("/doctors", response_model=List[UserOut])
def list_doctors(db: Session = Depends(get_db), _=Depends(_require)):
    return db.query(User).filter_by(role=UserRole.doctor, is_active=True).all()


@router.post("/visits", response_model=VisitOut)
def create_visit(data: VisitCreate, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    patient = db.query(Patient).filter_by(id=data.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    doctor = db.query(User).filter_by(id=data.doctor_id, role=UserRole.doctor).first()
    if not doctor:
        raise HTTPException(404, "Doctor not found")

    visit = OpdVisit(
        visit_id=_gen_visit_id(db),
        patient_id=data.patient_id,
        doctor_id=data.doctor_id,
        department=data.department,
        status=VisitStatus.scheduled,
        appointment_time=data.appointment_time or datetime.utcnow(),
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    db.add(AuditLog(user_id=current_user.id, action="create_visit", entity_type="visit", entity_id=visit.visit_id))
    db.commit()
    return visit


@router.post("/visits/{visit_id}/checkin", response_model=VisitOut)
def checkin_visit(visit_id: int, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    visit = db.query(OpdVisit).filter_by(id=visit_id).first()
    if not visit:
        raise HTTPException(404, "Visit not found")
    if visit.status != VisitStatus.scheduled:
        raise HTTPException(400, "Visit is not in Scheduled status")
    visit.status = VisitStatus.checked_in
    db.commit()
    db.refresh(visit)
    return visit


@router.get("/visits", response_model=List[VisitDetail])
def today_visits(db: Session = Depends(get_db), _=Depends(_require)):
    visits = (
        db.query(OpdVisit)
        .options(joinedload(OpdVisit.patient), joinedload(OpdVisit.doctor))
        .filter(OpdVisit.status.notin_([VisitStatus.completed, VisitStatus.cancelled]))
        .order_by(OpdVisit.created_at.desc())
        .limit(100)
        .all()
    )
    return visits


@router.post("/visits/{visit_id}/cancel")
def cancel_visit(visit_id: int, db: Session = Depends(get_db), user: User = Depends(_require)):
    visit = db.get(OpdVisit, visit_id)
    if not visit or visit.status != VisitStatus.scheduled:
        raise HTTPException(400, "Only scheduled visits can be cancelled")
    visit.status = VisitStatus.cancelled
    db.add(AuditLog(user_id=user.id, action="cancel_visit", entity_type="visit", entity_id=str(visit_id)))
    db.commit()
    return {"message": "Appointment cancelled"}


@router.post("/visits/{visit_id}/reschedule")
def reschedule_visit(visit_id: int, data: VisitCreate, db: Session = Depends(get_db), user: User = Depends(_require)):
    visit = db.get(OpdVisit, visit_id)
    if not visit or visit.status != VisitStatus.scheduled:
        raise HTTPException(400, "Only scheduled visits can be rescheduled")
    if data.patient_id != visit.patient_id or not data.appointment_time:
        raise HTTPException(400, "Patient must match and appointment time is required")
    if not db.query(User).filter_by(id=data.doctor_id, role=UserRole.doctor, is_active=True).first():
        raise HTTPException(400, "Doctor not found")
    visit.appointment_time = data.appointment_time
    visit.doctor_id = data.doctor_id
    visit.department = data.department
    db.add(AuditLog(user_id=user.id, action="reschedule_visit", entity_type="visit", entity_id=str(visit_id)))
    db.commit()
    return {"message": "Appointment rescheduled"}
