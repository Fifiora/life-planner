import { useState } from 'react'
import { useHousehold } from '../data/household'
import { useSettings } from '../data/useSettings'
import { useTable } from '../data/useTable'
import { buildExport } from '../lib/export'
import { supabase } from '../lib/supabase'
import type { Member } from '../types'
import { PageHead } from '../ui/PageHead'
import { useToast } from '../ui/Toast'

const TABLES = [
  'members', 'routines', 'routine_logs', 'night_options', 'night_votes', 'turns', 'milestones',
  'trivia_topics', 'trivia_questions', 'trivia_attempts', 'places', 'trip_plans', 'income', 'bills', 'settings',
]

export default function Settings() {
  const { me, householdId } = useHousehold()
  const members = useTable<Member>('members')
  const settings = useSettings()
  const toast = useToast()
  const [target, setTarget] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<string | null>(null)

  async function exportAll() {
    const out: Record<string, Record<string, unknown>[]> = {}
    for (const t of TABLES) {
      const { data } = await supabase.from(t).select('*').eq('household_id', householdId)
      out[t] = (data ?? []) as Record<string, unknown>[]
    }
    const url = URL.createObjectURL(new Blob([buildExport(out)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'life-planner-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="stack">
      <PageHead title="Settings" sub={`Signed in as ${me.display_name}`} />

      <section className="card">
        <h2>Us</h2>
        <p className="muted small">Names and colors show on ticks and lists. Refresh the page after changing them.</p>
        {members.rows.map((m) => (
          <div key={m.id} className="row2" style={{ gridTemplateColumns: '1fr auto', alignItems: 'end' }}>
            <div>
              <label className="label" htmlFor={`n-${m.id}`}>Name</label>
              <input id={`n-${m.id}`} className="input" defaultValue={m.display_name} onBlur={(e) => e.target.value.trim() && members.update(m.id, { display_name: e.target.value.trim() })} />
            </div>
            <input type="color" aria-label={`Color for ${m.display_name}`} defaultValue={m.color} onBlur={(e) => members.update(m.id, { color: e.target.value })} style={{ width: 44, height: 44, border: 0, background: 'none' }} />
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Targets</h2>
        <label className="label" htmlFor="target">Monthly savings target ($)</label>
        <input id="target" className="input" inputMode="decimal" value={target ?? settings.get('savings_target') ?? '10000'} onChange={(e) => setTarget(e.target.value)} />
        <label className="label" htmlFor="anchor">Start of the 2-week cycle (a Monday)</label>
        <input id="anchor" className="input" type="date" value={anchor ?? settings.get('biweekly_anchor') ?? '2026-11-02'} onChange={(e) => setAnchor(e.target.value)} />
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              if (target !== null && Number.isFinite(Number(target)) && Number(target) >= 0) await settings.set('savings_target', String(Number(target)))
              if (anchor) await settings.set('biweekly_anchor', anchor)
              toast('Saved')
            }}
          >Save</button>
        </div>
      </section>

      <section className="card">
        <h2>Your data</h2>
        <p className="muted small">Download everything as a JSON backup.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={exportAll}>Export data</button>
          <button type="button" className="btn btn-danger" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </section>
    </div>
  )
}
