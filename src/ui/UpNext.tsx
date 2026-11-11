import { Link } from 'react-router-dom'
import { eventOccurrences } from '../lib/calendar'
import { addDays } from '../lib/dates'
import { dueLabel, to12h } from '../lib/format'
import type { CalEvent } from '../types'

/** The next few events (today onward). Renders nothing when nothing is planned. */
export function UpNext({ today, events, limit = 3 }: { today: string; events: CalEvent[]; limit?: number }) {
  const coming = events
    .flatMap((e) => eventOccurrences(e, today, addDays(today, 60)).filter((date) => !e.done_on.includes(date)).map((date) => ({ e, date })))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.e.time ?? '').localeCompare(b.e.time ?? ''))
    .slice(0, limit)
  if (coming.length === 0) return null
  return (
    <section className="card upnext">
      <div className="card-head">
        <div className="card-title"><span className="accent-bar" style={{ background: 'var(--brand)' }} /><h2>Up next</h2></div>
        <Link to="/calendar">Calendar</Link>
      </div>
      <ul className="list">
        {coming.map(({ e, date }) => (
          <li key={`${e.id}-${date}`} className="list-row upnext-row">
            <span className="mdot" style={{ background: e.category === 'other' ? 'var(--muted)' : `var(--${e.category})` }} />
            <span className="grow">{e.title}</span>
            <span className="muted small">{dueLabel(date, today)}{e.time ? ` · ${to12h(e.time)}` : ''}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
