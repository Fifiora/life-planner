import { useHousehold } from '../data/household'
import { useSettings } from '../data/useSettings'
import { useTable } from '../data/useTable'
import { addDays, DEFAULT_ANCHOR, daysBetween, todayCT } from '../lib/dates'
import { nextTurn } from '../lib/turns'
import { cap } from '../lib/format'
import { pickWinner } from '../lib/nights'
import { countByType } from '../lib/shopping'
import type { NightLog, NightOption, NightVote, Turn } from '../types'
import { NightsView, type NewIdea } from './NightsView'

const TURN_NAME = 'Nights host'

/** The biweekly game / painting / date / movie night: ideas, votes and whose turn it is to host. */
export function NightsPlanner() {
  const { me, members } = useHousehold()
  const options = useTable<NightOption>('night_options')
  const votes = useTable<NightVote>('night_votes')
  const turns = useTable<Turn>('turns')
  const nightLog = useTable<NightLog>('night_log')
  const settings = useSettings()

  const anchor = settings.get('biweekly_anchor') ?? DEFAULT_ANCHOR
  const slot = addDays(anchor, 14 * Math.floor(daysBetween(anchor, todayCT()) / 14))
  const slotOptions = options.rows.filter((o) => o.slot_date === slot)
  const slotVotes = votes.rows.filter((v) => slotOptions.some((o) => o.id === v.option_id))

  const turnRow = turns.rows.find((t) => t.name === TURN_NAME)
  const hostId = turnRow?.current_member_id ?? members[0].id
  const finished = turnRow?.last_rotated_slot === slot

  async function onVote(optionId: string) {
    const mine = slotVotes.filter((v) => v.member_id === me.id)
    if (mine.some((v) => v.option_id === optionId)) return
    await Promise.all(mine.map((v) => votes.remove(v.id)))
    await votes.insert({ option_id: optionId, member_id: me.id })
  }

  async function onAdd(idea: NewIdea) {
    await options.insert({ slot_date: slot, proposed_by: me.id, ...idea })
  }

  async function onDone() {
    if (finished) return // already passed on for this slot
    const winnerId = pickWinner(slotOptions, slotVotes)
    const winner = slotOptions.find((o) => o.id === winnerId)
    await nightLog.insert({ date: todayCT(), type: winner?.type ?? 'other', activity: winner?.activity ?? 'Night in', snack: winner?.snack ?? '', host_id: hostId })
    const next = nextTurn(members.map((m) => m.id), hostId)
    if (turnRow) await turns.update(turnRow.id, { current_member_id: next, last_rotated_slot: slot })
    else await turns.insert({ name: TURN_NAME, current_member_id: next, last_rotated_slot: slot })
  }

  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="accent-bar" style={{ background: 'var(--health)' }} />
          <h2>Our next night in</h2>
        </div>
      </div>
      <NightsView
        options={slotOptions}
        votes={slotVotes}
        members={members}
        meId={me.id}
        hostId={hostId}
        finished={finished}
        onVote={onVote}
        onAdd={onAdd}
        onDone={onDone}
      />
      {nightLog.rows.length > 0 && (
        <>
          <h3 className="mt">Past nights</h3>
          <p className="muted small">
            This month: {(['game', 'painting', 'date', 'movie'] as const).map((t) => `${cap(t)} ${countByType(nightLog.rows, todayCT().slice(0, 7), t)}`).join(' · ')}
          </p>
          <ul className="list">
            {[...nightLog.rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((n) => (
              <li key={n.id} className="list-row">
                <span className="grow"><strong>{n.activity}</strong><span className="muted small block-text">{cap(n.type)} · {n.date}{n.snack ? ` · ${n.snack}` : ''}</span></span>
                <span className="muted small">{members.find((m) => m.id === n.host_id)?.display_name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
