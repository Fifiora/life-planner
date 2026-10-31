import { useState } from 'react'
import type { FinanceData } from '../../data/useFinance'
import { useHousehold } from '../../data/household'
import { todayCT } from '../../lib/dates'
import { categoryTotals, payoffProgress } from '../../lib/finance2'
import { money, monthLabel } from '../../lib/format'
import { budgetFor, cancelTracker, monthCallouts, monthKpis, plannedByCategory, spendShares, transfersToMake } from '../../lib/ledger'
import { Callouts } from '../../ui/Callouts'
import { Donut } from '../../ui/Donut'
import { PayoffCard } from '../../ui/PayoffCard'
import { SavingsBar } from '../../ui/SavingsBar'
import { Sheet } from '../../ui/Sheet'
import { Verse } from '../../ui/Verse'

export function Overview({ f, month }: { f: FinanceData; month: string }) {
  const { readOnly } = useHousehold()
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [incomeDraft, setIncomeDraft] = useState('')
  const { view, totalIncome, target, projected, flex } = f

  const actuals = f.actualsFor(month)
  const saved = f.savings.rows.filter((s) => s.month === month).reduce((s, e) => s + e.amount, 0)
  const kpis = monthKpis(totalIncome, actuals, saved)
  const usingPlan = actuals.spent === 0
  const shares = spendShares(usingPlan ? plannedByCategory(f.bills.rows, month) : actuals.spentByCategory)
  const cancel = cancelTracker(f.bills.rows)
  const payoff = payoffProgress(f.bills.rows, todayCT(), f.deadline)
  const subscriptions = categoryTotals(f.bills.rows, totalIncome).find((c) => c.category === 'subscriptions')
  const dueNow = f.bills.rows.filter((b) => b.kind === 'one_time' && !b.paid && b.due_month === month)
  const transfers = transfersToMake({ income: totalIncome, taxPct: f.goalTax, tithePct: f.goalTithe, savingsTarget: target, payoffsDue: dueNow })
  const budgetMap = Object.fromEntries(shares.map((s) => [s.category, budgetFor(s.category, f.bills.rows, f.budgets.rows)]))
  const callouts = monthCallouts({ kpis, shares, budgets: budgetMap, couldCancelMonthly: cancel.couldCancel })

  const done = (key: string) => f.checklist.rows.some((c) => c.month === month && c.key === key && c.done)
  async function toggleTransfer(key: string) {
    const existing = f.checklist.rows.find((c) => c.month === month && c.key === key)
    if (existing) await f.checklist.update(existing.id, { done: !existing.done })
    else await f.checklist.insert({ month, key, done: true })
  }

  async function saveIncome() {
    const amount = Number(incomeDraft)
    if (!Number.isFinite(amount) || amount < 0) return
    const first = f.income.rows[0]
    if (first) await f.income.update(first.id, { monthly_amount: amount })
    else await f.income.insert({ name: 'Combined contributions', monthly_amount: amount })
    setIncomeOpen(false)
  }

  const cards = [
    { label: 'Real income', value: kpis.realIncome, cls: 'green', sub: actuals.income > 0 ? 'logged income' : 'monthly contributions' },
    { label: 'Spent', value: kpis.spent, cls: 'red', sub: actuals.spent > 0 ? 'bills paid + logged spending' : 'nothing recorded yet' },
    { label: 'Net', value: kpis.net, cls: kpis.net >= 0 ? 'green' : 'red', sub: 'income - spent' },
    { label: 'Moved to savings', value: kpis.transferredOut, cls: '', sub: 'savings + transfers' },
  ]

  return (
    <>
      <div className="kpi-row">
        {cards.map((c) => (
          <div key={c.label} className="kpi-card">
            <div className="kpi-label">{c.label}</div>
            <div className={`kpi-value ${c.cls}`}>{money(c.value)}</div>
            <div className="kpi-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Spending by category</h2></div>{usingPlan && <span className="pill">planned</span>}</div>
        <Donut shares={shares} centerLabel={money(shares.reduce((s, x) => s + x.total, 0))} />
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Transfers to make</h2></div>
          <span className="muted small">Check off as you transfer</span>
        </div>
        <ul className="list">
          {transfers.map((t) => (
            <li key={t.key} className="list-row">
              <input type="checkbox" className="tick" checked={done(t.key)} disabled={readOnly} aria-label={t.title} onChange={() => void toggleTransfer(t.key)} />
              <span className="grow" style={{ opacity: done(t.key) ? 0.55 : 1, textDecoration: done(t.key) ? 'line-through' : undefined }}>
                <strong>{t.title}</strong>
                <span className="muted small block-text">{t.sub}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Savings tracker</h2></div><span className="muted small">Yellow = could cancel · Green = already saved</span></div>
        <div className="row2">
          <div className="savings-card yellow">
            <div className="savings-label">Could cancel (potential)</div>
            <div className="savings-amount">{money(cancel.couldCancel)}</div>
            <span className="muted small">{cancel.couldCount} bill{cancel.couldCount === 1 ? '' : 's'} a month</span>
          </div>
          <div className="savings-card green">
            <div className="savings-label">Cancelled (already saved)</div>
            <div className="savings-amount">{money(cancel.cancelled)}</div>
            <span className="muted small">{cancel.cancelledCount} bill{cancel.cancelledCount === 1 ? '' : 's'} a month</span>
          </div>
        </div>
        <p className="muted small mt">
          {cancel.couldCancel > 0 ? `If you cancel everything marked 'could cancel', you save ${money(cancel.annualPotential)} a year.` : "Mark subscriptions you could cancel in the Bills tab and the yearly saving shows here."}
        </p>
      </section>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>The plan for {monthLabel(month)}</h2></div></div>
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
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Debt payoff</h2></div></div>
        <PayoffCard payoff={payoff} deadlineLabel={new Date(`${f.deadline}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })} />
      </section>

      {subscriptions && (
        <section className="card">
          <h2>Subscriptions</h2>
          <p>{subscriptions.count} subscriptions cost <strong>{money(subscriptions.total)}</strong> a month — <strong>{money(subscriptions.total * 12)}</strong> a year.</p>
        </section>
      )}

      <section className="card">
        <h2>Insights for {monthLabel(month)}</h2>
        <Callouts items={callouts} />
      </section>

      <Verse text="But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you." reference="Matthew 6:33" />

      <Sheet open={incomeOpen} onClose={() => setIncomeOpen(false)} title="Monthly income">
        <label className="label" htmlFor="income-amount">Combined monthly contributions</label>
        <input id="income-amount" className="input" inputMode="decimal" value={incomeDraft} onChange={(e) => setIncomeDraft(e.target.value)} />
        <div className="actions"><button type="button" className="btn btn-primary" onClick={saveIncome}>Save</button></div>
      </Sheet>
    </>
  )
}
