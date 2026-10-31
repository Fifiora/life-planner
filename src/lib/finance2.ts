import type { Bill, BillPayment, Expense, SavingsEntry } from '../types'
import { daysBetween } from './dates'
import { monthView, type MonthView } from './finance'
import { cap, money, monthLabel, shiftMonthKey } from './format'

export interface CategoryTotal {
  category: string
  total: number
  count: number
  pctOfIncome: number
}

/** Monthly bills added up by category, biggest first, with each one's share of income. */
export function categoryTotals(bills: Bill[], income: number): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const b of bills) {
    if (b.kind !== 'recurring') continue
    const cur = map.get(b.category) ?? { total: 0, count: 0 }
    map.set(b.category, { total: cur.total + b.amount, count: cur.count + 1 })
  }
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      total: v.total,
      count: v.count,
      pctOfIncome: income > 0 ? Math.round((v.total / income) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
}

export type ForecastRow = MonthView & { month: string }

/** The next `count` months starting at `startMonth`, each worked out like a single month. */
export function forecast(income: number, bills: Bill[], target: number, startMonth: string, count: number): ForecastRow[] {
  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonthKey(startMonth, i)
    return { month, ...monthView(income, bills, target, month) }
  })
}

export interface PayoffItem {
  bill: Bill
  status: 'paid' | 'overdue' | 'upcoming'
}

export interface PayoffProgress {
  total: number
  paid: number
  remaining: number
  pct: number
  daysLeft: number
  overdue: Bill[]
  items: PayoffItem[]
}

/** How far the one-time payoffs have got, and what is late. */
export function payoffProgress(bills: Bill[], today: string, deadline: string): PayoffProgress {
  const thisMonth = today.slice(0, 7)
  const list = bills
    .filter((b) => b.kind === 'one_time')
    .sort((a, b) => (a.due_month ?? '').localeCompare(b.due_month ?? '') || a.name.localeCompare(b.name))
  const items = list.map<PayoffItem>((bill) => ({
    bill,
    status: bill.paid ? 'paid' : (bill.due_month ?? '') < thisMonth ? 'overdue' : 'upcoming',
  }))
  const total = list.reduce((s, b) => s + b.amount, 0)
  const paid = list.filter((b) => b.paid).reduce((s, b) => s + b.amount, 0)
  return {
    total,
    paid,
    remaining: total - paid,
    pct: total === 0 ? 100 : Math.round((paid / total) * 100),
    daysLeft: daysBetween(today, deadline),
    overdue: items.filter((i) => i.status === 'overdue').map((i) => i.bill),
    items,
  }
}

/** Which monthly bills have been ticked off as paid for `month`. */
export function billsPaidSummary(bills: Bill[], payments: BillPayment[], month: string) {
  const recurring = bills.filter((b) => b.kind === 'recurring')
  const paidIds = new Set(payments.filter((p) => p.month === month).map((p) => p.bill_id))
  const paid = recurring.filter((b) => paidIds.has(b.id))
  return {
    paidCount: paid.length,
    totalCount: recurring.length,
    paidAmount: paid.reduce((s, b) => s + b.amount, 0),
    totalAmount: recurring.reduce((s, b) => s + b.amount, 0),
    unpaid: recurring.filter((b) => !paidIds.has(b.id)),
  }
}

/** This month's extra spending against its budget; groceries are tracked apart (they have their own bill). */
export function flexView(budget: number, expenses: Expense[], month: string) {
  const inMonth = expenses.filter((e) => e.date.slice(0, 7) === month)
  const byCat = new Map<string, number>()
  let groceries = 0
  for (const e of inMonth) {
    if (e.category === 'groceries') groceries += e.amount
    else byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount)
  }
  const spent = [...byCat.values()].reduce((s, n) => s + n, 0)
  return {
    budget,
    spent,
    left: budget - spent,
    overBy: Math.max(0, spent - budget),
    groceries,
    byCategory: [...byCat.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category)),
  }
}

/** What will actually be saved once extra spending is taken out. */
export const projectedSavings = (available: number, flexSpent: number, target: number) =>
  Math.max(0, Math.min(available - flexSpent, target))

/** Money put aside so far against the target for every month since `startMonth`. */
export function savingsProgress(entries: SavingsEntry[], target: number, startMonth: string, month: string) {
  const index = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7))
  const months = Math.max(0, index(month) - index(startMonth) + 1)
  const within = entries.filter((e) => e.month >= startMonth && e.month <= month)
  const savedToDate = within.reduce((s, e) => s + e.amount, 0)
  const targetToDate = target * months
  return {
    savedToDate,
    targetToDate,
    thisMonth: entries.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0),
    gap: targetToDate - savedToDate,
    pct: targetToDate > 0 ? Math.round((savedToDate / targetToDate) * 100) : 0,
  }
}

/** A few plain-language takeaways from the numbers. */
export function buildInsights(input: { rows: ForecastRow[]; categories: CategoryTotal[]; payoff: PayoffProgress; target: number }): string[] {
  const { rows, categories, payoff, target } = input
  const lines: string[] = []
  const short = rows.find((r) => r.shortfall > 0)
  if (short) {
    lines.push(
      short.oneTime > 0
        ? `${monthLabel(short.month)} is ${money(short.shortfall)} short of the ${money(target)} savings target because ${money(short.oneTime)} of payoffs are due.`
        : `${monthLabel(short.month)} is ${money(short.shortfall)} short of the ${money(target)} savings target: bills leave ${money(short.available)}.`,
    )
  }
  const clear = rows.find((r) => r.oneTime === 0 && r.shortfall === 0)
  if (clear) lines.push(`From ${monthLabel(clear.month)}, ${money(clear.available - target)} is left each month after bills and savings.`)
  if (categories[0]) {
    lines.push(`${cap(categories[0].category)} is your biggest expense: ${money(categories[0].total)} (${categories[0].pctOfIncome}% of income).`)
  }
  if (payoff.remaining > 0) lines.push(`${money(payoff.remaining)} of payoffs still to pay, ${payoff.daysLeft} days to go.`)
  else if (payoff.total > 0) lines.push('All payoffs cleared 🎉')
  return lines
}
