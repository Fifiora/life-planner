import type { FinanceData } from '../../data/useFinance'
import { monthKeyCT, todayCT } from '../../lib/dates'
import { buildInsights, categoryTotals, forecast, payoffProgress } from '../../lib/finance2'
import { effectiveBills } from '../../lib/monthBills'
import { ForecastTable } from '../../ui/ForecastTable'

export function Plan({ f }: { f: FinanceData }) {
  const rows = forecast(f.totalIncome, f.billsBase.rows, f.target, monthKeyCT(), 8, (m) => effectiveBills(f.billsBase.rows, f.monthAmounts.rows, m))
  const categories = categoryTotals(f.bills.rows, f.totalIncome)
  const insights = buildInsights({ rows, categories, payoff: payoffProgress(f.bills.rows, todayCT(), f.deadline), target: f.target })
  return (
    <>
      <section className="card wide">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Next 8 months</h2></div></div>
        <p className="muted small">What you can put aside each month after bills and scheduled payoffs, against your savings target. Figures are before any extra spending you log. Change a payoff's due month under Bills to see it move.</p>
        <ForecastTable rows={rows} target={f.target} />
      </section>
      {insights.length > 0 && (
        <section className="card">
          <h2>What stands out</h2>
          <ul className="insights">{insights.map((line) => <li key={line}>{line}</li>)}</ul>
        </section>
      )}
    </>
  )
}
