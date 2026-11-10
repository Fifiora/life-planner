import { useState, type FormEvent } from 'react'
import { useHousehold } from '../../data/household'
import type { FinanceData } from '../../data/useFinance'
import { money, monthLabel } from '../../lib/format'
import { monthPay, type Payday } from '../../lib/pay'
import type { Paycheck } from '../../types'
import { AmountSheet } from '../../ui/AmountSheet'
import { PayScheduleForm } from '../../ui/PayScheduleForm'
import { Sheet } from '../../ui/Sheet'

const niceDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export function Pay({ f, month }: { f: FinanceData; month: string }) {
  const { readOnly } = useHousehold()
  const { schedule, paychecks } = f.pay
  const [editSchedule, setEditSchedule] = useState(false)
  const [amountFor, setAmountFor] = useState<Payday | null>(null)
  const [dateFor, setDateFor] = useState<Payday | null>(null)
  const [dateText, setDateText] = useState('')
  const [adding, setAdding] = useState(false)
  const [extra, setExtra] = useState({ date: '', amount: '', note: '' })
  const [extraError, setExtraError] = useState<string | null>(null)

  async function saveSchedule(amount: number, anchor: string) {
    await f.settings.set('pay_amount', String(amount))
    await f.settings.set('pay_anchor', anchor)
    setEditSchedule(false)
  }

  if (!schedule) {
    return (
      <section className="card">
        <h2>Set up your pay</h2>
        <p className="muted small">Enter what goes into the joint account every two weeks and the date of one real payday. The app works out every payday from there; you tick each one when the money shows in the account.</p>
        {!readOnly && <PayScheduleForm onSave={saveSchedule} />}
      </section>
    )
  }

  const m = monthPay(schedule, paychecks.rows, month)
  const rowOf = (p: Payday) => paychecks.rows.find((r) => (p.id ? r.id === p.id : p.slot !== null && r.slot === p.slot))

  /** Save a change to one payday: updates its saved row, or makes one the first time. */
  async function change(p: Payday, patch: Partial<Paycheck>) {
    const row = rowOf(p)
    if (row) await paychecks.update(row.id, patch)
    else await paychecks.insert({ slot: p.slot, date: p.date, amount: null, received: false, ...patch })
  }

  const tick = (p: Payday) => change(p, p.received ? { received: false, amount: null } : { received: true, amount: p.amount })

  async function saveExtra(e: FormEvent) {
    e.preventDefault()
    const n = Number(extra.amount.replace(/[$,\s]/g, ''))
    if (!(n > 0) || !Number.isFinite(n) || !/^\d{4}-\d{2}-\d{2}$/.test(extra.date)) return setExtraError('Enter a date and an amount.')
    await paychecks.insert({ slot: null, date: extra.date, amount: Math.round(n * 100) / 100, received: false, note: extra.note.trim() || null })
    setExtra({ date: '', amount: '', note: '' })
    setExtraError(null)
    setAdding(false)
  }

  return (
    <>
      <section className="card">
        <h2>{`Paydays in ${monthLabel(month)}`}</h2>
        <p className="bar-text">{`Expected ${money(m.planned)} · Received ${money(m.received)} · ${money(m.toCome)} to come`}</p>
        {m.threeDeposits && <p className="muted small">{`${m.count} paydays fall in this month, so there is an extra paycheck.`}</p>}
        <p className="muted small">{`${money(schedule.amount)} every two weeks, counting from ${niceDate(schedule.anchor)}.`}</p>
        {!readOnly && (
          <div className="actions">
            <button type="button" className="btn btn-small" onClick={() => setEditSchedule(true)}>Change the schedule</button>
            <button type="button" className="btn btn-small" onClick={() => setAdding(true)}>Add an extra deposit</button>
          </div>
        )}
      </section>

      <section className="card">
        <ul className="list">
          {m.paydays.map((p) => {
            const id = p.slot ?? p.date
            return (
              <li key={p.key} className="list-row">
                <input type="checkbox" className="tick" checked={p.received} disabled={readOnly || p.skipped} aria-label={`Payday ${id} received`} onChange={() => void tick(p)} />
                <span className="grow">
                  <strong style={{ textDecoration: p.skipped ? 'line-through' : undefined }}>{niceDate(p.date)}</strong>
                  <span className="muted small block-text">
                    {p.extra ? p.note || 'Extra deposit' : 'Payday'}
                    {p.skipped ? ' · skipped' : p.received ? ' · in the account' : ''}
                    {p.slot && p.date !== p.slot ? ` · was ${niceDate(p.slot)}` : ''}
                  </span>
                </span>
                {readOnly ? <span style={{ fontWeight: 600 }}>{money(p.amount)}</span> : (
                  <button type="button" className="plain-btn" style={{ fontWeight: 600 }} aria-label={`Edit amount for payday ${id}`} onClick={() => setAmountFor(p)}>{money(p.amount)}</button>
                )}
                {!readOnly && <button type="button" className="icon-btn" aria-label={`Edit date for payday ${id}`} onClick={() => { setDateFor(p); setDateText(p.date) }}>✎</button>}
                {!readOnly && !p.extra && !p.received && (
                  <button type="button" className="btn btn-small" aria-label={`${p.skipped ? 'Restore' : 'Skip'} payday ${id}`} onClick={() => void change(p, { skipped: !p.skipped })}>{p.skipped ? 'Restore' : 'Skip'}</button>
                )}
                {!readOnly && p.extra && p.id && (
                  <button type="button" className="btn btn-small" aria-label={`Remove deposit ${id}`} onClick={() => void paychecks.remove(p.id as string)}>Remove</button>
                )}
              </li>
            )
          })}
        </ul>
        {m.paydays.length === 0 && <p className="muted small">No paydays fall in this month.</p>}
      </section>

      {amountFor && (
        <AmountSheet key={amountFor.key} open title="Amount for this payday" label="Amount" initial={amountFor.amount} onClose={() => setAmountFor(null)} onSave={async (n) => { await change(amountFor, { amount: n }); setAmountFor(null) }} />
      )}
      <Sheet open={dateFor !== null} onClose={() => setDateFor(null)} title="Payday date">
        <form onSubmit={(e) => { e.preventDefault(); if (dateFor && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) void change(dateFor, { date: dateText }).then(() => setDateFor(null)) }} noValidate>
          <label className="label" htmlFor="payday-date">Date</label>
          <input id="payday-date" className="input" type="date" value={dateText} onChange={(e) => setDateText(e.target.value)} />
          <p className="muted small">The day the money really landed, if it was not the usual day.</p>
          <div className="actions"><button type="submit" className="btn btn-primary">Save</button></div>
        </form>
      </Sheet>
      <Sheet open={editSchedule} onClose={() => setEditSchedule(false)} title="Pay schedule">
        <PayScheduleForm initial={schedule} onSave={saveSchedule} />
        <p className="muted small">Paydays you have already ticked keep the amount they had.</p>
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="Extra deposit">
        <form onSubmit={(e) => void saveExtra(e)} noValidate>
          <label className="label" htmlFor="extra-date">Date</label>
          <input id="extra-date" className="input" type="date" value={extra.date} onChange={(e) => setExtra({ ...extra, date: e.target.value })} />
          <label className="label" htmlFor="extra-amount">Amount</label>
          <input id="extra-amount" className="input" inputMode="decimal" value={extra.amount} onChange={(e) => setExtra({ ...extra, amount: e.target.value })} />
          <label className="label" htmlFor="extra-note">Note</label>
          <input id="extra-note" className="input" value={extra.note} onChange={(e) => setExtra({ ...extra, note: e.target.value })} />
          {extraError && <p role="alert" className="error">{extraError}</p>}
          <div className="actions"><button type="submit" className="btn btn-primary">Save</button></div>
        </form>
      </Sheet>
    </>
  )
}
