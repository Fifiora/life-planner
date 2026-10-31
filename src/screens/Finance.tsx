import { useState } from 'react'
import { useHousehold } from '../data/household'
import { useSettings } from '../data/useSettings'
import { useTable } from '../data/useTable'
import { monthKeyCT } from '../lib/dates'
import { monthView } from '../lib/finance'
import { money, monthLabel, shiftMonthKey } from '../lib/format'
import type { Bill, Income } from '../types'
import { BillForm } from '../ui/BillForm'
import { Confetti } from '../ui/Confetti'
import { PageHead } from '../ui/PageHead'
import { SavingsBar } from '../ui/SavingsBar'
import { Sheet } from '../ui/Sheet'

export default function Finance() {
  const bills = useTable<Bill>('bills')
  const income = useTable<Income>('income')
  const settings = useSettings()
  const { readOnly } = useHousehold()

  const [month, setMonth] = useState(monthKeyCT())
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Bill | null>(null)
  const [incomeOpen, setIncomeOpen] = useState(false)
  const [incomeDraft, setIncomeDraft] = useState('')
  const [celebrate, setCelebrate] = useState(false)

  const target = Number(settings.get('savings_target') ?? 10000)
  const totalIncome = income.rows.reduce((s, i) => s + i.monthly_amount, 0)
  const v = monthView(totalIncome, bills.rows, target, month)

  const recurring = bills.rows.filter((b) => b.kind === 'recurring').sort((a, b) => b.amount - a.amount)
  const oneTime = bills.rows.filter((b) => b.kind === 'one_time').sort((a, b) => (a.due_month ?? '').localeCompare(b.due_month ?? ''))
  const outstanding = oneTime.filter((b) => !b.paid).reduce((s, b) => s + b.amount, 0)

  async function markPaid(b: Bill) {
    await bills.update(b.id, { paid: !b.paid })
    if (!b.paid) {
      setCelebrate(true)
      window.setTimeout(() => setCelebrate(false), 2200)
    }
  }

  async function saveIncome() {
    const amount = Number(incomeDraft)
    if (!Number.isFinite(amount) || amount < 0) return
    const first = income.rows[0]
    if (first) await income.update(first.id, { monthly_amount: amount })
    else await income.insert({ name: 'Combined contributions', monthly_amount: amount })
    setIncomeOpen(false)
  }

  return (
    <div className="stack">
      <Confetti fire={celebrate} />
      <PageHead title="Finance" sub="Plan the month, clear the debts, hit the savings goal." />

      <section className="card">
        <div className="month-nav">
          <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftMonthKey(month, -1))}>‹</button>
          <h2>{monthLabel(month)}</h2>
          <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonth(shiftMonthKey(month, 1))}>›</button>
        </div>

        <div className="stat-grid mt">
          <button type="button" className="stat" onClick={() => { setIncomeDraft(String(totalIncome)); setIncomeOpen(true) }} aria-label="Edit monthly income">
            <span className="cap">{readOnly ? 'Income' : 'Income (tap to edit)'}</span>
            <span className="num">{money(totalIncome)}</span>
          </button>
          <div className="stat"><span className="cap">Monthly bills</span><span className="num">{money(v.recurring)}</span></div>
          <div className="stat"><span className="cap">One-time this month</span><span className="num">{money(v.oneTime)}</span></div>
          <div className="stat">
            <span className="cap">Left after bills</span>
            <span className="num" style={{ color: v.available < 0 ? 'var(--danger)' : undefined }}>{money(v.available)}</span>
          </div>
        </div>

        <div className="mt"><SavingsBar savings={v.savings} target={target} /></div>
        {v.deficit > 0 && <p className="callout bad">Over by {money(v.deficit)} — move a one-time payment to another month.</p>}
        {v.deficit === 0 && v.shortfall > 0 && <p className="callout">{money(v.shortfall)} below the savings target — move a payoff or trim spending.</p>}
        {v.shortfall === 0 && <p className="callout ok">Savings target met this month 🎉</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>One-time payoffs</h2></div>
          <button type="button" className="add-btn" aria-label="Add bill" onClick={() => setAdding(true)}>+</button>
        </div>
        <p className="muted small">Still to pay: <strong>{money(outstanding)}</strong></p>
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
                <button type="button" className={`btn btn-small${b.paid ? '' : ' btn-primary'}`} onClick={() => markPaid(b)}>
                  {b.paid ? 'Paid ✓' : 'Mark paid'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title"><span className="accent-bar" style={{ background: 'var(--finance)' }} /><h2>Monthly bills</h2></div>
          <span className="pill">{money(recurring.reduce((s, b) => s + b.amount, 0))}</span>
        </div>
        {recurring.length === 0 ? <p className="muted small">No monthly bills yet.</p> : (
          <ul className="list">
            {recurring.map((b) => (
              <li key={b.id} className="list-row">
                <span className="grow">
                  <button type="button" className="plain-btn" onClick={() => setEditing(b)}>{b.name}</button>
                  <span className="muted small block-text">{b.category}</span>
                </span>
                <span style={{ fontWeight: 600 }}>{money(b.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a bill">
        <BillForm onSave={async (values) => { await bills.insert(values); setAdding(false) }} />
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title="Edit bill">
        {editing && (
          <BillForm
            key={editing.id}
            initial={editing}
            onSave={async (values) => { await bills.update(editing.id, values); setEditing(null) }}
            onDelete={async () => { await bills.remove(editing.id); setEditing(null) }}
          />
        )}
      </Sheet>
      <Sheet open={incomeOpen} onClose={() => setIncomeOpen(false)} title="Monthly income">
        <label className="label" htmlFor="income-amount">Combined monthly contributions</label>
        <input id="income-amount" className="input" inputMode="decimal" value={incomeDraft} onChange={(e) => setIncomeDraft(e.target.value)} />
        <div className="actions"><button type="button" className="btn btn-primary" onClick={saveIncome}>Save</button></div>
      </Sheet>
    </div>
  )
}
