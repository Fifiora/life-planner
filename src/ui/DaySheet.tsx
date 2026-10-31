import { useState } from 'react'
import type { RoutineData } from '../data/useRoutineData'
import type { EventValues, useEvents } from '../data/useEvents'
import { useTable } from '../data/useTable'
import { eventOccurrences, routinesOn } from '../lib/calendar'
import { to12h } from '../lib/format'
import type { CalEvent, NightOption, Routine } from '../types'
import { EventForm } from './EventForm'
import { Sheet } from './Sheet'

const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export function DaySheet({ date, onClose, data, events }: { date: string; onClose: () => void; data: RoutineData; events: ReturnType<typeof useEvents> }) {
  const nights = useTable<NightOption>('night_options')
  const [mode, setMode] = useState<'view' | 'add' | CalEvent>('view')
  const { readOnly, today } = data

  const routines = routinesOn(date, data.routines, data.anchor)
  const todays = events.events.filter((e) => eventOccurrences(e, date, date).length > 0)
  const nightsIn = nights.rows.filter((n) => n.slot_date === date)
  const periodRoutines = data.routines.filter((r) => r.cadence !== 'daily' && r.weekday == null)

  const routineRow = (r: Routine) => {
    const mine = data.logs.find((l) => l.routine_id === r.id && l.date === date && l.done && (r.shared || l.member_id === data.me.id))
    const canTick = date === today && !readOnly && !r.time_rule
    return (
      <li key={r.id} className="list-row">
        <span className="mdot" style={{ background: `var(--${r.bucket})` }} />
        {canTick ? (
          <label className="grow">
            <input
              type="checkbox"
              className="tick"
              checked={Boolean(data.myLogToday(r)?.done)}
              onChange={() => void (data.myLogToday(r)?.done ? data.untick(r) : data.tick(r))}
            />{' '}
            <span>{r.name}</span>
          </label>
        ) : (
          <>
            <span className="grow">{r.name}</span>
            {date === today && r.time_rule && !readOnly ? (
              <span className="muted small">Log the time on Today</span>
            ) : mine ? (
              <span><span aria-hidden>✓</span><span className="sr-only">Done</span></span>
            ) : null}
          </>
        )}
      </li>
    )
  }

  const title = mode === 'view' ? 'Day details' : mode === 'add' ? 'Add event' : 'Edit event'

  async function save(v: EventValues) {
    if (mode === 'add') await events.add(v)
    else if (mode !== 'view') {
      // If the event was deleted elsewhere while this form was open, keep the edit by saving it as a new event.
      if (events.events.some((e) => e.id === mode.id)) await events.edit(mode.id, v)
      else await events.add(v)
    }
    setMode('view')
  }

  return (
    <Sheet open onClose={onClose} title={title}>
      {mode !== 'view' ? (
        <>
        <button type="button" className="back-btn" aria-label="Back" onClick={() => setMode('view')}>← Back</button>
        <EventForm
          key={mode === 'add' ? 'new' : mode.id}
          initial={mode === 'add' ? undefined : mode}
          defaultDate={date}
          members={data.members}
          onSave={save}
          onDelete={mode === 'add' ? undefined : async () => { await events.remove(mode.id); setMode('view') }}
        />
        </>
      ) : (
        <>
          <button type="button" className="back-btn" aria-label="Back to calendar" onClick={onClose}>← Back to calendar</button>
          <h3>{longDate(date)}</h3>

          <div className="subheader">Routines</div>
          {routines.length === 0 ? (
            <p className="muted small">No routines are pinned to this day.</p>
          ) : (
            <ul className="list">{routines.map(routineRow)}</ul>
          )}

          {periodRoutines.length > 0 && (
            <>
              <div className="subheader">This period</div>
              <ul className="list">{periodRoutines.map(routineRow)}</ul>
            </>
          )}

          <div className="subheader">Events</div>
          {todays.length === 0 ? (
            <p className="muted small">Nothing planned.</p>
          ) : (
            <ul className="list">
              {todays.map((e) => (
                <li key={e.id} className="list-row">
                  <span className="mdot" style={{ background: e.category === 'other' ? 'var(--muted)' : `var(--${e.category})` }} />
                  <span className="grow">
                    <span>{e.title}</span>
                    {e.time && <span className="muted small"> · {to12h(e.time)}</span>}
                  </span>
                  {!readOnly && (
                    <>
                      <input
                        type="checkbox"
                        className="tick"
                        aria-label={`Done: ${e.title}`}
                        checked={Array.isArray(e.done_on) && e.done_on.includes(date)}
                        onChange={() => void events.toggleDone(e.id, date)}
                      />
                      <button type="button" className="icon-btn" aria-label={`Edit ${e.title}`} onClick={() => setMode(e)}>✏️</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {nightsIn.length > 0 && (
            <>
              <div className="subheader">Night in</div>
              <ul className="list">
                {nightsIn.map((n) => <li key={n.id} className="list-row"><span className="grow">{n.activity}</span><span className="muted small">{n.type}</span></li>)}
              </ul>
            </>
          )}

          {!readOnly && (
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={() => setMode('add')}>Add event</button>
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}
