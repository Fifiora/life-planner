import type { Bill, BillPayment } from '../types'

/**
 * Share a new monthly total for a category across its bills, in proportion to what each costs now.
 * The parts always add up to the new total exactly (odd cents go to the biggest bill).
 */
export function splitCategoryTotal(bills: Bill[], target: number): { id: string; amount: number }[] {
  if (bills.length === 0) return []
  const cents = Math.max(0, Math.round(target * 100))
  const sum = bills.reduce((s, b) => s + b.amount, 0)
  let parts: number[]
  if (cents === 0) parts = bills.map(() => 0)
  else if (sum <= 0) parts = bills.map((_, i) => (i === 0 ? cents : 0))
  else {
    parts = bills.map((b) => Math.round((cents * b.amount) / sum))
    const biggest = bills.reduce((best, b, i) => (b.amount > bills[best].amount ? i : best), 0)
    parts[biggest] += cents - parts.reduce((s, n) => s + n, 0)
  }
  return bills.map((b, i) => ({ id: b.id, amount: parts[i] / 100 }))
}

/**
 * Payments that simply follow the bill's amount would change with it. Pin each to what it was, so an
 * earlier month keeps what was really paid after the bill's amount changes. With `beforeMonth`, only
 * months before it are pinned: that month and later follow the bill (so a rent ticked at the old amount
 * becomes what you really pay now).
 */
export function paymentsToPin(payments: BillPayment[], bill: Bill, beforeMonth?: string): { id: string; amount: number }[] {
  return payments
    .filter((p) => p.bill_id === bill.id && p.amount == null && (beforeMonth === undefined || p.month < beforeMonth))
    .map((p) => ({ id: p.id, amount: bill.amount }))
}
