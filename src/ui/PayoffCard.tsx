import { payoffPaid, type PayoffProgress } from '../lib/finance2'
import { money, monthLabel } from '../lib/format'

export function PayoffCard({ payoff, deadlineLabel }: { payoff: PayoffProgress; deadlineLabel: string }) {
  const { total, remaining, pct, daysLeft, items } = payoff
  if (total === 0) return <p className="muted small">No one-time payoffs to track.</p>
  const when = daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left to ${deadlineLabel}` : `${-daysLeft} day${daysLeft === -1 ? '' : 's'} past ${deadlineLabel}`
  return (
    <div>
      <div className="bar" role="progressbar" aria-label="Payoffs cleared" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {remaining === 0 ? (
        <p className="callout ok">All cleared 🎉</p>
      ) : (
        <p className="bar-text">Still to pay: <strong>{money(remaining)}</strong> of {money(total)} · {when}</p>
      )}
      {items.length > 0 && (
        <ul className="list">
          {items.map(({ bill, status }) => (
            <li key={bill.id} className="list-row">
              <span className="grow">
                <strong>{bill.name}</strong>
                <span className="muted small block-text">{money(bill.amount)} · due {bill.due_month ? monthLabel(bill.due_month) : '—'}{status === 'partial' || (status === 'overdue' && payoffPaid(bill) > 0) ? ` · ${money(payoffPaid(bill))} paid` : ''}</span>
              </span>
              <span className={`badge ${status === 'paid' ? 'ok' : status === 'overdue' ? 'bad' : ''}`}>
                {status === 'paid' ? 'Paid' : status === 'overdue' ? 'Overdue' : status === 'partial' ? 'Part paid' : 'Upcoming'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
