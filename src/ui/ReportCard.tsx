import { Link } from 'react-router-dom'
import { reportMonthFor } from '../lib/months'
import { monthLabel } from '../lib/format'

/** On the first seven days of a month: last month's report is ready. */
export function ReportCard({ today }: { today: string }) {
  const month = reportMonthFor(today)
  if (!month) return null
  return (
    <section className="card" aria-label="Month-end report">
      <div className="card-head">
        <div className="card-title"><span className="accent-bar" style={{ background: 'var(--brand)' }} /><h2>{`Your ${monthLabel(month)} report is ready`}</h2></div>
        <Link to={`/report?month=${month}`}>Open report</Link>
      </div>
      <p className="muted small">What went well, what to improve, and goals for the month ahead.</p>
    </section>
  )
}
