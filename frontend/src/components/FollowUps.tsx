import { useCallback, useEffect, useState } from 'react'
import api from '../api/client'

type Request = { id: number; patient: string; uhid: string; doctor: string; requested_date: string; reason: string; status: string; appointment_time: string | null }

export function FollowUps({ patientId }: { patientId?: number }) {
  const reception = patientId === undefined
  const endpoint = reception ? '/api/receptionist/follow-ups' : `/api/doctor/patients/${patientId}/follow-ups`
  const [items, setItems] = useState<Request[]>([])
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [times, setTimes] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    try { const r = await api.get(endpoint); setItems(r.data) }
    catch { setError('Could not load follow-up requests. Please refresh to retry.') }
    finally { setLoading(false) }
  }, [endpoint])
  useEffect(() => { const initial = setTimeout(reload, 0); const timer = setInterval(reload, 5000); return () => { clearTimeout(initial); clearInterval(timer) } }, [reload])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api.post(endpoint, { requested_date: date, reason })
      setMessage('Follow-up request sent to reception.'); setReason(''); setDate(''); await reload()
    } catch (e: any) { setError(e.response?.data?.detail || 'Could not send request') }
    finally { setBusy(false) }
  }
  const book = async (e: React.FormEvent, id: number) => {
    e.preventDefault(); if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      await api.post(`${endpoint}/${id}/book`, { appointment_time: times[id] })
      setMessage('Follow-up appointment booked. It is now on the reception dashboard.'); await reload()
    } catch (e: any) { setError(e.response?.data?.detail || 'Could not book appointment') }
    finally { setBusy(false) }
  }
  return <div>
    <h2 className="section-title mb-4">Follow-ups</h2>
    {error && <div role="alert" className="alert-danger mb-4">{error}</div>}
    {message && <div role="status" className="alert-success mb-4">{message}</div>}
    {!reception && <form onSubmit={submit} className="card mb-6 flex flex-col gap-4">
      <p className="text-sm text-slate-600">Request a return appointment. Reception will arrange the booking with you.</p>
      <label className="form-group">Requested date<input className="input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></label>
      <label className="form-group">Reason for follow-up<textarea className="input" required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button className="btn-primary self-start" disabled={busy || items.some(r => r.status === 'pending')}>{busy ? 'Sending…' : items.some(r => r.status === 'pending') ? 'Requested — awaiting reception' : 'Send to reception'}</button>
    </form>}
    {loading ? <p>Loading follow-ups…</p> : !items.length && <p className="text-slate-600">No follow-up requests.</p>}
    <div className="flex flex-col gap-4">{items.map(r => <div className="card" key={r.id}>
      <div className="flex justify-between gap-4"><strong>{reception ? `${r.patient} · ${r.uhid}` : r.doctor}</strong><span className="text-green-800">{r.status === 'booked' ? 'Booked' : 'Awaiting reception'}</span></div>
      <p className="text-sm text-slate-600 mt-2">Requested: {r.requested_date}{reception && ` · ${r.doctor}`}</p>
      <p className="my-3 whitespace-pre-wrap">{r.reason}</p>
      {r.appointment_time && <p className="text-sm">Appointment: {new Date(r.appointment_time).toLocaleString()}</p>}
      {reception && r.status === 'pending' && <form onSubmit={e => book(e, r.id)} className="flex gap-3 items-end">
        <label className="form-group">Appointment date and time<input className="input" required type="datetime-local" value={times[r.id] || ''} onChange={e => setTimes(t => ({ ...t, [r.id]: e.target.value }))} /></label>
        <button className="btn-primary" disabled={busy}>{busy ? 'Booking…' : 'Book appointment'}</button>
      </form>}
    </div>)}</div>
  </div>
}
