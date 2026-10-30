import { useState } from 'react'
import { useTable } from '../data/useTable'
import { monthKeyCT } from '../lib/dates'
import { sortPlaces, tierFor } from '../lib/travel'
import type { Place, TripPlan } from '../types'
import { EmptyState } from '../ui/EmptyState'
import { PageHead } from '../ui/PageHead'
import { PlaceForm } from '../ui/PlaceForm'
import { Sheet } from '../ui/Sheet'
import { TripTimeline } from '../ui/TripTimeline'

export default function Travel() {
  const places = useTable<Place>('places')
  const trips = useTable<TripPlan>('trip_plans')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Place | null>(null)
  const [planning, setPlanning] = useState<Place | null>(null)
  const [month, setMonth] = useState(monthKeyCT())

  const sorted = sortPlaces(places.rows)
  const monthly = sorted.filter((p) => tierFor(p.drive_hours) === 'monthly')
  const quarterly = sorted.filter((p) => tierFor(p.drive_hours) === 'quarterly')
  const thisMonth = trips.rows.filter((t) => t.planned_month === monthKeyCT() && t.status === 'planned')

  async function toggleTrip(t: TripPlan) {
    const done = t.status !== 'done'
    await trips.update(t.id, { status: done ? 'done' : 'planned' })
    await places.update(t.place_id, { visited: done })
  }

  const renderPlace = (p: Place) => (
    <li key={p.id} className="list-row">
      <span className="pill">#{p.rank}</span>
      <span className="grow">
        <button type="button" className="plain-btn" onClick={() => setEditing(p)}>
          <strong style={{ textDecoration: p.visited ? 'line-through' : undefined }}>{p.name}</strong>
        </button>
        <span className="muted small block-text">{p.drive_hours} h drive{p.visited ? ' · visited' : ''}</span>
      </span>
      <button type="button" className="btn btn-small" onClick={() => { setPlanning(p); setMonth(monthKeyCT()) }}>Plan</button>
    </li>
  )

  return (
    <div className="stack">
      <PageHead title="Travel" sub="A trip within 6 hours each month, a bigger one every 3." />

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--travel)' }} /><h2>This month</h2></div></div>
        {thisMonth.length > 0 ? (
          <p>🧳 {thisMonth.map((t) => places.rows.find((p) => p.id === t.place_id)?.name).filter(Boolean).join(', ')}</p>
        ) : (
          <p className="muted">No trip planned this month yet.</p>
        )}
      </section>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--travel)' }} /><h2>Trip plan</h2></div></div>
        <TripTimeline trips={trips.rows} places={places.rows} onToggleDone={toggleTrip} onRemove={(t) => trips.remove(t.id)} />
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title"><span className="accent-bar" style={{ background: 'var(--travel)' }} /><h2>Places to go</h2></div>
          <button type="button" className="add-btn" aria-label="Add place" onClick={() => setAdding(true)}>+</button>
        </div>
        {places.rows.length === 0 ? (
          <EmptyState icon="📍" title="Start your wishlist" description="Add places and how long they are to drive." actionLabel="Add a place" onAction={() => setAdding(true)} />
        ) : (
          <>
            <h3 className="mt">Monthly · up to 6 hours</h3>
            {monthly.length ? <ul className="list">{monthly.map(renderPlace)}</ul> : <p className="muted small">None yet.</p>}
            <h3 className="mt">Every 3 months · farther</h3>
            {quarterly.length ? <ul className="list">{quarterly.map(renderPlace)}</ul> : <p className="muted small">None yet.</p>}
          </>
        )}
      </section>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a place">
        <PlaceForm onSave={async (v) => { await places.insert(v); setAdding(false) }} />
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit place">
        {editing && (
          <PlaceForm
            key={editing.id}
            initial={editing}
            onSave={async (v) => { await places.update(editing.id, v); setEditing(null) }}
            onDelete={async () => { await places.remove(editing.id); setEditing(null) }}
          />
        )}
      </Sheet>
      <Sheet open={planning !== null} onClose={() => setPlanning(null)} title={`Plan ${planning?.name ?? 'trip'}`}>
        <label className="label" htmlFor="trip-month">Month</label>
        <input id="trip-month" className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!month}
            onClick={async () => {
              if (planning && month) await trips.insert({ place_id: planning.id, planned_month: month, status: 'planned' })
              setPlanning(null)
            }}
          >Add to plan</button>
        </div>
      </Sheet>
    </div>
  )
}
