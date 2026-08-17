import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, moderator = false, admin = false }: { children: ReactNode; moderator?: boolean; admin?: boolean }) {
  const { user, loading, role } = useAuth()
  const location = useLocation()
  if (loading) return <div className="container page-loading">Loading…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (admin && role !== 'admin') return <Navigate to="/dashboard" replace />
  if (moderator && role !== 'moderator' && role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
