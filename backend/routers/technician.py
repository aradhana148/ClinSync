import asyncio, random
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db, SessionLocal
from models import (
    LabOrder, LabOrderTest, TechnicianAssignment, Sample, LabResult,
    User, UserRole, OrderStatus, SampleStatus, ResultStatus, AuditLog, Patient, OpdVisit,
    ReviewAssignment
)
from auth import require_role
from schemas import SampleCollectRequest, SampleRejectRequest, SampleOut, LabResultOut
from datetime import datetime
import random as rand_mod
import string

router = APIRouter(prefix="/api/technician", tags=["technician"])
_require = require_role(UserRole.technician)


def _gen_sample_id(db: Session) -> str:
    while True:
        sid = "SMP-" + "".join(rand_mod.choices(string.digits, k=6))
        if not db.query(Sample).filter_by(sample_id=sid).first():
            return sid


def _assigned(db, order_id, user):
    if not db.query(TechnicianAssignment).filter_by(order_id=order_id, technician_id=user.id).first():
        raise HTTPException(403, "Order is not assigned to you")


def _sample(db, sample_id, user):
    sample = db.query(Sample).filter_by(id=sample_id).first()
    if not sample:
        raise HTTPException(404, "Sample not found")
    _assigned(db, sample.order_id, user)
    return sample


# ── Simulated Analyser Results ─────────────────────────────────────────────────
ANALYSER_DATA = {
    "CBC":  [
        {"param": "WBC",  "unit": "10^3/µL", "ref_range": "4.5-11.0", "normal_range": (4.5, 11.0)},
        {"param": "RBC",  "unit": "10^6/µL", "ref_range": "4.5-5.9",  "normal_range": (4.5, 5.9)},
        {"param": "HGB",  "unit": "g/dL",    "ref_range": "13.5-17.5","normal_range": (13.5, 17.5)},
        {"param": "HCT",  "unit": "%",        "ref_range": "41-53",    "normal_range": (41, 53)},
        {"param": "PLT",  "unit": "10^3/µL", "ref_range": "150-400",  "normal_range": (150, 400)},
    ],
    "GLU":  [{"param": "Glucose", "unit": "mg/dL", "ref_range": "70-110",  "normal_range": (70, 110)}],
    "LIPID":[
        {"param": "Total Cholesterol", "unit": "mg/dL", "ref_range": "<200",      "normal_range": (100, 250)},
        {"param": "HDL",               "unit": "mg/dL", "ref_range": ">40",       "normal_range": (25, 90)},
        {"param": "LDL",               "unit": "mg/dL", "ref_range": "<130",      "normal_range": (50, 190)},
        {"param": "Triglycerides",     "unit": "mg/dL", "ref_range": "<150",      "normal_range": (50, 250)},
    ],
    "LFT":  [
        {"param": "ALT",     "unit": "U/L",  "ref_range": "7-56",    "normal_range": (7, 80)},
        {"param": "AST",     "unit": "U/L",  "ref_range": "10-40",   "normal_range": (10, 60)},
        {"param": "Bilirubin","unit":"mg/dL","ref_range": "0.2-1.2", "normal_range": (0.1, 2.0)},
    ],
    "KFT":  [
        {"param": "Creatinine","unit":"mg/dL","ref_range":"0.6-1.2","normal_range": (0.5, 2.0)},
        {"param": "BUN",       "unit":"mg/dL","ref_range":"7-25",   "normal_range": (5, 40)},
    ],
    "TSH":  [{"param": "TSH", "unit": "µIU/mL", "ref_range": "0.4-4.0", "normal_range": (0.3, 6.0)}],
    "UA":   [
        {"param": "pH",      "unit": "",      "ref_range": "4.5-8.0","normal_range": (5.0, 8.0)},
        {"param": "Protein", "unit": "mg/dL", "ref_range": "Negative","normal_range": (0, 30)},
    ],
}


def _gen_result_value(param_info: dict, force_abnormal: bool = False):
    lo, hi = param_info["normal_range"]
    if force_abnormal:
        if rand_mod.random() < 0.5:
            val = rand_mod.uniform(hi * 1.2, hi * 1.8)
            flag = "HH" if val > hi * 1.5 else "H"
        else:
            val = rand_mod.uniform(lo * 0.3, lo * 0.8)
            flag = "LL" if val < lo * 0.5 else "L"
    else:
        val = rand_mod.uniform(lo * 0.95, hi * 1.05)
        flag = None
        if val > hi:
            flag = "H"
        elif val < lo:
            flag = "L"
    critical = flag in ("HH", "LL")
    return round(val, 2), flag, "Critical" if critical else ("Pass" if not flag else "Review")


def _run_analyser(sample_db_id: int, test_codes: list, run_number: int = 1):
    """Runs in background. Simulates analyser delay then saves results."""
    import time
    time.sleep(15)  # simulate processing delay

    db = SessionLocal()
    try:
        sample = db.query(Sample).filter_by(id=sample_db_id).first()
        if not sample or sample.status != SampleStatus.processing:
            raise ValueError("Unknown sample or sample is not processing")

        if db.query(LabResult).filter_by(sample_id=sample.id, run_number=run_number).first():
            raise ValueError("Duplicate analyser run")
        allowed = {ot.test.code for ot in sample.order.order_tests}
        if not test_codes or not set(test_codes).issubset(allowed):
            raise ValueError("Unknown test in analyser message")
        force_abnormal = rand_mod.random() < 0.2  # 20% chance of abnormal result

        for code in test_codes:
            params = ANALYSER_DATA.get(code, [])
            # Get test catalogue for this code
            from models import LabTestCatalogue
            test = db.query(LabTestCatalogue).filter_by(code=code).first()
            if not test:
                continue

            # Build composite result string
            result_parts = []
            flags = []
            for p in params:
                val, flag, qc = _gen_result_value(p, force_abnormal)
                result_parts.append(f"{p['param']}: {val} {p['unit']}")
                if flag:
                    flags.append(f"{p['param']}={flag}")

            value_str = " | ".join(result_parts)
            combined_flag = ", ".join(flags) if flags else None
            qc_status = "Critical" if any(f in ("HH", "LL") for f in [f.split("=")[1] for f in flags] if "=" in f) else ("Pass" if not flags else "Review")

            result = LabResult(
                sample_id=sample.id,
                test_id=test.id,
                run_number=run_number,
                value=value_str,
                unit="(see details)",
                ref_range=" | ".join(f"{p['param']}: {p['ref_range']} {p['unit']}" for p in params),
                flag=combined_flag,
                qc_status=qc_status,
                analyser_flags="Auto-generated by SimAnalyser v1.0",
                status=ResultStatus.received,
                received_at=datetime.utcnow(),
            )
            db.add(result)

        sample.status = SampleStatus.processed
        sample.processed_at = datetime.utcnow()

        # Update order status
        order = db.query(LabOrder).filter_by(id=sample.order_id).first()
        if order:
            order.status = OrderStatus.in_progress

        db.flush()
        from review_routing import assign_received_results
        assign_received_results(db)
        db.commit()
    finally:
        db.close()


@router.get("/my-orders")
def my_orders(db: Session = Depends(get_db), current_user: User = Depends(_require)):
    assignments = (
        db.query(TechnicianAssignment)
        .options(
            joinedload(TechnicianAssignment.order)
            .joinedload(LabOrder.order_tests)
            .joinedload(LabOrderTest.test),
            joinedload(TechnicianAssignment.order).joinedload(LabOrder.visit).joinedload(OpdVisit.patient),
        )
        .filter(TechnicianAssignment.technician_id == current_user.id)
        .order_by(TechnicianAssignment.assigned_at.desc())
        .all()
    )
    result = []
    for a in assignments:
        o = a.order
        sample = db.query(Sample).filter_by(order_id=o.id).order_by(Sample.created_at.desc()).first()
        result.append({
            "order_id": o.id, "order_ref": o.order_id, "priority": o.priority.value,
            "status": o.status.value,
            "patient": {"name": o.visit.patient.full_name, "uhid": o.visit.patient.uhid} if o.visit and o.visit.patient else None,
            "tests": [{"code": ot.test.code, "name": ot.test.name} for ot in o.order_tests],
            "sample": {"sample_id": sample.sample_id, "status": sample.status.value, "id": sample.id} if sample else None,
        })
    return result


@router.post("/collect-sample")
def collect_sample(
    data: SampleCollectRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require)
):
    """Verify patient identity and collect sample."""
    order = (
        db.query(LabOrder)
        .options(joinedload(LabOrder.visit).joinedload(OpdVisit.patient))
        .filter_by(id=data.order_id)
        .first()
    )
    if not order:
        raise HTTPException(404, "Order not found")

    _assigned(db, order.id, current_user)
    # Verify patient with 2nd identifier
    patient = order.visit.patient if order.visit else None
    if not patient:
        raise HTTPException(404, "Patient not found")
    if not data.patient_identifier_2.strip() or data.patient_identifier_2 not in (patient.dob or "", patient.phone or ""):
        raise HTTPException(400, "Patient identity verification failed — DOB or phone does not match")

    # Check if already collected
    existing = db.query(Sample).filter_by(order_id=data.order_id).filter(
        Sample.status != SampleStatus.rejected
    ).first()
    if existing and existing.status not in (SampleStatus.rejected, SampleStatus.recollection_requested):
        raise HTTPException(400, f"Sample already exists with status: {existing.status.value}")

    sample_id = _gen_sample_id(db)
    sample = Sample(
        sample_id=sample_id,
        order_id=data.order_id,
        collected_by=current_user.id,
        status=SampleStatus.collected,
        barcode=f"BC-{sample_id}",
        collected_at=datetime.utcnow(),
    )
    db.add(sample)
    db.commit()
    db.refresh(sample)

    db.add(AuditLog(user_id=current_user.id, action="collect_sample", entity_type="sample", entity_id=sample.sample_id))
    db.commit()
    return {"message": "Sample collected", "sample_id": sample.sample_id, "barcode": sample.barcode}


@router.post("/receive-sample/{sample_id}")
def receive_sample(sample_id: int, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    sample = _sample(db, sample_id, current_user)
    if sample.status != SampleStatus.collected:
        raise HTTPException(400, "Sample must be in Collected state")
    sample.status = SampleStatus.received
    sample.received_at = datetime.utcnow()
    db.commit()
    return {"message": "Sample received"}


@router.post("/accept-sample/{sample_id}")
def accept_sample(
    sample_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require)
):
    sample = _sample(db, sample_id, current_user)
    if sample.status != SampleStatus.received:
        raise HTTPException(400, "Sample must be in Received state to accept")

    sample.status = SampleStatus.processing
    sample.order.status = OrderStatus.in_progress
    db.commit()

    # Get test codes for analyser
    order = db.query(LabOrder).options(joinedload(LabOrder.order_tests).joinedload(LabOrderTest.test)).filter_by(id=sample.order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    test_codes = [ot.test.code for ot in order.order_tests]

    # Get next run number
    existing_results_count = db.query(LabResult).filter_by(sample_id=sample.id).count()
    run_number = (existing_results_count // len(test_codes) if test_codes else 0) + 1

    background_tasks.add_task(_run_analyser, sample.id, test_codes, run_number)
    db.add(AuditLog(user_id=current_user.id, action="accept_sample", entity_type="sample", entity_id=str(sample.sample_id)))
    db.commit()
    return {"message": "Sample accepted. Analyser processing started (results in ~15s)"}


@router.post("/reject-sample")
def reject_sample(
    data: SampleRejectRequest,
    db: Session = Depends(get_db), current_user: User = Depends(_require)
):
    sample = _sample(db, data.sample_id, current_user)
    if sample.status not in (SampleStatus.collected, SampleStatus.received):
        raise HTTPException(400, "Only collected or received samples can be rejected")
    if not data.rejection_reason.strip():
        raise HTTPException(400, "Rejection reason is required")
    sample.status = SampleStatus.rejected
    sample.rejection_reason = data.rejection_reason

    order = db.query(LabOrder).filter_by(id=sample.order_id).first()
    if order:
        order.status = OrderStatus.assigned  # keep technician for recollection

    db.commit()
    db.add(AuditLog(user_id=current_user.id, action="reject_sample", entity_type="sample", entity_id=str(sample.sample_id), details=data.rejection_reason))
    db.commit()
    return {"message": "Sample rejected. Recollection required."}


@router.post("/request-rerun/{result_id}")
def request_rerun(result_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    result = db.query(LabResult).filter_by(id=result_id).first()
    if not result:
        raise HTTPException(404, "Result not found")
    sample = _sample(db, result.sample_id, current_user)
    if result.status not in (ResultStatus.received, ResultStatus.rerun_requested, ResultStatus.held):
        raise HTTPException(400, "Result cannot be rerun in this state")
    if sample.status != SampleStatus.processed:
        raise HTTPException(400, "Sample is already processing")
    if db.query(LabResult).filter(LabResult.sample_id == sample.id, LabResult.test_id == result.test_id, LabResult.run_number > result.run_number).first():
        raise HTTPException(400, "A newer run already exists")
    result.status = ResultStatus.rerun_requested
    sample.status = SampleStatus.processing
    sample.order.status = OrderStatus.in_progress
    run = max(r.run_number for r in sample.lab_results) + 1
    db.add(AuditLog(user_id=current_user.id, action="rerun", entity_type="lab_result", entity_id=str(result.id)))
    db.commit()
    background_tasks.add_task(_run_analyser, sample.id, [result.test.code], run)
    return {"message": "Rerun started; earlier results preserved"}


@router.get("/results/{sample_id}")
def get_sample_results(sample_id: int, db: Session = Depends(get_db), current_user: User = Depends(_require)):
    _sample(db, sample_id, current_user)
    results = (
        db.query(LabResult)
        .options(joinedload(LabResult.test))
        .filter_by(sample_id=sample_id)
        .order_by(LabResult.run_number, LabResult.id)
        .all()
    )
    return [
        {
            "id": r.id, "test": r.test.name if r.test else None, "run_number": r.run_number,
            "value": r.value, "unit": r.unit, "ref_range": r.ref_range,
            "flag": r.flag, "qc_status": r.qc_status, "status": r.status.value,
            "received_at": r.received_at,
            "reviewer": r.review_assignment.pathologist.full_name if r.review_assignment else None,
            "reviewer_username": r.review_assignment.pathologist.username if r.review_assignment else None,
        }
        for r in results
    ]


@router.get("/samples/{sample_id}/label")
def sample_label(sample_id: int, db: Session = Depends(get_db), user: User = Depends(_require)):
    from fastapi.responses import Response
    from barcode import Code128
    from barcode.writer import SVGWriter
    from io import BytesIO
    sample = _sample(db, sample_id, user)
    output = BytesIO()
    Code128(sample.barcode, writer=SVGWriter()).write(output)
    return Response(output.getvalue(), media_type="image/svg+xml")
