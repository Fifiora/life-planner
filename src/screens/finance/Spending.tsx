import { useEffect, useState, type FormEvent } from 'react'
import type { FinanceData } from '../../data/useFinance'
import { useHousehold } from '../../data/household'
import { todayCT } from '../../lib/dates'
import { defaultExpenseDate } from '../../lib/finance2'
import { cap, money } from '../../lib/format'

export const EXPENSE_CATEGORIES: [string, string][] = [
  ['dining', 'Eating out / dates'],
  ['beauty', 'Nails, salon & massage'],
  ['travel', 'Trips'],
  ['car', 'Car'],
  ['gifts', 'Gifts'],
  ['health', 'Health'],
  ['groceries', 'Groceries'],
  ['other', 'Other'],
]
const labelOf = (key: string) => EXPENSE_CATEGORIES.find(([k]) => k === key)?.[1] ?? cap(key)

export function Spending({ f, month }: { f: FinanceData; month: string }) {
  const { me, readOnly } = useHousehold()
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('dining')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => defaultExpenseDate(month, todayCT()))
  useEffect(() => setDate(defaultExpenseDate(month, todayCT())), [month])
  const [error, setError] = useState<string | null>(null)
  const [budget, setBudget] = useState<string | null>(null)

  const { flex } = f
  const pct = flex.budget > 0 ? Math.min(100, Math.round((flex.spent / flex.budget) * 100)) : flex.spent > 0 ? 100 : 0
  const list = f.expenses.rows.filter((e) => e.date.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date))

  async function add(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0)) return setError('Enter an amount greater than 0.')
    setError(null)
    await f.expenses.insert({ date: date || todayCT(), amount: n, category, note: note.trim(), member_id: me.id })
    setAmount('')
    setNote('')
  }

  return (
    <>
      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Extra spending budget</h2></div></div>
        <p className="muted small">Dates, salon, nails, trips, the car — anything outside the monthly bills. It comes out of what's left after bills, so it lowers savings.</p>
        <div className="bar mt" role="progressbar" aria-label="Extra spending used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="bar-fill" style={{ width: `${pct}%`, background: flex.overBy > 0 ? 'var(--danger)' : undefined }} />
        </div>
        <p className="bar-text">
          {money(flex.spent)} spent of {money(flex.budget)} ·{' '}
          <strong>{flex.overBy > 0 ? `${money(flex.overBy)} over` : `${money(flex.left)} left`}</strong>
        </p>
        {flex.byCategory.length > 0 && (
          <ul className="list">
            {flex.byCategory.map((c) => (
              <li key={c.category} className="list-row"><span className="grow">{labelOf(c.category)}</span><strong>{money(c.total)}</strong></li>
            ))}
          </ul>
        )}
        {flex.groceries > 0 && <p className="muted small">Groceries logged: {money(flex.groceries)} (tracked against the groceries bill, not this budget).</p>}
        {!readOnly && (
          <>
            <label className="label" htmlFor="flex-budget">Monthly extra-spending budget ($)</label>
            <input
              id="flex-budget"
              className="input"
              inputMode="decimal"
              value={budget ?? String(f.flexBudget)}
              onChange={(e) => setBudget(e.target.value)}
              onBlur={() => {
                if (budget !== null && budget.trim() !== '' && Number(budget) >= 0) void f.settings.set('flex_budget', String(Number(budget)))
                setBudget(null)
              }}
            />
          </>
        )}
        <p className="callout">Projected savings this month: <strong>{money(f.projected)}</strong> of {money(f.target)}</p>
      </section>

      <section className="card">
        <h2>Add an expense</h2>
        <form onSubmit={add} noValidate>
          <div className="row2">
            <div>
              <label className="label" htmlFor="exp-amount">Amount</label>
              <input id="exp-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="exp-category">Category</label>
              <select id="exp-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="row2">
            <div>
              <label className="label" htmlFor="exp-note">Note</label>
              <input id="exp-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="exp-date">Date</label>
              <input id="exp-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" className="btn btn-primary block mt">Add expense</button>
        </form>
      </section>

      <section className="card">
        <h2>This month's expenses</h2>
        {list.length === 0 ? <p className="muted small">Nothing logged yet.</p> : (
          <ul className="list">
            {list.map((e) => (
              <li key={e.id} className="list-row">
                <span className="grow">
                  <strong>{e.note || labelOf(e.category)}</strong>
                  <span className="muted small block-text">{labelOf(e.category)} · {e.date}</span>
                </span>
                <span style={{ fontWeight: 600 }}>{money(e.amount)}</span>
                <button type="button" className="icon-btn" aria-label={`Delete expense ${e.note || labelOf(e.category)}`} onClick={() => f.expenses.remove(e.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
