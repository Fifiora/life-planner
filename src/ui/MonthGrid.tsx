import { PLAN_START } from '../lib/dates'
import { monthGrid, type Marker } from '../lib/calendar'

const HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const label = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })

export function MonthGrid({
  month,
  today,
  selected,
  markersFor,
  completionFor,
  onSelect,
}: {
  month: string
  today: string
  selected: string | null
  markersFor: (date: string) => Marker[]
  completionFor: (date: string) => { done: number; total: number }
  onSelect: (date: string) => void
}) {
  const weeks = monthGrid(month)
  return (
    <div className="mgrid" role="group" aria-label="Days of the month">
      {HEAD.map((h) => <div key={h} className="mgrid-head" aria-hidden>{h}</div>)}
      {weeks.flat().map((date) => {
        const past = date < today && date >= PLAN_START
        const c = past ? completionFor(date) : { done: 0, total: 0 }
        const shade = c.total === 0 ? '' : c.done >= c.total ? ' all' : c.done > 0 ? ' some' : ' none'
        return (
          <button
            key={date}
            type="button"
            data-date={date}
            data-before-start={date < PLAN_START ? 'true' : undefined}
            aria-label={label(date)}
            aria-current={date === today ? 'date' : undefined}
            aria-pressed={selected === date}
            className={`cal-cell${date.slice(0, 7) === month ? '' : ' outside'}${date === today ? ' today' : ''}${shade ? ` done${shade}` : ''}`}
            onClick={() => onSelect(date)}
          >
            <span className="cal-num">{Number(date.slice(8))}</span>
            <span className="cal-dots">
              {markersFor(date).slice(0, 4).map((m) => <span key={m} className="mdot" data-marker={m} style={{ background: m === 'other' ? 'var(--muted)' : `var(--${m})` }} />)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
