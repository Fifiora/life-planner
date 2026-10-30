import { monthLabel } from '../lib/format'
import type { Place, TripPlan } from '../types'
import { EmptyState } from './EmptyState'

export function TripTimeline({
  trips,
  places,
  onToggleDone,
  onRemove,
}: {
  trips: TripPlan[]
  places: Place[]
  onToggleDone: (t: TripPlan) => void
  onRemove: (t: TripPlan) => void
}) {
  if (trips.length === 0) {
    return <EmptyState icon="🗺️" title="No trips planned" description="Pick a place below and give it a month." />
  }
  const sorted = [...trips].sort((a, b) => a.planned_month.localeCompare(b.planned_month))
  return (
    <ul className="list">
      {sorted.map((t) => {
        const place = places.find((p) => p.id === t.place_id)
        const done = t.status === 'done'
        return (
          <li key={t.id} className="list-row" style={{ ['--accent' as string]: 'var(--travel)' }}>
            <button
              type="button"
              className={`check${done ? ' on' : ''}`}
              aria-pressed={done}
              aria-label={`${done ? 'Undo' : 'Mark'} trip to ${place?.name ?? 'place'} ${done ? '' : 'done'}`.trim()}
              onClick={() => onToggleDone(t)}
            >{done ? '✓' : ''}</button>
            <span className="grow">
              <strong>{place?.name ?? 'Unknown place'}</strong>
              <span className="muted small block-text">{monthLabel(t.planned_month)}</span>
            </span>
            <button type="button" className="icon-btn" aria-label="Remove trip" onClick={() => onRemove(t)}>✕</button>
          </li>
        )
      })}
    </ul>
  )
}
