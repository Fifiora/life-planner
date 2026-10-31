export type Bucket = 'health' | 'study' | 'travel' | 'food' | 'finance'
export type SubBucket = 'physical' | 'mental' | 'spiritual'
export type Cadence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

export interface Member {
  id: string
  user_id?: string
  display_name: string
  color: string
}

export interface Routine {
  id: string
  name: string
  bucket: Bucket
  sub_bucket?: SubBucket | null
  cadence: Cadence
  times_per_period: number
  applies_to: string // 'both' or a member id
  place: string | null
  time_rule: string | null // e.g. 'before 22:30', 'after 04:00'
  weekday: number | null // 0=Sun .. 6=Sat
  active: boolean
  shared?: boolean // true: either partner ticking counts; false/absent: each person ticks their own
}

export interface RoutineLog {
  id: string
  routine_id: string
  member_id: string
  date: string // YYYY-MM-DD (Chicago)
  done: boolean
  value: string | null
}

export interface Bill {
  id: string
  name: string
  amount: number
  category: string
  kind: 'recurring' | 'one_time'
  due_month: string | null // YYYY-MM, required for one_time
  paid: boolean
  cancel_status?: '' | 'could' | 'cancelled' // marking a subscription as one you could cancel / did cancel
}

export interface Income {
  id: string
  name: string
  monthly_amount: number
}

export interface Place {
  id: string
  name: string
  drive_hours: number
  rank: number
  visited: boolean
  notes?: string | null
  est_cost?: number | null
}

export interface TripPlan {
  id: string
  place_id: string
  planned_month: string
  status: 'planned' | 'done'
}

export interface NightOption {
  id: string
  slot_date: string
  type: 'game' | 'painting' | 'date' | 'movie'
  proposed_by: string
  activity: string
  snack: string
}

export interface NightVote {
  id: string
  option_id: string
  member_id: string
}

export interface Turn {
  id: string
  name: string
  current_member_id: string | null
  last_rotated_slot?: string | null
}

export interface Milestone {
  id: string
  week_start: string
  member_id: string
  text: string
  done: boolean
}

export interface TriviaTopic {
  id: string
  topic: string
  claimed_by: string
  author_id: string
}

export interface TriviaQuestion {
  id: string
  topic_id: string
  prompt: string
  options: string[]
  correct_index: number
}

export interface TriviaAttempt {
  id: string
  question_id: string
  member_id: string
  chosen_index: number
  correct: boolean
}

/** A stored row: always has an id, plus whatever fields its table uses. */
export type Row = { id: string } & Record<string, unknown>

/** A little cheer one partner sends the other for the day. */
export interface Cheer {
  id: string
  from_member: string
  to_member: string
  date: string // YYYY-MM-DD (Chicago)
}

export interface BillPayment {
  id: string
  bill_id: string
  month: string // YYYY-MM
  paid_on: string // YYYY-MM-DD
  member_id?: string // who ticked it off (older rows have none)
}

export interface SavingsEntry {
  id: string
  month: string // YYYY-MM
  amount: number
  member_id?: string
  note?: string | null
}

export interface Expense {
  id: string
  date: string
  amount: number
  category: string
  note: string
  member_id: string
  kind?: 'expense' | 'income' | 'transfer' // missing means expense
  source?: 'manual' | 'bank'
  receipt_id?: string // a receipt photo kept on this phone
}

export interface Activity {
  id: string
  date: string
  member_id: string
  type: string
  minutes: number | null
}

export interface NightLog {
  id: string
  date: string
  type: string
  activity: string
  snack: string
  host_id: string
}

export interface ShoppingItem {
  id: string
  name: string
  store: string
  done: boolean
  added_by: string
}

export interface Budget {
  id: string
  category: string
  amount: number
}

export interface ChecklistItem {
  id: string
  month: string
  key: string
  done: boolean
}

export type Repeat = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'

/** An event the couple adds to the calendar. Repeats are worked out when shown, so they never run out. */
export interface CalEvent {
  id: string
  title: string
  date: string // YYYY-MM-DD, first day
  time: string | null // HH:MM, or null for all day
  member: string // 'both' or a member id
  category: Bucket | 'other'
  repeat: Repeat
  repeat_until: string | null
  notes: string
  done_on: string[] // dates of repeats that were ticked off
}
