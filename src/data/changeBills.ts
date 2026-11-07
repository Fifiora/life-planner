import { paymentsToPin } from '../lib/billChange'
import type { Bill } from '../types'
import type { FinanceData } from './useFinance'

/** Freeze what payments before `thisMonth` were, before the bill's amount changes. */
export async function pinPayments(f: Pick<FinanceData, 'payments'>, bill: Bill, thisMonth: string) {
  for (const pin of paymentsToPin(f.payments.rows, bill, thisMonth)) await f.payments.update(pin.id, { amount: pin.amount })
}

/** Change what bills cost: earlier months keep what was paid, this month and later follow the new amount. */
export async function setBillAmounts(f: Pick<FinanceData, 'payments' | 'bills'>, changes: { bill: Bill; amount: number }[], thisMonth: string) {
  for (const { bill, amount } of changes) {
    if (amount === bill.amount) continue
    await pinPayments(f, bill, thisMonth)
    await f.bills.update(bill.id, { amount })
  }
}
