import type { Paycheck } from '../types'
import { addDays, daysBetween } from './dates'

export interface PaySchedule {
  amount: number
  anchor: string // any real payday, YYYY-MM-DD; the others fall every 14 days from it
}

export interface Payday {
  key: string
  id?: string
  slot: string | null
  date: string
  amount: number
  received: boolean
  skipped: boolean
  /** An extra deposit, or one whose scheduled day no longer fits the schedule. */
  extra: boolean
  note?: string | null
}

const EVERY = 14

/** Every payday date from `from` to `to` (inclusive), counted in steps of two weeks from the anchor, before or after it. */
export function scheduledDates(anchor: string, from: string, to: string): string[] {
  const out: string[] = []
  let date = addDays(anchor, Math.ceil(daysBetween(anchor, from) / EVERY) * EVERY)
  while (date <= to) {
    out.push(date)
    date = addDays(date, EVERY)
  }
  return out
}

/** The paydays landing from `from` to `to`: the schedule, with what was ticked, changed or skipped laid over it, plus extra deposits. */
export function paydays(schedule: PaySchedule, rows: Paycheck[], from: string, to: string): Payday[] {
  const slots = scheduledDates(schedule.anchor, addDays(from, -45), addDays(to, 45))
  const known = new Set(slots)
  const list: Payday[] = slots.map((slot) => {
    const row = rows.find((r) => r.slot === slot)
    return {
      key: `slot:${slot}`,
      id: row?.id,
      slot,
      date: row?.date ?? slot,
      amount: row?.amount ?? schedule.amount,
      received: row?.received ?? false,
      skipped: row?.skipped ?? false,
      extra: false,
      note: row?.note ?? null,
    }
  })
  for (const r of rows) {
    if (r.slot !== null && known.has(r.slot)) continue
    list.push({ key: `row:${r.id}`, id: r.id, slot: r.slot, date: r.date, amount: r.amount ?? 0, received: r.received, skipped: r.skipped ?? false, extra: true, note: r.note ?? null })
  }
  return list.filter((p) => p.date >= from && p.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key))
}

/** What a month's paydays add up to: planned (everything not skipped), received so far, and what is still to come. */
export function monthPay(schedule: PaySchedule, rows: Paycheck[], month: string) {
  const list = paydays(schedule, rows, `${month}-01`, `${month}-31`)
  const live = list.filter((p) => !p.skipped)
  const planned = live.reduce((s, p) => s + p.amount, 0)
  const received = live.filter((p) => p.received).reduce((s, p) => s + p.amount, 0)
  const count = live.filter((p) => !p.extra).length
  return { paydays: list, count, planned, received, toCome: planned - received, threeDeposits: count >= 3 }
}
