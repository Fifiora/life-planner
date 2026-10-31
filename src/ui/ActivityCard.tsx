import { useState, type FormEvent } from 'react'
import { useHousehold } from '../data/household'
import { useTable } from '../data/useTable'
import { todayCT } from '../lib/dates'
import { cap } from '../lib/format'
import { activityWeek } from '../lib/habits'
import type { Activity } from '../types'

const TYPES = ['run', 'walk', 'calisthenics', 'swim', 'weights', 'other']

/** Log what kind of exercise you did and see the week at a glance. */
export function ActivityCard() {
  const { me } = useHousehold()
  const activities = useTable<Activity>('activities')
  const [type, setType] = useState('run')
  const [minutes, setMinutes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const today = todayCT()
  const week = activityWeek(activities.rows, today, me.id)
  const recent = activities.rows.filter((a) => a.member_id === me.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  async function log(e: FormEvent) {
    e.preventDefault()
    const m = minutes.trim() === '' ? null : Number(minutes)
    if (m !== null && !(m > 0)) return setError('Minutes should be a number above 0, or left blank.')
    setError(null)
    await activities.insert({ date: today, member_id: me.id, type, minutes: m })
    setMinutes('')
  }

  return (
    <section className="card">
      <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--health)' }} /><h2>Activity</h2></div></div>
      <p>
        <strong>{week.activeDays} of 7 days active</strong>
        {week.minutes > 0 && ` · ${week.minutes} min`}
      </p>
      {Object.keys(week.byType).length > 0 && (
        <p className="chips">{Object.entries(week.byType).map(([t, n]) => <span key={t} className="pill">{cap(t)} ×{n}</span>)}</p>
      )}
      <form onSubmit={log} noValidate>
        <div className="row2">
          <div>
            <label className="label" htmlFor="act-type">Activity type</label>
            <select id="act-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="act-minutes">Minutes</label>
            <input id="act-minutes" className="input" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </div>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" className="btn btn-primary block mt">Log activity</button>
      </form>
      {recent.length > 0 && (
        <ul className="list">
          {recent.map((a) => (
            <li key={a.id} className="list-row">
              <span className="grow">{cap(a.type)}{a.minutes ? ` · ${a.minutes} min` : ''}<span className="muted small block-text">{a.date}</span></span>
              <button type="button" className="icon-btn" aria-label={`Delete ${a.type} on ${a.date}`} onClick={() => activities.remove(a.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
