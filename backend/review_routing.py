"""Route received analyser results to available reviewers, preserving assignments."""
from datetime import datetime
from models import User, UserRole, LabResult, ReviewAssignment, ResultStatus, AuditLog


def assign_received_results(db):
    reviewers = db.query(User).filter_by(role=UserRole.pathologist, is_active=True).order_by(User.id).all()
    if not reviewers:
        return
    results = db.query(LabResult).filter(
        LabResult.status == ResultStatus.received,
        ~LabResult.review_assignment.has(),
    ).order_by(LabResult.id).all()
    for result in results:
        reviewer = min(reviewers, key=lambda user: db.query(ReviewAssignment).filter(
            ReviewAssignment.pathologist_id == user.id,
            ReviewAssignment.result.has(LabResult.status.in_([ResultStatus.pending_review, ResultStatus.held])),
        ).count())
        db.add(ReviewAssignment(result_id=result.id, pathologist_id=reviewer.id,
                               assigned_by=result.sample.collected_by or reviewer.id,
                               assigned_at=datetime.utcnow()))
        result.status = ResultStatus.pending_review
        db.add(AuditLog(action='auto_assign_reviewer', entity_type='lab_result', entity_id=str(result.id),
                        details=f'Automatic routing to reviewer {reviewer.id}'))
        db.flush()
