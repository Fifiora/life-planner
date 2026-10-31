import type { FinanceData } from '../../data/useFinance'
import { useHousehold } from '../../data/household'
import { monthKeyCT } from '../../lib/dates'
import { normCategory } from '../../lib/finance2'
import { cap, money, monthLabel } from '../../lib/format'
import { budgetRows, monthWindow } from '../../lib/ledger'
import { Verse } from '../../ui/Verse'

export function Budget({ f }: { f: FinanceData }) {
  const { readOnly } = useHousehold()
  const months = monthWindow(monthKeyCT(), 5, 0)
  const actuals = months.map((m) => f.actualsFor(m))
  const rows = budgetRows({ bills: f.bills.rows, budgets: f.budgets.rows, months, actuals })
  const counts = { under: 0, watch: 0, over: 0 }
  for (const r of rows) {
    if (r.status.pill === 'crushed' || r.status.pill === 'ontrack') counts.under++
    else if (r.status.pill === 'watch') counts.watch++
    else if (r.status.pill === 'over') counts.over++
  }

  async function saveBudget(category: string, text: string) {
    const amount = Number(text)
    if (!Number.isFinite(amount) || amount < 0 || text.trim() === '') return
    const existing = f.budgets.rows.find((b) => normCategory(b.category) === category)
    if (existing) await f.budgets.update(existing.id, { amount })
    else await f.budgets.insert({ category, amount })
  }

  async function saveGoal(key: 'goal_tax' | 'goal_tithe', text: string) {
    const n = Number(text)
    if (Number.isFinite(n) && n >= 0 && n <= 100 && text.trim() !== '') await f.settings.set(key, String(n))
  }

  return (
    <>
      <div className="tiles three">
        <div className="tile good"><span className="tile-label">On track / under</span><strong>{counts.under}</strong></div>
        <div className="tile warn"><span className="tile-label">Watch it</span><strong>{counts.watch}</strong></div>
        <div className="tile bad"><span className="tile-label">Over budget</span><strong>{counts.over}</strong></div>
      </div>

      <section className="card">
        <div className="card-head">
          <div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Budget vs actual</h2></div>
          <span className="muted small">{readOnly ? '' : 'Budgets editable here'}</span>
        </div>
        <p className="muted small">Actual = bills ticked off as paid + spending logged or imported. A category's budget starts as what its monthly bills add up to; change it to set your own. Averages cover months with activity.</p>
        <div className="table-wrap">
          <table className="ftable budget">
            <thead>
              <tr>
                <th>Category</th>
                <th>Budget / mo</th>
                {months.map((m) => <th key={m}>{monthLabel(m).slice(0, 3)}</th>)}
                <th>Avg</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.category}>
                  <td><strong>{cap(r.category)}</strong></td>
                  <td>
                    {readOnly ? money(r.budget) : (
                      <input
                        key={`${r.category}-${r.budget}`}
                        className="budget-input"
                        inputMode="decimal"
                        aria-label={`Budget for ${r.category}`}
                        defaultValue={r.budget}
                        onBlur={(e) => void saveBudget(r.category, e.target.value)}
                      />
                    )}
                  </td>
                  {r.perMonth.map((v, i) => {
                    const cls = r.budget > 0 && v > r.budget ? 'over' : v > 0 && r.budget > 0 ? 'under' : ''
                    return <td key={months[i]} className={`mcell ${cls}`}>{v > 0 ? money(v) : '-'}</td>
                  })}
                  <td><strong>{r.avg > 0 ? money(r.avg) : '-'}</strong></td>
                  <td><span className={`status-pill ${r.status.pill}`}>{r.status.label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {!readOnly && (
        <section className="card">
          <h2>Set-asides</h2>
          <p className="muted small">Optional. When above 0, tax and tithe join the Transfers to make list each month.</p>
          <div className="row2">
            <div>
              <label className="label" htmlFor="goal-tax">Tax set-aside (% of income)</label>
              <input id="goal-tax" className="input" inputMode="decimal" defaultValue={f.goalTax} onBlur={(e) => void saveGoal('goal_tax', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="goal-tithe">Tithe (% after tax)</label>
              <input id="goal-tithe" className="input" inputMode="decimal" defaultValue={f.goalTithe} onBlur={(e) => void saveGoal('goal_tithe', e.target.value)} />
            </div>
          </div>
        </section>
      )}

      <Verse text="Honour the LORD with thy substance, and with the firstfruits of all thine increase: so shall thy barns be filled with plenty." reference="Proverbs 3:9-10" />
    </>
  )
}
