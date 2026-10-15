import { useState, useEffect, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Sidebar } from '../../components/Sidebar'
import { FlagBadge } from '../../components/StatusBadge'
import { reviewQueue, resultContext, submitReview, myReports } from '../../api'
import { CheckCircle, Pause, RefreshCw, AlertTriangle } from 'lucide-react'

function ReviewDetail({ assignment, onClose }: any) {
  const [ctx, setCtx] = useState<any>(null)
  const [decision, setDecision] = useState('')
  const [holdReason, setHoldReason] = useState('')
  const [notifRecorded, setNotifRecorded] = useState(false)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  useEffect(() => {
    resultContext(assignment.result_id).then(r => setCtx(r.data)).catch(() => {})
  }, [assignment.result_id])

  const submit = async () => {
    setErr(''); setMsg('')
    if (!decision) return setErr('Select a decision')
    if ((decision === 'held' || decision === 'rerun') && !holdReason) return setErr('Provide hold reason')
    try {
      await submitReview(assignment.assignment_id, { decision, hold_reason: holdReason, notification_recorded: notifRecorded })
      setMsg(`Result ${decision} successfully!`)
    } catch (err: any) { setErr(err.response?.data?.detail ?? 'Failed') }
  }

  const isCritical = assignment.is_critical
  const result = ctx?.result

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="section-title">Review: {result?.test}</h2>
          <button className="btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>

        {isCritical && (
          <div className="alert-danger mb-4 flex items-center gap-2">
            <AlertTriangle size={16} /> CRITICAL RESULT — urgent notification required before approval
          </div>
        )}

        {ctx ? (
          <div className="flex flex-col gap-4">
            {/* Patient */}
            <div className="card-sm">
              <div className="text-slate-600 text-xs mb-2">Patient</div>
              <div className="text-slate-900 font-medium">{ctx.patient?.name}</div>
              <div className="text-slate-600 text-sm">{ctx.patient?.uhid} · {ctx.patient?.gender} · DOB {ctx.patient?.dob}</div>
              {ctx.diagnosis && <div className="mt-2 text-sm"><span className="text-slate-600">Diagnosis: </span>{ctx.diagnosis}</div>}
              {ctx.complaints && <div className="text-sm"><span className="text-slate-600">Complaints: </span>{ctx.complaints}</div>}
            </div>

            {/* Result */}
            <div className="card-sm">
              <div className="text-slate-600 text-xs mb-2">Analyser Result — Run #{result?.run_number}</div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-slate-900 font-medium">{result?.test}</span>
                <FlagBadge flag={result?.flag} />
                <span className={`text-sm ${result?.qc_status === 'Critical' ? 'text-red-700' : result?.qc_status === 'Pass' ? 'text-green-800' : 'text-amber-800'}`}>QC: {result?.qc_status}</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-slate-700 text-sm break-all">{result?.value}</div>
              <div className="text-slate-600 text-xs mt-2">Reference: {result?.ref_range}<br />Analyser: {result?.analyser_flags}</div>
            </div>

            {/* Prior results */}
            {ctx.prior_results?.length > 0 && (
              <div className="card-sm">
                <div className="text-slate-600 text-xs mb-2">Previous Results (same test)</div>
                <div className="flex flex-col gap-1">
                  {ctx.prior_results.map((r: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-slate-600 text-xs">{r.received_at ? new Date(r.received_at).toLocaleDateString() : '—'}</span>
                      <span className="text-slate-700">{r.value}</span>
                      <FlagBadge flag={r.flag} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Decision */}
            {!msg.includes('successfully') && (
              <div className="card-sm">
                <div className="text-slate-600 text-xs mb-3">Decision</div>
                <div className="flex gap-2 mb-3">
                  {[
                    { val: 'approved', label: 'Approve & Release', cls: 'btn-success' },
                    { val: 'held',     label: 'Hold',             cls: 'btn-danger'  },
                    { val: 'rerun',    label: 'Request Rerun',    cls: 'btn-secondary' },
                  ].map(d => (
                    <button
                      key={d.val}
                      className={`btn ${d.cls} btn-sm ${decision === d.val ? 'ring-2 ring-green-700/30' : ''}`}
                      onClick={() => setDecision(d.val)}
                    >
                      {d.val === 'approved' && <CheckCircle size={13} />}
                      {d.val === 'held' && <Pause size={13} />}
                      {d.val === 'rerun' && <RefreshCw size={13} />}
                      {d.label}
                    </button>
                  ))}
                </div>

                {(decision === 'held' || decision === 'rerun') && (
                  <div className="form-group mb-3">
                    <label className="label">Reason *</label>
                    <textarea className="input" rows={2} value={holdReason} onChange={e => setHoldReason(e.target.value)} />
                  </div>
                )}

                {isCritical && decision === 'approved' && (
                  <label className="flex items-center gap-2 text-amber-800 text-sm mb-3 cursor-pointer">
                    <input type="checkbox" checked={notifRecorded} onChange={e => setNotifRecorded(e.target.checked)} className="w-4 h-4 accent-amber-500" />
                    I confirm that urgent notification has been recorded/communicated
                  </label>
                )}

                {err && <div className="alert-danger mb-3">{err}</div>}
                <button className="btn-primary w-full justify-center" onClick={submit}>Submit Decision</button>
              </div>
            )}

            {msg.includes('successfully') && <div className="alert-success">{msg}</div>}
          </div>
        ) : <div className="text-slate-600">Loading context...</div>}
      </div>
    </div>
  )
}

function ReviewQueue() {
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)

  const reload = useCallback(
    () => reviewQueue().then(r => setQueue(r.data)).finally(() => setLoading(false)),
    []
  )
  useEffect(() => {
    reload()
    // Refresh assigned work after analyser completion.
    const timer = setInterval(reload, 5_000)
    return () => clearInterval(timer)
  }, [reload])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Review Queue</h1>
        <button className="btn-secondary" onClick={reload}><RefreshCw size={15} /> Refresh</button>
      </div>

      {loading ? <div className="text-slate-600">Loading...</div> : (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Result ID</th><th>Test</th><th>Flag</th><th>QC</th><th>Assigned</th><th>Action</th></tr></thead>
              <tbody>
                {queue.map((item: any) => (
                  <tr key={item.assignment_id}>
                    <td className="font-mono">{item.result_id}</td>
                    <td className="text-slate-900 font-medium">{item.test}</td>
                    <td><FlagBadge flag={item.flag} /></td>
                    <td>{item.qc_status}</td>
                    <td className="text-slate-600 text-xs">{new Date(item.assigned_at).toLocaleString('en-IN')}</td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => setSelected(item)}>
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
                {!queue.length && <tr><td colSpan={6} className="text-center text-slate-500 py-8">No reviews assigned to this account. Check the assigned reviewer shown in the technician portal.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <ReviewDetail assignment={selected} onClose={() => { setSelected(null); reload() }} />}
    </div>
  )
}

function MyReports() {
  const [reports, setReports] = useState<any[]>([])
  useEffect(() => { myReports().then(r => setReports(r.data)) }, [])

  return (
    <div>
      <h1 className="page-title mb-6">My Reviews</h1>
      <div className="card">
        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Result ID</th><th>Test</th><th>Flag</th><th>Decision</th><th>Reviewed</th></tr></thead>
            <tbody>
              {reports.map((r: any) => (
                <tr key={r.result_id}>
                  <td className="font-mono">{r.result_id}</td>
                  <td>{r.test}</td>
                  <td><FlagBadge flag={r.flag} /></td>
                  <td>
                    <span className={r.decision === 'approved' ? 'badge-green' : r.decision === 'held' ? 'badge-red' : 'badge-orange'}>
                      {r.decision}
                    </span>
                  </td>
                  <td className="text-slate-600 text-xs">{r.reviewed_at ? new Date(r.reviewed_at).toLocaleString('en-IN') : '—'}</td>
                </tr>
              ))}
              {!reports.length && <tr><td colSpan={5} className="text-center text-slate-500 py-8">No reviews yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function PathologistApp() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route index element={<ReviewQueue />} />
          <Route path="reports" element={<MyReports />} />
        </Routes>
      </main>
    </div>
  )
}
