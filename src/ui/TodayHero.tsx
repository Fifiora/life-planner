import { Link } from 'react-router-dom'
import type { Daypart } from '../lib/daypart'
import { heroLine, restUsedLine } from '../lib/voice'
import { pipMood } from '../lib/pip'
import { Pip } from './Pip'
import { Ring } from './Ring'
import { XpBar } from './XpBar'
import { useStyleChoice } from './StyleSwitch'

export interface HeroRing {
  key: string
  label: string
  icon: string
  color: string
  value: number
  caption: string
  to: string
}

export interface HeroXp {
  label: string
  level: number
  into: number
  needed: number
  partyLevel: number
  partyInto: number
  partyNeeded: number
}

/** The top card of Today: how today is going, the five areas, and a tint for the time of day. */
export function TodayHero({ rings, done, total, streak, part, host, xp, restUsed }: { rings: HeroRing[]; done: number; total: number; streak: number; part: Daypart; host?: string; xp?: HeroXp; restUsed?: boolean }) {
  const style = useStyleChoice()
  return (
    <section className={`card hero hero-${part}`} aria-label="Progress">
      <div className="hero-top">
        <Ring label="Done today" color="var(--brand)" size={112} value={total > 0 ? done / total : 0} centre={total > 0 ? `${done}/${total}` : '—'} />
        <div className="hero-text">
          {(total > 0 || streak >= 2) && (
            <p className="headline">
              {total > 0 && <span>{`${done} of ${total} done today`}</span>}
              {streak >= 2 && <span className="streak-chip">{`🔥 ${streak}-day streak`}</span>}
            </p>
          )}
          <p className="muted">{heroLine(style, done, total)}</p>
          {restUsed && <p className="muted small">{restUsedLine}</p>}
        </div>
        {style === 'anime' && <Pip mood={pipMood({ done, total, streak, part })} />}
      </div>
      {xp && (
        <div className="xp-row">
          <XpBar label={xp.label} level={xp.level} into={xp.into} needed={xp.needed} />
          <XpBar label="Party" level={xp.partyLevel} into={xp.partyInto} needed={xp.partyNeeded} />
        </div>
      )}
      <div className="rings">
        {rings.map((r) => (
          <Link key={r.key} to={r.to} className="ring-link" aria-label={`${r.label}, ${Math.round(Math.max(0, Math.min(1, r.value)) * 100)}%, ${r.caption}`}>
            <Ring label={r.label} color={r.color} value={r.value} size={58} icon={r.icon} caption={r.caption} />
          </Link>
        ))}
      </div>
      {host && <p className="muted small mt">🎲 Next night in is hosted by <strong>{host}</strong></p>}
    </section>
  )
}
