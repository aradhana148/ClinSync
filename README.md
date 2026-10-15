# City Hospital — OPD + LIS demo

A local full-stack prototype for six staff roles, using React/TypeScript, FastAPI and SQLite. All patients and analyser results are fictional. Requires clinical, security, privacy and analyser-interface validation before real patient use. ABHA is an unverified placeholder; no external records are retrieved.

## Run locally

Requires Python 3.10+ and Node 22.12+.

From this directory, first-time backend setup:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
backend/.venv/bin/python backend/seed.py
backend/.venv/bin/uvicorn main:app --app-dir backend --host 127.0.0.1 --port 8000
```

In a second terminal:

```sh
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173. Vite proxies `/api` to the backend. SQLite data persists in `backend/hospital.db`; seeding is repeatable and preserves existing records. `DATABASE_URL` can select another SQLite database. `JWT_SECRET` optionally provides a stable signing secret; without it, restarting the backend invalidates existing sessions. `VITE_API_URL` overrides the API origin if needed.

## Local demo accounts

| Role | Username | Password |
| --- | --- | --- |
| Receptionist | recep1 | recep123 |
| Nurse | nurse1 | nurse123 |
| Doctor | doctor1 | doc123 |
| Doctor 2 | doctor2 | doc456 |
| Coordinator | coord1 | coord123 |
| Technician | tech1 | tech123 |
| Technician 2 | tech2 | tech456 |
| Pathologist | patho1 | patho123 |
| Pathologist 2 | patho2 | patho456 |

## Walk through the workflow

1. Reception: register or search a patient, book a visit, then check in. Scheduled appointments can be rescheduled or cancelled.
2. Nurse: record vitals, chief complaint and urgency; save to mark ready for the doctor. The demo uses one shared nursing queue.
3. Doctor: open the patient's chart, save consultation and prescription, and create an order in Lab Orders.
4. Coordinator: assign the order to a technician.
5. Technician: verify the displayed patient and enter DOB (`yyyy-mm-dd`) or phone as the second identifier. Collect, open/print the barcode, receive, then accept and process. Results arrive after approximately 15 seconds; the orders list refreshes automatically. Reject a received sample with a reason to enable recollection.
6. Received results are automatically assigned to an available pathologist. The coordinator can review or change assignments under Review Assignments. The technician results panel shows the assigned reviewer and username.
7. Pathologist: review context, reference ranges and earlier results. Hold or request rerun with a reason, or approve and release. Critical results require notification confirmation. Close the review dialog to refresh the queue. For reruns, the technician starts another run from the results panel; prior results remain available.
8. Doctor: dashboard order/report links open the patient's corresponding tab. Only approved results appear as downloadable text reports, including after the visit is completed.

Seeded patient Arjun Mehta has DOB `1985-03-12` and phone `9876543210`. Lata Desai has DOB `1972-07-25` and phone `9123456789`.

## Basic checks

```sh
backend/.venv/bin/python backend/smoke.py
cd frontend
npm run build
npm run lint
```

The smoke check uses a temporary database and verifies all role logins, the registration-to-release workflow, rejection/recollection, hold/rerun, critical notifications, report immutability, and access denials. It does not alter the demo database.

This is a local prototype: no production deployment, real analyser connection, real ABHA integration, billing or pharmacy. The simulated analyser is an in-process background task; keep the backend running while samples process. Barcode SVGs can be printed using the browser's Print command.

Each browser tab keeps its own login session, so staff roles can be tested side by side. Doctor queues, open patient vitals, and reviewer queues refresh every five seconds. On restart, received results without a reviewer are routed automatically; held and released results are preserved.
