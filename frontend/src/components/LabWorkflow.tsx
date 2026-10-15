import { useState } from 'react'
import api from '../api/client'

const descriptions = ['OPD places order', 'LIS assigns technician', 'Technician labels sample', 'Auto-analyser runs', 'Pathologist review', 'Verified reports released']
export function LabWorkflow({ order, onChanged }: { order: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const w = order.workflow
  if (!w) return null
  const cancelled = w.stage === 'Cancelled'
  const cancel = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return
    setBusy(true); setError('')
    try { await api.post(`/api/doctor/lab-orders/${order.id}/cancel`, { reason }); setEditing(false); onChanged() }
    catch (e: any) { setError(e.response?.data?.detail || 'Could not cancel this order'); onChanged() }
    finally { setBusy(false) }
  }
  return <div className="mt-4">
    <p className="text-sm font-medium mb-3">LIS progress: {w.stage}</p>
    <ol className="grid grid-cols-2 xl:grid-cols-3 gap-2" aria-label="LIS workflow">
      {w.stages.map((stage: string, index: number) => <li key={stage} aria-current={!cancelled && index === w.stage_index ? 'step' : undefined}
        className={`p-3 rounded border text-xs ${cancelled ? 'bg-slate-50 border-slate-200 text-slate-500' : index === w.stage_index ? 'bg-green-100 border-green-700 text-green-900' : index < w.stage_index ? 'bg-green-50 border-green-200 text-green-800' : 'bg-white border-slate-200 text-slate-500'}`}>
        <strong className="block mb-1">{index + 1}. {stage}</strong>{descriptions[index]}
      </li>)}
    </ol>
    {w.technician && <p className="text-xs text-slate-600 mt-3">Technician: {w.technician}</p>}
    {w.sample_id && <p className="text-xs text-slate-600 mt-1">Sample: {w.sample_id} · {w.sample_status}</p>}
    {w.exceptions.map((note: string) => <p key={note} className="alert-warn text-sm mt-3">{note}</p>)}
    {w.stage_index >= 3 && !cancelled && <ul className="text-xs mt-3 space-y-1">{w.tests.map((t: any) => <li key={t.name}>{t.name}: {t.status}</li>)}</ul>}
    {cancelled && <div className="alert-danger mt-3"><strong>Cancelled</strong><p>{w.cancellation_reason || 'Order cancelled'}</p>{w.cancelled_at && <small>{new Date(w.cancelled_at + 'Z').toLocaleString()}</small>}</div>}
    {error && <p role="alert" className="alert-danger mt-3">{error}</p>}
    {w.can_cancel && !editing && <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => setEditing(true)}>Cancel order</button>}
    {w.can_cancel && editing && <form onSubmit={cancel} className="mt-3 flex flex-col gap-3">
      <label className="text-sm">Cancellation reason<textarea className="input mt-1" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="For example, test no longer needed or sample not recollected" /></label>
      <div className="flex gap-2"><button disabled={busy || !reason.trim()} className="btn-danger btn-sm">{busy ? 'Cancelling…' : 'Confirm cancellation'}</button><button type="button" disabled={busy} className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Keep order</button></div>
    </form>}
  </div>
}
