import { cap, money, shortDate } from './format'
import type { CalendarSection, FinanceSection, HealthSection, Insight, MemberRef, MonthRange, RoutineRow, Scorecard, StudySection, TravelSection } from './reportTypes'

export interface InsightInput {
  range: MonthRange
  members: MemberRef[]
  scorecard: Scorecard
  routines: RoutineRow[]
  health: HealthSection
  study: StudySection
  travel: TravelSection
  finance: FinanceSection
  calendar?: CalendarSection
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export function insightsFor(input: InsightInput): { wins: Insight[]; improve: Insight[] } {
  const { range, members, routines, health, study, travel, finance } = input
  const person = (id: string) => members.find((m) => m.id === id)?.display_name ?? 'Someone'
  const label = (name: string, memberId: string) => (memberId === 'shared' ? name : `${name} (${person(memberId)})`)
  const finished = !range.partial

  // ----- improve (group 0 money, 1 routines, 2 the rest) -----
  const improve: { group: number; insight: Insight }[] = []
  const add = (group: number, area: Insight['area'], text: string) => improve.push({ group, insight: { area, text } })

  for (const c of finance.categories) {
    if (c.ratio !== null && c.budget > 0 && c.spent > c.budget * 1.1) add(0, 'finance', `${cap(c.category)} ran ${Math.round((c.spent / c.budget - 1) * 100)}% over budget (${money(c.spent)} against ${money(c.budget)}).`)
  }
  if (finance.unpaid.length > 0) {
    const n = finance.unpaid.length
    add(0, 'finance', `${n} monthly ${plural(n, 'bill', 'bills')} not paid${finished ? `: ${finance.unpaid.join(', ')}` : ' yet'}.`)
  }
  const moneyLogged = finance.spent > 0 || finance.incomeLogged > 0 || finance.savedThisMonth > 0 || finance.billsPaid > 0
  if (finished && finance.savingsTracked && moneyLogged && finance.savingsTarget > 0 && finance.savedThisMonth < finance.savingsTarget) {
    add(0, 'finance', `Savings reached ${money(finance.savedThisMonth)} against the ${money(finance.savingsTarget)} target.`)
  }
  routines
    .filter((r) => r.pct !== null && r.expected > 0 && r.pct < 60 && !(range.partial && r.cadence !== 'daily'))
    .sort((a, b) => (a.pct as number) - (b.pct as number) || a.name.localeCompare(b.name))
    .slice(0, 3)
    .forEach((r) => add(1, r.bucket, `${label(r.name, r.memberId)} was done ${r.pct}% of the time (${r.count} of ${r.expected}).`))
  for (const t of health.timed) {
    if (t.logged > 0 && t.pct !== null && t.pct < 70) add(2, 'health', `${label(t.name, t.memberId)} was on time ${t.pct}% of logged days.`)
  }
  const anyWorkout = Object.values(health.byMember).some((m) => m.workouts > 0)
  if (anyWorkout && health.weeksWithoutWorkout.length > 0) {
    const n = health.weeksWithoutWorkout.length
    add(2, 'health', `No workout was logged in ${n} ${plural(n, 'week', 'weeks')}, starting with the week of ${shortDate(health.weeksWithoutWorkout[0])}.`)
  }
  const done = Object.values(study.milestones).reduce((s, m) => s + m.done, 0)
  const total = Object.values(study.milestones).reduce((s, m) => s + m.total, 0)
  if (finished && total > 0 && done / total < 0.5) add(2, 'study', `Study milestones: ${done} of ${total} done.`)
  if (finished && travel.planned - travel.done > 0) {
    const n = travel.planned - travel.done
    add(2, 'travel', `${n} planned ${plural(n, 'trip', 'trips')} not done.`)
  }

  // ----- wins (in this order) -----
  const wins: Insight[] = []
  routines
    .filter((r) => r.pct !== null && r.expected > 0 && r.pct >= 90)
    .sort((a, b) => (b.pct as number) - (a.pct as number) || a.name.localeCompare(b.name))
    .slice(0, 3)
    .forEach((r) => wins.push({ area: r.bucket, text: `${label(r.name, r.memberId)}: ${r.pct}% done. Keep it up!` }))
  if (finance.billsDue > 0 && finance.unpaid.length === 0) wins.push({ area: 'finance', text: 'Every monthly bill was paid.' })
  if (finished && finance.savingsTracked && moneyLogged && finance.savingsTarget > 0 && finance.savedThisMonth >= finance.savingsTarget) {
    wins.push({ area: 'finance', text: `Savings hit ${money(finance.savedThisMonth)}, at or above the ${money(finance.savingsTarget)} target.` })
  }
  if (finished) {
    for (const c of finance.categories) {
      if (c.budget > 0 && c.spent > 0 && c.spent < c.budget * 0.9) wins.push({ area: 'finance', text: `${cap(c.category)} came in ${Math.round((1 - c.spent / c.budget) * 100)}% under budget.` })
    }
  }
  if (finance.payoffsCleared.length > 0) wins.push({ area: 'finance', text: `Cleared: ${finance.payoffsCleared.join(', ')}.` })
  const best = Object.entries(input.scorecard.bestStreakByMember).sort((a, b) => b[1] - a[1])[0]
  if (best && best[1] >= 7) wins.push({ area: 'general', text: `Best streak: ${best[1]} days (${person(best[0])}).` })

  return {
    wins: wins.slice(0, 5),
    improve: improve
      .map((x, i) => ({ ...x, i }))
      .sort((a, b) => a.group - b.group || a.i - b.i)
      .slice(0, 7)
      .map((x) => x.insight),
  }
}
