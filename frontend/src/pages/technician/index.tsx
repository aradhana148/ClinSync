import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '../../components/Sidebar'
import { StatusBadge, FlagBadge } from '../../components/StatusBadge'
import { myOrders, collectSample, receiveSample, acceptSample, rejectSample, getSampleResults, requestRerun, sampleLabel } from '../../api'
import { TestTube, RefreshCw, AlertTriangle } from 'lucide-react'

function CollectModal({ order, onClose, onDone }: any) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (saving || msg) return; setSaving(true); setErr(''); setMsg('')
    try {
      const { data } = await collectSample({ order_id: order.order_id })
      setMsg(`Sample collected! ID: ${data.sample_id} | Barcode: ${data.barcode}`)
    } catch (err: any) { setErr(err.response?.data?.detail ?? 'Failed') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="section-title">Collect Sample</h2>
          <button className="btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="alert-info mb-4 text-sm">
          Patient: <strong>{order.patient?.name}</strong> ({order.patient?.uhid})<br />
          Tests: {order.tests?.map((t: any) => t.name).join(', ')}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {msg && <div className="alert-success">{msg}</div>}
          {err && <div className="alert-danger">{err}</div>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !!msg} className="btn-primary flex-1 justify-center">{saving ? 'Verifying…' : msg ? 'Verified' : 'Verify'}</button>
            {msg && <button type="button" className="btn-secondary" onClick={onDone}>Done</button>}
          </div>
        </form>
      </div>
    </div>
  )
}

function RejectModal({ sample, onClose, onDone }: any) {
  const [reason, setReason] = useState('')
  const [err, setErr] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    try { await rejectSample({ sample_id: sample.id, rejection_reason: reason }); onDone() }
    catch (err: any) { setErr(err.response?.data?.detail ?? 'Failed') }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="section-title text-red-700">Reject Sample</h2>
          <button className="btn-secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="form-group"><label className="label">Rejection Reason *</label><textarea className="input" rows={3} required value={reason} onChange={e => setReason(e.target.value)} /></div>
          {err && <div className="alert-danger">{err}</div>}
          <button type="submit" className="btn-danger w-full justify-center"><AlertTriangle size={15} /> Confirm Rejection</button>
        </form>
      </div>
    </div>
  )
}

function ResultsPanel({ sampleId }: { sampleId: number }) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => getSampleResults(sampleId).then(r => setResults(r.data)).finally(() => setLoading(false)), [sampleId])
  useEffect(() => { reload(); const timer = setInterval(reload, 5000); return () => clearInterval(timer) }, [reload])

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-600 text-sm">Results</span>
        <button className="btn-secondary btn-sm" onClick={reload}><RefreshCw size={12} /></button>
      </div>
      {loading ? <div className="text-slate-600 text-xs">Loading...</div> : (
        results.length ? (
          <div className="flex flex-col gap-2">
            {results.map((r: any) => (
              <div key={r.id} className="bg-slate-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-900 text-sm font-medium">{r.test}</span>
                  <div className="flex gap-2"><FlagBadge flag={r.flag} /><StatusBadge status={r.status} /></div>
                </div>
                <div className="text-slate-700 text-xs break-all">{r.value}</div>
                <div className="text-slate-600 text-xs mt-1">QC: {r.qc_status} · Run #{r.run_number}</div>
                <div className="text-green-800 text-xs mt-2">{r.reviewer ? `Assigned reviewer: ${r.reviewer} (${r.reviewer_username})` : 'Awaiting reviewer assignment'}</div>
                {['Received', 'Held', 'Rerun Requested'].includes(r.status) && (
                  <button className="btn-secondary btn-sm mt-2" onClick={async () => { try { await requestRerun(r.id); reload() } catch (e: any) { alert(e.response?.data?.detail || "Rerun failed") } }}>Request Rerun</button>
                )}
              </div>
            ))}
          </div>
        ) : <div className="text-slate-500 text-xs">No results yet — analyser processing...</div>
      )}
    </div>
  )
}

export default function TechnicianApp() {
  const printLabel = async (id: number) => {
    try { const { data } = await sampleLabel(id); const url = URL.createObjectURL(data); const win = window.open(url, '_blank'); if (!win) { const a = document.createElement('a'); a.href = url; a.download = `sample-${id}.svg`; a.click() } setTimeout(() => URL.revokeObjectURL(url), 60000) }
    catch { alert('Could not load barcode label') }
  }
  const [barcodeQuery, setBarcodeQuery] = useState('')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [collectModal, setCollectModal] = useState<any>(null)
  const [rejectModal, setRejectModal] = useState<any>(null)
  const [expandedSample, setExpandedSample] = useState<number | null>(null)
  const [actionMsg, setActionMsg] = useState<Record<number, string>>({})

  const reload = () => myOrders().then(r => setOrders(r.data)).finally(() => setLoading(false))
  useEffect(() => { reload(); const timer = setInterval(reload, 5000); return () => clearInterval(timer) }, [])

  const withMsg = async (id: number, fn: () => Promise<any>, msg: string) => {
    try { await fn(); setActionMsg(m => ({ ...m, [id]: msg })); reload() }
    catch (e: any) { setActionMsg(m => ({ ...m, [id]: e.response?.data?.detail || 'Action failed' })) }
  }

  return (
    <div className="flex">
      <Sidebar />
      <main className="main-content">
        <div className="flex items-center justify-between mb-6">
          <h1 className="page-title">My Assigned Orders</h1>
          <button className="btn-secondary" onClick={reload}><RefreshCw size={15} /> Refresh</button>
        </div>

        <input aria-label="Find sample by barcode" className="input mb-4" placeholder="Scan / enter barcode, sample ID or patient name" value={barcodeQuery} onChange={e => setBarcodeQuery(e.target.value)} />
        {loading ? <div className="text-slate-600">Loading...</div> : (
          <div className="flex flex-col gap-4">
            {orders.filter(o => `${o.patient?.name} ${o.patient?.uhid} BC-${o.sample?.sample_id} ${o.order_ref}`.toLowerCase().includes(barcodeQuery.trim().toLowerCase())).map((o: any) => (
              <div key={o.order_id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-green-800">{o.order_ref}</span>
                      <StatusBadge status={o.priority} />
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="text-slate-900 font-medium">{o.patient?.name} <span className="text-slate-600 text-sm">({o.patient?.uhid})</span></div>
                    <div className="text-slate-600 text-sm mt-1">{o.tests?.map((t: any) => t.name).join(' · ')}</div>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    {o.status !== 'Cancelled' && (!o.sample || o.sample.status === 'Rejected') && (
                      <button className="btn-primary btn-sm" onClick={() => setCollectModal(o)}>
                        <TestTube size={13} /> Collect Sample
                      </button>
                    )}
                    {o.status !== 'Cancelled' && o.sample?.status === 'Collected' && (
                      <button className="btn-secondary btn-sm" onClick={() => withMsg(o.order_id, () => receiveSample(o.sample.id), 'Sample received')}>
                        Mark Received
                      </button>
                    )}
                    {o.status !== 'Cancelled' && o.sample?.status === 'Received' && (
                      <div className="flex gap-2">
                        <button className="btn-success btn-sm" onClick={() => withMsg(o.order_id, () => acceptSample(o.sample.id), 'Analyser started — results in ~15s')}>
                          Accept & Process
                        </button>
                        <button className="btn-danger btn-sm" onClick={() => setRejectModal(o.sample)}>Reject</button>
                      </div>
                    )}
                    {o.status !== 'Cancelled' && o.sample?.status === 'Processing' && (
                      <div className="badge-orange">Analyser Processing...</div>
                    )}
                    {o.status !== 'Cancelled' && o.sample?.status === 'Processed' && (
                      <button className="btn-secondary btn-sm" onClick={() => setExpandedSample(expandedSample === o.sample.id ? null : o.sample.id)}>
                        {expandedSample === o.sample.id ? 'Hide Results' : 'View Results'}
                      </button>
                    )}
                  </div>
                </div>

                {o.sample && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="text-slate-600 text-xs flex items-center gap-4">
                      <span>Sample ID: <span className="text-slate-900 font-mono">{o.sample.sample_id}</span></span>
                      <span>Barcode: <span className="text-slate-900 font-mono">{o.sample.sample_id ? `BC-${o.sample.sample_id}` : '—'}</span></span>
                      <StatusBadge status={o.sample.status} /><button className="btn-secondary btn-sm" onClick={() => printLabel(o.sample.id)}>Open / print barcode</button>
                    </div>
                    {expandedSample === o.sample.id && <ResultsPanel sampleId={o.sample.id} />}
                  </div>
                )}

                {actionMsg[o.order_id] && <div className="alert-success mt-3 text-sm">{actionMsg[o.order_id]}</div>}
              </div>
            ))}
            {!orders.length && <div className="card"><div className="text-slate-600 text-center py-8">No orders assigned</div></div>}
          </div>
        )}

        {collectModal && <CollectModal order={collectModal} onClose={() => setCollectModal(null)} onDone={() => { setCollectModal(null); reload() }} />}
        {rejectModal && <RejectModal sample={rejectModal} onClose={() => setRejectModal(null)} onDone={() => { setRejectModal(null); reload() }} />}
      </main>
    </div>
  )
}
