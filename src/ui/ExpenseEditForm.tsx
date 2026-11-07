import { useState, type FormEvent } from 'react'
import type { Expense } from '../types'
import { Sheet } from './Sheet'

/** Correct a logged item's amount, date or note so the books match what really happened. */
export function ExpenseEditForm({ expense, onSave, onClose }: { expense: Expense; onSave: (values: Pick<Expense, 'amount' | 'date' | 'note'>) => void | Promise<void>; onClose: () => void }) {
  const [amount, setAmount] = useState(String(expense.amount))
  const [date, setDate] = useState(expense.date)
  const [note, setNote] = useState(expense.note ?? '')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount.replace(/[$,\s]/g, ''))
    if (!(n > 0) || !Number.isFinite(n)) return setError('Enter an amount greater than 0.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Pick the date it happened.')
    setError(null)
    void onSave({ amount: Math.round(n * 100) / 100, date, note: note.trim() })
  }

  return (
    <Sheet open onClose={onClose} title="Edit transaction">
      <form onSubmit={submit} noValidate>
        <div className="row2">
          <div>
            <label className="label" htmlFor="edit-exp-amount">Amount</label>
            <input id="edit-exp-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="edit-exp-date">Date</label>
            <input id="edit-exp-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <label className="label" htmlFor="edit-exp-note">Note</label>
        <input id="edit-exp-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <p role="alert" className="error">{error}</p>}
        <div className="actions"><button type="submit" className="btn btn-primary">Save</button></div>
      </form>
    </Sheet>
  )
}
