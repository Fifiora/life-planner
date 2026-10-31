import { eventOccurrences, routinesOn } from '../lib/calendar'
import { addDays } from '../lib/dates'
import { dueLabel, to12h } from '../lib/format'
import type { CalEvent, Routine } from '../types'

/** The next `days` days that have something on them: events plus weekday-specific routines. */
export function AgendaList({
  from,
  days,
  events,
  routines,
  anchor,
  onSelect,
}: {
  from: string
  days: number
  events: CalEvent[]
  routines: Routine[]
  anchor: string
  onSelect: (date: string) => void
}) {
  const special = routines.filter((r) => r.cadence !== 'daily')
  const rows = Array.from({ length: days }, (_, i) => addDays(from, i))
    .map((date) => ({
      date,
      events: events.filter((e) => eventOccurrences(e, date, date).length > 0),
      routines: routinesOn(date, special, anchor),
    }))
    .filter((d) => d.events.length > 0 || d.routines.length > 0)

  if (rows.length === 0) return <p className="muted small">{`Nothing coming up in the next ${days} days.`}</p>
  return (
    <ul className="agenda">
      {rows.map((d) => (
        <li key={d.date}>
          <button type="button" className="agenda-day" onClick={() => onSelect(d.date)}>{dueLabel(d.date, from)}</button>
          <ul className="list">
            {d.events.map((e) => (
              <li key={e.id} className="list-row">
                <span className="mdot" style={{ background: e.category === 'other' ? 'var(--muted)' : `var(--${e.category})` }} />
                <span className="grow">{e.title}</span>
                {e.time && <span className="muted small">{to12h(e.time)}</span>}
              </li>
            ))}
            {d.routines.map((r) => (
              <li key={r.id} className="list-row">
                <span className="mdot" style={{ background: `var(--${r.bucket})` }} />
                <span className="grow muted">{r.name}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}
