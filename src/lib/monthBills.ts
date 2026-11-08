import type { Bill, BillMonth } from '../types'

/**
 * The bills as they stand in `month`: a monthly bill with its own amount saved for that month uses it.
 * Returns the same list when nothing changes, and never alters the stored bills.
 */
export function effectiveBills(bills: Bill[], overrides: BillMonth[], month: string): Bill[] {
  const mine = overrides.filter((o) => o.month === month)
  if (mine.length === 0) return bills
  const byBill = new Map(mine.map((o) => [o.bill_id, o.amount]))
  return bills.map((b) => (b.kind === 'recurring' && byBill.has(b.id) ? { ...b, amount: byBill.get(b.id) as number } : b))
}
