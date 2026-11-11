import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useHousehold } from '../data/household'
import { useFinance } from '../data/useFinance'
import { useRoutineData } from '../data/useRoutineData'
import { useEvents } from '../data/useEvents'
import { useSettings } from '../data/useSettings'
import { useTable } from '../data/useTable'
import { periodProgress, scopedLogs, streak } from '../lib/cadence'
import { ReportCard } from '../ui/ReportCard'
import { monthKeyCT, weekStart } from '../lib/dates'
import { Confetti } from '../ui/Confetti'
import { useIncrease } from '../data/useIncrease'
import { needsBackup } from '../lib/backup'
import { monthView } from '../lib/finance'
import { billsPaidSummary } from '../lib/finance2'
import { money } from '../lib/format'
import { weekRecap } from '../lib/recap'
import { SavingsBar } from '../ui/SavingsBar'
import type { Bill, Income, Milestone, Routine, TripPlan, Turn } from '../types'
import { EmptyState } from '../ui/EmptyState'
import { PageHead } from '../ui/PageHead'
import { TodayHero, type HeroRing } from '../ui/TodayHero'
import { daypart } from '../lib/daypart'
import { RoutineForm } from '../ui/RoutineForm'
import { RoutineRows } from '../ui/RoutineList'
import { QuickAdd } from '../ui/QuickAdd'
import { StarterPlanLoader } from '../ui/StarterPlanLoader'
import { Sheet } from '../ui/Sheet'
import { UpNext } from '../ui/UpNext'
import { GlowStats } from '../ui/GlowStats'
import { TickTrend } from '../ui/TickTrend'
import { WeekStrip } from '../ui/WeekStrip'

const ratio = (done: number, total: number) => (total === 0 ? 0 : done / total)

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function MoneyCard({ f }: { f: ReturnType<typeof useFinance> }) {
  const month = monthKeyCT()
  if (f.bills.rows.length === 0) return null
  const unpaid = billsPaidSummary(f.bills.rows, f.payments.rows, month).unpaid.length
  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Money this month</h2></div>
        <Link to="/finance">Open</Link>
      </div>
      <SavingsBar savings={f.projected} target={f.target} />
      <p className="muted small">{unpaid} monthly bill{unpaid === 1 ? '' : 's'} not ticked off yet · {f.flex.left >= 0 ? `${money(f.flex.left)} left for extras` : `${money(-f.flex.left)} over on extras`}</p>
    </section>
  )
}

export default function Today() {
  const data = useRoutineData()
  const { me, members, readOnly } = useHousehold()
  const milestones = useTable<Milestone>('milestones')
  const trips = useTable<TripPlan>('trip_plans')
  const money = useFinance(monthKeyCT())
  const turns = useTable<Turn>('turns')
  const events = useEvents()
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

  const count = (done: number, total: number) => `${done}/${total}`
  const healthDone = healthToday.filter(isDone).length
  const studyDone = weekMs.filter((m) => m.done).length
  const tripsDone = monthTrips.filter((t) => t.status === 'done').length
  const foodDone = food.filter(isDone).length
  const rings: HeroRing[] = [
    { key: 'health', label: 'Health', icon: '💪', color: 'var(--health)', value: ratio(healthDone, healthToday.length), caption: count(healthDone, healthToday.length), to: '/health' },
    { key: 'study', label: 'Study', icon: '📚', color: 'var(--study)', value: ratio(studyDone, weekMs.length), caption: count(studyDone, weekMs.length), to: '/study' },
    { key: 'travel', label: 'Travel', icon: '🧭', color: 'var(--travel)', value: ratio(tripsDone, monthTrips.length), caption: count(tripsDone, monthTrips.length), to: '/travel' },
    { key: 'food', label: 'Food', icon: '🍲', color: 'var(--food)', value: ratio(foodDone, food.length), caption: count(foodDone, food.length), to: '/food' },
    { key: 'finance', label: 'Finance', icon: '💰', color: 'var(--finance)', value: ratio(money.projected, money.target), caption: `${Math.round(Math.max(0, Math.min(1, ratio(money.projected, money.target))) * 100)}%`, to: '/finance' },
  ]

  const complete = rings.filter((r) => r.value >= 1).length
  const celebrate = useIncrease(complete)
  const recap = weekRecap(data.logs, data.today)
  const milestonesDone = weekMs.filter((m) => m.done).length

  const hostTurn = turns.rows.find((t) => t.name === 'Nights host')
  const host = members.find((m) => m.id === hostTurn?.current_member_id)

  const doneToday = todayItems.filter(isDone).length
  const bestStreak = Math.max(0, ...data.routines.filter((r) => r.cadence === 'daily').map((r) => streak(r, scopedLogs(r, data.logs, me.id), data.today, data.anchor)))

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

      <WeekStrip today={data.today} events={events.events} />

      <div className="wide today-layout">
        <div className="today-col today-main">
          <TodayHero rings={rings} done={doneToday} total={todayItems.length} streak={bestStreak} part={daypart(new Date().getHours())} host={host?.display_name} />

          <GlowStats today={ratio(doneToday, todayItems.length)} areas={rings.reduce((a, r) => a + Math.max(0, Math.min(1, r.value)), 0) / rings.length} />

          <ReportCard today={data.today} />

          <TickTrend logs={data.logs} today={data.today} members={members} meId={me.id} />


        {nothing && !data.loading ? (
          <section className="card">
            <EmptyState
              title="Nothing to track yet"
              description="Add your first routine, or load your starter plan from Settings."
              actionLabel="Add a routine"
              onAction={() => setCreating(true)}
            />
            <StarterPlanLoader />
          </section>
        ) : (
          <>
            <section className="card">
              <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--brand)' }} /><h2>Today</h2></div><button type="button" className="add-btn" aria-label="Add routine" onClick={() => setCreating(true)}>+</button></div>
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
        </div>
        <div className="today-col today-side">
          <UpNext today={data.today} events={events.events} />


          <MoneyCard f={money} />


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
        </div>
      </div>

      <p className="muted small"><Link to="/report">Month-end report</Link></p>

      {backupDue && (
        <section className="card">
          <p>💾 Your planner is saved only on this phone. <Link to="/settings">Download a backup</Link> so it can't be lost.</p>
        </section>
      )}

      <QuickAdd />

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
