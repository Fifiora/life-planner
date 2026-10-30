import { useId, useState, type FormEvent } from 'react'
import type { Member, NightOption, NightVote } from '../types'
import { pickWinner } from '../lib/nights'

export interface NewIdea {
  type: NightOption['type']
  activity: string
  snack: string
}

const ICONS: Record<NightOption['type'], string> = { game: '🎲', painting: '🎨', date: '🌹', movie: '🎬' }

export function NightsView({
  options,
  votes,
  members,
  meId,
  hostId,
  onVote,
  onAdd,
  onDone,
}: {
  options: NightOption[]
  votes: NightVote[]
  members: Member[]
  meId: string
  hostId: string
  onVote: (optionId: string) => void
  onAdd: (idea: NewIdea) => void
  onDone: () => void
}) {
  const uid = useId()
  const [type, setType] = useState<NightOption['type']>('game')
  const [activity, setActivity] = useState('')
  const [snack, setSnack] = useState('')
  const [error, setError] = useState<string | null>(null)

  const host = members.find((m) => m.id === hostId)
  const winnerId = pickWinner(options, votes)
  const winner = options.find((o) => o.id === winnerId)
  const tie = options.length > 1 && votes.length > 0 && winnerId === null
  const myVote = votes.filter((v) => v.member_id === meId).at(-1)?.option_id

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!activity.trim() || !snack.trim()) return setError('Add an activity and a snack')
    setError(null)
    onAdd({ type, activity: activity.trim(), snack: snack.trim() })
    setActivity('')
    setSnack('')
  }

  return (
    <div>
      <p className="muted small">Host this time: <strong>{host?.display_name ?? '—'}</strong></p>

      {options.length === 0 ? (
        <p className="muted">No ideas yet — add the first one below.</p>
      ) : (
        <ul className="list">
          {options.map((o) => {
            const count = votes.filter((v) => v.option_id === o.id).length
            return (
              <li key={o.id} className="list-row">
                <span aria-hidden className="emoji">{ICONS[o.type]}</span>
                <span className="grow">
                  <strong>{o.activity}</strong>
                  <span className="muted small block">Snack: {o.snack}</span>
                </span>
                <span className="muted small">{count}</span>
                <button
                  type="button"
                  className={`btn btn-small${myVote === o.id ? ' btn-primary' : ''}`}
                  aria-pressed={myVote === o.id}
                  aria-label={`Vote for ${o.activity}`}
                  onClick={() => onVote(o.id)}
                >
                  {myVote === o.id ? 'Voted' : 'Vote'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {winner && <p className="callout ok">Winner: {winner.activity}</p>}
      {tie && <p className="callout">Tie — flip a coin</p>}
      {winner && (
        <button type="button" className="btn block" onClick={onDone}>Mark night done · pass the host</button>
      )}

      <form onSubmit={submit} noValidate className="mt">
        <div className="row2">
          <div>
            <label className="label" htmlFor={`${uid}-type`}>Type</label>
            <select id={`${uid}-type`} className="input" value={type} onChange={(e) => setType(e.target.value as NightOption['type'])}>
              <option value="game">Game night</option>
              <option value="painting">Painting night</option>
              <option value="date">Date night</option>
              <option value="movie">Movie night</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`${uid}-activity`}>Activity</label>
            <input id={`${uid}-activity`} className="input" value={activity} onChange={(e) => setActivity(e.target.value)} />
          </div>
        </div>
        <label className="label" htmlFor={`${uid}-snack`}>Snack</label>
        <input id={`${uid}-snack`} className="input" value={snack} onChange={(e) => setSnack(e.target.value)} />
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="btn btn-primary block mt">Add idea</button>
      </form>
    </div>
  )
}
