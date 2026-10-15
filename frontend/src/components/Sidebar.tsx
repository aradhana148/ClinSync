import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Home, Users, Calendar, ClipboardList, TestTube, Plus,
  LogOut, Activity, FileText, Microscope
} from 'lucide-react'

type NavItem = { to: string; label: string; icon: React.ReactNode }

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  receptionist: [
    { to: '/receptionist/follow-ups', label: 'Follow-ups', icon: <Calendar size={18} /> },
    { to: '/receptionist', label: 'Dashboard', icon: <Home size={18} /> },
    { to: '/receptionist/patients', label: 'Patients', icon: <Users size={18} /> },
    { to: '/receptionist/register', label: 'Register Patient', icon: <Users size={18} /> },
    { to: '/receptionist/appointments', label: 'Appointments', icon: <Calendar size={18} /> },
  ],
  nurse: [
    { to: '/nurse', label: 'Queue', icon: <Activity size={18} /> },
  ],
  doctor: [
    { to: '/doctor', label: 'Dashboard', icon: <Home size={18} /> },
    { to: '/doctor/patients', label: 'My Patients', icon: <Users size={18} /> },
  ],
  coordinator: [
    { to: '/coordinator', label: 'Dashboard', icon: <Home size={18} /> },
    { to: '/coordinator/orders', label: 'Lab Orders', icon: <ClipboardList size={18} /> },
    { to: '/coordinator/workload', label: 'Workload', icon: <Activity size={18} /> },
  ],
  technician: [
    { to: '/technician', label: 'My Orders', icon: <TestTube size={18} /> },
  ],
  pathologist: [
    { to: '/pathologist', label: 'Review Queue', icon: <Microscope size={18} /> },
    { to: '/pathologist/reports', label: 'My Reports', icon: <FileText size={18} /> },
  ],
}

const ROLE_NAMES: Record<string, string> = {
  receptionist: 'Reception', nurse: 'Nursing', doctor: 'Outpatient care',
  coordinator: 'Laboratory coordination', technician: 'Laboratory', pathologist: 'Clinical review',
}

export const Sidebar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const navItems = NAV_BY_ROLE[user?.role ?? ''] ?? []

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo"><span className="hospital-mark"><Plus size={25} strokeWidth={3} /></span><div><strong>ClinSync</strong><small>Clinical workspace</small></div></div>
        <div className="nav-section-label">{ROLE_NAMES[user?.role ?? '']}</div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(item => <NavLink key={item.to} to={item.to} end={item.to.split('/').length === 2} className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}>{item.icon}<span>{item.label}</span></NavLink>)}
        </nav>
        <div className="sidebar-footer"><span className="session-dot" /> Staff access <span className="ml-auto">OPD / LIS</span></div>
        <button onClick={handleLogout} className="sign-out"><LogOut size={16} /> Sign out</button>
      </aside>
      <header className="workspace-header">
        <div className="header-location">ClinSync <span>/</span> <strong>{ROLE_NAMES[user?.role ?? '']}</strong></div>
        <div className="staff-identity"><span className="staff-avatar">{user?.full_name.replace(/^Dr\.\s*/, '').split(' ').map(n => n[0]).slice(0,2).join('')}</span><div><strong>{user?.full_name}</strong><small>{user?.role}</small></div></div>
      </header>
    </>
  )
}
