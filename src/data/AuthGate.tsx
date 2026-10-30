import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from '../lib/supabase'
import { HouseholdProvider } from './household'
import Login from '../screens/Login'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isConfigured) {
    return (
      <div className="app">
        <div className="card">
          <h2>Almost there</h2>
          <p className="muted">
            The app isn't connected to its database yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> as repository secrets and redeploy.
          </p>
        </div>
      </div>
    )
  }
  if (session === undefined) return <div className="app center-note">Loading…</div>
  if (session === null) return <Login />
  return <HouseholdProvider userId={session.user.id}>{children}</HouseholdProvider>
}
