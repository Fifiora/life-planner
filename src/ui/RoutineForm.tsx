import { useId, useState, type FormEvent } from 'react'
import type { Bucket, Cadence, Routine } from '../types'
import { WEEKDAYS } from '../lib/format'

export type RoutineValues = Omit<Routine, 'id'>

const RULE = /^(before|after)\s+\d{1,2}:\d{2}$/

export function RoutineForm({
  initial,
  onSave,
  onDelete,
}: {
  initial?: Partial<Routine>
  onSave: (values: RoutineValues) => void
  onDelete?: () => void
}) {
  const uid = useId()
  const [name, setName] = useState(initial?.name ?? '')
  const [bucket, setBucket] = useState<Bucket>(initial?.bucket ?? 'health')
  const [section, setSection] = useState<string>(initial?.sub_bucket ?? '')
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? 'daily')
  const [times, setTimes] = useState(String(initial?.times_per_period ?? 1))
  const [weekday, setWeekday] = useState(initial?.weekday == null ? '' : String(initial.weekday))
  const [place, setPlace] = useState(initial?.place ?? '')
  const [rule, setRule] = useState(initial?.time_rule ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(times)
    if (!name.trim()) return setError('Name is required')
    if (!Number.isInteger(n) || n < 1) return setError('Times per period must be a whole number of 1 or more')
    if (rule.trim() && !RULE.test(rule.trim())) return setError('Time rule looks like "before 22:30" or "after 04:00"')
    setError(null)
    onSave({
      name: name.trim(),
      bucket,
      sub_bucket: (section || null) as Routine['sub_bucket'],
      cadence,
      times_per_period: n,
      applies_to: initial?.applies_to ?? 'both',
      place: place.trim() || null,
      time_rule: rule.trim() || null,
      weekday: weekday === '' ? null : Number(weekday),
      active: initial?.active ?? true,
    })
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="label" htmlFor={`${uid}-name`}>Name</label>
      <input id={`${uid}-name`} className="input" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="row2">
        <div>
          <label className="label" htmlFor={`${uid}-bucket`}>Bucket</label>
          <select id={`${uid}-bucket`} className="input" value={bucket} onChange={(e) => setBucket(e.target.value as Bucket)}>
            <option value="health">Health</option>
            <option value="food">Food</option>
            <option value="study">Study</option>
            <option value="travel">Travel</option>
            <option value="finance">Finance</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-section`}>Section</label>
          <select id={`${uid}-section`} className="input" value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">None</option>
            <option value="physical">Physical</option>
            <option value="mental">Mental</option>
            <option value="spiritual">Spiritual</option>
          </select>
        </div>
      </div>

      <div className="row2">
        <div>
          <label className="label" htmlFor={`${uid}-cadence`}>Repeats</label>
          <select id={`${uid}-cadence`} className="input" value={cadence} onChange={(e) => setCadence(e.target.value as Cadence)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-times`}>Times per period</label>
          <input id={`${uid}-times`} className="input" inputMode="numeric" value={times} onChange={(e) => setTimes(e.target.value)} />
        </div>
      </div>

      <label className="label" htmlFor={`${uid}-weekday`}>Weekday</label>
      <select id={`${uid}-weekday`} className="input" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
        <option value="">Any day</option>
        {WEEKDAYS.map((d, i) => (
          <option key={d} value={i}>{d}</option>
        ))}
      </select>

      <label className="label" htmlFor={`${uid}-place`}>Place (optional)</label>
      <input id={`${uid}-place`} className="input" value={place} onChange={(e) => setPlace(e.target.value)} />

      <label className="label" htmlFor={`${uid}-rule`}>Time rule (optional)</label>
      <input id={`${uid}-rule`} className="input" placeholder="before 22:30" value={rule} onChange={(e) => setRule(e.target.value)} />

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
