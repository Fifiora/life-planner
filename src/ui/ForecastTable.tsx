import type { ForecastRow } from '../lib/finance2'
import { money, monthLabel } from '../lib/format'

/** Month-by-month projection: a small bar chart (with a text summary) and a table. */
export function ForecastTable({ rows, target }: { rows: ForecastRow[]; target: number }) {
  const max = Math.max(target, ...rows.map((r) => r.savings), 1)
  const summary = `Projected savings by month: ${rows.map((r) => `${monthLabel(r.month)} ${money(r.savings)} of ${money(target)}`).join(', ')}`
  return (
    <>
      <div role="img" aria-label={summary} className="fbars">
        {rows.map((r) => (
          <div key={r.month} className="fbar-col" aria-hidden>
            <div className="fbar-track">
              <div className="fbar-target" style={{ bottom: `${(target / max) * 100}%` }} />
              <div className={`fbar${r.shortfall > 0 ? ' short' : ''}`} style={{ height: `${(r.savings / max) * 100}%` }} />
            </div>
            <span className="fbar-label">{monthLabel(r.month).slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <div className="table-wrap">
        <table className="ftable">
          <thead>
            <tr><th>Month</th><th>Payoffs</th><th>After bills</th><th>Saved</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month}>
                <td>{monthLabel(r.month)}</td>
                <td>{r.oneTime ? money(r.oneTime) : '—'}</td>
                <td style={{ color: r.available < 0 ? 'var(--danger)' : undefined }}>{money(r.available)}</td>
                <td>{money(r.savings)}</td>
                <td>{r.shortfall > 0 ? <span className="badge bad">{money(r.shortfall)} short</span> : <span className="badge ok">On target</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
