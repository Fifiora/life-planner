import type { Bill } from '../types'

export interface MonthView {
  recurring: number
  oneTime: number
  available: number
  savings: number
  shortfall: number
  deficit: number
}

/**
 * Budget for one month (YYYY-MM). A one-time bill counts in its own due month
 * whether or not it has been paid, so past months keep their history.
 */
export function monthView(income: number, bills: Bill[], target: number, month: string): MonthView {
  const recurring = bills.filter((b) => b.kind === 'recurring').reduce((s, b) => s + b.amount, 0)
  const oneTime = bills
    .filter((b) => b.kind === 'one_time' && b.due_month === month)
    .reduce((s, b) => s + b.amount, 0)
  const available = income - recurring - oneTime
  const savings = Math.max(0, Math.min(available, target))
  return {
    recurring,
    oneTime,
    available,
    savings,
    shortfall: target - savings,
    deficit: Math.max(0, -available),
  }
}

/** Returns an error message, or null when the bill is valid. */
export function validateBill(b: Partial<Bill>): string | null {
  if (!b.name || b.name.trim() === '') return 'Name is required'
  if (typeof b.amount !== 'number' || !Number.isFinite(b.amount) || b.amount < 0) {
    return 'Amount must be a number of 0 or more'
  }
  if (b.kind !== 'recurring' && b.kind !== 'one_time') return 'Choose recurring or one-time'
  if (b.kind === 'one_time' && !(b.due_month && /^\d{4}-\d{2}$/.test(b.due_month))) {
    return 'One-time bills need a due month'
  }
  return null
}
