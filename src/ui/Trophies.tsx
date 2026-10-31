import { useGame } from '../data/useGame'
import { BADGES } from '../lib/badges'

/** Every badge: earned ones lit, locked ones greyed with a hint. Anime style only. */
export function Trophies() {
  const game = useGame()
  if (!game.on) return null
  const earned = new Set(game.me.badges)
  return (
    <section className="card" aria-labelledby="trophies-title">
      <h2 id="trophies-title">Trophies</h2>
      <p className="muted small">{`${earned.size} of ${BADGES.length} earned`}</p>
      <ul className="trophies">
        {BADGES.map((b) => {
          const got = earned.has(b.id)
          return (
            <li key={b.id} className={got ? 'trophy got' : 'trophy'} aria-label={got ? `${b.name}, earned` : `${b.name}, locked: ${b.hint}`}>
              <span aria-hidden>{got ? '🏅' : '🔒'}</span>
              <span aria-hidden className="trophy-name">{b.name}</span>
              {!got && <span aria-hidden className="trophy-hint">{b.hint}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
