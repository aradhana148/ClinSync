"""Doctor-facing LIS progress, derived from persisted lab activity."""
from models import Sample, LabResult, LabReport, AuditLog, OrderStatus, SampleStatus, ResultStatus

STAGES = ['Ordered', 'Received', 'Sample collected', 'Processing', 'Awaiting verification', 'Completed']

def workflow(db, order, user_id):
    samples = db.query(Sample).filter_by(order_id=order.id).order_by(Sample.id).all()
    sample = samples[-1] if samples else None
    results = db.query(LabResult).join(Sample).filter(Sample.order_id == order.id).order_by(LabResult.id).all()
    latest = {r.test_id: r for r in results}
    released = db.query(LabReport).filter_by(order_id=order.id).count()
    cancelled = order.status == OrderStatus.cancelled
    stage = 0
    assignment = order.technician_assignment
    if assignment: stage = 1
    if sample: stage = 2
    if sample and sample.status in (SampleStatus.processing, SampleStatus.processed): stage = 3
    if latest and sample and sample.status != SampleStatus.processing: stage = 4
    if order.status == OrderStatus.completed: stage = 5
    exceptions = []
    if sample and sample.status in (SampleStatus.rejected, SampleStatus.recollection_requested):
        exceptions.append('Recollection required: ' + (sample.rejection_reason or 'A replacement sample is needed.'))
    if any(r.status == ResultStatus.held for r in latest.values()):
        exceptions.append('Verification held: ' + '; '.join(r.review_assignment.hold_reason or 'Review required' for r in latest.values() if r.status == ResultStatus.held and r.review_assignment))
    if any(r.status == ResultStatus.rerun_requested for r in latest.values()):
        exceptions.append('Repeat analysis requested; earlier runs are preserved.')
    if released and stage != 5: exceptions.append('Some reports are released; remaining tests are still in progress.')
    cancellation = db.query(AuditLog).filter_by(action='cancel_lab_order', entity_type='lab_order', entity_id=str(order.id)).order_by(AuditLog.id.desc()).first()
    can_cancel = order.ordered_by == user_id and not cancelled and not released and not results and order.status in (OrderStatus.ordered, OrderStatus.assigned)
    if any(s.status == SampleStatus.processing for s in samples): can_cancel = False
    return {
        'stage': 'Cancelled' if cancelled else STAGES[stage], 'stage_index': stage,
        'stages': STAGES, 'exceptions': exceptions,
        'technician': assignment.technician.full_name if assignment else None,
        'sample_id': sample.sample_id if sample else None,
        'sample_status': sample.status.value if sample else None,
        'ordered_at': order.created_at,
        'received_at': assignment.assigned_at if assignment else None,
        'collected_at': sample.collected_at if sample else None,
        'processed_at': sample.processed_at if sample else None,
        'can_cancel': can_cancel,
        'cancellation_reason': cancellation.details if cancellation else None,
        'cancelled_at': cancellation.timestamp if cancellation else None,
        'tests': [{'name': ot.test.name, 'status': latest[ot.test_id].status.value if ot.test_id in latest else 'Awaiting result'} for ot in order.order_tests],
    }
