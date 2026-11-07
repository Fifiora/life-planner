import { paymentsToPin } from '../lib/billChange'
import type { Bill } from '../types'
import type { FinanceData } from './useFinance'

/** Freeze what earlier payments of this bill were, before the bill's amount changes. */
export async function pinPayments(f: Pick<FinanceData, 'payments'>, bill: Bill) {
  for (const pin of paymentsToPin(f.payments.rows, bill)) await f.payments.update(pin.id, { amount: pin.amount })
}

/** Change what bills cost from now on, keeping every payment already made as it was. */
export async function setBillAmounts(f: Pick<FinanceData, 'payments' | 'bills'>, changes: { bill: Bill; amount: number }[]) {
  for (const { bill, amount } of changes) {
    if (amount === bill.amount) continue
    await pinPayments(f, bill)
    await f.bills.update(bill.id, { amount })
  }
}
