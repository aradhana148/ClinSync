import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Sidebar } from '../../components/Sidebar'
import { StatusBadge } from '../../components/StatusBadge'
import {
  coordDashboard, coordOrders, coordTechnicians,
  assignTechnician
} from '../../api'
import { RefreshCw } from 'lucide-react'

function CoordDashboard() {
  const [stats, setStats] = useState<any>(null)
  useEffect(() => { coordDashboard().then(r => setStats(r.data)) }, [])

  const items = stats ? [
    { label: 'Total Orders', value: stats.total_orders, color: 'text-green-800' },
    { label: 'Unassigned', value: stats.unassigned, color: 'text-red-700' },
    { label: 'In Progress', value: stats.in_progress, color: 'text-amber-800' },
    { label: 'Pending Review', value: stats.pending_review, color: 'text-green-800' },
  ] : []

  return (
    <div>
      <h1 className="page-title mb-6">Lab Coordinator Dashboard</h1>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {items.map(s => (
          <div key={s.label} className="stat-card">
            <div><div className="text-slate-600 text-xs">{s.label}</div><div className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</div></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [assigning, setAssigning] = useState<Record<number, string>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  const reload = () => {
    coordOrders().then(r => setOrders(r.data))
    coordTechnicians().then(r => setTechnicians(r.data))
  }
  useEffect(() => { reload() }, [])

  const assign = async (orderId: number, techId: number) => {
    setBusy(orderId); setError(''); setMsg('')
    try {
      await assignTechnician({ order_id: orderId, technician_id: techId })
      setOrders(items => items.map(o => o.id === orderId ? {...o, technician_id: techId, technician: technicians.find(t => t.id === techId)?.full_name} : o))
      setMsg('Assigned successfully'); reload()
    } catch (e: any) { setError(e.response?.data?.detail || 'Assignment failed') }
    finally { setBusy(null) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Incoming Orders</h1>
        <button className="btn-secondary" onClick={reload}><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <div className="alert-danger mb-4">{error}</div>}
      {msg && <div className="alert-success mb-4">{msg}</div>}
      <div className="table-wrapper">
        <table className="table">
          <thead><tr><th>Order ID</th><th>Tests</th><th>Priority</th><th>Status</th><th>Assigned To</th><th>Assign</th></tr></thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id}>
                <td className="font-mono text-green-800">{o.order_id}</td>
                <td className="text-slate-700 text-xs max-w-xs">{o.tests?.map((t: any) => t.name).join(', ')}</td>
                <td><StatusBadge status={o.priority} /></td>
                <td><StatusBadge status={o.status} /></td>
                <td className="text-slate-700">{o.technician ?? '—'}</td>
                <td>
                  <div className="flex gap-2">
                    <select
                      className="input text-xs py-1 px-2 w-36"
                      value={assigning[o.id] ?? o.technician_id ?? ''}
                      onChange={e => setAssigning(a => ({ ...a, [o.id]: e.target.value }))}
                    >
                      <option value="">— Select —</option>
                      {technicians.map((t: any) => <option key={t.id} value={t.id}>{t.full_name} ({t.active_orders})</option>)}
                    </select>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy === o.id || !assigning[o.id] || Number(assigning[o.id]) === o.technician_id}
                      onClick={() => assign(o.id, Number(assigning[o.id]))}
                    >{busy === o.id ? 'Assigning…' : o.technician_id && (!assigning[o.id] || Number(assigning[o.id]) === o.technician_id) ? 'Assigned' : 'Assign'}</button>
                  </div>
                </td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={6} className="text-center text-slate-500 py-8">No orders</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WorkloadPage() {
  const [technicians, setTechnicians] = useState<any[]>([])
  useEffect(() => { coordTechnicians().then(r => setTechnicians(r.data)) }, [])

  return (
    <div>
      <h1 className="page-title mb-6">Technician Workload</h1>
      <div className="grid grid-cols-3 gap-4">
        {technicians.map((t: any) => (
          <div key={t.id} className="card">
            <div className="text-slate-900 font-medium">{t.full_name}</div>
            <div className="text-slate-600 text-sm mt-1">Active Orders: <span className="text-amber-800 font-bold">{t.active_orders}</span></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CoordinatorApp() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route index element={<CoordDashboard />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="workload" element={<WorkloadPage />} />
          <Route path="reviews" element={<Navigate to="/coordinator" replace />} />
        </Routes>
      </main>
    </div>
  )
}
