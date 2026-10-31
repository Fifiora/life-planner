import { insightsFor } from './reportInsights'
import { calendarSection, financeSection, foodSection, healthSection, monthRange, routinesSection, scorecardSection, studySection, travelSection } from './reportSections'
import type { FocusGoal, Report, ReportInput } from './reportTypes'

/** Everything about one month, as plain numbers. The page and the text export both read this. */
export function buildReport(month: string, input: ReportInput, extra: { game?: { level: number; bossesBeaten: number } | null; focus?: FocusGoal[] } = {}): Report {
  const range = monthRange(month, input.today)
  const scorecard = scorecardSection(range, input)
  const routines = routinesSection(range, input)
  const health = healthSection(range, input)
  const study = studySection(range, input)
  const travel = travelSection(range, input)
  const food = foodSection(range, input)
  const finance = financeSection(range, input)
  const calendar = calendarSection(range, input)
  const game = extra.game ?? null
  return {
    month,
    range,
    scorecard,
    routines,
    health,
    study,
    travel,
    food,
    finance,
    calendar,
    game,
    focus: extra.focus ?? [],
    insights: insightsFor({ range, members: input.members, scorecard, routines, health, study, travel, finance, calendar, game: game ? { bossesBeaten: game.bossesBeaten } : undefined }),
  }
}
