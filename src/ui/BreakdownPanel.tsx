import { cap, money } from '../lib/format'
import type { Breakdown } from '../lib/ledger'

const KIND: Record<string, string> = { bill: 'Bill', payoff: 'Payoff', spent: 'Spent' }

/** The right-hand detail for one chosen donut slice. */
export function BreakdownPanel({ breakdown, income, planned }: { breakdown: Breakdown; income: number; planned: boolean }) {
  const { rows, total, previousTotal, change, hasPrevious } = breakdown
  const share = income > 0 ? Math.round((total / income) * 100) : 0
  const vs =
    !hasPrevious
      ? 'First month with data'
      : previousTotal === 0 && change === 0
      ? 'Nothing last month either'
      : change === 0
        ? 'Same as last month'
        : `${change > 0 ? 'Up' : 'Down'} ${money(Math.abs(change))} from last month`
  return (
    <div>
      <h3>{cap(breakdown.category)}</h3>
      <p className="breakdown-total">{money(total)} <span className="muted small">{income > 0 ? `${share}% of income` : ''}</span></p>
      <p className="muted small">{planned ? 'Planned for this month' : 'This month'} · {vs}</p>
      <ul className="list">
        {rows.map((r, i) => (
          <li key={`${r.label}-${i}`} className="list-row">
            <span className="chip-kind">{KIND[r.kind]}</span>
            <span className="grow">{r.label}</span>
            <strong>{money(r.amount)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
