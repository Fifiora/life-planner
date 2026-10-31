import type { FinanceData } from '../../data/useFinance'
import { monthKeyCT } from '../../lib/dates'
import { categoryTotals } from '../../lib/finance2'
import { buildLedgerInsights, cancelTracker, monthSeries, monthWindow, topSpikes } from '../../lib/ledger'
import { Callouts } from '../../ui/Callouts'
import { Verse } from '../../ui/Verse'

export function Insights({ f }: { f: FinanceData }) {
  const months = monthWindow(monthKeyCT(), 5, 0)
  const actuals = months.map((m) => f.actualsFor(m))
  const series = monthSeries({ months, actuals, income: f.totalIncome, bills: f.bills.rows, savings: f.savings.rows })
  const giving = categoryTotals(f.bills.rows, f.totalIncome).find((c) => c.category === 'giving')
  const sections = buildLedgerInsights({
    series,
    spikes: topSpikes(months, actuals),
    cancel: cancelTracker(f.bills.rows),
    giving: giving ? { monthly: giving.total, pctOfIncome: giving.pctOfIncome } : undefined,
  })
  return (
    <>
      <section className="card">
        {sections.map((s) => (
          <div key={s.title}>
            <div className="subheader">{s.title}</div>
            <Callouts items={s.items} />
          </div>
        ))}
      </section>
      <Verse text="But my God shall supply all your need according to his riches in glory by Christ Jesus." reference="Philippians 4:19" />
    </>
  )
}
