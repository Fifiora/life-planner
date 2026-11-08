import { useId, useState, type FormEvent } from 'react'
import { validateBill } from '../lib/finance'

export interface MonthBillValues {
  name: string
  amount: number
  category: string
  paid: boolean
}

/** A bill that belongs to one month only: name, amount, category, and whether it is already paid. */
export function MonthBillForm({ onSave }: { onSave: (values: MonthBillValues) => void | Promise<void> }) {
  const uid = useId()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('misc')
  const [paid, setPaid] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const values = {
      name: name.trim(),
      amount: amount.trim() === '' ? NaN : Number(amount.replace(/[$,\s]/g, '')),
      category: category.trim().toLowerCase() || 'misc',
      paid,
    }
    const problem = validateBill({ ...values, kind: 'recurring' })
    if (problem) return setError(problem)
    setError(null)
    void onSave(values)
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
          <label className="label" htmlFor={`${uid}-category`}>Category</label>
          <input id={`${uid}-category`} className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
      </div>
      <label className="check-row">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
        <span>Already paid</span>
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions"><button type="submit" className="btn btn-primary">Save</button></div>
    </form>
  )
}
