import { useTable } from '../data/useTable'
import { monthKeyCT } from '../lib/dates'
import { flexView, normCategory } from '../lib/finance2'
import { money } from '../lib/format'
import type { Bill, Expense } from '../types'

/** What has been spent on groceries this month against the groceries bill. */
export function GroceryBudget() {
  const bills = useTable<Bill>('bills')
  const expenses = useTable<Expense>('expenses')
  const budget = bills.rows.filter((b) => b.kind === 'recurring' && normCategory(b.category) === 'food').reduce((s, b) => s + b.amount, 0)
  const spent = flexView(0, expenses.rows, monthKeyCT()).groceries
  const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0
  return (
    <section className="card">
      <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--food)' }} /><h2>Groceries budget</h2></div></div>
      {budget === 0 ? (
        <p className="muted small">Add a monthly bill in the "food" category to track a groceries budget.</p>
      ) : (
        <>
          <div className="bar" role="progressbar" aria-label="Groceries spent this month" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div className="bar-fill" style={{ width: `${pct}%`, background: spent > budget ? 'var(--danger)' : undefined }} />
          </div>
          <p className="bar-text">{money(spent)} spent of {money(budget)} · <strong>{spent > budget ? `${money(spent - budget)} over` : `${money(budget - spent)} left`}</strong></p>
        </>
      )}
      <p className="muted small">Log receipts in Finance → Spending (category Groceries).</p>
    </section>
  )
}
