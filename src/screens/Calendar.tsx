import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useEvents } from '../data/useEvents'
import { useRoutineData } from '../data/useRoutineData'
import { dayCompletion, dayMarkers, isDate } from '../lib/calendar'
import { todayCT } from '../lib/dates'
import { monthLabel, shiftMonthKey } from '../lib/format'
import { AgendaList } from '../ui/AgendaList'
import { DaySheet } from '../ui/DaySheet'
import { MonthGrid } from '../ui/MonthGrid'
import { PageHead } from '../ui/PageHead'

const MIN_YEAR = 1000
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2000, i, 1)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' }))

export default function Calendar({ initialDate }: { initialDate?: string }) {
  const data = useRoutineData()
  const events = useEvents()
  const [params] = useSearchParams()
  const linked = params.get('date')
  const linkedDate = isDate(linked) ? linked : null
  const [month, setMonth] = useState((linkedDate ?? initialDate ?? todayCT()).slice(0, 7))
  const [selected, setSelected] = useState<string | null>(linkedDate)
  const [view, setView] = useState<'month' | 'agenda'>('month')
  const [agendaDays, setAgendaDays] = useState(14)
  const [yearDraft, setYearDraft] = useState<string | null>(null)

  const today = data.today
  const [year, mm] = month.split('-')
  const goTo = (m: string) => { setYearDraft(null); setMonth(m) }

  // Daily routines would put the same dots on every day, so dots show events and weekday-specific routines only.
  const dotRoutines = data.routines.filter((r) => r.cadence !== 'daily')
  const markersFor = (date: string) => dayMarkers(date, { routines: dotRoutines, events: events.events, anchor: data.anchor })
  const completionFor = (date: string) => dayCompletion(date, data.routines, data.logs, data.me.id, data.anchor)

  return (
    <div className="stack">
      <PageHead title="Calendar" sub="Everything planned, as far ahead as you like." />

      <section className="card">
        <div className="cal-head">
          <button type="button" className="icon-btn" aria-label="Previous month" disabled={month <= `${MIN_YEAR}-01`} onClick={() => goTo(shiftMonthKey(month, -1))}>‹</button>
          <h2>{monthLabel(month)}</h2>
          <button type="button" className="icon-btn" aria-label="Next month" disabled={month >= '9999-12'} onClick={() => goTo(shiftMonthKey(month, 1))}>›</button>
        </div>

        <div className="cal-tools">
          <button type="button" className="chip" onClick={() => goTo(today.slice(0, 7))}>Today</button>
          <select className="mini-select" aria-label="Month" value={Number(mm)} onChange={(e) => goTo(`${year}-${String(e.target.value).padStart(2, '0')}`)}>
            {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
          </select>
          <input
            className="mini-select year"
            type="number"
            aria-label="Year"
            value={yearDraft ?? year}
            onChange={(e) => {
              if (e.target.value.length > 4) return
              setYearDraft(e.target.value)
              if (/^\d{4}$/.test(e.target.value) && Number(e.target.value) >= MIN_YEAR) setMonth(`${e.target.value}-${mm}`)
            }}
            onBlur={() => setYearDraft(null)}
          />
          <div className="seg-group">
            <button type="button" className={`seg${view === 'month' ? ' active' : ''}`} aria-pressed={view === 'month'} onClick={() => setView('month')}>Month view</button>
            <button type="button" className={`seg${view === 'agenda' ? ' active' : ''}`} aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>Agenda view</button>
          </div>
        </div>

        {view === 'month' ? (
          <MonthGrid month={month} today={today} selected={selected} markersFor={markersFor} completionFor={completionFor} onSelect={setSelected} />
        ) : (
          <>
            <AgendaList from={today} days={agendaDays} events={events.events} routines={data.routines} anchor={data.anchor} onSelect={setSelected} />
            <div className="actions">
              <button type="button" className="btn" onClick={() => setAgendaDays((n) => n + 14)}>Show more</button>
            </div>
          </>
        )}
      </section>

      {selected && <DaySheet key={selected} date={selected} onClose={() => setSelected(null)} data={data} events={events} />}
    </div>
  )
}
