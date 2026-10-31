import type { RoutineData } from '../data/useRoutineData'
import { scopedLogs } from '../lib/cadence'
import { to12h } from '../lib/format'
import { timeStats } from '../lib/habits'

/** Bedtime and wake-up consistency over the last 7 days, for whoever is using the app. */
export function SleepRhythm({ data }: { data: RoutineData }) {
  const timed = data.routines.filter((r) => r.bucket === 'health' && r.time_rule)
  if (timed.length === 0) return null
  return (
    <section className="card">
      <div className="card-head"><div className="card-title"><span className="accent-bar" style={{ background: 'var(--health)' }} /><h2>Sleep rhythm</h2></div></div>
      <p className="muted small">Last 7 days for {data.me.display_name}.</p>
      <ul className="list">
        {timed.map((r) => {
          const s = timeStats(scopedLogs(r, data.logs, data.me.id), r, data.today, 7, data.me.id)
          return (
            <li key={r.id} className="list-row">
              <span className="grow">
                <strong>{r.name}</strong>
                <span className="muted small block-text">Goal: {r.time_rule}</span>
              </span>
              <span style={{ textAlign: 'right' }}>
                {s.logged === 0 ? <span className="muted small">No times logged yet</span> : (
                  <>
                    <strong>{s.onTime} of {s.logged} on time</strong>
                    {s.avg && <span className="muted small block-text">average {to12h(s.avg)}</span>}
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
