import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { configured } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const state = location.state as { from?: string; reportAfterLogin?: boolean } | null

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError(''); setMessage('')
    if (!supabase) { setError('Connect Supabase first.'); setLoading(false); return }
    try {
      if (mode === 'signup') {
        const { error: signUpError, data } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() } } })
        if (signUpError) throw signUpError
        if (!data.session) setMessage('Account created. Check your email to confirm your address, then sign in.')
        else navigate(state?.from || '/dashboard')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        navigate(state?.from || '/dashboard', { state: state?.reportAfterLogin ? { reportAfterLogin: true } : undefined })
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Authentication failed.') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link className="brand auth-brand" to="/"><span className="brand-mark">♥</span><span>Rehome</span></Link>
        <div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button></div>
        <h1>{mode === 'login' ? 'Welcome back' : 'Create your fosterer account'}</h1>
        <p className="muted">{mode === 'login' ? 'Manage your animal listings or submit a community report.' : 'Your account lets you publish and maintain animals in your care.'}</p>
        {!configured && <div className="warning-box">The app is in demo mode. Add Supabase environment variables before accounts can be created.</div>}
        <form onSubmit={submit} className="stack-form">
          {mode === 'signup' && <label><span>Your name</span><input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"/></label>}
          <label><span>Email</span><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"/></label>
          <label><span>Password</span><input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/></label>
          {error && <div className="error-box">{error}</div>}
          {message && <div className="success-box">{message}</div>}
          <button className="button button-full" disabled={loading || !configured}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
      </div>
    </div>
  )
}
