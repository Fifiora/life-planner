import { useHousehold } from '../data/household'
import { useSettings } from '../data/useSettings'
import { useTable } from '../data/useTable'
import { addDays, daysBetween, todayCT } from '../lib/dates'
import { nextTurn } from '../lib/turns'
import type { NightOption, NightVote, Turn } from '../types'
import { NightsView, type NewIdea } from './NightsView'

const TURN_NAME = 'Nights host'

/** The biweekly game / painting / date / movie night: ideas, votes and whose turn it is to host. */
export function NightsPlanner() {
  const { me, members } = useHousehold()
  const options = useTable<NightOption>('night_options')
  const votes = useTable<NightVote>('night_votes')
  const turns = useTable<Turn>('turns')
  const settings = useSettings()

  const anchor = settings.get('biweekly_anchor') ?? '2026-01-05'
  const slot = addDays(anchor, 14 * Math.floor(daysBetween(anchor, todayCT()) / 14))
  const slotOptions = options.rows.filter((o) => o.slot_date === slot)
  const slotVotes = votes.rows.filter((v) => slotOptions.some((o) => o.id === v.option_id))

  const turnRow = turns.rows.find((t) => t.name === TURN_NAME)
  const hostId = turnRow?.current_member_id ?? members[0].id

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
    const next = nextTurn(members.map((m) => m.id), hostId)
    if (turnRow) await turns.update(turnRow.id, { current_member_id: next })
    else await turns.insert({ name: TURN_NAME, current_member_id: next })
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
        onVote={onVote}
        onAdd={onAdd}
        onDone={onDone}
      />
    </section>
  )
}
