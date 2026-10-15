import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Receptionist from './pages/receptionist'
import Nurse from './pages/nurse'
import Doctor from './pages/doctor'
import Coordinator from './pages/coordinator'
import Technician from './pages/technician'
import Pathologist from './pages/pathologist'
import { useEffect, useState, type ReactNode } from 'react'

function Guard({ role, children }: { role: string; children: ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={`/${user.role}`} replace />
  return <>{children}</>
}
function Home() {
  const { user } = useAuth()
  return <Navigate to={user ? `/${user.role}` : '/login'} replace />
}
export default function App() {
  const [error, setError] = useState('')
  useEffect(() => { const handler = (e: Event) => setError((e as CustomEvent).detail); window.addEventListener('api-error', handler); return () => window.removeEventListener('api-error', handler) }, [])
  return <AuthProvider><BrowserRouter>
    {error && <div role="alert" className="fixed bottom-4 right-4 z-50 alert-danger">{error} <button className="btn-secondary btn-sm" onClick={() => setError('')}>Dismiss</button></div>}
    <Routes>
      <Route path="/login" element={<Login />} />
      {Object.entries({ receptionist: <Receptionist />, nurse: <Nurse />, doctor: <Doctor />, coordinator: <Coordinator />, technician: <Technician />, pathologist: <Pathologist /> }).map(([role, page]) =>
        <Route key={role} path={`/${role}/*`} element={<Guard role={role}>{page}</Guard>} />)}
      <Route path="/reception" element={<Navigate to="/receptionist" replace />} />
      <Route path="/lis/coordinator" element={<Navigate to="/coordinator" replace />} />
      <Route path="/lis/technician" element={<Navigate to="/technician" replace />} />
      <Route path="/lis/reviewer" element={<Navigate to="/pathologist" replace />} />
      <Route path="*" element={<Home />} />
    </Routes>
  </BrowserRouter></AuthProvider>
}
