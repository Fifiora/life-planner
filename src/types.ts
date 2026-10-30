export type Bucket = 'health' | 'study' | 'travel' | 'food' | 'finance'
export type SubBucket = 'physical' | 'mental' | 'spiritual'
export type Cadence = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'

export interface Member {
  id: string
  user_id: string
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
