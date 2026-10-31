import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHousehold } from '../data/household'
import { useRoutineData } from '../data/useRoutineData'
import { useSettings } from '../data/useSettings'
import { useTable } from '../data/useTable'
import { periodProgress, scopedLogs } from '../lib/cadence'
import { monthKeyCT, weekStart } from '../lib/dates'
import { Confetti } from '../ui/Confetti'
import { useIncrease } from '../data/useIncrease'
import { needsBackup } from '../lib/backup'
import { monthView } from '../lib/finance'
import { weekRecap } from '../lib/recap'
import type { Bill, Income, Milestone, Routine, TripPlan, Turn } from '../types'
import { EmptyState } from '../ui/EmptyState'
import { PageHead } from '../ui/PageHead'
import { Ring } from '../ui/Ring'
import { RoutineForm } from '../ui/RoutineForm'
import { RoutineRows } from '../ui/RoutineList'
import { Sheet } from '../ui/Sheet'

const ratio = (done: number, total: number) => (total === 0 ? 0 : done / total)

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Today() {
  const data = useRoutineData()
  const { me, members, readOnly } = useHousehold()
  const milestones = useTable<Milestone>('milestones')
  const trips = useTable<TripPlan>('trip_plans')
  const bills = useTable<Bill>('bills')
  const income = useTable<Income>('income')
  const turns = useTable<Turn>('turns')
  const settings = useSettings()
  const [editing, setEditing] = useState<Routine | null>(null)
  const [creating, setCreating] = useState(false)

  const dow = new Date(`${data.today}T00:00:00Z`).getUTCDay()
  const isDone = (r: Routine) => periodProgress(r, scopedLogs(r, data.logs, me.id), data.today, data.anchor).done
  const todayItems = data.routines.filter((r) => r.cadence === 'daily' || r.weekday === dow)
  const laterItems = data.routines.filter((r) => !todayItems.includes(r) && !isDone(r))

  const healthToday = todayItems.filter((r) => r.bucket === 'health')
  const food = data.routines.filter((r) => r.bucket === 'food')
  const weekMs = milestones.rows.filter((m) => m.week_start === weekStart(data.today))
  const monthTrips = trips.rows.filter((t) => t.planned_month === monthKeyCT())
  const target = Number(settings.get('savings_target') ?? 10000)
  const fin = monthView(income.rows.reduce((s, i) => s + i.monthly_amount, 0), bills.rows, target, monthKeyCT())

  const rings = [
    { label: 'Health', color: 'var(--health)', value: ratio(healthToday.filter(isDone).length, healthToday.length) },
    { label: 'Study', color: 'var(--study)', value: ratio(weekMs.filter((m) => m.done).length, weekMs.length) },
    { label: 'Travel', color: 'var(--travel)', value: ratio(monthTrips.filter((t) => t.status === 'done').length, monthTrips.length) },
    { label: 'Food', color: 'var(--food)', value: ratio(food.filter(isDone).length, food.length) },
    { label: 'Finance', color: 'var(--finance)', value: ratio(fin.savings, target) },
  ]

  const complete = rings.filter((r) => r.value >= 1).length
  const celebrate = useIncrease(complete)
  const recap = weekRecap(data.logs, data.today)
  const milestonesDone = weekMs.filter((m) => m.done).length

  const hostTurn = turns.rows.find((t) => t.name === 'Nights host')
  const host = members.find((m) => m.id === hostTurn?.current_member_id)

  const nothing = data.routines.length === 0
  const lastBackup = Number(localStorage.getItem('lp.lastBackup')) || null
  const backupDue = !readOnly && needsBackup(lastBackup, Date.now(), data.routines.length > 0)

  return (
    <div className="stack">
      <Confetti fire={celebrate} />
      <PageHead
        title={`${greeting()}, ${me.display_name}`}
        sub={new Date(`${data.today}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
      />

      <section className="card" aria-label="Progress">
        <div className="rings">
          {rings.map((r) => <Ring key={r.label} label={r.label} color={r.color} value={r.value} size={58} />)}
        </div>
        {host && <p className="muted small mt">🎲 Next night in is hosted by <strong>{host.display_name}</strong></p>}
      </section>

      {(recap.total > 0 || milestonesDone > 0) && (
        <section className="card" aria-label="This week's wins">
          <h2>This week's wins 🎉</h2>
          <p>
            {`${recap.total} thing${recap.total === 1 ? '' : 's'} ticked off`}
            {members.length > 1 && ` (${members.map((m) => `${m.display_name} ${recap.byMember[m.id] ?? 0}`).join(' · ')})`}
            {milestonesDone > 0 && ` · ${milestonesDone} study milestone${milestonesDone === 1 ? '' : 's'} done`}
          </p>
        </section>
      )}

      {backupDue && (
        <section className="card">
          <p>💾 Your planner is saved only on this phone. <Link to="/settings">Download a backup</Link> so it can't be lost.</p>
        </section>
      )}

      {nothing && !data.loading ? (
        <section className="card">
          <EmptyState
            title="Nothing to track yet"
            description="Add your first routine, or load your starter plan from Settings."
            actionLabel="Add a routine"
            onAction={() => setCreating(true)}
          />
        </section>
      ) : (
        <>
          <section className="card">
            <div className="card-head"><h2>Today</h2><button type="button" className="add-btn" aria-label="Add routine" onClick={() => setCreating(true)}>+</button></div>
            {todayItems.length === 0 ? <p className="muted small">Nothing scheduled for today.</p> : <RoutineRows routines={todayItems} data={data} onEdit={setEditing} />}
          </section>
          {laterItems.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>Still to do this period</h2></div>
              <RoutineRows routines={laterItems} data={data} onEdit={setEditing} showDue />
            </section>
          )}
        </>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Add a routine">
        <RoutineForm onSave={async (v) => { await data.saveRoutine(v); setCreating(false) }} />
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit routine">
        {editing && (
          <RoutineForm
            key={editing.id}
            initial={editing}
            onSave={async (v) => { await data.saveRoutine(v, editing.id); setEditing(null) }}
            onDelete={async () => { await data.deleteRoutine(editing.id); setEditing(null) }}
          />
        )}
      </Sheet>
    </div>
  )
}
