import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/Sidebar'
import { StatusBadge } from '../../components/StatusBadge'
import { nurseQueue, recordVitals } from '../../api'
import { Activity, AlertTriangle } from 'lucide-react'

function VitalsModal({ visit, onClose, onSaved }: { visit: any, onClose: () => void, onSaved: () => void }) {
  const [form, setForm] = useState({
    temperature: '', bp_systolic: '', bp_diastolic: '', pulse: '',
    spo2: '', height_cm: '', weight_kg: '', chief_complaint: ''
  })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    try {
      const payload: any = {
        chief_complaint: form.chief_complaint,
      }
      if (form.temperature) payload.temperature = parseFloat(form.temperature)
      if (form.bp_systolic) payload.bp_systolic = parseInt(form.bp_systolic)
      if (form.bp_diastolic) payload.bp_diastolic = parseInt(form.bp_diastolic)
      if (form.pulse) payload.pulse = parseInt(form.pulse)
      if (form.spo2) payload.spo2 = parseFloat(form.spo2)
      if (form.height_cm) payload.height_cm = parseFloat(form.height_cm)
      if (form.weight_kg) payload.weight_kg = parseFloat(form.weight_kg)

      await recordVitals(visit.id, payload)
      setMsg('Vitals saved — patient marked ready for doctor')
      onSaved()
    } catch (err: any) {
      setErr(err.response?.data?.detail ?? 'Failed to save')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Record Vitals</h2>
          <button className="btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="alert-info mb-4 text-sm">
          {visit.patient?.full_name} · {visit.patient?.uhid}
        </div>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <div className="form-group"><label className="label">Temperature (°C)</label><input className="input" type="number" step="0.1" value={form.temperature} onChange={set('temperature')} /></div>
          <div className="form-group"><label className="label">Pulse (bpm)</label><input className="input" type="number" value={form.pulse} onChange={set('pulse')} /></div>
          <div className="form-group"><label className="label">BP Systolic</label><input className="input" type="number" value={form.bp_systolic} onChange={set('bp_systolic')} /></div>
          <div className="form-group"><label className="label">BP Diastolic</label><input className="input" type="number" value={form.bp_diastolic} onChange={set('bp_diastolic')} /></div>
          <div className="form-group"><label className="label">SpO2 (%)</label><input className="input" type="number" step="0.1" value={form.spo2} onChange={set('spo2')} /></div>
          <div className="form-group"><label className="label">Height (cm)</label><input className="input" type="number" value={form.height_cm} onChange={set('height_cm')} /></div>
          <div className="form-group col-span-2"><label className="label">Weight (kg)</label><input className="input" type="number" step="0.1" value={form.weight_kg} onChange={set('weight_kg')} /></div>
          <div className="form-group col-span-2"><label className="label">Chief Complaint</label><textarea className="input" rows={2} value={form.chief_complaint} onChange={set('chief_complaint')} /></div>
          {msg && <div className="alert-success col-span-2">{msg}</div>}
          {err && <div className="alert-danger col-span-2">{err}</div>}
          <button type="submit" className="btn-primary col-span-2 justify-center">Save & Mark Ready</button>
        </form>
      </div>
    </div>
  )
}

export default function NurseApp() {
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<any>(null)
  const [handoff, setHandoff] = useState('')

  const reload = () => nurseQueue().then(r => setQueue(r.data)).finally(() => setLoading(false))
  useEffect(() => { reload() }, [])

  return (
    <div className="flex">
      <Sidebar />
      <main className="main-content">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-title">Nursing Queue</h1>
          <button className="btn-secondary" onClick={reload}><Activity size={15} /> Refresh</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="stat-card"><div><div className="text-slate-600 text-xs">Awaiting Vitals</div><div className="text-3xl font-bold mt-1 text-amber-800">{queue.filter(v => v.status === 'Checked In').length}</div></div></div>
          <div className="stat-card"><div><div className="text-slate-600 text-xs">Urgent Cases</div><div className="text-3xl font-bold mt-1 text-red-700">{queue.filter(v => v.vitals?.is_urgent).length}</div></div></div>
        </div>

        {handoff && <div className="alert-success mb-4">{handoff}</div>}
        {loading ? <div className="text-slate-600">Loading...</div> : (
          <div className="card">
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Patient</th><th>UHID</th><th>Assigned doctor</th><th>Status</th><th>Urgency</th><th>Action</th></tr></thead>
                <tbody>
                  {queue.map((v) => (
                    <tr key={v.id}>
                      <td className="font-medium text-slate-900">{v.patient?.full_name}</td>
                      <td className="text-slate-600">{v.patient?.uhid}</td>
                      <td>{v.doctor?.full_name}</td><td><StatusBadge status={v.status} /></td>
                      <td>{v.vitals?.is_urgent ? <span className="badge-red flex items-center gap-1"><AlertTriangle size={11} /> Urgent</span> : <span className="text-slate-500 text-xs">Normal</span>}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal(v)}>
                          Record Vitals
                        </button>
                      </td>
                    </tr>
                  ))}
                  {queue.length === 0 && <tr><td colSpan={6} className="text-center text-slate-500 py-8">Queue is empty</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {modal && <VitalsModal visit={modal} onClose={() => setModal(null)} onSaved={() => { setHandoff(`Vitals saved. Patient is ready for ${modal.doctor?.full_name} (${modal.doctor?.username}).`); setModal(null); reload() }} />}
      </main>
    </div>
  )
}
