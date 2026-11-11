import { useHousehold } from '../data/household'
import { useGame } from '../data/useGame'
import { useTable } from '../data/useTable'
import { episodeFor } from '../lib/episode'
import { monthLabel, money } from '../lib/format'
import type { Expense } from '../types'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** A finished month told as an episode of the series. */
export function EpisodeCard({ month }: { month: string }) {
  const game = useGame()
  const { members } = useHousehold()
  const expenses = useTable<Expense>('expenses').rows
  if (!game.on) return null
  const e = episodeFor(month, { ...game.data, expenses }, members)
  return (
    <section className="card episode-card" aria-label={`Episode for ${monthLabel(month)}`}>
      <h2>{e.title}</h2>
      <p className="muted small">{monthLabel(month)}</p>
      <ul className="list">
        {members.map((m) => (
          <li key={m.id} className="list-row">{`${m.display_name}: ${plural(e.ticksByMember[m.id] ?? 0, 'tick')}`}</li>
        ))}
        <li className="list-row">{`Best streak: ${plural(e.bestStreak, 'day')}`}</li>
        <li className="list-row">{`Bills paid: ${e.billsPaid}`}</li>
        <li className="list-row">{`Spent: ${money(e.spent)}`}</li>
      </ul>
    </section>
  )
}
