"""
Seed script — creates tables and inserts demo data.
Run once: python seed.py
"""
from database import engine, SessionLocal
import models
from auth import get_password_hash
from datetime import datetime, timedelta
import random

models.Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── Users ─────────────────────────────────────────────────────────────────────
demo_users = [
    {"username": "recep1",   "full_name": "Priya Sharma",    "password": "recep123",  "role": models.UserRole.receptionist},
    {"username": "nurse1",   "full_name": "Ananya Gupta",    "password": "nurse123",  "role": models.UserRole.nurse},
    {"username": "doctor1",  "full_name": "Dr. Rajesh Kumar","password": "doc123",    "role": models.UserRole.doctor},
    {"username": "coord1",   "full_name": "Meena Patel",     "password": "coord123",  "role": models.UserRole.coordinator},
    {"username": "tech1",    "full_name": "Vikram Singh",    "password": "tech123",   "role": models.UserRole.technician},
    {"username": "patho1",   "full_name": "Dr. Sunita Rao",  "password": "patho123",  "role": models.UserRole.pathologist},
    # extra doctor & technician for variety
    {"username": "doctor2",  "full_name": "Dr. Kavya Nair",  "password": "doc456",    "role": models.UserRole.doctor},
    {"username": "tech2",    "full_name": "Rohan Verma",     "password": "tech456",   "role": models.UserRole.technician},
    {"username": "patho2",   "full_name": "Dr. Amit Joshi",  "password": "patho456",  "role": models.UserRole.pathologist},
]

user_objects = {}
for u in demo_users:
    if not db.query(models.User).filter_by(username=u["username"]).first():
        user = models.User(
            username=u["username"],
            full_name=u["full_name"],
            hashed_password=get_password_hash(u["password"]),
            role=u["role"],
        )
        db.add(user)
        db.flush()
        user_objects[u["username"]] = user

db.commit()
# Reload
for u in demo_users:
    user_objects[u["username"]] = db.query(models.User).filter_by(username=u["username"]).first()

# ── Lab Test Catalogue ─────────────────────────────────────────────────────────
tests = [
    {"code": "CBC",  "name": "Complete Blood Count",   "category": "Haematology",  "sample_type": "EDTA Blood", "turnaround_minutes": 45},
    {"code": "GLU",  "name": "Blood Glucose (Fasting)","category": "Biochemistry", "sample_type": "Plain Blood","turnaround_minutes": 30},
    {"code": "LIPID","name": "Lipid Profile",           "category": "Biochemistry", "sample_type": "Plain Blood","turnaround_minutes": 60},
    {"code": "LFT",  "name": "Liver Function Test",    "category": "Biochemistry", "sample_type": "Plain Blood","turnaround_minutes": 60},
    {"code": "KFT",  "name": "Kidney Function Test",   "category": "Biochemistry", "sample_type": "Plain Blood","turnaround_minutes": 60},
    {"code": "TSH",  "name": "Thyroid Stimulating Hormone","category": "Endocrinology","sample_type": "Plain Blood","turnaround_minutes": 120},
    {"code": "UA",   "name": "Urine Analysis",         "category": "Microbiology", "sample_type": "Urine",      "turnaround_minutes": 30},
]
test_objects = {}
for t in tests:
    obj = db.query(models.LabTestCatalogue).filter_by(code=t["code"]).first()
    if not obj:
        obj = models.LabTestCatalogue(**t)
        db.add(obj)
        db.flush()
    test_objects[t["code"]] = obj
db.commit()

# ── Patients ──────────────────────────────────────────────────────────────────
patients_data = [
    {"uhid": "UHID-0001", "full_name": "Arjun Mehta",   "dob": "1985-03-12", "gender": "Male",   "phone": "9876543210", "blood_group": "B+"},
    {"uhid": "UHID-0002", "full_name": "Lata Desai",    "dob": "1972-07-25", "gender": "Female", "phone": "9123456789", "blood_group": "O+"},
    {"uhid": "UHID-0003", "full_name": "Rohan Kapoor",  "dob": "1995-11-08", "gender": "Male",   "phone": "9988776655", "blood_group": "A-"},
]
patient_objects = {}
for p in patients_data:
    obj = db.query(models.Patient).filter_by(uhid=p["uhid"]).first()
    if not obj:
        obj = models.Patient(**p)
        db.add(obj)
        db.flush()
    patient_objects[p["uhid"]] = obj
db.commit()

# ── Demo OPD Visits ────────────────────────────────────────────────────────────
visits_data = [
    {"uhid": "UHID-0001", "doctor": "doctor1", "status": models.VisitStatus.waiting,           "vid": "VID-20001", "token": "T-001"},
    {"uhid": "UHID-0002", "doctor": "doctor1", "status": models.VisitStatus.in_consultation,   "vid": "VID-20002", "token": "T-002"},
    {"uhid": "UHID-0003", "doctor": "doctor2", "status": models.VisitStatus.scheduled,         "vid": "VID-20003", "token": "T-003"},
]
visit_objects = {}
for v in visits_data:
    obj = db.query(models.OpdVisit).filter_by(visit_id=v["vid"]).first()
    if not obj:
        obj = models.OpdVisit(
            visit_id=v["vid"],
            patient_id=patient_objects[v["uhid"]].id,
            doctor_id=user_objects[v["doctor"]].id,
            department="General Medicine",
            token_number=v["token"],
            status=v["status"],
            appointment_time=datetime.utcnow() + timedelta(hours=random.randint(0, 3)),
        )
        db.add(obj)
        db.flush()
    visit_objects[v["vid"]] = obj
db.commit()

# Vitals for VID-20001
if not db.query(models.Vitals).filter_by(visit_id=visit_objects["VID-20001"].id).first():
    db.add(models.Vitals(
        visit_id=visit_objects["VID-20001"].id,
        nurse_id=user_objects["nurse1"].id,
        temperature=37.2,
        bp_systolic=130, bp_diastolic=85,
        pulse=88, spo2=97.5,
        height_cm=172, weight_kg=75,
        chief_complaint="Headache and fatigue for 3 days",
        is_urgent=False, ready_for_doctor=True,
    ))
    db.commit()

# Consultation + lab order for VID-20002 (already in consultation)
visit2 = visit_objects["VID-20002"]
if not db.query(models.Consultation).filter_by(visit_id=visit2.id).first():
    consult = models.Consultation(
        visit_id=visit2.id,
        doctor_id=user_objects["doctor1"].id,
        complaints="Chest pain and shortness of breath",
        examination="Normal heart sounds, mild tachycardia",
        diagnosis="Rule out cardiac event – investigations ordered",
        notes="Monitor closely",
    )
    db.add(consult)
    db.flush()

    order = models.LabOrder(
        order_id="ORD-30001",
        visit_id=visit2.id,
        ordered_by=user_objects["doctor1"].id,
        priority=models.Priority.urgent,
        status=models.OrderStatus.ordered,
    )
    db.add(order)
    db.flush()

    for code in ["CBC", "LIPID"]:
        db.add(models.LabOrderTest(order_id=order.id, test_id=test_objects[code].id))
    db.commit()

db.close()
print("Seed complete. Local demo credentials are in README.md.")
