import { useState } from 'react'
import type { FinanceData } from '../../data/useFinance'
import { monthKeyCT } from '../../lib/dates'
import { normCategory } from '../../lib/finance2'
import { cap, money, monthLabel } from '../../lib/format'
import { categoryTrend, monthSeries, monthWindow } from '../../lib/ledger'
import { GroupedBars } from '../../ui/GroupedBars'
import { TrendBars } from '../../ui/TrendBars'
import { Verse } from '../../ui/Verse'

export function MonthVsMonth({ f }: { f: FinanceData }) {
  const months = monthWindow(monthKeyCT(), 3, 4)
  const actuals = months.map((m) => f.actualsFor(m))
  const series = monthSeries({ months, actuals, income: f.totalIncome, bills: f.bills.rows, savings: f.savings.rows })

  const names = new Set<string>()
  for (const b of f.bills.rows) if (b.kind === 'recurring') names.add(normCategory(b.category))
  for (const a of actuals) for (const c of Object.keys(a.spentByCategory)) names.add(c)
  const categories = [...names].sort()
  const [picked, setPicked] = useState<string | null>(null)
  const category = picked && names.has(picked) ? picked : categories[0]

  return (
    <>
      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Income vs spend</h2></div></div>
        <GroupedBars rows={series} />
      </section>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Net by month</h2></div></div>
        <div className="tiles">
          {series.map((r) => (
            <div key={r.month} className={`tile ${!r.hasData ? 'empty' : r.net >= 0 ? 'good' : 'bad'}`}>
              <span className="tile-label">{monthLabel(r.month).slice(0, 3)}</span>
              <strong>{r.hasData ? `${r.net >= 0 ? '+' : ''}${money(r.net)}` : '—'}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Category trend</h2></div></div>
        {categories.length === 0 ? (
          <p className="muted small">Add bills or log spending to see categories here.</p>
        ) : (
          <>
            <div className="pill-row" aria-label="Category">
              {categories.map((c) => (
                <button key={c} type="button" className={`mpill${c === category ? ' active' : ''}`} aria-pressed={c === category} onClick={() => setPicked(c)}>{cap(c)}</button>
              ))}
            </div>
            <TrendBars label={cap(category)} months={months} values={categoryTrend(category, actuals)} />
          </>
        )}
      </section>

      <Verse text="Wealth gotten by vanity shall be diminished: but he that gathereth by labour shall increase." reference="Proverbs 13:11" />
    </>
  )
}
