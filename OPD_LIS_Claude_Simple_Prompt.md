# Build Prompt: Simple Integrated OPD + LIS Website

Build a **working full-stack demo** of an integrated hospital **Outpatient Department (OPD)** and **Laboratory Information System (LIS)**. Keep the code straightforward and the interface clean. **Prioritize implementing the complete user workflows over extensive testing, enterprise architecture, or documentation.** I am using a free Claude account, so work in small steps and avoid generating unnecessary files or long explanations.

## Scope

- One hospital, **one login page**, six staff roles: **Receptionist, Nurse, Doctor, Lab Coordinator, Lab Technician, Pathologist/Authorized Reviewer**.
- After login, redirect users to their role dashboard. Enforce role permissions in the backend, not only the UI.
- **Do not build:** admin/staff-management pages, billing, pharmacy, phlebotomist, patient portal, radiology, IPD, inventory, insurance, or semi-auto/manual analysers.
- Doctors can record prescriptions, but there is no pharmacy module.
- Use **fictional patient data** and a **simulated automatic analyser**. This is a demo, **not approved for real clinical use**.
- Use a practical stack such as **React + TypeScript + Tailwind**, **FastAPI**, and **SQLite** for easy local setup. Keep database code simple enough to migrate to PostgreSQL later. If a project already exists, prefer its working stack.

## 1. Main workflow

1. **Receptionist** searches for an existing patient or registers a new one, creates an OPD visit, assigns a doctor and generates an appointment/token.
2. **Nurse** sees waiting patients, records vitals and chief complaint, and marks them ready for the doctor; urgent cases are flagged.
3. **Doctor** opens the patient's page, views relevant history, records consultation/diagnosis, optionally creates a prescription, and orders tests from a lab test catalogue.
4. **Lab Coordinator** receives new lab orders, sees technician workload, assigns orders to technicians, monitors progress, and assigns results needing manual review to available pathologists.
5. **Lab Technician** sees assigned orders, verifies patient identity, collects the sample, generates/prints its barcode label, marks collection and receipt, accepts or rejects the sample, and processes accepted samples using a simulated **automatic analyser**. Handle rejected samples with a new recollection sample and handle reruns without losing earlier results.
6. **Analyser simulator** automatically sends sample-linked results to the LIS. Show analyser flags and QC status; prevent unknown sample IDs or duplicate messages from silently creating results.
7. **Results:** For this demo, **all results require pathologist approval** (simpler and safer than implementing autoverification). Coordinator assigns review cases; each pathologist sees assigned results, reviews relevant history and results, and can **Approve & Release**, **Hold**, or **Request Rerun**. Critical flags should be clearly visible and require urgent notification recording; never silently auto-release them.
8. **Doctor** sees pending lab orders and released reports on their dashboard. Clicking either opens **that patient's page**, focused on the corresponding lab order/report. A held/unapproved report is not displayed as a final report.

## 2. Website pages by role

### Common
- `/login`: username/password, login/logout. Preconfigure demo accounts for each role through a seed script; show credentials in the README only for local demo.

### Receptionist — `/reception`
- **Dashboard:** today's visits and appointments.
- **Patients:** search, register, view basic demographic details; create unique hospital UHID.
- **Appointments:** select department/doctor/time, create visit and token, check in, cancel/reschedule.
- No clinical diagnosis fields in registration.

### Nurse — `/nurse`
- **Dashboard/Queue:** patients awaiting nursing assessment.
- **Vitals:** temperature, BP, pulse, SpO2, height/weight, chief complaint, urgency flag; save and mark ready for doctor.
- Access only relevant records for assigned patients.

### Doctor — `/doctor`
- **Dashboard:** today's patients, pending lab orders, newly released reports. Clicking an order/report opens its patient's page.
- **Patient page** `/doctor/patients/:id` with tabs:
  - **Overview:** demographics, current visit, vitals.
  - **Consultation:** complaints, examination, diagnosis, notes.
  - **Lab Orders:** order tests from catalogue, choose routine/urgent/STAT, view order status. **Order creation and tracking happen inside the patient page, not a separate doctor page.**
  - **Reports:** view/download released lab reports.
  - **Prescription:** medicine, dosage/instructions and advice (record only).
  - **History:** previous OPD visits, diagnoses, prescriptions, lab orders/reports, allergies, conditions and current medicines.
- Doctor access must be limited to patients they are authorized to treat.

### Lab Coordinator — `/lis/coordinator`
- **Dashboard:** new/unassigned orders, in-progress work, pending reviews, counts by technician.
- **Incoming Orders:** assign/reassign technician; show priority, patient, test and status.
- **Workload:** each technician's assigned and active orders.
- **Review Assignments:** assign pending-review results to Pathologist 1, Pathologist 2, etc. Coordinator cannot approve results.

### Lab Technician — `/lis/technician`
- **Dashboard/My Orders:** assigned orders and statuses.
- **Sample Collection:** verify patient using two identifiers, generate sample ID and barcode, print label, record collection.
- **Sample Processing:** scan or enter barcode, receive sample, accept/reject with reason, start simulated analyser processing.
- **Results/Repeat Tests:** view automatically received results and flags, submit for review, request rerun or recollection. Preserve sample/result history.
- Technician cannot authorize final reports.

### Pathologist — `/lis/reviewer`
- **Dashboard/Review Queue:** assigned results and flagged cases.
- **Review:** see order, relevant clinical history, analyser results, reference ranges, QC/flags, earlier results; approve/release, hold with reason, or request rerun.
- **Reports:** previously reviewed reports and statuses.
- Each reviewer sees assigned work; only authorized reviewers release reports.

## 3. Patient history and ABHA

- Each patient has a unique **UHID**; every visit has its own **Visit ID**. Keep previous visits, consultations, prescriptions, allergies, conditions and released reports accessible from the doctor's **History** tab.
- Receptionist sees demographics and appointments, **not clinical notes**. Nurse sees relevant history. Coordinator and technician see only information needed for their work. Pathologist sees relevant history and previous results for assigned reviews.
- Add an **optional ABHA field** and a status such as **Not linked / Unverified / Verified**. For this version it is **only a placeholder**, not real ABHA verification or retrieval. Clearly label it as such.
- **Do not build real ABDM consent flows or claim that entering an ABHA number retrieves records from other hospitals.** External records can be added later through official consent-based ABDM integration.

## 4. Basic data model

Keep straightforward entities/tables: `users`, `patients`, `appointments`, `opd_visits`, `vitals`, `consultations`, `prescriptions`, `medical_history`, `lab_test_catalogue`, `lab_orders`, `lab_order_tests`, `technician_assignments`, `samples`, `analysers`, `lab_results`, `review_assignments`, `lab_reports`, `audit_logs`.

Use distinct IDs for patient, visit, order and sample. One order may contain multiple tests. Store timestamps, status, assigned staff, rejection/hold reasons, and reviewer identity. Avoid silently overwriting released reports or prior analyser results.

## 5. Simple permissions and safety

- Receptionist: register/search patients and manage appointments; no clinical data editing.
- Nurse: record vitals/triage for assigned patients; no diagnoses or prescriptions.
- Doctor: consult, order tests, prescribe, see released results and relevant history for their patients; no lab approval.
- Coordinator: view lab orders, assign technicians/reviewers, monitor work; no result approval.
- Technician: collect/label/process assigned specimens and view instrument results; no final report approval.
- Pathologist: review assigned results and approve/hold/request rerun; cannot change doctor's consultation.
- Use hashed passwords, backend role checks, basic access scoping, and a lightweight audit log for critical actions. Don't expose patient records publicly.

## 6. Statuses

- OPD visit: `Scheduled → Checked In → Waiting → In Consultation → Completed`.
- Lab order: `Ordered → Assigned → In Progress → Completed` (also cancelled/partially completed).
- Sample: `Awaiting Collection → Collected → Received → Accepted → Processing → Processed`, or `Rejected → Recollection Requested`.
- Result/report: `Awaiting Result → Received → Pending Review → Approved/Released`, or `Held / Rerun Requested`.
- Ensure the doctor sees the **latest accurate status**.

## 7. User interface

Make a simple, attractive, desktop-first hospital UI: sidebar navigation, status badges, searchable tables, short forms, clear action buttons and confirmation messages. Avoid elaborate animation, charts, design systems or unnecessary pages. Provide a few fictional demo patients, doctors, technicians, reviewers and test catalogue items (CBC, glucose, lipid profile).

## 8. Build approach — optimized for a free account

**Implement rather than just describing the system.** Work incrementally, reusing code and keeping replies short:

1. Set up app, database, demo accounts, login and role-based dashboards.
2. Build receptionist, nurse and doctor patient/consultation/history workflows.
3. Build lab catalogue, doctor lab orders, coordinator assignments and technician sample workflow.
4. Build simulated auto-analyser, result review, report release and doctor report viewing.
5. Connect everything, add simple error handling and a short README with run commands.

**Testing:** Do **basic smoke checks only**, not extensive automated test suites, CI/CD pipelines, performance benchmarks or strict coverage targets. At minimum manually verify login by role, registration → consultation → order → assignment → sample → simulated result → pathologist approval → doctor report; also verify sample rejection, report hold, and denial of an unauthorized approval action. Fix obvious errors.

Do not spend tokens writing lengthy architecture essays, exhaustive test plans, deployment manifests or enterprise documentation. Avoid premature optimization and excessive abstraction. At each stage, show which files were created, how to run the app, and what is working. If response limits are reached, stop at a clean stage and state the next implementation step.

**Deliverable:** A runnable, functional full-stack prototype with a shared database and end-to-end OPD–LIS workflow, not just static screens. It must be clearly labeled a **demo requiring clinical, security, privacy and analyser-interface validation before any real patient use**.
