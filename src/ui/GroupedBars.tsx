import { money, monthLabel } from '../lib/format'
import type { SeriesRow } from '../lib/ledger'

/** Income against spending for each month, with a marker for what the bills were planned to cost. */
export function GroupedBars({ rows }: { rows: SeriesRow[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.spent, r.planned]))
  const label = `Income versus spending by month: ${rows
    .map((r) => `${monthLabel(r.month)}${r.hasData ? ` income ${money(r.income)}, spent ${money(r.spent)}` : ' no data yet'}`)
    .join('; ')}`
  return (
    <div role="img" aria-label={label}>
      <div className="gbars" aria-hidden>
        {rows.map((r) => (
          <div key={r.month} className="gbar-col" style={{ opacity: r.hasData ? 1 : 0.4 }}>
            <div className="gbar-track">
              <div className="gbar income" style={{ height: `${(r.income / max) * 100}%` }} />
              <div className="gbar spent" style={{ height: `${(r.spent / max) * 100}%` }} />
              <div className="gbar-plan" style={{ bottom: `${(r.planned / max) * 100}%` }} />
            </div>
            <span className="fbar-label">{monthLabel(r.month).slice(0, 3)}</span>
          </div>
        ))}
      </div>
      <p className="muted small legend-line" aria-hidden>
        <span className="dot" style={{ background: 'var(--ok)' }} /> Income <span className="dot" style={{ background: 'var(--food)' }} /> Spent <span className="dash" /> Planned bills
      </p>
    </div>
  )
}
