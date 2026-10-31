import { useState } from 'react'
import type { FinanceData } from '../../data/useFinance'
import { useHousehold } from '../../data/household'
import { todayCT } from '../../lib/dates'
import { billsPaidSummary, categoryTotals, normCategory } from '../../lib/finance2'
import { cap, money, monthLabel } from '../../lib/format'
import type { Bill } from '../../types'
import { BillForm } from '../../ui/BillForm'
import { Confetti } from '../../ui/Confetti'
import { Sheet } from '../../ui/Sheet'

export function Bills({ f, month }: { f: FinanceData; month: string }) {
  const { readOnly } = useHousehold()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [celebrate, setCelebrate] = useState(false)

  const summary = billsPaidSummary(f.bills.rows, f.payments.rows, month)
  const paidIds = new Set(f.payments.rows.filter((p) => p.month === month).map((p) => p.bill_id))
  const recurring = f.bills.rows.filter((b) => b.kind === 'recurring')
  const groups = categoryTotals(f.bills.rows, f.totalIncome).map((c) => ({
    ...c,
    bills: recurring.filter((b) => normCategory(b.category) === c.category).sort((a, b) => b.amount - a.amount),
  }))
  const oneTime = f.bills.rows.filter((b) => b.kind === 'one_time').sort((a, b) => (a.due_month ?? '').localeCompare(b.due_month ?? ''))
  const pct = summary.totalCount ? Math.round((summary.paidCount / summary.totalCount) * 100) : 0

  async function togglePaid(bill: Bill) {
    const existing = f.payments.rows.find((p) => p.bill_id === bill.id && p.month === month)
    if (existing) await f.payments.remove(existing.id)
    else await f.payments.insert({ bill_id: bill.id, month, paid_on: todayCT() })
  }

  async function markPayoff(b: Bill) {
    await f.bills.update(b.id, { paid: !b.paid })
    if (!b.paid) {
      setCelebrate(true)
      window.setTimeout(() => setCelebrate(false), 2200)
    }
  }

  return (
    <>
      <Confetti fire={celebrate} />
      <section className="card">
        <h2>Paid this month</h2>
        <div className="bar mt" role="progressbar" aria-label="Bills paid this month" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="bar-text">{summary.paidCount} of {summary.totalCount} paid · {money(summary.paidAmount)} of {money(summary.totalAmount)}</p>
        {summary.unpaid.length > 0 && summary.unpaid.length <= 6 && (
          <p className="muted small">Still to pay: {summary.unpaid.map((b) => b.name).join(', ')}</p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>One-time payoffs</h2></div>
          <button type="button" className="add-btn" aria-label="Add bill" onClick={() => setAdding(true)}>+</button>
        </div>
        {oneTime.length === 0 ? <p className="muted small">No one-time payments. Tap + to add one.</p> : (
          <ul className="list">
            {oneTime.map((b) => (
              <li key={b.id} className="list-row">
                <span className="grow">
                  <button type="button" className="plain-btn" onClick={() => setEditing(b)}><strong>{b.name}</strong></button>
                  <span className="muted small block-text">Due {b.due_month ? monthLabel(b.due_month) : '—'}</span>
                </span>
                <span style={{ fontWeight: 700, textDecoration: b.paid ? 'line-through' : undefined }}>{money(b.amount)}</span>
                {readOnly && b.paid && <span className="pill">Paid ✓</span>}
                <button type="button" className={`btn btn-small${b.paid ? '' : ' btn-primary'}`} onClick={() => markPayoff(b)}>{b.paid ? 'Paid ✓' : 'Mark paid'}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {groups.map((g) => (
        <section key={g.category} className="card">
          <div className="card-head"><h3>{cap(g.category)}</h3><span className="pill">{money(g.total)}</span></div>
          <ul className="list">
            {g.bills.map((b) => (
              <li key={b.id} className="list-row">
                <input
                  type="checkbox"
                  className="tick"
                  checked={paidIds.has(b.id)}
                  disabled={readOnly}
                  aria-label={`${b.name} paid`}
                  onChange={() => void togglePaid(b)}
                />
                <button type="button" className="plain-btn grow" onClick={() => setEditing(b)}>{b.name}</button>
                <select
                  className="mini-select"
                  aria-label={`Cancel status for ${b.name}`}
                  value={b.cancel_status ?? ''}
                  disabled={readOnly}
                  onChange={(e) => void f.bills.update(b.id, { cancel_status: e.target.value as Bill['cancel_status'] })}
                >
                  <option value="">Keep</option>
                  <option value="could">Could cancel</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <span style={{ fontWeight: 600, opacity: paidIds.has(b.id) ? 0.55 : 1 }}>{money(b.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <section className="card"><p className="muted small">No monthly bills yet. Tap + above to add one.</p></section>}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a bill">
        <BillForm onSave={async (values) => { await f.bills.insert(values); setAdding(false) }} />
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit bill">
        {editing && (
          <BillForm
            key={editing.id}
            initial={editing}
            onSave={async (values) => { await f.bills.update(editing.id, values); setEditing(null) }}
            onDelete={async () => { await f.bills.remove(editing.id); setEditing(null) }}
          />
        )}
      </Sheet>
    </>
  )
}
