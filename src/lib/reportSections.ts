import type { Routine } from '../types'
import { eventOccurrences } from './calendar'
import { addDays, daysBetween, PLAN_START, shiftMonths, weekStart } from './dates'
import { billsPaidSummary, flexView, normCategory } from './finance2'
import { shiftMonthKey } from './format'
import { scorecard, timeStats } from './habits'
import { budgetRows, monthActuals } from './ledger'
import type { CalendarSection, FinanceSection, FoodSection, HealthSection, MonthRange, ReportInput, RoutineRow, Scorecard, StudySection, TravelSection } from './reportTypes'
import { streakLengths } from './streak'
import { memberTickDates, memberTicks, type GameData } from './xp'

export function monthRange(month: string, today: string, planStart: string = PLAN_START): MonthRange {
  const first = `${month}-01`
  const end = addDays(shiftMonths(first, 1), -1)
  const partial = today >= first && today <= end
  const last = partial ? today : end
  const start = planStart > first ? planStart : first
  return { month, first, start, last, days: Math.max(0, daysBetween(start, last) + 1), partial }
}

const inRange = (r: MonthRange, date: string) => date >= r.start && date <= r.last
/** The month before, always a whole month (from the plan start on). */
const previous = (r: MonthRange, input: ReportInput) => monthRange(shiftMonthKey(r.month, -1), r.first, input.planStart)
const prevAvailable = (r: MonthRange, input: ReportInput) => shiftMonthKey(r.month, -1) >= input.planStart.slice(0, 7)
const gameData = (i: ReportInput): GameData => ({ routines: i.routines, logs: i.logs, activities: i.activities, milestones: i.milestones, attempts: i.attempts, payments: i.payments, bills: i.bills })
const peopleFor = (i: ReportInput, routine: Routine) => (routine.applies_to === 'both' ? i.members.map((m) => m.id) : i.members.filter((m) => m.id === routine.applies_to).map((m) => m.id))
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null)

export function routinesSection(r: MonthRange, input: ReportInput): RoutineRow[] {
  const rows: RoutineRow[] = []
  for (const routine of input.routines) {
    if (!routine.active) continue
    const mine = input.logs.filter((l) => l.routine_id === routine.id)
    const targets = routine.shared ? [{ memberId: 'shared', logs: mine }] : peopleFor(input, routine).map((id) => ({ memberId: id, logs: mine.filter((l) => l.member_id === id) }))
    for (const t of targets) {
      const s = scorecard(routine, t.logs.filter((l) => l.date >= r.start), r.last)
      let expected = s.expected
      // A month that began before the plan did only expects what falls from the start on (monthly routines keep their one).
      if (r.start > r.first && ['daily', 'weekly', 'biweekly'].includes(routine.cadence)) expected = Math.max(0, expected - scorecard(routine, [], addDays(r.start, -1)).expected)
      rows.push({ id: routine.id, name: routine.name, bucket: routine.bucket, memberId: t.memberId, count: s.count, expected, pct: expected > 0 ? Math.min(100, Math.round((s.count / expected) * 100)) : null })
    }
  }
  return rows.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101) || a.name.localeCompare(b.name) || a.memberId.localeCompare(b.memberId))
}

export function scorecardSection(r: MonthRange, input: ReportInput): Scorecard {
  const data = gameData(input)
  const prev = previous(r, input)
  const rows = routinesSection(r, input)
  const doneTotal = rows.reduce((s, x) => s + Math.min(x.count, x.expected), 0)
  const expectedTotal = rows.reduce((s, x) => s + x.expected, 0)
  const ticksByMember: Record<string, number> = {}
  const prevTicksByMember: Record<string, number> = {}
  const bestStreakByMember: Record<string, number> = {}
  for (const m of input.members) {
    const ticks = memberTicks(data, m.id)
    ticksByMember[m.id] = ticks.filter((t) => inRange(r, t.date)).length
    prevTicksByMember[m.id] = ticks.filter((t) => inRange(prev, t.date)).length
    bestStreakByMember[m.id] = Math.max(0, ...Object.entries(streakLengths(memberTickDates(data, m.id))).filter(([d]) => inRange(r, d)).map(([, len]) => len))
  }
  return {
    ticksByMember,
    prevTicksByMember,
    expectedTotal,
    doneTotal,
    completionPct: pctOf(doneTotal, expectedTotal),
    bestStreakByMember,
    spent: monthActuals(input.bills, input.payments, input.expenses, r.month).spent,
    prevSpent: monthActuals(input.bills, input.payments, input.expenses, prev.month).spent,
    prevAvailable: prevAvailable(r, input),
  }
}

export function healthSection(r: MonthRange, input: ReportInput): HealthSection {
  const byMember: HealthSection['byMember'] = {}
  for (const m of input.members) byMember[m.id] = { workouts: 0, minutes: 0, byType: {} }
  for (const a of input.activities) {
    const mine = byMember[a.member_id]
    if (!mine || !inRange(r, a.date)) continue
    mine.workouts++
    mine.minutes += a.minutes ?? 0
    mine.byType[a.type] = (mine.byType[a.type] ?? 0) + 1
  }
  const timed: HealthSection['timed'] = []
  for (const routine of input.routines) {
    if (!routine.active || !routine.time_rule) continue
    for (const id of peopleFor(input, routine)) {
      const s = timeStats(input.logs, routine, r.last, r.days, id)
      timed.push({ routineId: routine.id, name: routine.name, memberId: id, logged: s.logged, onTime: s.onTime, pct: pctOf(s.onTime, s.logged) })
    }
  }
  // Weeks (Monday to Sunday) that start inside the month; while the month is going, only weeks already over.
  const weeksWithoutWorkout: string[] = []
  const monday = weekStart(r.start) === r.start ? r.start : addDays(weekStart(r.start), 7)
  for (let w = monday; w <= r.last; w = addDays(w, 7)) {
    if (r.partial && addDays(w, 6) > r.last) break
    const end = addDays(w, 6)
    if (!input.activities.some((a) => a.date >= w && a.date <= end)) weeksWithoutWorkout.push(w)
  }
  return { byMember, timed, weeksWithoutWorkout }
}

export function studySection(r: MonthRange, input: ReportInput): StudySection {
  const milestones: StudySection['milestones'] = {}
  const triviaAllTime: StudySection['triviaAllTime'] = {}
  for (const m of input.members) {
    const mine = input.milestones.filter((x) => x.member_id === m.id && inRange(r, x.week_start))
    milestones[m.id] = { done: mine.filter((x) => x.done).length, total: mine.length }
    const tried = input.attempts.filter((a) => a.member_id === m.id)
    triviaAllTime[m.id] = { attempts: tried.length, correct: tried.filter((a) => a.correct).length }
  }
  return { milestones, triviaAllTime }
}

export function travelSection(r: MonthRange, input: ReportInput): TravelSection {
  const places = new Map(input.places.map((p) => [p.id, p.name]))
  const trips = input.trips.filter((t) => t.planned_month === r.month)
  return {
    planned: trips.length,
    done: trips.filter((t) => t.status === 'done').length,
    trips: trips.map((t) => ({ place: places.get(t.place_id) ?? 'Unknown place', status: t.status })),
  }
}

export function foodSection(r: MonthRange, input: ReportInput): FoodSection {
  const nightsByType: Record<string, number> = {}
  for (const n of input.nights) if (inRange(r, n.date)) nightsByType[n.type] = (nightsByType[n.type] ?? 0) + 1
  const grocery = routinesSection(r, input).filter((x) => x.bucket === 'food' && x.name.includes('rocery'))
  return {
    grocerySpent: flexView(0, input.expenses, r.month).groceries,
    groceryBudget: input.bills.filter((b) => b.kind === 'recurring' && normCategory(b.category) === 'food').reduce((s, b) => s + b.amount, 0),
    nightsByType,
    groceryRoutinePct: pctOf(grocery.reduce((s, x) => s + x.count, 0), grocery.reduce((s, x) => s + x.expected, 0)),
  }
}

export function financeSection(r: MonthRange, input: ReportInput): FinanceSection {
  const actual = monthActuals(input.bills, input.payments, input.expenses, r.month)
  const before = monthActuals(input.bills, input.payments, input.expenses, shiftMonthKey(r.month, -1))
  const summary = billsPaidSummary(input.bills, input.payments, r.month)
  const categories = budgetRows({ bills: input.bills, budgets: input.budgets, months: [r.month], actuals: [actual] })
    .map((row) => {
      const spent = row.perMonth[0] ?? 0
      return { category: row.category, budget: row.budget, spent, ratio: row.budget > 0 ? spent / row.budget : null }
    })
    .filter((c) => c.budget > 0 || c.spent > 0)
  const names = new Set([...Object.keys(actual.spentByCategory), ...Object.keys(before.spentByCategory)])
  const changes = (prevAvailable(r, input) ? [...names] : [])
    .map((category) => ({ category, delta: (actual.spentByCategory[category] ?? 0) - (before.spentByCategory[category] ?? 0) }))
    .filter((c) => c.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.category.localeCompare(b.category))
    .slice(0, 3)
  return {
    incomeConfigured: input.incomeConfigured,
    incomeLogged: actual.income,
    spent: actual.spent,
    savedThisMonth: input.savings.filter((s) => s.month === r.month).reduce((s, e) => s + e.amount, 0),
    savingsTarget: input.savingsTarget,
    savingsTracked: r.month >= input.savingsStart.slice(0, 7),
    billsPaid: summary.paidCount,
    billsDue: summary.totalCount,
    unpaid: summary.unpaid.map((b) => b.name),
    payoffsCleared: input.bills.filter((b) => b.kind === 'one_time' && b.paid && b.due_month === r.month).map((b) => b.name),
    categories,
    changes,
  }
}

export function calendarSection(r: MonthRange, input: ReportInput): CalendarSection {
  const out: CalendarSection = { done: 0, missed: 0, upcoming: 0 }
  for (const e of input.events) {
    for (const date of eventOccurrences(e, r.start, r.last)) {
      if ((e.done_on ?? []).includes(date)) out.done++
      else if (date < input.today) out.missed++
      else out.upcoming++
    }
  }
  return out
}
