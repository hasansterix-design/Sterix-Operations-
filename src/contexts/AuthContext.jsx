import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)       // app_users row
  const [permissions, setPermissions] = useState({}) // { module_id: 'none'|'view'|'edit' }
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)

  const loadProfileAndPermissions = useCallback(async (userId) => {
    const [{ data: profileData, error: profileErr }, { data: moduleData }, { data: permData }] = await Promise.all([
      supabase.from('app_users').select('*').eq('id', userId).single(),
      supabase.from('modules').select('*').order('sort_order'),
      supabase.from('user_permissions').select('module_id, access_level').eq('user_id', userId),
    ])

    if (profileErr) {
      console.error('Failed to load profile', profileErr)
      setProfile(null)
    } else {
      setProfile(profileData)
    }

    setModules(moduleData || [])

    const permMap = {}
    ;(permData || []).forEach((p) => { permMap[p.module_id] = p.access_level })
    setPermissions(permMap)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        await loadProfileAndPermissions(session.user.id)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await loadProfileAndPermissions(session.user.id)
      } else {
        setProfile(null)
        setPermissions({})
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [loadProfileAndPermissions])

  const isAdmin = !!profile?.is_admin

  // 'view' | 'edit' minimum check. Admins always pass.
  const can = useCallback((moduleId, level = 'view') => {
    if (isAdmin) return true
    const access = permissions[moduleId] || 'none'
    if (level === 'view') return access === 'view' || access === 'edit'
    if (level === 'edit') return access === 'edit'
    return false
  }, [isAdmin, permissions])

  const refreshPermissions = useCallback(() => {
    if (session?.user) return loadProfileAndPermissions(session.user.id)
  }, [session, loadProfileAndPermissions])

  const signIn = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const value = {
    session,
    user: session?.user || null,
    profile,
    isAdmin,
    permissions,
    modules,
    can,
    loading,
    signIn,
    signOut,
    refreshPermissions,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
