import { insightsFor } from './reportInsights'
import { calendarSection, financeSection, foodSection, healthSection, monthRange, routinesSection, scorecardSection, studySection, travelSection } from './reportSections'
import type { FocusGoal, Report, ReportInput } from './reportTypes'

/** Everything about one month, as plain numbers. The page and the text export both read this. */
export function buildReport(month: string, input: ReportInput, extra: { focus?: FocusGoal[] } = {}): Report {
  const range = monthRange(month, input.today, input.planStart)
  const scorecard = scorecardSection(range, input)
  const routines = routinesSection(range, input)
  const health = healthSection(range, input)
  const study = studySection(range, input)
  const travel = travelSection(range, input)
  const food = foodSection(range, input)
  const finance = financeSection(range, input)
  const calendar = calendarSection(range, input)
  const routineIds = new Set(input.routines.map((r) => r.id))
  const inRange = (d: string) => d >= range.start && d <= range.last
  const hasData =
    input.logs.some((l) => l.done && routineIds.has(l.routine_id) && inRange(l.date)) ||
    input.activities.some((a) => inRange(a.date)) ||
    input.milestones.some((m) => inRange(m.week_start)) ||
    input.nights.some((n) => inRange(n.date)) ||
    input.payments.some((p) => p.month === month) ||
    input.expenses.some((e) => inRange(e.date)) ||
    input.savings.some((s) => s.month === month) ||
    calendar.done > 0
  return {
    month,
    hasData,
    range,
    scorecard,
    routines,
    health,
    study,
    travel,
    food,
    finance,
    calendar,
    focus: extra.focus ?? [],
    insights: !hasData ? { wins: [], improve: [] } : insightsFor({ range, members: input.members, scorecard, routines, health, study, travel, finance, calendar }),
  }
}
