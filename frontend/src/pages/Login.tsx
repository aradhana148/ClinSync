import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { login } from '../api'
import { useAuth } from '../context/AuthContext'

const ROLE_ROUTES: Record<string, string> = {
  receptionist: '/receptionist',
  nurse:        '/nurse',
  doctor:       '/doctor',
  coordinator:  '/coordinator',
  technician:   '/technician',
  pathologist:  '/pathologist',
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await login(username, password)
      setUser({ user_id: data.user_id, full_name: data.full_name, role: data.role, token: data.access_token })
      navigate(ROLE_ROUTES[data.role] ?? '/')
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <section className="login-information">
        <div className="login-brand"><span className="hospital-mark"><Plus size={29} strokeWidth={3} /></span><div><strong>ClinSync</strong><small>Outpatient & laboratory services</small></div></div>
        <div className="login-intro"><span className="eyebrow">STAFF PORTAL</span><h1>Care starts with<br />a connected team.</h1><p>Patient visits, clinical records and laboratory reports, together in one place.</p></div>
        <div className="service-directory"><h2>Hospital workspace</h2><div><span>01</span><p><strong>Outpatient department</strong><small>Registration, appointments and nursing assessment</small></p></div><div><span>02</span><p><strong>Consultations & patient records</strong><small>Clinical notes, prescriptions and visit history</small></p></div><div><span>03</span><p><strong>Laboratory services</strong><small>Sample processing, review and report release</small></p></div></div>
        <div className="login-information-footer">ClinSync <span>OPD / LIS</span></div>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="eyebrow">WELCOME BACK</div>
          <h2>Staff sign in</h2><p className="login-instructions">Enter your credentials to access your workspace.</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div><label className="label" htmlFor="username">Username</label><input id="username" className="input" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" /></div>
            <div><label className="label" htmlFor="password">Password</label><div className="relative"><input id="password" className="input pr-12" type={showPass ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" /><button type="button" className="password-toggle" aria-label={showPass ? 'Hide password' : 'Show password'} onClick={() => setShowPass(!showPass)}>{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            {error && <div role="alert" className="alert-danger">{error}</div>}
            <button type="submit" className="btn-primary login-submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}{!loading && <ArrowRight size={17} />}</button>
          </form>
          <p className="login-access-note">Access is limited to your assigned staff role.<br />Sign out when you have finished using this workstation.</p>
        </div>
        <footer className="login-footer">ClinSync · Hospital information system</footer>
      </section>
    </div>
  )
}
