import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { encodeSnapshot, parseSnapshotJson } from '../lib/snapshot'
import type { Member } from '../types'
import { isReadOnly } from './tableStore'
import { useTable } from './useTable'

export interface HouseholdValue {
  householdId: string
  members: Member[]
  me: Member
  /** True when showing someone's shared copy: nothing can be changed. */
  readOnly: boolean
  /** Act as the other person on this phone. */
  switchTo: (memberId: string) => void
}

export const HouseholdContext = createContext<HouseholdValue | null>(null)

export function useHousehold(): HouseholdValue {
  const v = useContext(HouseholdContext)
  if (!v) throw new Error('useHousehold must be used inside a HouseholdProvider')
  return v
}

const ME_KEY = 'lp.me'
const COLORS = ['#16a34a', '#6366f1']

/** For a phone that was sent a view-only file instead of a link. */
function OpenSharedFile() {
  const [error, setError] = useState<string | null>(null)
  async function open(file: File | undefined) {
    if (!file) return
    try {
      const snap = parseSnapshotJson(await file.text())
      localStorage.setItem('lp.snapshot', await encodeSnapshot(snap))
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  return (
    <div className="card mt">
      <label className="label" htmlFor="shared-file">Was a view-only file shared with you? Open it here</label>
      <input id="shared-file" className="input" type="file" accept="application/json,.json" onChange={(e) => void open(e.target.files?.[0])} />
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  )
}

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
      <OpenSharedFile />
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

/** Loads the two people, asks for their names the first time, and remembers who is using this phone. */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const members = useTable<Member>('members')
  const readOnly = isReadOnly()
  const [meId, setMeId] = useState(() => localStorage.getItem(ME_KEY))
  const me = readOnly ? members.rows[0] : members.rows.find((m) => m.id === meId)

  const value = useMemo<HouseholdValue | null>(
    () =>
      me
        ? {
            householdId: 'home',
            members: members.rows,
            me,
            readOnly,
            switchTo: (id: string) => {
              localStorage.setItem(ME_KEY, id)
              setMeId(id)
            },
          }
        : null,
    [members.rows, me, readOnly],
  )

  if (members.rows.length === 0) {
    if (readOnly) return <div className="app center-note">This view-only copy is empty.</div>
    return (
      <Onboarding
        onSave={(names) => {
          void members.seedIfEmpty(names.map((display_name, i) => ({ display_name, color: COLORS[i], user_id: '' })))
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
