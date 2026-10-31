import { monthLabel } from '../lib/format'

const short = (m: string) => `${monthLabel(m).slice(0, 3)} '${m.slice(2, 4)}`

/** A row of months to jump between. */
export function MonthPills({ months, value, onChange }: { months: string[]; value: string; onChange: (m: string) => void }) {
  return (
    <div className="pill-row" aria-label="Month">
      {months.map((m) => (
        <button key={m} type="button" className={`mpill${m === value ? ' active' : ''}`} aria-pressed={m === value} onClick={() => onChange(m)}>
          {short(m)}
        </button>
      ))}
    </div>
  )
}
