import { useGame } from '../data/useGame'

/** This week's boss for the two of you, with how much health it has left. Anime style only. */
export function BossCard({ today }: { today?: string }) {
  const game = useGame(today)
  if (!game.on) return null
  const { boss, progress } = game.boss
  const shown = Math.min(progress.value, progress.target)
  const left = progress.target - shown
  return (
    <section className="card boss-card" aria-label="Weekly boss">
      <div className="card-head">
        <div className="card-title"><span className="accent-bar" style={{ background: 'var(--brand)' }} /><h2>Weekly boss</h2></div>
        {progress.defeated && <span className="badge">Defeated!</span>}
      </div>
      <p className="boss-name">{boss.name}</p>
      <p className="muted small">{boss.blurb}</p>
      <div className="xp-track boss-hp" role="progressbar" aria-label="Boss HP" aria-valuemin={0} aria-valuemax={progress.target} aria-valuenow={left}>
        <div className="xp-fill boss-fill" style={{ width: `${Math.round((left / progress.target) * 100)}%` }} />
      </div>
      <p className="small">{`${shown}/${progress.target} ${boss.unit}`}</p>
    </section>
  )
}
