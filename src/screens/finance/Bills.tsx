import { pinPayments, setBillAmounts } from '../../data/changeBills'
import { StarterPlanLoader } from '../../ui/StarterPlanLoader'
import { useState } from 'react'
import type { FinanceData } from '../../data/useFinance'
import { useHousehold } from '../../data/household'
import { monthKeyCT, todayCT } from '../../lib/dates'
import { billsPaidSummary, categoryTotals, monthPaidProgress, normCategory, paymentAmount, paymentPatch, payoffPaid, payoffPatch } from '../../lib/finance2'
import { cap, money, monthLabel } from '../../lib/format'
import type { Bill, BillPayment } from '../../types'
import { AmountSheet } from '../../ui/AmountSheet'
import { BillForm } from '../../ui/BillForm'
import { Confetti } from '../../ui/Confetti'
import { Sheet } from '../../ui/Sheet'

export function Bills({ f, month }: { f: FinanceData; month: string }) {
  const { readOnly, me } = useHousehold()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  const [paying, setPaying] = useState<{ bill: Bill; payment?: BillPayment } | null>(null)

  const summary = billsPaidSummary(f.bills.rows, f.payments.rows, month)
  const progress = monthPaidProgress(f.bills.rows, f.payments.rows, month)
  const paymentFor = (b: Bill) => f.payments.rows.find((p) => p.bill_id === b.id && p.month === month)
  const paidIds = new Set(f.payments.rows.filter((p) => p.month === month).map((p) => p.bill_id))
  const recurring = f.bills.rows.filter((b) => b.kind === 'recurring')
  const groups = categoryTotals(f.bills.rows, f.totalIncome).map((c) => ({
    ...c,
    bills: recurring.filter((b) => normCategory(b.category) === c.category).sort((a, b) => b.amount - a.amount),
  }))
  const oneTime = f.bills.rows.filter((b) => b.kind === 'one_time').sort((a, b) => (a.due_month ?? '').localeCompare(b.due_month ?? ''))
  const pct = progress.pct

  async function togglePaid(bill: Bill) {
    const existing = f.payments.rows.find((p) => p.bill_id === bill.id && p.month === month)
    if (existing) await f.payments.remove(existing.id)
    else await f.payments.insert({ bill_id: bill.id, month, paid_on: todayCT(), member_id: me.id })
  }

  function cheer() {
    setCelebrate(true)
    window.setTimeout(() => setCelebrate(false), 2200)
  }

  async function markPayoff(b: Bill) {
    await f.bills.update(b.id, { paid: !b.paid, paid_amount: null })
    if (!b.paid) cheer()
  }

  async function savePaid(n: number, options?: { makePlan: boolean }) {
    if (!paying) return
    const { bill, payment } = paying
    if (bill.kind === 'one_time') {
      await f.bills.update(bill.id, payoffPatch(bill, n))
      if (!bill.paid && n >= bill.amount) cheer()
    } else if (payment) {
      if (options?.makePlan) {
        await setBillAmounts(f, [{ bill, amount: n }], monthKeyCT())
        await f.payments.update(payment.id, { amount: n })
      } else await f.payments.update(payment.id, paymentPatch(bill, n))
    }
    setPaying(null)
  }

  return (
    <>
      <Confetti fire={celebrate} />
      {f.bills.rows.length === 0 && (
        <section className="card">
          <h2>No bills yet</h2>
          <p className="muted small">Load the monthly bills and one-time payoffs that came with the site, or add your own below.</p>
          <StarterPlanLoader />
        </section>
      )}
      <section className="card">
        <h2>Paid this month</h2>
        <div className="bar mt" role="progressbar" aria-label="Bills paid this month" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="bar-text">{summary.paidCount} of {summary.totalCount} paid{summary.partial.length > 0 ? ` · ${summary.partial.length} part-paid` : ''} · {money(progress.paid)} of {money(progress.planned)}</p>
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
                  {!b.paid && payoffPaid(b) > 0 && <span className="muted small block-text">Partly paid · {money(payoffPaid(b))} of {money(b.amount)}</span>}
                  {b.paid && b.paid_amount != null && b.paid_amount !== b.amount && <span className="muted small block-text">Paid {money(b.paid_amount)}</span>}
                </span>
                <span style={{ fontWeight: 700, textDecoration: b.paid ? 'line-through' : undefined }}>{money(b.amount)}</span>
                {!readOnly && <button type="button" className="icon-btn" aria-label={`Edit amount paid for ${b.name}`} onClick={() => setPaying({ bill: b })}>✎</button>}
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
                {(() => {
                  const payment = paymentFor(b)
                  if (!payment) return <span style={{ fontWeight: 600 }}>{money(b.amount)}</span>
                  const paid = paymentAmount(b, payment)
                  const text = paid < b.amount ? `${money(paid)} of ${money(b.amount)}` : money(paid)
                  return (
                    <span className="amt-col">
                      {readOnly ? (
                        <span style={{ fontWeight: 600, opacity: 0.55 }}>{text}</span>
                      ) : (
                        <button type="button" className="plain-btn" style={{ fontWeight: 600, opacity: 0.8 }} aria-label={`Edit amount paid for ${b.name}`} onClick={() => setPaying({ bill: b, payment })}>{text}</button>
                      )}
                      {paid < b.amount && <span className="muted small block-text">{money(b.amount - paid)} to go</span>}
                    </span>
                  )
                })()}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <section className="card"><p className="muted small">No monthly bills yet. Tap + above to add one.</p></section>}

      {paying && (
        <AmountSheet
          key={paying.bill.id}
          open
          title={`Amount paid: ${paying.bill.name}`}
          label="Amount"
          initial={paying.bill.kind === 'one_time' ? payoffPaid(paying.bill) || paying.bill.amount : paymentAmount(paying.bill, paying.payment)}
          full={paying.bill.amount}
          planOffer={paying.bill.kind === 'recurring' ? { name: paying.bill.name, current: paying.bill.amount } : undefined}
          onClose={() => setPaying(null)}
          onSave={savePaid}
        />
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a bill">
        <BillForm onSave={async (values) => { await f.bills.insert(values); setAdding(false) }} />
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit bill">
        {editing && (
          <BillForm
            key={editing.id}
            initial={editing}
            onSave={async (values) => { if (values.amount !== editing.amount) await pinPayments(f, editing, monthKeyCT()); await f.bills.update(editing.id, values); setEditing(null) }}
            onDelete={async () => { await f.bills.remove(editing.id); setEditing(null) }}
          />
        )}
      </Sheet>
    </>
  )
}
