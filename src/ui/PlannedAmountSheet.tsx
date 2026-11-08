import { useState, type FormEvent } from 'react'
import { Sheet } from './Sheet'

export type PlanScope = 'month' | 'onward'

/** Change what a monthly bill is planned to cost: just in the month on screen, or from this month on. */
export function PlannedAmountSheet({
  open,
  name,
  initial,
  onSave,
  onClose,
}: {
  open: boolean
  name: string
  initial: number
  onSave: (amount: number, scope: PlanScope) => void | Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState(String(initial))
  const [scope, setScope] = useState<PlanScope>('month')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = Number(text.replace(/[$,\s]/g, ''))
    if (!(n > 0) || !Number.isFinite(n)) return setError('Enter an amount greater than 0.')
    setError(null)
    void onSave(Math.round(n * 100) / 100, scope)
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Planned amount: ${name}`}>
      <form onSubmit={submit} noValidate>
        <label className="label" htmlFor="planned-amount-input">Amount</label>
        <input id="planned-amount-input" className="input" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <label className="check-row">
          <input type="radio" name="plan-scope" checked={scope === 'month'} onChange={() => setScope('month')} />
          <span>Just this month</span>
        </label>
        <label className="check-row">
          <input type="radio" name="plan-scope" checked={scope === 'onward'} onChange={() => setScope('onward')} />
          <span>This month and every month after</span>
        </label>
        <p className="muted small">Earlier months keep what they were.</p>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="actions"><button type="submit" className="btn btn-primary">Save</button></div>
      </form>
    </Sheet>
  )
}
