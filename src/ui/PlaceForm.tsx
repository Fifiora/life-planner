import { useId, useState, type FormEvent } from 'react'
import type { Place } from '../types'
import { tierFor } from '../lib/travel'

export type PlaceValues = Omit<Place, 'id'>

export function PlaceForm({
  initial,
  onSave,
  onDelete,
}: {
  initial?: Partial<Place>
  onSave: (values: PlaceValues) => void
  onDelete?: () => void
}) {
  const uid = useId()
  const [name, setName] = useState(initial?.name ?? '')
  const [hours, setHours] = useState(initial?.drive_hours != null ? String(initial.drive_hours) : '')
  const [rank, setRank] = useState(initial?.rank != null ? String(initial.rank) : '')
  const [cost, setCost] = useState(initial?.est_cost != null ? String(initial.est_cost) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const parsed = hours.trim() === '' ? NaN : Number(hours)
  const validHours = Number.isFinite(parsed) && parsed >= 0
  const tier = validHours ? tierFor(parsed) : null

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Name is required')
    if (!validHours) return setError('Drive hours must be 0 or more')
    const r = rank.trim() === '' ? 99 : Number(rank)
    if (!Number.isFinite(r)) return setError('Rank must be a number')
    const c = cost.trim() === '' ? null : Number(cost)
    if (c !== null && !(Number.isFinite(c) && c >= 0)) return setError('Estimated cost must be 0 or more')
    setError(null)
    onSave({ name: name.trim(), drive_hours: parsed, rank: r, visited: initial?.visited ?? false, est_cost: c, notes: notes.trim() || null })
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="label" htmlFor={`${uid}-name`}>Name</label>
      <input id={`${uid}-name`} className="input" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="row2">
        <div>
          <label className="label" htmlFor={`${uid}-hours`}>Drive hours</label>
          <input id={`${uid}-hours`} className="input" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-rank`}>Rank (1 = first)</label>
          <input id={`${uid}-rank`} className="input" inputMode="numeric" value={rank} onChange={(e) => setRank(e.target.value)} />
        </div>
      </div>

      <div className="row2">
        <div>
          <label className="label" htmlFor={`${uid}-cost`}>Estimated cost ($)</label>
          <input id={`${uid}-cost`} className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-notes`}>Notes</label>
          <input id={`${uid}-notes`} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {tier && (
        <p className="tier-preview">
          Trip pace: <span className={`badge badge-${tier}`}>{tier === 'monthly' ? 'Monthly' : 'Quarterly'}</span>
        </p>
      )}

      {error && <p role="alert" className="error">{error}</p>}

      <div className="actions">
        <button type="submit" className="btn btn-primary">Save</button>
        {onDelete && !confirming && (
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Delete</button>
        )}
        {onDelete && confirming && (
          <>
            <button type="button" className="btn btn-danger" onClick={onDelete}>Yes, delete</button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
          </>
        )}
      </div>
    </form>
  )
}
