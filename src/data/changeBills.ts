import { paymentsToPin } from '../lib/billChange'
import type { Bill } from '../types'
import type { FinanceData } from './useFinance'

/** Freeze what payments before `thisMonth` were, before the bill's amount changes. */
export async function pinPayments(f: Pick<FinanceData, 'payments'>, bill: Bill, thisMonth: string) {
  for (const pin of paymentsToPin(f.payments.rows, bill, thisMonth)) await f.payments.update(pin.id, { amount: pin.amount })
}

/**
 * Make this month's and later payments of the bill follow the bill again, dropping any amount saved on them
 * that differs from it. Returns whether anything changed.
 */
export async function followBill(f: Pick<FinanceData, 'payments'>, bill: Bill, thisMonth: string, amount = bill.amount): Promise<boolean> {
  let changed = false
  for (const p of f.payments.rows) {
    if (p.bill_id === bill.id && p.month >= thisMonth && p.amount != null && p.amount !== amount) {
      await f.payments.update(p.id, { amount: null })
      changed = true
    }
  }
  return changed
}

type Changing = Pick<FinanceData, 'payments' | 'bills' | 'billsBase' | 'monthAmounts'>

/** What a bill itself costs, whatever this month's own amount may be. */
const baseOf = (f: Pick<FinanceData, 'billsBase'>, bill: Bill) => f.billsBase.rows.find((b) => b.id === bill.id)?.amount ?? bill.amount

/** Drop the one-month amounts saved for a bill from `fromMonth` on (the bill's own amount takes over again). */
export async function clearMonthAmounts(f: Pick<FinanceData, 'monthAmounts'>, bill: Bill, fromMonth: string) {
  for (const o of f.monthAmounts.rows) if (o.bill_id === bill.id && o.month >= fromMonth) await f.monthAmounts.remove(o.id)
}

/** Change what bills cost: earlier months keep what was paid, this month and later follow the new amount. */
export async function setBillAmounts(f: Changing, changes: { bill: Bill; amount: number }[], thisMonth: string) {
  for (const { bill, amount } of changes) {
    const base = baseOf(f, bill)
    const hasMonthAmount = f.monthAmounts.rows.some((o) => o.bill_id === bill.id && o.month >= thisMonth)
    if (amount === base && !hasMonthAmount) continue
    if (amount !== base) {
      await pinPayments(f, { ...bill, amount: base }, thisMonth)
      await f.bills.update(bill.id, { amount })
    }
    await clearMonthAmounts(f, bill, thisMonth)
    await followBill(f, bill, thisMonth, amount)
  }
}

/**
 * Change what a monthly bill costs in one month only. The bill and the other months stay as they are; typing the
 * bill's own amount takes the month's change away. A payment saved for that month with a different amount follows.
 */
export async function setMonthAmount(f: Changing, bill: Bill, month: string, amount: number) {
  const base = baseOf(f, bill)
  const own = f.monthAmounts.rows.find((o) => o.bill_id === bill.id && o.month === month)
  if (amount === base) {
    if (own) await f.monthAmounts.remove(own.id)
  } else if (own) await f.monthAmounts.update(own.id, { amount })
  else await f.monthAmounts.insert({ bill_id: bill.id, month, amount })
  const payment = f.payments.rows.find((p) => p.bill_id === bill.id && p.month === month)
  if (payment && payment.amount != null && payment.amount !== amount) await f.payments.update(payment.id, { amount: null })
}
