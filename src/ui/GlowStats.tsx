/** Two soft-gradient tiles: how much of today and how much of the five areas is done. */
export function GlowStats({ today, areas }: { today: number; areas: number }) {
  const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)) * 100)}%`
  return (
    <div className="glow-row">
      <section className="glow-tile glow-a" aria-label="Today's tasks">
        <p className="glow-title">Today's<br />tasks</p>
        <p className="glow-num">{pct(today)}</p>
        <p className="glow-cap">Completed</p>
      </section>
      <section className="glow-tile glow-b" aria-label="All areas">
        <p className="glow-title">All five<br />areas</p>
        <p className="glow-num">{pct(areas)}</p>
        <p className="glow-cap">On track</p>
      </section>
    </div>
  )
}
