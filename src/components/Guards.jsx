import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function RequireAuth({ children }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-slate-400">Loading...</div>
  if (!session) return <Navigate to="/login" replace />
  return children
}

export function RequireModule({ moduleId, level = 'view', children }) {
  const { can, loading } = useAuth()
  if (loading) return null
  if (!can(moduleId, level)) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <p className="text-lg font-medium text-slate-700">No access to this section</p>
        <p className="text-sm text-slate-500 mt-1">Ask an admin to grant you access if you need it.</p>
      </div>
    )
  }
  return children
}
