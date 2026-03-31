import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'

const AuthContext = createContext({})
const AUTH_TIMEOUT_MS = 5000

function withTimeout(promise, ms, fallbackValue, label) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => {
        if (label) {
          console.warn(`${label} timed out after ${ms}ms`)
        }
        resolve(fallbackValue)
      }, ms)
    }),
  ])
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId) {
    if (!supabase) return null
    const result = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single(),
      AUTH_TIMEOUT_MS,
      { data: null, error: { message: 'Profile request timeout' } },
      'Profile fetch',
    )
    const { data, error } = result
    if (error) {
      console.error('Failed to fetch profile', error)
      return null
    }
    return data ?? null
  }

  useEffect(() => {
    let mounted = true
    let loadingWatchdog = null

    if (!supabase) {
      setLoading(false)
      return
    }

    function armLoadingWatchdog() {
      if (loadingWatchdog) clearTimeout(loadingWatchdog)
      loadingWatchdog = setTimeout(() => {
        if (mounted) {
          console.warn(`Auth sync watchdog released loading state after ${AUTH_TIMEOUT_MS}ms`)
          setLoading(false)
        }
      }, AUTH_TIMEOUT_MS)
    }

    async function syncSession(session) {
      if (!mounted) return

      try {
        setUser(session?.user ?? null)

        if (session?.user) {
          const nextProfile = await fetchProfile(session.user.id)
          if (!mounted) return
          setProfile(nextProfile)
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.error('Failed to sync auth session', error)
        if (!mounted) return
        setProfile(null)
      } finally {
        if (loadingWatchdog) clearTimeout(loadingWatchdog)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    armLoadingWatchdog()

    withTimeout(
      supabase.auth.getSession(),
      AUTH_TIMEOUT_MS,
      { data: { session: null } },
      'Auth session fetch',
    ).then(({ data: { session } }) => {
      syncSession(session)
    }).catch((error) => {
      console.error('Failed to get session', error)
      if (loadingWatchdog) clearTimeout(loadingWatchdog)
      if (mounted) {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true)
      armLoadingWatchdog()
      syncSession(session)
    })

    return () => {
      mounted = false
      if (loadingWatchdog) clearTimeout(loadingWatchdog)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    if (!supabase) return { error: { message: 'Supabase is not configured' } }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  const role = profile?.role ?? null
  const isAuthenticated = !!role
  const isAdmin = role === 'admin'
  const isManager = role === 'manager' || isAdmin
  const canCreateLeads = isAdmin || role === 'manager'
  const canEditLeads = isAuthenticated
  const canDeleteLeads = isAdmin
  const canManageLeads = canEditLeads
  const canCreateDeals = isAuthenticated
  const canEditDeals = isAuthenticated
  const canDeleteDeals = isAdmin
  const canManageDeals = canEditDeals
  const canCreateActivities = isAuthenticated
  const canEditActivities = isAuthenticated
  const canDeleteActivities = isAdmin
  const canManageActivities = canCreateActivities
  const canCreateTasks = isAuthenticated
  const canEditTasks = isAuthenticated
  const canDeleteTasks = isAdmin
  const canManageTasks = canEditTasks
  const canManageUsers = isAdmin
  const isReadOnly = role === 'sales'

  const value = {
    user,
    profile,
    role,
    loading,
    signIn,
    signOut,
    supabaseConfigured,
    isAdmin,
    isManager,
    canCreateLeads,
    canEditLeads,
    canDeleteLeads,
    canManageLeads,
    canCreateDeals,
    canEditDeals,
    canDeleteDeals,
    canManageDeals,
    canCreateActivities,
    canEditActivities,
    canDeleteActivities,
    canManageActivities,
    canCreateTasks,
    canEditTasks,
    canDeleteTasks,
    canManageTasks,
    canManageUsers,
    isReadOnly,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
