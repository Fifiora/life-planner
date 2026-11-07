import type { Bill, BillPayment, Expense, SavingsEntry } from '../types'
import { daysBetween } from './dates'
import { monthView, type MonthView } from './finance'
import { cap, money, monthLabel, shiftMonthKey } from './format'

/** Categories are typed by hand, so compare them tidied up: "Food", "food " and "food" are one. */
export const normCategory = (category: string | undefined) => (category ?? '').trim().toLowerCase() || 'other'

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
    const key = normCategory(b.category)
    const cur = map.get(key) ?? { total: 0, count: 0 }
    map.set(key, { total: cur.total + b.amount, count: cur.count + 1 })
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

/** What was really paid on a bill for a month: the amount typed in, else the bill's own amount (0 when not paid). */
export const paymentAmount = (bill: Bill, payment?: BillPayment) => (payment ? (payment.amount ?? bill.amount) : 0)

/** What has really been paid on a one-time payoff: all of it once cleared (or what was typed), else the part paid. */
export const payoffPaid = (bill: Bill) => (bill.paid ? (bill.paid_amount ?? bill.amount) : (bill.paid_amount ?? 0))

/** What to save on a payment when an amount is typed in (the full bill amount means "no amount"). */
export const paymentPatch = (bill: Bill, amount: number): Partial<BillPayment> => ({ amount: amount === bill.amount ? null : amount })

/** What to save on a payoff when an amount paid is typed in: cleared at the full amount, part-paid below it. */
export const payoffPatch = (bill: Bill, amount: number): Partial<Bill> =>
  amount >= bill.amount ? { paid: true, paid_amount: amount === bill.amount ? null : amount } : { paid: false, paid_amount: amount }

/** Money paid per monthly bill for `month`, adding up every payment recorded for it. */
export function paidPerBill(bills: Bill[], payments: BillPayment[], month: string): Map<string, number> {
  const byId = new Map(bills.map((b) => [b.id, b]))
  const out = new Map<string, number>()
  for (const p of payments) {
    const bill = byId.get(p.bill_id)
    if (p.month === month && bill && bill.kind === 'recurring') out.set(bill.id, (out.get(bill.id) ?? 0) + paymentAmount(bill, p))
  }
  return out
}

export interface PayoffItem {
  bill: Bill
  status: 'paid' | 'partial' | 'overdue' | 'upcoming'
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
    status: bill.paid ? 'paid' : (bill.due_month ?? '') < thisMonth ? 'overdue' : payoffPaid(bill) > 0 ? 'partial' : 'upcoming',
  }))
  const total = list.reduce((s, b) => s + b.amount, 0)
  const paid = list.reduce((s, b) => s + payoffPaid(b), 0)
  return {
    total,
    paid,
    remaining: list.reduce((s, b) => s + Math.max(0, b.amount - payoffPaid(b)), 0),
    pct: total === 0 ? 100 : Math.min(100, Math.round((paid / total) * 100)),
    daysLeft: daysBetween(today, deadline),
    overdue: items.filter((i) => i.status === 'overdue').map((i) => i.bill),
    items,
  }
}

/** Which monthly bills have been paid for `month`, and how much money that is (part payments count for what they were). */
export function billsPaidSummary(bills: Bill[], payments: BillPayment[], month: string) {
  const recurring = bills.filter((b) => b.kind === 'recurring')
  const paidBy = paidPerBill(bills, payments, month)
  const paidOf = (b: Bill) => paidBy.get(b.id) ?? 0
  const full = recurring.filter((b) => paidBy.has(b.id) && paidOf(b) >= b.amount)
  return {
    paidCount: full.length,
    totalCount: recurring.length,
    paidAmount: recurring.reduce((s, b) => s + paidOf(b), 0),
    totalAmount: recurring.reduce((s, b) => s + b.amount, 0),
    toGoAmount: recurring.reduce((s, b) => s + Math.max(0, b.amount - paidOf(b)), 0),
    partial: recurring.filter((b) => paidOf(b) > 0 && paidOf(b) < b.amount),
    unpaid: recurring.filter((b) => !(paidBy.has(b.id) && paidOf(b) >= b.amount)),
  }
}

/** Money paid against everything due in `month`: the monthly bills plus the payoffs due that month. */
export function monthPaidProgress(bills: Bill[], payments: BillPayment[], month: string) {
  const summary = billsPaidSummary(bills, payments, month)
  const due = bills.filter((b) => b.kind === 'one_time' && b.due_month === month)
  const paid = summary.paidAmount + due.reduce((s, b) => s + payoffPaid(b), 0)
  const planned = summary.totalAmount + due.reduce((s, b) => s + b.amount, 0)
  const toGo = summary.toGoAmount + due.reduce((s, b) => s + Math.max(0, b.amount - payoffPaid(b)), 0)
  return { paid, planned, toGo, pct: planned > 0 ? Math.min(100, Math.round((paid / planned) * 100)) : 0 }
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

/** Savings are tracked from the configured month, or earlier if something was put aside before it. */
export const trackingStart = (entries: SavingsEntry[], configured: string) =>
  [configured, ...entries.map((e) => e.month)].sort()[0]

/** New expenses default to today, or to the 1st of the month being looked at. */
export const defaultExpenseDate = (month: string, today: string) => (today.startsWith(month) ? today : `${month}-01`)

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
  if (payoff.remaining > 0) {
    const when = payoff.daysLeft >= 0 ? `${payoff.daysLeft} days to go` : `${-payoff.daysLeft} days past the deadline`
    lines.push(`${money(payoff.remaining)} of payoffs still to pay, ${when}.`)
  }
  else if (payoff.total > 0) lines.push('All payoffs cleared 🎉')
  return lines
}
