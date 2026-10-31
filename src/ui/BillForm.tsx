import { useId, useState, type FormEvent } from 'react'
import type { Bill } from '../types'
import { validateBill } from '../lib/finance'

export type BillValues = Omit<Bill, 'id'>

export function BillForm({
  initial,
  onSave,
  onDelete,
}: {
  initial?: Partial<Bill>
  onSave: (values: BillValues) => void
  onDelete?: () => void
}) {
  const uid = useId()
  const [name, setName] = useState(initial?.name ?? '')
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '')
  const [kind, setKind] = useState<Bill['kind']>(initial?.kind ?? 'recurring')
  const [category, setCategory] = useState(initial?.category ?? 'misc')
  const [dueMonth, setDueMonth] = useState(initial?.due_month ?? '')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    const values: BillValues = {
      name: name.trim(),
      amount: amount.trim() === '' ? NaN : Number(amount),
      kind,
      category: category.trim().toLowerCase() || 'misc',
      due_month: kind === 'one_time' ? dueMonth || null : null,
      paid: initial?.paid ?? false,
    }
    const problem = validateBill(values)
    if (problem) return setError(problem)
    setError(null)
    onSave(values)
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="label" htmlFor={`${uid}-name`}>Name</label>
      <input id={`${uid}-name`} className="input" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="row2">
        <div>
          <label className="label" htmlFor={`${uid}-amount`}>Amount</label>
          <input id={`${uid}-amount`} className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor={`${uid}-kind`}>Type</label>
          <select id={`${uid}-kind`} className="input" value={kind} onChange={(e) => setKind(e.target.value as Bill['kind'])}>
            <option value="recurring">Every month</option>
            <option value="one_time">One-time</option>
          </select>
        </div>
      </div>

      <label className="label" htmlFor={`${uid}-category`}>Category</label>
      <input id={`${uid}-category`} className="input" value={category} onChange={(e) => setCategory(e.target.value)} />

      {kind === 'one_time' && (
        <>
          <label className="label" htmlFor={`${uid}-due`}>Due month</label>
          <input id={`${uid}-due`} className="input" type="month" value={dueMonth} onChange={(e) => setDueMonth(e.target.value)} />
        </>
      )}

      {error && <p role="alert" className="error">{error}</p>}

      <div className="actions">
        <button type="submit" className="btn btn-primary">Save</button>
        {onDelete && !confirming && (
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Delete</button>
        )}
        {onDelete && confirming && (
          <>
            <button type="button" className="btn btn-danger" onClick={onDelete}>Yes, delete</button>
            <button type="button" className="btn" onClick={() => setConfirming(false)}>Cancel</button>
          </>
        )}
      </div>
    </form>
  )
}
