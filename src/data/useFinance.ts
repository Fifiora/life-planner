import { monthView } from '../lib/finance'
import { flexView, projectedSavings, trackingStart } from '../lib/finance2'
import { monthActuals } from '../lib/ledger'
import { effectiveBills } from '../lib/monthBills'
import type { Bill, BillMonth, BillPayment, Budget, ChecklistItem, Expense, Income, SavingsEntry } from '../types'
import { useSettings } from './useSettings'
import { useTable } from './useTable'

export const PAYOFF_DEADLINE = '2027-01-01'

/** Everything the money screens need for one month, loaded once. */
export function useFinance(month: string) {
  const billsBase = useTable<Bill>('bills')
  const monthAmounts = useTable<BillMonth>('bill_months')
  const income = useTable<Income>('income')
  const payments = useTable<BillPayment>('bill_payments')
  const expenses = useTable<Expense>('expenses')
  const savings = useTable<SavingsEntry>('savings')
  const budgets = useTable<Budget>('budgets')
  const checklist = useTable<ChecklistItem>('checklist')
  const settings = useSettings()

  const target = Number(settings.get('savings_target') ?? 10000)
  const flexBudget = Number(settings.get('flex_budget') ?? 1000)
  const savingsStart = trackingStart(savings.rows, settings.get('savings_start') ?? '2026-11')
  const deadline = settings.get('payoff_deadline') ?? PAYOFF_DEADLINE
  const totalIncome = income.rows.reduce((s, i) => s + i.monthly_amount, 0)
  // The bills as they stand in the month on screen: a monthly bill may have its own amount for just this month.
  const bills = { ...billsBase, rows: effectiveBills(billsBase.rows, monthAmounts.rows, month) }
  const view = monthView(totalIncome, bills.rows, target, month)
  const flex = flexView(flexBudget, expenses.rows, month)

  return {
    bills,
    billsBase,
    monthAmounts,
    income,
    payments,
    expenses,
    savings,
    budgets,
    checklist,
    settings,
    goalTax: Number(settings.get('goal_tax') ?? 0),
    goalTithe: Number(settings.get('goal_tithe') ?? 0),
    actualsFor: (m: string) => monthActuals(effectiveBills(billsBase.rows, monthAmounts.rows, m), payments.rows, expenses.rows, m),
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
