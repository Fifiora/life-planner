import { money, monthLabel } from '../lib/format'

/** One category, month by month. */
export function TrendBars({ label, months, values }: { label: string; months: string[]; values: number[] }) {
  const max = Math.max(1, ...values)
  const text = `${label} by month: ${months.map((m, i) => `${monthLabel(m)} ${money(values[i])}`).join(', ')}`
  return (
    <div role="img" aria-label={text}>
      <div className="gbars" aria-hidden>
        {months.map((m, i) => (
          <div key={m} className="gbar-col">
            <span className="trend-value">{values[i] > 0 ? money(values[i]) : ''}</span>
            <div className="gbar-track">
              <div className="gbar spent" style={{ height: `${(values[i] / max) * 100}%`, background: 'var(--finance)' }} />
            </div>
            <span className="fbar-label">{monthLabel(m).slice(0, 3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
