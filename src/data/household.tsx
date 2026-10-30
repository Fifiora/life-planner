import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Member } from '../types'

export interface HouseholdValue {
  householdId: string
  members: Member[]
  me: Member
}

export const HouseholdContext = createContext<HouseholdValue | null>(null)

export function useHousehold(): HouseholdValue {
  const v = useContext(HouseholdContext)
  if (!v) throw new Error('useHousehold must be used inside a HouseholdProvider')
  return v
}

type State = { status: 'loading' } | { status: 'unlinked' } | { status: 'ready'; value: HouseholdValue }

/** Loads the signed-in user's household and members. */
export function HouseholdProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: mine } = await supabase.from('members').select('*').eq('user_id', userId)
      const me = (mine as Member[] | null)?.[0] as (Member & { household_id: string }) | undefined
      if (!me) {
        if (!cancelled) setState({ status: 'unlinked' })
        return
      }
      const { data: all } = await supabase.from('members').select('*').eq('household_id', me.household_id)
      if (!cancelled) {
        setState({ status: 'ready', value: { householdId: me.household_id, members: (all as Member[]) ?? [me], me } })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  if (state.status === 'loading') return <div className="app center-note">Loading…</div>
  if (state.status === 'unlinked') {
    return (
      <div className="app">
        <div className="card">
          <h2>Account not linked yet</h2>
          <p className="muted">This login isn't part of a household. Run <code>supabase/bootstrap.sql</code> in the Supabase SQL editor, then refresh.</p>
        </div>
      </div>
    )
  }
  return <HouseholdContext.Provider value={state.value}>{children}</HouseholdContext.Provider>
}
