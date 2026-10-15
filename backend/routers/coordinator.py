from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
from models import (
    LabOrder, LabOrderTest, TechnicianAssignment, ReviewAssignment,
    LabResult, User, UserRole, OrderStatus, ResultStatus, AuditLog
)
from auth import require_role
from schemas import AssignTechnicianRequest, AssignReviewerRequest, UserOut
from datetime import datetime

router = APIRouter(prefix="/api/coordinator", tags=["coordinator"])
_require = require_role(UserRole.coordinator)


@router.get("/orders")
def list_orders(db: Session = Depends(get_db), _=Depends(_require)):
    orders = (
        db.query(LabOrder)
        .options(
            joinedload(LabOrder.order_tests).joinedload(LabOrderTest.test),
            joinedload(LabOrder.technician_assignment).joinedload(TechnicianAssignment.technician),
            joinedload(LabOrder.visit),
        )
        .order_by(LabOrder.created_at.desc())
        .limit(100)
        .all()
    )
    result = []
    for o in orders:
        result.append({
            "id": o.id, "order_id": o.order_id, "priority": o.priority.value,
            "status": o.status.value, "created_at": o.created_at,
            "patient": o.visit.patient.full_name,
            "tests": [{"code": ot.test.code, "name": ot.test.name} for ot in o.order_tests],
            "technician": o.technician_assignment.technician.full_name if o.technician_assignment else None,
            "technician_id": o.technician_assignment.technician_id if o.technician_assignment else None,
        })
    return result


@router.get("/technicians")
def list_technicians(db: Session = Depends(get_db), _=Depends(_require)):
    techs = db.query(User).filter_by(role=UserRole.technician, is_active=True).all()
    result = []
    for t in techs:
        active = db.query(TechnicianAssignment).join(LabOrder).filter(TechnicianAssignment.technician_id == t.id, LabOrder.status.notin_([OrderStatus.completed, OrderStatus.cancelled])).count()
        result.append({"id": t.id, "full_name": t.full_name, "active_orders": active})
    return result


@router.get("/pathologists", response_model=List[UserOut])
def list_pathologists(db: Session = Depends(get_db), _=Depends(_require)):
    return db.query(User).filter_by(role=UserRole.pathologist, is_active=True).all()


@router.post("/assign-technician")
def assign_technician(
    data: AssignTechnicianRequest,
    db: Session = Depends(get_db), current_user: User = Depends(_require)
):
    order = db.query(LabOrder).filter_by(id=data.order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if order.status in (OrderStatus.cancelled, OrderStatus.completed):
        raise HTTPException(409, "Closed orders cannot be assigned")
    tech = db.query(User).filter_by(id=data.technician_id, role=UserRole.technician).first()
    if not tech:
        raise HTTPException(404, "Technician not found")

    existing = db.query(TechnicianAssignment).filter_by(order_id=data.order_id).first()
    if existing:
        existing.technician_id = data.technician_id
        existing.assigned_at = datetime.utcnow()
    else:
        db.add(TechnicianAssignment(
            order_id=data.order_id,
            technician_id=data.technician_id,
            assigned_by=current_user.id,
        ))
    if order.status == OrderStatus.ordered:
        order.status = OrderStatus.assigned
    db.commit()
    db.add(AuditLog(user_id=current_user.id, action="assign_technician", entity_type="lab_order", entity_id=str(data.order_id)))
    db.commit()
    return {"message": "Technician assigned"}


@router.post("/assign-reviewer")
def assign_reviewer(
    data: AssignReviewerRequest,
    db: Session = Depends(get_db), current_user: User = Depends(_require)
):
    result = db.query(LabResult).filter_by(id=data.result_id).first()
    if not result:
        raise HTTPException(404, "Result not found")
    if result.status not in (ResultStatus.received, ResultStatus.pending_review, ResultStatus.held):
        raise HTTPException(400, "Result cannot be assigned for review")
    patho = db.query(User).filter_by(id=data.pathologist_id, role=UserRole.pathologist).first()
    if not patho:
        raise HTTPException(404, "Pathologist not found")

    existing = db.query(ReviewAssignment).filter_by(result_id=data.result_id).first()
    if existing:
        existing.pathologist_id = data.pathologist_id
        existing.assigned_at = datetime.utcnow()
        existing.decision = None
        existing.reviewed_at = None
    else:
        db.add(ReviewAssignment(
            result_id=data.result_id,
            pathologist_id=data.pathologist_id,
            assigned_by=current_user.id,
        ))
    result.status = ResultStatus.pending_review
    db.commit()
    db.add(AuditLog(user_id=current_user.id, action="assign_reviewer", entity_type="lab_result", entity_id=str(data.result_id)))
    db.commit()
    return {"message": "Reviewer assigned"}


@router.get("/pending-reviews")
def pending_reviews(db: Session = Depends(get_db), _=Depends(_require)):
    results = (
        db.query(LabResult)
        .options(joinedload(LabResult.test), joinedload(LabResult.review_assignment))
        .filter(LabResult.status.in_([ResultStatus.received, ResultStatus.pending_review, ResultStatus.held]))
        .all()
    )
    return [
        {
            "id": r.id, "test": r.test.name if r.test else None,
            "flag": r.flag, "status": r.status.value,
            "assigned_to": r.review_assignment.pathologist_id if r.review_assignment else None,
        }
        for r in results
    ]


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _=Depends(_require)):
    total = db.query(LabOrder).count()
    unassigned = db.query(LabOrder).filter_by(status=OrderStatus.ordered).count()
    in_progress = db.query(LabOrder).filter_by(status=OrderStatus.in_progress).count()
    pending_review = db.query(LabResult).filter_by(status=ResultStatus.received).count()
    return {
        "total_orders": total,
        "unassigned": unassigned,
        "in_progress": in_progress,
        "pending_review": pending_review,
    }
