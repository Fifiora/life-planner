import { money } from '../lib/format'

export function SavingsBar({ savings, target }: { savings: number; target: number }) {
  const pct = target > 0 ? Math.round(Math.max(0, Math.min(savings / target, 1)) * 100) : 0
  const met = savings >= target
  return (
    <div className="savings">
      <div
        role="progressbar"
        aria-label="Savings toward target"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bar"
      >
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="bar-text">
        {money(savings)} of {money(target)} ·{' '}
        <strong>{met ? 'Target met' : `${money(target - savings)} short`}</strong>
      </p>
    </div>
  )
}
