import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { clearConfig } from '../lib/githubStore'
import type { Member } from '../types'
import { useTable } from './useTable'

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

const ME_KEY = 'lp.me'
const COLORS = ['#16a34a', '#6366f1']

function Onboarding({ onSave }: { onSave: (names: [string, string]) => void }) {
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!first.trim() || !second.trim()) return setError('Please enter both names.')
    onSave([first.trim(), second.trim()])
  }

  return (
    <div className="app">
      <div className="login-hero" aria-hidden style={{ textAlign: 'center' }}>🌿</div>
      <h1 style={{ textAlign: 'center' }}>Who's using this planner?</h1>
      <form className="card mt" onSubmit={submit} noValidate>
        <label className="label" htmlFor="first-person">First person</label>
        <input id="first-person" className="input" value={first} onChange={(e) => setFirst(e.target.value)} />
        <label className="label" htmlFor="second-person">Second person</label>
        <input id="second-person" className="input" value={second} onChange={(e) => setSecond(e.target.value)} />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="btn btn-primary block mt">Save names</button>
      </form>
    </div>
  )
}

function WhoAreYou({ members, onPick }: { members: Member[]; onPick: (id: string) => void }) {
  return (
    <div className="app">
      <h1 style={{ textAlign: 'center', marginTop: '3rem' }}>Who are you on this phone?</h1>
      <div className="stack mt">
        {members.map((m) => (
          <button key={m.id} type="button" className="btn block" onClick={() => onPick(m.id)}>
            I'm {m.display_name}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Loads the two people, asks for their names the first time, and remembers which one this phone is. */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const members = useTable<Member>('members')
  const [meId, setMeId] = useState(() => localStorage.getItem(ME_KEY))
  const me = members.rows.find((m) => m.id === meId)

  const value = useMemo<HouseholdValue | null>(
    () => (me ? { householdId: 'home', members: members.rows, me } : null),
    [members.rows, me],
  )

  if (members.loading) return <div className="app center-note">Loading…</div>

  if (members.rows.length === 0 && members.error) {
    return (
      <div className="app">
        <div className="card">
          <h2>Couldn't load your data</h2>
          <p className="error">{members.error}</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => members.refetch()}>Try again</button>
            <button type="button" className="btn btn-danger" onClick={() => { clearConfig(); window.location.reload() }}>Reconnect</button>
          </div>
        </div>
      </div>
    )
  }

  if (members.rows.length === 0) {
    return (
      <Onboarding
        onSave={(names) => {
          names.forEach((display_name, i) => void members.insert({ display_name, color: COLORS[i], user_id: '' }))
        }}
      />
    )
  }

  if (!value) {
    return (
      <WhoAreYou
        members={members.rows}
        onPick={(id) => {
          localStorage.setItem(ME_KEY, id)
          setMeId(id)
        }}
      />
    )
  }

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}
