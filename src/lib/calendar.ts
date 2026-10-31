import type { Bucket, CalEvent, Repeat, Routine, RoutineLog } from '../types'
import { addDays, daysBetween, DEFAULT_ANCHOR, weekStart } from './dates'

/** True for a real calendar date written YYYY-MM-DD. */
export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const pad = (n: number) => String(n).padStart(2, '0')
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()
const parts = (d: string) => d.split('-').map(Number) as [number, number, number]
const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay()

/** Six Monday-first weeks that cover the month (YYYY-MM), any year. */
export function monthGrid(monthKey: string): string[][] {
  const start = weekStart(`${monthKey}-01`)
  return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
}

/** Dates an event falls on inside [from, to], earliest first. Bad rows give nothing. */
export function eventOccurrences(event: CalEvent, from: string, to: string): string[] {
  if (!event || !isDate(event.date)) return []
  const start = event.date
  let end = to
  if (isDate(event.repeat_until)) {
    if (event.repeat_until < start) return []
    if (event.repeat_until < end) end = event.repeat_until
  }
  if (end < from) return []
  const out: string[] = []
  switch (event.repeat) {
    case 'weekly':
    case 'biweekly': {
      const step = event.repeat === 'weekly' ? 7 : 14
      const skip = Math.max(0, Math.ceil(daysBetween(start, from) / step))
      for (let d = addDays(start, skip * step); d <= end; d = addDays(d, step)) out.push(d)
      break
    }
    case 'monthly': {
      const [sy, sm, sd] = parts(start)
      const [fy, fm] = parts(from < start ? start : from)
      const [ey, em] = parts(end)
      for (let idx = fy * 12 + fm - 1; idx <= ey * 12 + em - 1; idx++) {
        const y = Math.floor(idx / 12)
        const m = (idx % 12) + 1
        const d = `${y}-${pad(m)}-${pad(Math.min(sd, daysInMonth(y, m)))}`
        if (d >= start && d >= from && d <= end && !(y === sy && m < sm)) out.push(d)
      }
      break
    }
    case 'yearly': {
      const [, sm, sd] = parts(start)
      const [fy] = parts(from < start ? start : from)
      const [ey] = parts(end)
      for (let y = fy; y <= ey; y++) {
        const d = `${y}-${pad(sm)}-${pad(Math.min(sd, daysInMonth(y, sm)))}`
        if (d >= start && d >= from && d <= end) out.push(d)
      }
      break
    }
    default:
      if (start >= from && start <= end) out.push(start)
  }
  return out
}

/** Routines that belong on this specific day. Monthly/quarterly ones without a weekday belong to the period, not a day. */
export function routinesOn(date: string, routines: Routine[], anchor: string): Routine[] {
  const start = isDate(anchor) ? anchor : DEFAULT_ANCHOR
  const weekIndex = Math.floor(daysBetween(weekStart(start), weekStart(date)) / 7)
  const evenWeek = ((weekIndex % 2) + 2) % 2 === 0
  return routines.filter((r) => {
    if (r.cadence === 'daily') return true
    if (r.weekday == null || r.weekday !== dow(date)) return false
    if (r.cadence === 'weekly') return true
    if (r.cadence === 'biweekly') return evenWeek
    return false
  })
}

export type Marker = Bucket | 'other'

/** Distinct colour dots for a day: routines due plus events. */
export function dayMarkers(date: string, input: { routines: Routine[]; events: CalEvent[]; anchor: string }): Marker[] {
  const set = new Set<Marker>()
  for (const r of routinesOn(date, input.routines, input.anchor)) set.add(r.bucket)
  for (const e of input.events) if (eventOccurrences(e, date, date).length > 0) set.add(e.category)
  return [...set]
}

/** How much of a day's routines got ticked, by one person (shared routines count either partner). */
export function dayCompletion(date: string, routines: Routine[], logs: RoutineLog[], memberId: string, anchor: string): { done: number; total: number } {
  const due = routinesOn(date, routines, anchor)
  const done = due.filter((r) => logs.some((l) => l.routine_id === r.id && l.date === date && l.done && (r.shared || l.member_id === memberId))).length
  return { done, total: due.length }
}

/** An error message for the event form, or null when the event is fine. */
export function validateEvent(v: { title: string; date: string; repeat: string; repeat_until: string | null }): string | null {
  if (!v.title.trim()) return 'Give the event a title.'
  if (!isDate(v.date)) return 'Pick a valid date.'
  if (v.repeat_until) {
    if (!isDate(v.repeat_until)) return 'Pick a valid "Repeat until" date.'
    if (v.repeat_until < v.date) return '"Repeat until" must be on or after the date.'
  }
  return null
}

const BUCKETS = ['health', 'study', 'travel', 'food', 'finance', 'other']
const REPEATS: Repeat[] = ['none', 'weekly', 'biweekly', 'monthly', 'yearly']

/** A safe copy of a stored event row, or null when it cannot be shown (so one bad row never breaks a screen). */
export function cleanEvent(row: unknown): CalEvent | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.title !== 'string' || !isDate(r.date)) return null
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    time: typeof r.time === 'string' && /^\d{2}:\d{2}$/.test(r.time) ? r.time : null,
    member: typeof r.member === 'string' ? r.member : 'both',
    category: (typeof r.category === 'string' && BUCKETS.includes(r.category) ? r.category : 'other') as CalEvent['category'],
    repeat: typeof r.repeat === 'string' && (REPEATS as string[]).includes(r.repeat) ? (r.repeat as Repeat) : 'none',
    repeat_until: isDate(r.repeat_until) ? r.repeat_until : null,
    notes: typeof r.notes === 'string' ? r.notes : '',
    done_on: Array.isArray(r.done_on) ? r.done_on.filter((d): d is string => typeof d === 'string') : [],
  }
}
