import type { Bill, BillPayment, Budget, Expense, SavingsEntry } from '../types'
import { monthView } from './finance'
import { normCategory } from './finance2'
import { cap, money, monthLabel, shiftMonthKey } from './format'

// ---------- A month's real numbers ----------

export interface MonthActuals {
  income: number
  spent: number
  transferOut: number
  hasBank: boolean
  spentByCategory: Record<string, number>
}

const kindOf = (e: Expense) => e.kind ?? 'expense'

/**
 * What actually happened in `month`: logged and imported items, plus bills ticked off as paid and paid
 * payoffs. Once bank transactions exist for a month they are trusted on their own (so nothing counts twice).
 */
export function monthActuals(bills: Bill[], payments: BillPayment[], expenses: Expense[], month: string): MonthActuals {
  const inMonth = expenses.filter((e) => e.date.slice(0, 7) === month)
  const hasBank = inMonth.some((e) => e.source === 'bank')
  const by: Record<string, number> = {}
  const add = (category: string, amount: number) => {
    const key = normCategory(category)
    by[key] = (by[key] ?? 0) + amount
  }
  let income = 0
  let transferOut = 0
  for (const e of inMonth) {
    const kind = kindOf(e)
    if (kind === 'income') income += e.amount
    else if (kind === 'transfer') transferOut += e.amount
    else add(e.category, e.amount)
  }
  if (!hasBank) {
    const byId = new Map(bills.map((b) => [b.id, b]))
    for (const p of payments) {
      const bill = byId.get(p.bill_id)
      if (p.month === month && bill && bill.kind === 'recurring') add(bill.category, bill.amount)
    }
    for (const b of bills) if (b.kind === 'one_time' && b.paid && b.due_month === month) add(b.category, b.amount)
  }
  return { income, spent: Object.values(by).reduce((s, n) => s + n, 0), transferOut, hasBank, spentByCategory: by }
}

export interface Kpis {
  realIncome: number
  spent: number
  net: number
  transferredOut: number
}

/** The four headline numbers. Income falls back to the configured contributions when none was logged. */
export function monthKpis(configuredIncome: number, a: MonthActuals, savedThisMonth: number): Kpis {
  const realIncome = a.income > 0 ? a.income : configuredIncome
  return { realIncome, spent: a.spent, net: realIncome - a.spent, transferredOut: a.transferOut + savedThisMonth }
}

export interface Share {
  category: string
  total: number
  pct: number
}

export function spendShares(byCategory: Record<string, number>): Share[] {
  const entries = Object.entries(byCategory).filter(([, total]) => total > 0)
  const sum = entries.reduce((s, [, total]) => s + total, 0)
  return entries
    .map(([category, total]) => ({ category, total, pct: Math.round((total / sum) * 100) }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
}

/** What the month's bills and payoffs were planned to cost, by category. */
export function plannedByCategory(bills: Bill[], month: string): Record<string, number> {
  const by: Record<string, number> = {}
  for (const b of bills) {
    if (b.kind === 'recurring' || b.due_month === month) {
      const key = normCategory(b.category)
      by[key] = (by[key] ?? 0) + b.amount
    }
  }
  return by
}

// ---------- One category in detail ----------

export interface BreakdownRow {
  label: string
  amount: number
  kind: 'bill' | 'payoff' | 'spent'
}

export interface Breakdown {
  category: string
  rows: BreakdownRow[]
  total: number
  previousTotal: number
  change: number
  /** False when there is nothing from last month to compare with (so "up from nothing" is not claimed). */
  hasPrevious: boolean
}

function breakdownRows(category: string, bills: Bill[], payments: BillPayment[], expenses: Expense[], month: string, planned: boolean): BreakdownRow[] {
  const rows: BreakdownRow[] = []
  if (planned) {
    for (const b of bills) {
      if ((b.kind === 'recurring' || b.due_month === month) && normCategory(b.category) === category) {
        rows.push({ label: b.name, amount: b.amount, kind: b.kind === 'one_time' ? 'payoff' : 'bill' })
      }
    }
  } else {
    const inMonth = expenses.filter((e) => e.date.slice(0, 7) === month)
    for (const e of inMonth) {
      if (kindOf(e) === 'expense' && normCategory(e.category) === category) rows.push({ label: e.note?.trim() || cap(category), amount: e.amount, kind: 'spent' })
    }
    if (!inMonth.some((e) => e.source === 'bank')) {
      const byId = new Map(bills.map((b) => [b.id, b]))
      for (const p of payments) {
        const bill = byId.get(p.bill_id)
        if (p.month === month && bill && bill.kind === 'recurring' && normCategory(bill.category) === category) rows.push({ label: bill.name, amount: bill.amount, kind: 'bill' })
      }
      for (const b of bills) {
        if (b.kind === 'one_time' && b.paid && b.due_month === month && normCategory(b.category) === category) rows.push({ label: b.name, amount: b.amount, kind: 'payoff' })
      }
    }
  }
  return rows.sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
}

/** What makes up one category in a month (planned bills, or what really happened), and how it compares with last month. */
export function categoryBreakdown(input: { category: string; bills: Bill[]; payments: BillPayment[]; expenses: Expense[]; month: string; planned: boolean }): Breakdown {
  const { category, bills, payments, expenses, month, planned } = input
  const rows = breakdownRows(category, bills, payments, expenses, month, planned)
  const total = rows.reduce((s, r) => s + r.amount, 0)
  const previous = shiftMonthKey(month, -1)
  const before = planned ? null : monthActuals(bills, payments, expenses, previous)
  const previousTotal = before ? (before.spentByCategory[category] ?? 0) : (plannedByCategory(bills, previous)[category] ?? 0)
  const hasPrevious = before ? before.spent > 0 : bills.length > 0
  return { category, rows, total, previousTotal, change: total - previousTotal, hasPrevious }
}

// ---------- Transfers and cancel tracker ----------

export interface TransferItem {
  key: string
  title: string
  sub: string
  amount: number
}

/** The money moves to make this month. Tax and tithe appear only when their percentages are set. */
export function transfersToMake(input: { income: number; taxPct: number; tithePct: number; savingsTarget: number; payoffsDue: Bill[] }): TransferItem[] {
  const { income, taxPct, tithePct, savingsTarget, payoffsDue } = input
  const tax = (income * taxPct) / 100
  const tithe = ((income - tax) * tithePct) / 100
  const items: TransferItem[] = [
    { key: 'deposit', title: `Deposit contributions into the joint account: ${money(income)}`, sub: 'both contributions in', amount: income },
  ]
  if (taxPct > 0) items.push({ key: 'tax', title: `Set aside for tax: ${money(tax)}`, sub: `${taxPct}% of income`, amount: tax })
  if (tithePct > 0) items.push({ key: 'tithe', title: `Tithe: ${money(tithe)}`, sub: `${tithePct}% after tax`, amount: tithe })
  items.push({ key: 'savings', title: `Move to savings: ${money(savingsTarget)}`, sub: 'the monthly savings target', amount: savingsTarget })
  for (const b of payoffsDue) items.push({ key: `payoff:${b.id}`, title: `Pay ${b.name}: ${money(b.amount)}`, sub: 'one-time payoff due this month', amount: b.amount })
  return items
}

/** Subscriptions marked "could cancel" (potential savings) and "cancelled" (already saved). */
export function cancelTracker(bills: Bill[]) {
  const recurring = bills.filter((b) => b.kind === 'recurring')
  const could = recurring.filter((b) => b.cancel_status === 'could')
  const cancelled = recurring.filter((b) => b.cancel_status === 'cancelled')
  const sum = (list: Bill[]) => list.reduce((s, b) => s + b.amount, 0)
  return {
    couldCancel: sum(could),
    cancelled: sum(cancelled),
    annualPotential: sum(could) * 12,
    annualSaved: sum(cancelled) * 12,
    couldCount: could.length,
    cancelledCount: cancelled.length,
  }
}

// ---------- Budget versus actual ----------

export function statusForRatio(ratio: number) {
  if (ratio <= 0.85) return { pill: 'crushed', label: 'CRUSHED IT' }
  if (ratio <= 1) return { pill: 'ontrack', label: 'ON TRACK' }
  if (ratio <= 1.1) return { pill: 'watch', label: 'WATCH IT' }
  return { pill: 'over', label: 'OVER BUDGET' }
}

const DEFAULT_CATEGORIES = ['dining', 'beauty', 'transport', 'travel', 'gifts', 'health', 'groceries', 'other']

export interface BudgetRow {
  category: string
  budget: number
  perMonth: number[]
  avg: number
  ratio: number
  status: { pill: string; label: string }
}

/** The budget for a category: a saved one, else what its monthly bills add up to. */
export function budgetFor(category: string, bills: Bill[], budgets: Budget[]): number {
  const saved = budgets.find((b) => normCategory(b.category) === category)
  if (saved) return saved.amount
  return bills.filter((b) => b.kind === 'recurring' && normCategory(b.category) === category).reduce((s, b) => s + b.amount, 0)
}

export function budgetRows(input: { bills: Bill[]; budgets: Budget[]; months: string[]; actuals: MonthActuals[] }): BudgetRow[] {
  const { bills, budgets, actuals } = input
  const names = new Set<string>(DEFAULT_CATEGORIES)
  for (const b of bills) if (b.kind === 'recurring') names.add(normCategory(b.category))
  for (const b of budgets) names.add(normCategory(b.category))
  for (const a of actuals) for (const c of Object.keys(a.spentByCategory)) names.add(c)
  const tracked = actuals.map((a) => a.spent > 0 || Object.values(a.spentByCategory).some((v) => v > 0))
  return [...names]
    .map<BudgetRow>((category) => {
      const budget = budgetFor(category, bills, budgets)
      const perMonth = actuals.map((a) => a.spentByCategory[category] ?? 0)
      const trackedValues = perMonth.filter((_, i) => tracked[i])
      const avg = trackedValues.length ? trackedValues.reduce((s, n) => s + n, 0) / trackedValues.length : 0
      const ratio = budget > 0 ? avg / budget : 0
      const status = budget === 0 ? { pill: 'nobudget', label: 'NO BUDGET' } : trackedValues.length === 0 ? { pill: 'nodata', label: 'NO DATA' } : statusForRatio(ratio)
      return { category, budget, perMonth, avg, ratio, status }
    })
    .sort((a, b) => Number(b.budget > 0) - Number(a.budget > 0) || b.budget - a.budget || a.category.localeCompare(b.category))
}

// ---------- Month by month ----------

export const monthWindow = (current: string, back: number, forward: number): string[] =>
  Array.from({ length: back + forward + 1 }, (_, i) => shiftMonthKey(current, i - back))

export interface SeriesRow {
  month: string
  income: number
  spent: number
  planned: number
  net: number
  hasData: boolean
}

export function monthSeries(input: { months: string[]; actuals: MonthActuals[]; income: number; bills: Bill[]; savings: SavingsEntry[] }): SeriesRow[] {
  return input.months.map((month, i) => {
    const a = input.actuals[i]
    const view = monthView(input.income, input.bills, 0, month)
    const saved = input.savings.filter((s) => s.month === month).reduce((s, e) => s + e.amount, 0)
    const income = a.income > 0 ? a.income : input.income
    return {
      month,
      income,
      spent: a.spent,
      planned: view.recurring + view.oneTime,
      net: income - a.spent,
      hasData: a.spent > 0 || a.income > 0 || a.transferOut > 0 || saved > 0,
    }
  })
}

export const categoryTrend = (category: string, actuals: MonthActuals[]): number[] =>
  actuals.map((a) => a.spentByCategory[normCategory(category)] ?? 0)

export interface Spike {
  category: string
  month: string
  value: number
  avg: number
  pctOver: number
}

/** Categories that jumped well above their usual in some month (top 3). */
export function topSpikes(months: string[], actuals: MonthActuals[]): Spike[] {
  const categories = new Set(actuals.flatMap((a) => Object.keys(a.spentByCategory)))
  const spikes: Spike[] = []
  for (const category of categories) {
    const values = categoryTrend(category, actuals)
    const nonZero = values.filter((v) => v > 0)
    const avg = nonZero.reduce((s, n) => s + n, 0) / nonZero.length
    values.forEach((value, i) => {
      if (avg > 20 && value > avg * 1.4) spikes.push({ category, month: months[i], value, avg, pctOver: Math.round((value / avg - 1) * 100) })
    })
  }
  return spikes.sort((a, b) => b.value - a.value).slice(0, 3)
}

// ---------- The transaction list ----------

export type LedgerKind = 'expense' | 'income' | 'transfer' | 'bill' | 'payoff' | 'savings'

export interface LedgerRow {
  id: string
  date: string
  description: string
  category: string
  amount: number // money in is positive, money out is negative
  kind: LedgerKind
  editable: boolean
}

export function ledgerRows(input: { month: string; expenses: Expense[]; payments: BillPayment[]; bills: Bill[]; savings: SavingsEntry[] }): LedgerRow[] {
  const { month, expenses, payments, bills, savings } = input
  const rows: LedgerRow[] = []
  for (const e of expenses.filter((x) => x.date.slice(0, 7) === month)) {
    const kind = kindOf(e)
    rows.push({
      id: e.id,
      date: e.date,
      description: e.note || cap(e.category),
      category: normCategory(e.category),
      amount: kind === 'income' ? e.amount : -e.amount,
      kind,
      editable: true,
    })
  }
  const byId = new Map(bills.map((b) => [b.id, b]))
  for (const p of payments.filter((x) => x.month === month)) {
    const bill = byId.get(p.bill_id)
    if (bill) rows.push({ id: `pay-${p.id}`, date: p.paid_on, description: bill.name, category: normCategory(bill.category), amount: -bill.amount, kind: 'bill', editable: false })
  }
  for (const b of bills.filter((x) => x.kind === 'one_time' && x.paid && x.due_month === month)) {
    rows.push({ id: `payoff-${b.id}`, date: `${month}-01`, description: b.name, category: normCategory(b.category), amount: -b.amount, kind: 'payoff', editable: false })
  }
  for (const s of savings.filter((x) => x.month === month)) {
    rows.push({ id: `save-${s.id}`, date: `${month}-01`, description: s.note ? `Savings: ${s.note}` : 'Savings', category: 'savings', amount: -s.amount, kind: 'savings', editable: false })
  }
  return rows
}

export interface LedgerFilter {
  search: string
  kind: 'all' | LedgerKind
  category: 'all' | string
  sort: 'date' | 'description' | 'category' | 'amount'
  dir: 'asc' | 'desc'
}

export function filterLedger(rows: LedgerRow[], f: LedgerFilter): LedgerRow[] {
  const q = f.search.trim().toLowerCase()
  const filtered = rows.filter(
    (r) =>
      (f.kind === 'all' || r.kind === f.kind) &&
      (f.category === 'all' || r.category === f.category) &&
      (!q || r.description.toLowerCase().includes(q) || r.category.includes(q)),
  )
  const sign = f.dir === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const cmp = f.sort === 'amount' ? a.amount - b.amount : String(a[f.sort]).localeCompare(String(b[f.sort]))
    return cmp * sign
  })
}

// ---------- Words about the numbers ----------

export type Tone = 'good' | 'bad' | 'warning' | 'neutral' | 'yellow'
export interface Callout {
  tone: Tone
  text: string
}

/** The takeaways shown on a month's overview. */
export function monthCallouts(input: { kpis: Kpis; shares: Share[]; budgets: Record<string, number>; couldCancelMonthly: number }): Callout[] {
  const { kpis, shares, budgets, couldCancelMonthly } = input
  const out: Callout[] = [
    kpis.net >= 0 ? { tone: 'good', text: `Net positive: +${money(kpis.net)} this month.` } : { tone: 'bad', text: `Net negative: ${money(kpis.net)} this month.` },
  ]
  if (shares[0]) out.push({ tone: 'neutral', text: `Biggest spending line this month: ${cap(shares[0].category)} at ${money(shares[0].total)}.` })
  const over = shares.filter((s) => (budgets[s.category] ?? 0) > 0 && s.total > (budgets[s.category] as number) * 1.1)
  if (over.length) out.push({ tone: 'warning', text: `Over budget on: ${over.map((s) => cap(s.category)).join(', ')}.` })
  if (couldCancelMonthly > 0) out.push({ tone: 'yellow', text: `Could cancel ${money(couldCancelMonthly)} a month - mark them in the Bills tab.` })
  return out
}

export interface InsightSection {
  title: string
  items: Callout[]
}

/** The longer story across every month with data. */
export function buildLedgerInsights(input: {
  series: SeriesRow[]
  spikes: Spike[]
  cancel: ReturnType<typeof cancelTracker>
  giving?: { monthly: number; pctOfIncome: number }
}): InsightSection[] {
  const tracked = input.series.filter((r) => r.hasData)
  const big: Callout[] = []
  const wins: Callout[] = []
  if (tracked.length === 0) {
    big.push({ tone: 'neutral', text: 'Nothing tracked yet — tick off bills and log spending to see the big picture.' })
  } else {
    const income = tracked.reduce((s, r) => s + r.income, 0)
    const net = tracked.reduce((s, r) => s + r.net, 0)
    const best = tracked.reduce((a, b) => (b.net > a.net ? b : a))
    const worst = tracked.reduce((a, b) => (b.net < a.net ? b : a))
    big.push({ tone: net >= 0 ? 'good' : 'bad', text: `You netted ${net >= 0 ? '+' : ''}${money(net)} across ${tracked.length} month${tracked.length === 1 ? '' : 's'}. Average ${money(net / tracked.length)}/month kept.` })
    if (income > 0) big.push({ tone: net >= 0 ? 'good' : 'bad', text: `Your real save rate is ${Math.round((net / income) * 100)}%.` })
    if (worst.net < 0) big.push({ tone: 'bad', text: `${monthLabel(worst.month)} was your toughest month at ${money(worst.net)}.` })
    wins.push({ tone: 'neutral', text: `${tracked.length}-month total net: ${net >= 0 ? '+' : ''}${money(net)}.` })
    wins.push({ tone: 'good', text: `${monthLabel(best.month)} was your best month: +${money(best.net)} net.` })
    if (worst.net < 0) wins.push({ tone: 'bad', text: `${monthLabel(worst.month)} was tough: net ${money(worst.net)}.` })
  }
  const callouts: Callout[] = input.spikes.map((s) => ({
    tone: 'warning',
    text: `${cap(s.category)} in ${monthLabel(s.month)} hit ${money(s.value)} — about ${s.pctOver}% over your usual ${money(s.avg)}.`,
  }))
  if (callouts.length === 0) callouts.push({ tone: 'neutral', text: 'No major category spikes yet — spending has stayed fairly consistent.' })
  const trends: Callout[] = []
  if (input.cancel.couldCancel > 0) trends.push({ tone: 'yellow', text: `${money(input.cancel.couldCancel)} a month (${money(input.cancel.annualPotential)} a year) is marked 'could cancel'.` })
  if (input.cancel.cancelled > 0) trends.push({ tone: 'good', text: `Already cancelled: ${money(input.cancel.cancelled)} a month (${money(input.cancel.annualSaved)} a year) saved.` })
  if (input.giving && input.giving.monthly > 0) trends.push({ tone: 'good', text: `You give ${money(input.giving.monthly)} a month (${input.giving.pctOfIncome}% of income).` })
  if (trends.length === 0) trends.push({ tone: 'neutral', text: 'No trends to flag yet.' })
  return [
    { title: 'Big picture', items: big },
    { title: 'Category callouts', items: callouts },
    { title: 'Trends to watch', items: trends },
    { title: 'Big wins / big losses', items: wins.length ? wins : [{ tone: 'neutral', text: 'Wins and losses show up once a month has data.' }] },
  ]
}
