import { useState } from 'react'
import type { FinanceData } from '../../data/useFinance'
import { useHousehold } from '../../data/household'
import { monthKeyCT, todayCT } from '../../lib/dates'
import { buildInsights, categoryTotals, forecast, payoffProgress } from '../../lib/finance2'
import { money, monthLabel } from '../../lib/format'
import { CategoryBars } from '../../ui/CategoryBars'
import { PayoffCard } from '../../ui/PayoffCard'
import { SavingsBar } from '../../ui/SavingsBar'
import { Sheet } from '../../ui/Sheet'

export function Overview({ f }: { f: FinanceData }) {
  const { readOnly } = useHousehold()
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [incomeDraft, setIncomeDraft] = useState('')
  const { view, totalIncome, target, projected, flex } = f

  const categories = categoryTotals(f.bills.rows, totalIncome)
  const subscriptions = categories.find((c) => c.category === 'subscriptions')
  const payoff = payoffProgress(f.bills.rows, todayCT(), f.deadline)
  const rows = forecast(totalIncome, f.bills.rows, target, monthKeyCT(), 8)
  const insights = buildInsights({ rows, categories, payoff, target })

  async function saveIncome() {
    const amount = Number(incomeDraft)
    if (!Number.isFinite(amount) || amount < 0) return
    const first = f.income.rows[0]
    if (first) await f.income.update(first.id, { monthly_amount: amount })
    else await f.income.insert({ name: 'Combined contributions', monthly_amount: amount })
    setIncomeOpen(false)
  }

  return (
    <>
      <section className="card">
        <div className="stat-grid">
          {readOnly ? (
            <div className="stat"><span className="cap">Income</span><span className="num">{money(totalIncome)}</span></div>
          ) : (
            <button type="button" className="stat" onClick={() => { setIncomeDraft(String(totalIncome)); setIncomeOpen(true) }}>
              <span className="cap">Income (tap to edit)</span>
              <span className="num">{money(totalIncome)}</span>
            </button>
          )}
          <div className="stat"><span className="cap">Monthly bills</span><span className="num">{money(view.recurring)}</span></div>
          <div className="stat"><span className="cap">One-time this month</span><span className="num">{money(view.oneTime)}</span></div>
          <div className="stat">
            <span className="cap">Left after bills</span>
            <span className="num" style={{ color: view.available < 0 ? 'var(--danger)' : undefined }}>{money(view.available)}</span>
          </div>
        </div>
        <div className="mt"><SavingsBar savings={projected} target={target} /></div>
        {flex.spent > 0 && <p className="muted small">Includes {money(flex.spent)} of extra spending logged this month.</p>}
        {totalIncome === 0 ? (
          <p className="callout">Add your monthly income (tap the Income box) to see what's left each month.</p>
        ) : view.deficit > 0 ? (
          <p className="callout bad">Over by {money(view.deficit)} — move a one-time payment to another month.</p>
        ) : projected < target ? (
          <p className="callout">{money(target - projected)} below the savings target — move a payoff or trim spending.</p>
        ) : (
          <p className="callout ok">Savings target on track this month 🎉</p>
        )}
      </section>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Where the money goes</h2></div></div>
        <CategoryBars rows={categories} />
      </section>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Debt payoff</h2></div></div>
        <PayoffCard payoff={payoff} deadlineLabel={new Date(`${f.deadline}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} />
      </section>

      {subscriptions && (
        <section className="card">
          <h2>Subscriptions</h2>
          <p>{subscriptions.count} subscriptions cost <strong>{money(subscriptions.total)}</strong> a month — <strong>{money(subscriptions.total * 12)}</strong> a year.</p>
        </section>
      )}

      {insights.length > 0 && (
        <section className="card">
          <h2>What stands out</h2>
          <ul className="insights">{insights.map((line) => <li key={line}>{line}</li>)}</ul>
          <p className="muted small">Looking at {monthLabel(rows[0].month)} onward.</p>
        </section>
      )}

      <Sheet open={incomeOpen} onClose={() => setIncomeOpen(false)} title="Monthly income">
        <label className="label" htmlFor="income-amount">Combined monthly contributions</label>
        <input id="income-amount" className="input" inputMode="decimal" value={incomeDraft} onChange={(e) => setIncomeDraft(e.target.value)} />
        <div className="actions"><button type="button" className="btn btn-primary" onClick={saveIncome}>Save</button></div>
      </Sheet>
    </>
  )
}
