import type { Activity, Bill, BillPayment, Bucket, Budget, CalEvent, Cadence, Expense, Milestone, NightLog, Place, Routine, RoutineLog, SavingsEntry, TripPlan, TriviaAttempt } from '../types'

export interface MemberRef {
  id: string
  display_name: string
}

/** Everything a report is worked out from: the saved lists plus a few settings. */
export interface ReportInput {
  members: MemberRef[]
  routines: Routine[]
  logs: RoutineLog[]
  activities: Activity[]
  milestones: Milestone[]
  attempts: TriviaAttempt[]
  trips: TripPlan[]
  places: Place[]
  nights: NightLog[]
  events: CalEvent[]
  expenses: Expense[]
  bills: Bill[]
  payments: BillPayment[]
  budgets: Budget[]
  savings: SavingsEntry[]
  incomeConfigured: number
  savingsTarget: number
  /** The first month savings are tracked (`YYYY-MM`). */
  savingsStart: string
  /** The day the plan began; nothing before it is counted. */
  planStart: string
  today: string
}

export interface MonthRange {
  month: string
  first: string
  /** The first day that counts: the month's first day, or the plan start if that is later. */
  start: string
  /** The month's last day, or today while the month is still going. */
  last: string
  days: number
  partial: boolean
}

export interface Scorecard {
  ticksByMember: Record<string, number>
  prevTicksByMember: Record<string, number>
  expectedTotal: number
  doneTotal: number
  completionPct: number | null
  bestStreakByMember: Record<string, number>
  spent: number
  prevSpent: number
  /** False when last month was before the plan began, so there is nothing to compare with. */
  prevAvailable: boolean
}

export interface RoutineRow {
  id: string
  name: string
  bucket: Bucket
  cadence: Cadence
  memberId: string | 'shared'
  count: number
  expected: number
  pct: number | null
}

export interface HealthSection {
  byMember: Record<string, { workouts: number; minutes: number; byType: Record<string, number> }>
  timed: { routineId: string; name: string; memberId: string; logged: number; onTime: number; pct: number | null }[]
  weeksWithoutWorkout: string[]
}

export interface StudySection {
  milestones: Record<string, { done: number; total: number }>
  /** Trivia answers carry no date, so this is everything ever answered. */
  triviaAllTime: Record<string, { attempts: number; correct: number }>
}

export interface TravelSection {
  planned: number
  done: number
  trips: { place: string; status: 'planned' | 'done' }[]
}

export interface FoodSection {
  grocerySpent: number
  groceryBudget: number
  nightsByType: Record<string, number>
  groceryRoutinePct: number | null
}

export interface FinanceSection {
  incomeConfigured: number
  incomeLogged: number
  spent: number
  savedThisMonth: number
  savingsTarget: number
  /** False for months before savings tracking began. */
  savingsTracked: boolean
  billsPaid: number
  billsDue: number
  unpaid: string[]
  payoffsCleared: string[]
  categories: { category: string; budget: number; spent: number; ratio: number | null }[]
  changes: { category: string; delta: number }[]
}

export interface CalendarSection {
  done: number
  missed: number
  upcoming: number
}

export interface Insight {
  area: Bucket | 'calendar' | 'general'
  text: string
}

export interface FocusGoal {
  text: string
  done: boolean
}

export interface Report {
  month: string
  /** False when nothing at all was logged in the month. */
  hasData: boolean
  range: MonthRange
  scorecard: Scorecard
  routines: RoutineRow[]
  health: HealthSection
  study: StudySection
  travel: TravelSection
  food: FoodSection
  finance: FinanceSection
  calendar: CalendarSection
  focus: FocusGoal[]
  insights: { wins: Insight[]; improve: Insight[] }
}
