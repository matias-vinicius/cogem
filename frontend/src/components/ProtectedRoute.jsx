import { Navigate, useLocation } from 'react-router-dom'
import { canAccess } from '../config/permissions'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ module, children }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (module && !canAccess(user.role, module)) return <Navigate to="/" replace />
  return children
}
