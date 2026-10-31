import { useHousehold } from '../data/household'
import { useTable } from '../data/useTable'
import { todayCT, weekStart } from '../lib/dates'
import { nextTurn } from '../lib/turns'
import type { Turn } from '../types'

/** "Whose turn is it this week" for something the two of you alternate (e.g. leading Bible study). */
export function TurnCard({ name, title }: { name: string; title: string }) {
  const { members } = useHousehold()
  const turns = useTable<Turn>('turns')
  const row = turns.rows.find((t) => t.name === name)
  const leaderId = row?.current_member_id ?? members[0].id
  const leader = members.find((m) => m.id === leaderId)
  const week = weekStart(todayCT())
  const finished = row?.last_rotated_slot === week

  async function pass() {
    if (finished) return
    const patch = { current_member_id: nextTurn(members.map((m) => m.id), leaderId), last_rotated_slot: week }
    if (row) await turns.update(row.id, patch)
    else await turns.insert({ name, ...patch })
  }

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="accent-bar" style={{ background: 'var(--health)' }} />
          <h2>{title}</h2>
        </div>
      </div>
      {finished ? (
        <p className="callout ok">{`Done this week ✓ — ${leader?.display_name ?? 'your partner'} leads next`}</p>
      ) : (
        <>
          <p>{`Leads this week: ${leader?.display_name ?? '—'}`}</p>
          <button type="button" className="btn block mt edit-only" onClick={pass}>Mark done · pass the lead</button>
        </>
      )}
    </section>
  )
}
