import { useState, type FormEvent } from 'react'
import type { FinanceData } from '../../data/useFinance'
import { useHousehold } from '../../data/household'
import { savingsProgress } from '../../lib/finance2'
import { money, monthLabel } from '../../lib/format'

export function Savings({ f, month }: { f: FinanceData; month: string }) {
  const { me } = useHousehold()
  const [amount, setAmount] = useState('')
  const [when, setWhen] = useState(month)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const p = savingsProgress(f.savings.rows, f.target, f.savingsStart, month)
  const entries = [...f.savings.rows].sort((a, b) => b.month.localeCompare(a.month))

  async function add(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount)
    if (!(n > 0)) return setError('Enter an amount greater than 0.')
    if (!/^\d{4}-\d{2}$/.test(when)) return setError('Pick the month it was put aside.')
    setError(null)
    await f.savings.insert({ month: when, amount: n, member_id: me.id, note: note.trim() || null })
    setAmount('')
    setNote('')
  }

  return (
    <>
      <section className="card">
        <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Put aside so far</h2></div></div>
        <div className="bar" role="progressbar" aria-label="Saved compared with target so far" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, p.pct)}>
          <div className="bar-fill" style={{ width: `${Math.min(100, p.pct)}%` }} />
        </div>
        <p className="bar-text">{money(p.savedToDate)} of {money(p.targetToDate)} target so far (since {monthLabel(f.savingsStart)})</p>
        <p className="callout">
          {p.gap > 0 ? `${money(p.gap)} behind the target` : p.gap < 0 ? `${money(-p.gap)} ahead of the target` : 'Exactly on target'} · {money(p.thisMonth)} put aside in {monthLabel(month)}
        </p>
      </section>

      <section className="card">
        <h2>Add savings</h2>
        <form onSubmit={add} noValidate>
          <div className="row2">
            <div>
              <label className="label" htmlFor="sv-amount">Amount put aside</label>
              <input id="sv-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="sv-month">Month</label>
              <input id="sv-month" className="input" type="month" value={when} onChange={(e) => setWhen(e.target.value)} />
            </div>
          </div>
          <label className="label" htmlFor="sv-note">Note (optional)</label>
          <input id="sv-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" className="btn btn-primary block mt">Add savings</button>
        </form>
      </section>

      <section className="card">
        <h2>History</h2>
        {entries.length === 0 ? <p className="muted small">Nothing recorded yet. Add what you move to savings each month.</p> : (
          <ul className="list">
            {entries.map((e) => (
              <li key={e.id} className="list-row">
                <span className="grow"><strong>{monthLabel(e.month)}</strong>{e.note && <span className="muted small block-text">{e.note}</span>}</span>
                <span style={{ fontWeight: 600 }}>{money(e.amount)}</span>
                <button type="button" className="icon-btn" aria-label={`Delete savings for ${monthLabel(e.month)}`} onClick={() => f.savings.remove(e.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
