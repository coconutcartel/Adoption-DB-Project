import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import BrandMark from './BrandMark'

export default function Layout() {
  const { user, role, signOut, configured } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label="rehome home">
            <BrandMark />
            <span>rehome</span>
          </Link>
          <nav className="nav-links" aria-label="Primary navigation">
            <NavLink to="/" end>Adopt</NavLink>
            {user && <NavLink to="/dashboard">My animals</NavLink>}
            {role === 'admin' && <NavLink to="/dashboard/import">Import creative</NavLink>}
            {(role === 'moderator' || role === 'admin') && <NavLink to="/moderation">Reports</NavLink>}
            {!user ? (
              <NavLink className="button button-small" to="/login">Fosterer login</NavLink>
            ) : (
              <button className="link-button" onClick={handleSignOut}>Sign out</button>
            )}
          </nav>
        </div>
      </header>

      {!configured && (
        <div className="setup-banner">
          <div className="container"><strong>Demo mode.</strong> Connect Supabase to enable accounts, publishing, realtime updates and reports.</div>
        </div>
      )}

      <main><Outlet /></main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <div><strong>rehome</strong><br/><span>Every animal deserves a safe home.</span></div>
          <div className="footer-note">Community listings. Please verify adoption details independently.</div>
        </div>
      </footer>
    </div>
  )
}
