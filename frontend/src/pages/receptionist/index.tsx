import { useState, useEffect, useRef, useId } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { Sidebar } from '../../components/Sidebar'
import { StatusBadge } from '../../components/StatusBadge'
import { todayVisits, searchPatients, registerPatient, listDoctors, createVisit, checkinVisit, cancelAppointment, rescheduleAppointment } from '../../api'
import { Search, Plus, UserPlus, CheckCircle } from 'lucide-react'

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [when, setWhen] = useState('')
  const [error, setError] = useState('')
  const [today] = useState(() => new Date().toLocaleDateString('en-IN'))
  const refresh = () => todayVisits().then(r => setVisits(r.data))
  const cancel = async (id: number) => { try { await cancelAppointment(id); refresh() } catch (e: any) { setError(e.response?.data?.detail || 'Cancellation failed') } }
  const reschedule = async (e: React.FormEvent) => { e.preventDefault(); try { await rescheduleAppointment(editing.id, { patient_id: editing.patient_id, doctor_id: editing.doctor_id, department: editing.department, appointment_time: when }); setEditing(null); refresh() } catch (e: any) { setError(e.response?.data?.detail || 'Reschedule failed') } }


  useEffect(() => {
    todayVisits().then((r) => setVisits(r.data)).finally(() => setLoading(false))
  }, [])

  const handleCheckin = async (id: number) => {
    await checkinVisit(id)
    todayVisits().then((r) => setVisits(r.data))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Receptionist Dashboard</h1>
        <span className="text-slate-600 text-sm">{today}</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Visits', value: visits.length, color: 'text-green-800' },
          { label: 'Waiting', value: visits.filter(v => v.status === 'Waiting').length, color: 'text-amber-800' },
          { label: 'In Consultation', value: visits.filter(v => v.status === 'In Consultation').length, color: 'text-green-800' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div>
              <div className="text-slate-600 text-xs">{s.label}</div>
              <div className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="section-title mb-4">Active visits and appointments</h2>
        {error && <div className="alert-danger mb-3">{error}</div>}
        {editing && <form onSubmit={reschedule} className="card-sm mb-4 flex gap-3"><label>Reschedule {editing.patient.full_name}<input type="datetime-local" className="input" required value={when} onChange={e => setWhen(e.target.value)} /></label><button className="btn-primary">Save</button><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Close</button></form>}
        {loading ? <div className="text-slate-600 text-sm">Loading...</div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Patient</th><th>UHID</th><th>Doctor</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium text-slate-900">{v.patient?.full_name}</td>
                    <td className="text-slate-600">{v.patient?.uhid}</td>
                    <td>{v.doctor?.full_name ?? '—'}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>
                      {v.status === 'Scheduled' && (
                        <div className="flex gap-2 flex-wrap"><button className="btn btn-success btn-sm" onClick={() => handleCheckin(v.id)}>
                          <CheckCircle size={13} /> Check In
                        </button><button className="btn-secondary btn-sm" onClick={() => { setEditing(v); setWhen(v.appointment_time?.slice(0,16) || "") }}>Reschedule</button><button className="btn-danger btn-sm" onClick={() => cancel(v.id)}>Cancel</button></div>
                      )}
                    </td>
                  </tr>
                ))}
                {visits.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-slate-500 py-8">No visits today</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Patient Search ─────────────────────────────────────────────────────────────
function PatientList() {
  const [q, setQ] = useState('')
  const [bookingPatient, setBookingPatient] = useState<any>(null)
  const [confirmation, setConfirmation] = useState('')
  const [patients, setPatients] = useState<any[]>([])
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const search = async () => {
    setLoading(true)
    setError('')
    try { const response = await searchPatients(q); setPatients(response.data) }
    catch { setError('Unable to load patients. Check the connection and click Search to retry.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    searchPatients().then(r => { if (active) setPatients(r.data) })
      .catch(() => { if (active) setError('Unable to load patients. Check the connection and click Search to retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div>
      <h1 className="page-title mb-6">Patients</h1>
      {confirmation && <div role="status" className="alert-success mb-4">{confirmation}</div>}
      {bookingPatient && <BookingDialog patient={bookingPatient} onClose={() => setBookingPatient(null)} onBooked={(visit) => {
        setConfirmation(`Appointment booked for ${bookingPatient.full_name}. Visit ID: ${visit.visit_id}.`)
        setBookingPatient(null)
      }} />}
      <div className="card mb-6">
        <div className="flex gap-3">
          <input className="input" placeholder="Search by name, UHID, or phone…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <button className="btn-primary" onClick={search}><Search size={15} /> Search</button>
          <button className="btn-secondary" onClick={() => navigate('/receptionist/register')}><UserPlus size={15} /> Register New</button>
        </div>
      </div>
      {error && <div role="alert" className="alert-danger mb-4">{error}</div>}
      <div className="table-wrapper">
        <table className="table">
          <thead><tr><th>UHID</th><th>Name</th><th>Gender</th><th>Phone</th><th>Blood Group</th><th>Action</th></tr></thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-green-800">{p.uhid}</td>
                <td className="font-medium text-slate-900">{p.full_name}</td>
                <td>{p.gender ?? '—'}</td>
                <td>{p.phone ?? '—'}</td>
                <td>{p.blood_group ?? '—'}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setConfirmation(''); setBookingPatient(p) }}>
                    Book Visit
                  </button>
                </td>
              </tr>
            ))}
            {loading && <tr><td colSpan={6} className="text-center text-slate-500 py-8">Loading patients…</td></tr>}
            {!loading && !error && patients.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-8">No patients found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Register Patient ───────────────────────────────────────────────────────────
function RegisterPatient() {
  const [form, setForm] = useState({ full_name: '', dob: '', gender: '', phone: '', address: '', blood_group: '', allergies: '', abha_number: '' })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccess('')
    try {
      const { data } = await registerPatient({ ...form, abha_number: form.abha_number.trim() || null })
      setSuccess(`Patient registered! UHID: ${data.uhid}`)
      setForm({ full_name: '', dob: '', gender: '', phone: '', address: '', blood_group: '', allergies: '', abha_number: '' })
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Registration failed')
    }
  }

  return (
    <div>
      <h1 className="page-title mb-6">Register New Patient</h1>
      <div className="card max-w-2xl">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div className="form-group col-span-2"><label className="label">Full Name *</label><input className="input" required value={form.full_name} onChange={set('full_name')} /></div>
          <div className="form-group"><label className="label">Date of Birth</label><input type="date" className="input" value={form.dob} onChange={set('dob')} /></div>
          <div className="form-group"><label className="label">Gender</label>
            <select className="select" value={form.gender} onChange={set('gender')}>
              <option value="">— Select —</option>
              <option>Male</option><option>Female</option><option>Other</option>
            </select>
          </div>
          <div className="form-group"><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
          <div className="form-group"><label className="label">Blood Group</label>
            <select className="select" value={form.blood_group} onChange={set('blood_group')}>
              <option value="">— Select —</option>
              {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-group col-span-2"><label className="label" htmlFor="registration-abha">ABHA ID (optional)</label><input id="registration-abha" className="input" maxLength={30} value={form.abha_number} onChange={set('abha_number')} placeholder="Enter ABHA ID" /></div>
          <div className="form-group col-span-2"><label className="label">Address</label><textarea className="input" rows={2} value={form.address} onChange={set('address')} /></div>
          <div className="form-group col-span-2"><label className="label">Known Allergies</label><input className="input" value={form.allergies} onChange={set('allergies')} /></div>
          {success && <div className="alert-success col-span-2">{success}</div>}
          {error && <div className="alert-danger col-span-2">{error}</div>}
          <button type="submit" className="btn-primary col-span-2 justify-center"><Plus size={15} /> Register Patient</button>
        </form>
      </div>
    </div>
  )
}

type BookingPatient = { id: number; full_name: string; uhid: string }
type BookedVisit = { visit_id: string }

function AppointmentForm({ patient, onBooked, onCancel }: {
  patient: BookingPatient; onBooked?: (visit: BookedVisit) => void; onCancel?: () => void
}) {
  const fieldId = useId()
  const [doctors, setDoctors] = useState<{ id: number; full_name: string }[]>([])
  const [form, setForm] = useState({ doctor_id: '', department: 'General Medicine', appointment_time: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState<BookedVisit | null>(null)
  const submitting = useRef(false)

  useEffect(() => {
    let active = true
    listDoctors().then(r => { if (active) setDoctors(r.data) })
      .catch(() => { if (active) setError('Could not load doctors. Reopen this form to retry.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const book = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting.current || booked) return
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      const { data } = await createVisit({ patient_id: patient.id, doctor_id: Number(form.doctor_id),
        department: form.department, appointment_time: form.appointment_time || undefined })
      setBooked(data)
      onBooked?.(data)
    } catch (err: any) { setError(err.response?.data?.detail || 'Could not book this appointment. Please retry.') }
    finally { submitting.current = false; setSaving(false) }
  }

  return <form onSubmit={book} className="flex flex-col gap-4">
    <div className="alert-info">Patient: <strong>{patient.full_name}</strong> ({patient.uhid})</div>
    {booked ? <div role="status" className="alert-success">Appointment booked. Visit ID: {booked.visit_id}</div> : <>
      <fieldset disabled={saving || loading} className="flex flex-col gap-4">
        <div className="form-group"><label className="label" htmlFor={`${fieldId}-doctor`}>Doctor *</label>
          <select id={`${fieldId}-doctor`} className="select" required value={form.doctor_id} onChange={e => setForm(f => ({ ...f, doctor_id: e.target.value }))}>
            <option value="">{loading ? 'Loading doctors…' : 'Select doctor'}</option>
            {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="label" htmlFor={`${fieldId}-department`}>Department</label>
          <input id={`${fieldId}-department`} className="input" required value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
        </div>
        <div className="form-group"><label className="label" htmlFor={`${fieldId}-time`}>Appointment time</label>
          <input id={`${fieldId}-time`} type="datetime-local" className="input" value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))} />
          <span className="text-slate-500 text-xs">Leave blank to book for now.</span>
        </div>
      </fieldset>
      {error && <div role="alert" className="alert-danger">{error}</div>}
      <div className="flex gap-3 justify-end">
        {onCancel && <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn-primary" disabled={saving || loading || !doctors.length}>{saving ? 'Booking…' : 'Confirm appointment'}</button>
      </div>
    </>}
  </form>
}

function BookingDialog({ patient, onClose, onBooked }: {
  patient: BookingPatient; onClose: () => void; onBooked: (visit: BookedVisit) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={e => e.preventDefault()}
    className="card m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[90vh] overflow-y-auto backdrop:bg-black/40">
    <h2 id={titleId} className="section-title mb-5">Book appointment</h2>
    <AppointmentForm patient={patient} onCancel={onClose} onBooked={onBooked} />
  </dialog>
}

// ── Appointments ───────────────────────────────────────────────────────────────
function Appointments() {
  const [q, setQ] = useState('')
  const [patients, setPatients] = useState<any[]>([])
  const [sel, setSel] = useState<any>(null)
  const [searchError, setSearchError] = useState('')
  const searchP = () => searchPatients(q).then(r => { setPatients(r.data); setSearchError('') })
    .catch(() => setSearchError('Could not load patients. Please retry.'))

  return (
    <div>
      <h1 className="page-title mb-6">Book Appointment</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h2 className="section-title mb-4">Step 1: Find Patient</h2>
          {searchError && <div role="alert" className="alert-danger mb-4">{searchError}</div>}
          <div className="flex gap-2 mb-4">
            <input className="input" placeholder="Search patient…" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchP()} />
            <button className="btn-primary" onClick={searchP}><Search size={15} /></button>
          </div>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {patients.map(p => (
              <button key={p.id} onClick={() => setSel(p)} className={`text-left p-3 rounded-md border transition-all ${sel?.id === p.id ? 'border-green-700 bg-green-100/10' : 'border-slate-200 hover:border-green-300'}`}>
                <div className="text-slate-900 font-medium">{p.full_name}</div>
                <div className="text-slate-600 text-xs">{p.uhid} · {p.phone}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="section-title mb-4">Step 2: Book Visit</h2>
          {sel ? <AppointmentForm key={sel.id} patient={sel} /> : <div className="text-slate-600 text-sm">Select a patient first</div>}
        </div>
      </div>
    </div>
  )
}

export default function ReceptionistApp() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<PatientList />} />
          <Route path="register" element={<RegisterPatient />} />
          <Route path="appointments" element={<Appointments />} />
        </Routes>
      </main>
    </div>
  )
}
