from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
from models import (
    ReviewAssignment, LabResult, LabReport, LabOrder, OpdVisit, Patient,
    Consultation, User, UserRole, ResultStatus, OrderStatus, Sample, AuditLog
)
from auth import require_role
from schemas import ReviewDecisionRequest
from datetime import datetime
import random, string

router = APIRouter(prefix="/api/pathologist", tags=["pathologist"])
_require = require_role(UserRole.pathologist)


def _gen_report_id(db: Session) -> str:
    while True:
        rid = "RPT-" + "".join(random.choices(string.digits, k=6))
        if not db.query(LabReport).filter_by(report_id=rid).first():
            return rid


@router.get("/review-queue")
def review_queue(db: Session = Depends(get_db), current_user: User = Depends(_require)):
    assignments = (
        db.query(ReviewAssignment)
        .options(
            joinedload(ReviewAssignment.result).joinedload(LabResult.test),
            joinedload(ReviewAssignment.result).joinedload(LabResult.sample),
        )
        .filter(ReviewAssignment.pathologist_id == current_user.id)
        .filter(ReviewAssignment.result.has(LabResult.status.in_([ResultStatus.pending_review, ResultStatus.held])))
        .order_by(ReviewAssignment.assigned_at)
        .all()
    )
    result = []
    for a in assignments:
        r = a.result
        result.append({
            "assignment_id": a.id, "result_id": r.id,
            "test": r.test.name if r.test else None,
            "value": r.value, "flag": r.flag, "qc_status": r.qc_status,
            "status": r.status.value, "assigned_at": a.assigned_at,
            "sample_id": r.sample_id,
            "is_critical": r.flag and ("HH" in r.flag or "LL" in r.flag),
        })
    return result


@router.get("/result/{result_id}/context")
def result_context(result_id: int, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    """Get full context: result, patient history, past results."""
    # Verify assignment
    assignment = db.query(ReviewAssignment).filter_by(result_id=result_id, pathologist_id=current_user.id).first()
    if not assignment:
        raise HTTPException(403, "Not assigned to review this result")

    result = (
        db.query(LabResult)
        .options(joinedload(LabResult.test), joinedload(LabResult.sample))
        .filter_by(id=result_id)
        .first()
    )
    if not result:
        raise HTTPException(404, "Result not found")

    # Patient context via sample→order→visit→patient
    order = db.query(LabOrder).filter_by(id=result.sample.order_id).first() if result.sample else None
    visit = db.query(OpdVisit).options(joinedload(OpdVisit.patient)).filter_by(id=order.visit_id).first() if order else None
    patient = visit.patient if visit else None

    # Previous results for same test
    prior_results = []
    if patient and result.test_id:
        all_order_ids = [o.id for o in db.query(LabOrder).filter(LabOrder.visit_id.in_(
            [v.id for v in db.query(OpdVisit).filter_by(patient_id=patient.id).all()]
        )).all()]
        all_sample_ids = [s.id for s in db.query(__import__('models', fromlist=['Sample']).Sample).filter_by(
        ).filter(__import__('models', fromlist=['Sample']).Sample.order_id.in_(all_order_ids)).all()]
        prior = (
            db.query(LabResult)
            .filter(LabResult.test_id == result.test_id, LabResult.id != result_id)
            .filter(LabResult.sample_id.in_(all_sample_ids))
            .order_by(LabResult.received_at.desc())
            .limit(5)
            .all()
        )
        prior_results = [{"value": r.value, "flag": r.flag, "received_at": r.received_at, "run": r.run_number} for r in prior]

    # Consultation/diagnosis
    consultation = db.query(Consultation).filter_by(visit_id=visit.id).first() if visit else None

    return {
        "result": {
            "id": result.id, "test": result.test.name if result.test else None,
            "value": result.value, "unit": result.unit, "ref_range": result.ref_range,
            "flag": result.flag, "qc_status": result.qc_status,
            "analyser_flags": result.analyser_flags, "run_number": result.run_number,
        },
        "patient": {"name": patient.full_name, "uhid": patient.uhid, "dob": patient.dob, "gender": patient.gender} if patient else None,
        "diagnosis": consultation.diagnosis if consultation else None,
        "complaints": consultation.complaints if consultation else None,
        "prior_results": prior_results,
    }


@router.post("/review/{assignment_id}")
def submit_review(
    assignment_id: int,
    data: ReviewDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require)
):
    if data.decision not in ("approved", "held", "rerun"):
        raise HTTPException(400, "decision must be 'approved', 'held', or 'rerun'")

    assignment = db.query(ReviewAssignment).filter_by(id=assignment_id, pathologist_id=current_user.id).first()
    if not assignment:
        raise HTTPException(403, "Not authorized or assignment not found")

    result = db.query(LabResult).filter_by(id=assignment.result_id).first()
    if not result:
        raise HTTPException(404, "Result not found")

    if result.status not in (ResultStatus.pending_review, ResultStatus.held):
        raise HTTPException(400, "Only pending or held results can be reviewed")
    if data.decision in ("held", "rerun") and not (data.hold_reason or "").strip():
        raise HTTPException(400, "A reason is required")
    # Require notification recording for critical flags
    is_critical = result.flag and ("HH" in result.flag or "LL" in result.flag)
    if is_critical and data.decision == "approved" and not data.notification_recorded:
        raise HTTPException(400, "Critical result: must record urgent notification before approving")

    assignment.decision = data.decision
    assignment.reviewed_at = datetime.utcnow()
    assignment.notification_recorded = data.notification_recorded

    if data.decision == "approved":
        result.status = ResultStatus.approved
        # Create lab report
        order = db.query(LabOrder).filter_by(id=result.sample.order_id).first()
        report = LabReport(
            report_id=_gen_report_id(db),
            order_id=order.id if order else 0,
            result_id=result.id,
            approved_by=current_user.id,
            approved_at=datetime.utcnow(),
        )
        db.add(report)
    elif data.decision == "held":
        result.status = ResultStatus.held
        assignment.hold_reason = data.hold_reason
    elif data.decision == "rerun":
        result.status = ResultStatus.rerun_requested

    db.flush()
    order = result.sample.order
    results = db.query(LabResult).join(Sample).filter(Sample.order_id == order.id).order_by(LabResult.id).all()
    latest = {}
    for item in results:
        latest[item.test_id] = item
    approved = sum(r.status == ResultStatus.approved for r in latest.values())
    order.status = OrderStatus.completed if approved == len(order.order_tests) else (OrderStatus.partially_completed if approved else OrderStatus.in_progress)
    db.commit()
    db.add(AuditLog(
        user_id=current_user.id, action=f"review_{data.decision}",
        entity_type="lab_result", entity_id=str(result.id),
        details=data.hold_reason
    ))
    db.commit()
    return {"message": f"Result {data.decision}"}


@router.get("/my-reports")
def my_reports(db: Session = Depends(get_db), current_user: User = Depends(_require)):
    assignments = (
        db.query(ReviewAssignment)
        .filter(ReviewAssignment.pathologist_id == current_user.id)
        .filter(ReviewAssignment.decision != None)
        .order_by(ReviewAssignment.reviewed_at.desc())
        .all()
    )
    result = []
    for a in assignments:
        r = db.query(LabResult).options(joinedload(LabResult.test)).filter_by(id=a.result_id).first()
        result.append({
            "result_id": r.id if r else None,
            "test": r.test.name if r and r.test else None,
            "flag": r.flag if r else None,
            "decision": a.decision,
            "reviewed_at": a.reviewed_at,
        })
    return result
