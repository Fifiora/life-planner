import { cap, money } from '../lib/format'
import type { CategoryTotal } from '../lib/finance2'

export function CategoryBars({ rows }: { rows: CategoryTotal[] }) {
  if (rows.length === 0) return <p className="muted small">No monthly bills yet.</p>
  const max = rows[0].total || 1
  return (
    <ul className="list">
      {rows.map((r) => (
        <li key={r.category} className="cat-row">
          <div className="cat-head">
            <span>{cap(r.category)}</span>
            <strong>{money(r.total)}</strong>
          </div>
          <div className="bar" aria-hidden><div className="bar-fill" style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} /></div>
          <span className="muted small">{r.pctOfIncome}% of income · {r.count} bill{r.count === 1 ? '' : 's'}</span>
        </li>
      ))}
    </ul>
  )
}
