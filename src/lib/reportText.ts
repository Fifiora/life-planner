import { cap, money } from './format'
import type { MemberRef, Report } from './reportTypes'

export interface TextSection {
  title: string
  lines: string[]
  /** What to say when there are no lines. */
  emptyText: string
}

export const reportFileName = (month: string): string => `life-planner-report-${month}.md`

const pct = (p: number | null) => (p === null ? '—' : `${p}%`)
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** The report as Markdown: for copying, pasting into a message, or saving as a file. */
export function reportSections(report: Report, members: MemberRef[]): TextSection[] {
  const name = (id: string) => members.find((m) => m.id === id)?.display_name ?? 'Someone'
  const label = (title: string, memberId: string) => (memberId === 'shared' ? title : `${title} (${name(memberId)})`)
  const sections: TextSection[] = []
  const section = (title: string, lines: string[], emptyText = 'Nothing logged') => sections.push({ title, lines, emptyText })

  const { scorecard: s, health: h, study, travel, food, finance: f, calendar: c } = report
  const scoreLines = [
    ...members.map((m) => `${m.display_name}: ${s.ticksByMember[m.id] ?? 0} ${plural(s.ticksByMember[m.id] ?? 0, 'tick', 'ticks')}${s.prevAvailable ? ` (${s.prevTicksByMember[m.id] ?? 0} last month)` : ''}`),
    `Completion: ${pct(s.completionPct)}`,
    `Best streak: ${members.map((m) => `${m.display_name} ${s.bestStreakByMember[m.id] ?? 0} days`).join(', ')}`,
    `Spent: ${money(s.spent)}${s.prevAvailable ? ` (last month ${money(s.prevSpent)})` : ''}`,
  ]
  if (report.focus.length > 0) scoreLines.push(`Focus goals: ${report.focus.filter((g) => g.done).length} of ${report.focus.length} done`)
  section('Scorecard', scoreLines)

  const known = report.routines.filter((r) => r.pct !== null)
  const strongest = known.length >= 3 ? [`Strongest: ${[...known].sort((a, b) => (b.pct as number) - (a.pct as number) || a.name.localeCompare(b.name)).slice(0, 3).map((r) => `${label(r.name, r.memberId)} ${r.pct}%`).join(', ')}`] : []
  section('Routines', [...report.routines.map((r) => `${label(r.name, r.memberId)}: ${r.count} of ${r.expected} (${pct(r.pct)})`), ...(report.routines.length > 0 ? strongest : [])])

  const healthLines = [
    ...members.filter((m) => (h.byMember[m.id]?.workouts ?? 0) > 0).map((m) => `${m.display_name}: ${h.byMember[m.id].workouts} ${plural(h.byMember[m.id].workouts, 'workout', 'workouts')} (${Object.entries(h.byMember[m.id].byType).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([type, n]) => `${type} ${n}`).join(', ')}), ${h.byMember[m.id].minutes} minutes`),
    ...h.timed.filter((t) => t.logged > 0).map((t) => `${label(t.name, t.memberId)}: on time ${pct(t.pct)} (${t.onTime} of ${t.logged} logged days)`),
  ]
  section('Health', healthLines)

  const studyLines = [
    ...members.filter((m) => (study.milestones[m.id]?.total ?? 0) > 0).map((m) => `${m.display_name}: ${study.milestones[m.id].done} of ${study.milestones[m.id].total} milestones`),
  ]
  if (members.some((m) => (study.triviaAllTime[m.id]?.attempts ?? 0) > 0)) {
    studyLines.push(`Trivia (all time): ${members.map((m) => `${m.display_name} ${study.triviaAllTime[m.id]?.correct ?? 0} of ${study.triviaAllTime[m.id]?.attempts ?? 0} correct`).join(', ')}`)
  }
  section('Study', studyLines)

  section('Travel', travel.planned > 0 ? [`Trips: ${travel.done} of ${travel.planned} done`, ...travel.trips.map((t) => `${t.place} (${t.status})`)] : [])

  const nights = Object.entries(food.nightsByType)
  const foodLines: string[] = []
  if (food.grocerySpent > 0 || food.groceryBudget > 0) foodLines.push(`Groceries: ${money(food.grocerySpent)} against ${food.groceryBudget > 0 ? money(food.groceryBudget) : 'no budget set'}`)
  if (food.groceryRoutinePct !== null) foodLines.push(`Grocery routine: ${pct(food.groceryRoutinePct)}`)
  if (nights.length > 0) foodLines.push(`Nights in: ${nights.reduce((n, [, v]) => n + v, 0)} (${nights.map(([k, v]) => `${k} ${v}`).join(', ')})`)
  section('Food', foodLines)

  const moneyLogged = f.spent > 0 || f.incomeLogged > 0 || f.savedThisMonth > 0 || f.billsDue > 0
  section(
    'Finance',
    moneyLogged
      ? [
          `Income: ${money(f.incomeLogged)} logged (${money(f.incomeConfigured)} planned)`,
          `Spent: ${money(f.spent)}`,
          ...(f.savingsTracked ? [`Saved: ${money(f.savedThisMonth)} against the ${money(f.savingsTarget)} target`] : []),
          `Bills paid: ${f.billsPaid} of ${f.billsDue}`,
          ...(f.payoffsCleared.length > 0 ? [`Payoffs cleared: ${f.payoffsCleared.join(', ')}`] : []),
          ...f.categories.map((x) => `${cap(x.category)}: ${money(x.spent)} against ${x.budget > 0 ? money(x.budget) : 'no budget'}`),
          ...f.changes.map((x) => `${x.category} ${x.delta > 0 ? 'up' : 'down'} ${money(Math.abs(x.delta))} since last month`),
        ]
      : [],
  )

  section('Calendar', c.done + c.missed + c.upcoming > 0 ? [`Done: ${c.done}, missed: ${c.missed}, still to come: ${c.upcoming}`] : [])

  section('Wins', report.insights.wins.map((i) => i.text), 'None this month.')
  section('Improve next month', report.insights.improve.map((i) => i.text), 'None this month.')
  // A month with nothing logged is empty all the way down, even if routines and bills are set up.
  return report.hasData ? sections : sections.map((x) => ({ ...x, lines: [] }))
}

/** The report as Markdown: for copying, pasting into a message, or saving as a file. */
export function reportToMarkdown(report: Report, members: MemberRef[], monthTitle: string): string {
  const out: string[] = [`# Life Planner report: ${monthTitle}${report.range.partial ? ' (so far)' : ''}`]
  if (report.focus.length > 0) out.push('', `## Focus for ${monthTitle.split(' ')[0]}`, ...report.focus.map((g) => `- [${g.done ? 'x' : ' '}] ${g.text}`))
  for (const s of reportSections(report, members)) out.push('', `## ${s.title}`, ...(s.lines.length > 0 ? s.lines : [s.emptyText]).map((l) => `- ${l}`))
  return out.join('\n') + '\n'
}
