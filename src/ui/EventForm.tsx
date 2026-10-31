import { useId, useState, type FormEvent } from 'react'
import { validateEvent } from '../lib/calendar'
import type { EventValues } from '../data/useEvents'
import type { Bucket, CalEvent, Member, Repeat } from '../types'

const CATEGORIES: [Bucket | 'other', string][] = [
  ['other', 'General'],
  ['health', 'Health'],
  ['study', 'Study'],
  ['travel', 'Travel'],
  ['food', 'Food'],
  ['finance', 'Finance'],
]
const REPEATS: [Repeat, string][] = [
  ['none', 'Does not repeat'],
  ['weekly', 'Every week'],
  ['biweekly', 'Every 2 weeks'],
  ['monthly', 'Every month'],
  ['yearly', 'Every year'],
]

export function EventForm({
  initial,
  defaultDate,
  members,
  onSave,
  onDelete,
}: {
  initial?: CalEvent
  defaultDate: string
  members: Pick<Member, 'id' | 'display_name'>[]
  onSave: (values: EventValues) => void
  onDelete?: () => void
}) {
  const uid = useId()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? defaultDate)
  const [time, setTime] = useState(initial?.time ?? '')
  const [member, setMember] = useState(initial?.member ?? 'both')
  const [category, setCategory] = useState<Bucket | 'other'>(initial?.category ?? 'other')
  const [repeat, setRepeat] = useState<Repeat>(initial?.repeat ?? 'none')
  const [until, setUntil] = useState(initial?.repeat_until ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const repeat_until = repeat === 'none' || !until ? null : until
    const problem = validateEvent({ title, date, repeat, repeat_until })
    if (problem) return setError(problem)
    setError(null)
    onSave({ title: title.trim(), date, time: time || null, member, category, repeat, repeat_until, notes: notes.trim() })
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="label" htmlFor={`${uid}-title`}>Title</label>
      <input id={`${uid}-title`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} />

      <div className="row2">
        <div>
          <label className="label" htmlFor={`${uid}-date`}>Date</label>
          <input id={`${uid}-date`} className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-time`}>Time</label>
          <input id={`${uid}-time`} className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div className="row2">
        <div>
          <label className="label" htmlFor={`${uid}-for`}>For</label>
          <select id={`${uid}-for`} className="input" value={member} onChange={(e) => setMember(e.target.value)}>
            <option value="both">Both of us</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-cat`}>Category</label>
          <select id={`${uid}-cat`} className="input" value={category} onChange={(e) => setCategory(e.target.value as Bucket | 'other')}>
            {CATEGORIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="row2">
        <div>
          <label className="label" htmlFor={`${uid}-repeat`}>Repeat</label>
          <select id={`${uid}-repeat`} className="input" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
            {REPEATS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-until`}>Repeat until</label>
          <input id={`${uid}-until`} className="input" type="date" value={until} disabled={repeat === 'none'} onChange={(e) => setUntil(e.target.value)} />
        </div>
      </div>

      <label className="label" htmlFor={`${uid}-notes`}>Notes</label>
      <textarea id={`${uid}-notes`} className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        <button type="submit" className="btn btn-primary">Save event</button>
        {onDelete && !confirming && <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Delete event</button>}
        {onDelete && confirming && <button type="button" className="btn btn-danger" onClick={onDelete}>Yes, delete event</button>}
      </div>
    </form>
  )
}
