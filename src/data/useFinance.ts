import { monthView } from '../lib/finance'
import { flexView, projectedSavings, trackingStart } from '../lib/finance2'
import type { Bill, BillPayment, Expense, Income, SavingsEntry } from '../types'
import { useSettings } from './useSettings'
import { useTable } from './useTable'

export const PAYOFF_DEADLINE = '2027-01-01'

/** Everything the money screens need for one month, loaded once. */
export function useFinance(month: string) {
  const bills = useTable<Bill>('bills')
  const income = useTable<Income>('income')
  const payments = useTable<BillPayment>('bill_payments')
  const expenses = useTable<Expense>('expenses')
  const savings = useTable<SavingsEntry>('savings')
  const settings = useSettings()

  const target = Number(settings.get('savings_target') ?? 10000)
  const flexBudget = Number(settings.get('flex_budget') ?? 1000)
  const savingsStart = trackingStart(savings.rows, settings.get('savings_start') ?? '2026-11')
  const deadline = settings.get('payoff_deadline') ?? PAYOFF_DEADLINE
  const totalIncome = income.rows.reduce((s, i) => s + i.monthly_amount, 0)
  const view = monthView(totalIncome, bills.rows, target, month)
  const flex = flexView(flexBudget, expenses.rows, month)

  return {
    bills,
    income,
    payments,
    expenses,
    savings,
    settings,
    target,
    flexBudget,
    savingsStart,
    deadline,
    totalIncome,
    view,
    flex,
    projected: projectedSavings(view.available, flex.spent, target),
  }
}

export type FinanceData = ReturnType<typeof useFinance>
