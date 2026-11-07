import { useState, type FormEvent } from 'react'
import { money } from '../lib/format'
import { Sheet } from './Sheet'

/** A small sheet for correcting one amount: what was really paid, sent or put aside. */
export function AmountSheet({
  open,
  title,
  label,
  initial,
  full,
  fullLabel = 'Pay in full',
  planOffer,
  onSave,
  onClose,
}: {
  open: boolean
  title: string
  label: string
  initial: number
  /** When given, a one-tap button saves this amount (the whole bill). */
  full?: number
  fullLabel?: string
  /** For a bill: offer to make the typed amount the bill's amount from now on. */
  planOffer?: { name: string; current: number }
  onSave: (amount: number, options?: { makePlan: boolean }) => void | Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState(String(initial))
  const [error, setError] = useState<string | null>(null)
  const [makePlan, setMakePlan] = useState(false)
  const typed = Number(text.replace(/[$,\s]/g, ''))
  const offer = planOffer !== undefined && typed > 0 && Number.isFinite(typed) && typed !== planOffer.current

  const finish = (n: number, plan: boolean) => void (planOffer ? onSave(n, { makePlan: plan }) : onSave(n))

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(text.replace(/[$,\s]/g, ''))
    if (!(n > 0) || !Number.isFinite(n)) return setError('Enter an amount greater than 0.')
    setError(null)
    finish(Math.round(n * 100) / 100, offer && makePlan)
  }

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} noValidate>
        <label className="label" htmlFor="amount-sheet-input">{label}</label>
        <input id="amount-sheet-input" className="input" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        {offer && planOffer && (
          <label className="check-row">
            <input type="checkbox" checked={makePlan} onChange={(e) => setMakePlan(e.target.checked)} />
            <span>{`Also make ${planOffer.name} ${money(typed)} from now on`}</span>
          </label>
        )}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn btn-primary">Save</button>
          {full !== undefined && <button type="button" className="btn" onClick={() => finish(full, false)}>{`${fullLabel} (${money(full)})`}</button>}
        </div>
      </form>
    </Sheet>
  )
}
