import { useId, useState, type FormEvent } from 'react'

/** The pay schedule: how much arrives every two weeks, and the date of one real payday to count from. */
export function PayScheduleForm({ initial, onSave }: { initial?: { amount: number; anchor: string }; onSave: (amount: number, anchor: string) => void | Promise<void> }) {
  const uid = useId()
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [anchor, setAnchor] = useState(initial?.anchor ?? '')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(amount.replace(/[$,\s]/g, ''))
    if (!(n > 0) || !Number.isFinite(n) || !/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return setError('Enter the amount and a payday date.')
    setError(null)
    void onSave(Math.round(n * 100) / 100, anchor)
  }

  return (
    <form onSubmit={submit} noValidate>
      <label className="label" htmlFor={`${uid}-amount`}>Amount every two weeks</label>
      <input id={`${uid}-amount`} className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <label className="label" htmlFor={`${uid}-anchor`}>A recent or upcoming payday</label>
      <input id={`${uid}-anchor`} className="input" type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions"><button type="submit" className="btn btn-primary">Save pay schedule</button></div>
    </form>
  )
}
