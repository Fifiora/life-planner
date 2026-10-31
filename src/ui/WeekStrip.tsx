import { Link } from 'react-router-dom'
import { eventOccurrences } from '../lib/calendar'
import { addDays, weekStart } from '../lib/dates'
import type { CalEvent } from '../types'

const full = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })

/** The seven days of this week; tap one to open the calendar. A dot marks days with an event. */
export function WeekStrip({ today, events }: { today: string; events: CalEvent[] }) {
  const start = weekStart(today)
  return (
    <nav className="weekstrip" aria-label="This week">
      {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
        const busy = events.some((e) => eventOccurrences(e, d, d).length > 0)
        return (
          <Link key={d} to={`/calendar?date=${d}`} className={`wday${d === today ? ' today' : ''}`} aria-label={full(d)} aria-current={d === today ? 'date' : undefined}>
            <span className="wday-name">{short(d)}</span>
            <span className="wday-num">{Number(d.slice(8))}</span>
            <span className="wday-dot" style={{ opacity: busy ? 1 : 0 }} />
          </Link>
        )
      })}
    </nav>
  )
}
