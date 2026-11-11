import { useId, useState } from 'react'
import { dailyTicks, smoothPath } from '../lib/trend'
import type { RoutineLog } from '../types'

const W = 600
const H = 190
const PAD = { l: 8, r: 8, t: 34, b: 14 }
const RANGES = [7, 14, 30]

/** Two smooth lines (one per person): how many things were ticked each day. A bubble marks today. */
export function TickTrend({ logs, today, members, meId }: { logs: RoutineLog[]; today: string; members: { id: string; display_name: string }[]; meId: string }) {
  const [days, setDays] = useState(14)
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ids = members.map((m) => m.id)
  const series = dailyTicks(logs, ids, today, days)
  const max = Math.max(3, ...ids.flatMap((id) => series[id]))
  const x = (i: number) => PAD.l + (i / Math.max(1, days - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b)
  const pts = (id: string) => series[id].map((v, i) => ({ x: x(i), y: y(v) }))
  const mine = series[meId] ?? []
  const avg = mine.length ? Math.round((mine.reduce((a, b) => a + b, 0) / mine.length) * 10) / 10 : 0
  const todayN = mine[mine.length - 1] ?? 0
  const todayPt = { x: x(days - 1), y: y(todayN) }
  const colour = (i: number) => (i === 0 ? 'var(--brand)' : 'var(--blue)')
  const order = [meId, ...ids.filter((id) => id !== meId)]

  return (
    <section className="card trend-card" aria-label="Momentum">
      <div className="card-head">
        <div>
          <h2>Momentum</h2>
          <p className="muted small">Things ticked off each day</p>
        </div>
        <label className="range-pick">
          <span className="muted small">Range</span>
          <select className="mini-select" aria-label="Range" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((r) => <option key={r} value={r}>{`Last ${r} days`}</option>)}
          </select>
        </label>
      </div>
      <svg className="trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`You ticked ${avg} things a day on average over the last ${days} days`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`fill${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((g) => (
          <line key={g} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + (g / 3) * (H - PAD.t - PAD.b)} y2={PAD.t + (g / 3) * (H - PAD.t - PAD.b)} stroke="var(--line)" strokeDasharray="2 6" />
        ))}
        {order.slice(1).map((id, i) => <path key={id} d={smoothPath(pts(id))} fill="none" stroke={colour(i + 1)} strokeWidth="2.5" strokeLinecap="round" opacity="0.8" vectorEffect="non-scaling-stroke" />)}
        <path d={`${smoothPath(pts(meId))} L${x(days - 1)} ${H - PAD.b} L${x(0)} ${H - PAD.b} Z`} fill={`url(#fill${gid})`} />
        <path d={smoothPath(pts(meId))} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <circle cx={todayPt.x} cy={todayPt.y} r="6" fill="var(--card-solid)" stroke="var(--brand)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="trend-bubble" style={{ left: `${(todayPt.x / W) * 100}%` }} aria-hidden>
        <strong>Today</strong>
        <span>{todayN} ticked</span>
      </div>
      <div className="trend-foot">
        <ul className="trend-legend">
          {order.map((id, i) => {
            const m = members.find((mm) => mm.id === id)
            return m ? <li key={id}><i style={{ background: colour(i) }} />{m.display_name}</li> : null
          })}
        </ul>
        <div className="trend-big"><strong>{avg}</strong><span className="muted small">avg ticks a day</span></div>
      </div>
    </section>
  )
}
