import { useMemo } from 'react'
import { PLAN_START } from '../lib/dates'
import { cleanEvent } from '../lib/calendar'
import { focusKey, parseFocus } from '../lib/focus'
import { buildReport } from '../lib/report'
import type { Report } from '../lib/reportTypes'
import type { Activity, CalEvent, Milestone, NightLog, Place, Routine, RoutineLog, TripPlan, TriviaAttempt } from '../types'
import { useHousehold } from './household'
import { useFinance } from './useFinance'
import { useTable } from './useTable'
import { useToday } from './useToday'

/** The report for one month, worked out from everything saved. `today` is only given by tests. */
export function useReport(month: string, today?: string): Report {
  const { members } = useHousehold()
  const live = useToday()
  const day = today ?? live
  const routines = useTable<Routine>('routines').rows
  const logs = useTable<RoutineLog>('routine_logs').rows
  const activities = useTable<Activity>('activities').rows
  const milestones = useTable<Milestone>('milestones').rows
  const attempts = useTable<TriviaAttempt>('trivia_attempts').rows
  const trips = useTable<TripPlan>('trip_plans').rows
  const places = useTable<Place>('places').rows
  const nights = useTable<NightLog>('night_log').rows
  const rawEvents = useTable<CalEvent>('events').rows
  const finance = useFinance(month)
  const focusRaw = finance.settings.get(focusKey(month))
  const events = useMemo(() => rawEvents.map(cleanEvent).filter((e): e is CalEvent => e !== null), [rawEvents])

  return useMemo(
    () =>
      buildReport(
        month,
        {
          members,
          routines,
          logs,
          activities,
          milestones,
          attempts,
          trips,
          places,
          nights,
          events,
          expenses: finance.expenses.rows,
          bills: finance.bills.rows,
          payments: finance.payments.rows,
          budgets: finance.budgets.rows,
          savings: finance.savings.rows,
          incomeConfigured: finance.totalIncome,
          savingsTarget: finance.target,
          savingsStart: finance.savingsStart,
          planStart: PLAN_START,
          today: day,
        },
        { focus: parseFocus(focusRaw) },
      ),
    [month, day, members, routines, logs, activities, milestones, attempts, trips, places, nights, events, finance.expenses.rows, finance.bills.rows, finance.payments.rows, finance.budgets.rows, finance.savings.rows, finance.totalIncome, finance.target, finance.savingsStart, focusRaw],
  )
}
