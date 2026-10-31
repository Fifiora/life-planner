import type { RoutineData } from '../data/useRoutineData'
import { scopedLogs } from '../lib/cadence'
import { scorecard } from '../lib/habits'
import type { Bucket } from '../types'

/** How each routine is going this month: ticks so far versus what was expected by today. */
export function Scorecard({ data, bucket, title = 'Monthly scorecard' }: { data: RoutineData; bucket: Bucket; title?: string }) {
  const rows = data.routines
    .filter((r) => r.bucket === bucket)
    .map((r) => ({ routine: r, ...scorecard(r, scopedLogs(r, data.logs, data.me.id), data.today) }))
  if (rows.length === 0) return null
  const overall = Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length)
  return (
    <section className="card">
      <div className="card-head">
        <div className="card-title"><span className="accent-bar" style={{ background: `var(--${bucket})` }} /><h2>{title}</h2></div>
        <span className="pill">{overall}% overall</span>
      </div>
      <ul className="list">
        {rows.map(({ routine, count, expected, pct }) => (
          <li key={routine.id} className="cat-row">
            <div className="cat-head"><span>{routine.name}</span><span className="muted small">{count} of {expected}</span></div>
            <div className="bar" role="progressbar" aria-label={`${routine.name} this month`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className="bar-fill" style={{ width: `${pct}%`, background: `var(--${bucket})` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
