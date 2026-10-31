import { cap, money } from '../lib/format'
import type { Share } from '../lib/ledger'

const COLORS: Record<string, string> = {
  housing: '#3c6c8a', family: '#2f6f4e', debt: '#b8423a', dining: '#b86a2b', groceries: '#6a9955', food: '#6a9955',
  transport: '#8a6d3b', subscriptions: '#7a5c9e', insurance: '#4a90a4', utilities: '#c89b1e', beauty: '#c9668a',
  travel: '#5b8c85', giving: '#7286d3', health: '#5c8a72', business: '#9b9b6a', gifts: '#d1884f', other: '#8a857a',
}
const FALLBACK = ['#a0703c', '#4f7f9e', '#9a5c7a', '#6f8f4f', '#b0894a']

export function categoryColor(category: string): string {
  if (COLORS[category]) return COLORS[category]
  let hash = 0
  for (const ch of category) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return FALLBACK[hash % FALLBACK.length]
}

const R = 38
const CIRC = 2 * Math.PI * R

/** Spending split into slices, with a legend of amounts and shares beside it. */
export function Donut({ shares, centerLabel }: { shares: Share[]; centerLabel?: string }) {
  if (shares.length === 0) return <p className="muted small">No spending yet this month.</p>
  const label = `Spending by category: ${shares.map((s) => `${s.category} ${s.pct}%`).join(', ')}`
  let used = 0
  return (
    <div className="donut-row">
      <div role="img" aria-label={label} className="donut">
        <svg viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line)" strokeWidth="14" />
          {shares.map((s) => {
            const length = (s.total / shares.reduce((sum, x) => sum + x.total, 0)) * CIRC
            const circle = (
              <circle
                key={s.category}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={categoryColor(s.category)}
                strokeWidth="14"
                strokeDasharray={`${Math.max(0, length - 0.6)} ${CIRC}`}
                strokeDashoffset={-used}
                transform="rotate(-90 50 50)"
              />
            )
            used += length
            return circle
          })}
          {centerLabel && <text x="50" y="54" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{centerLabel}</text>}
        </svg>
      </div>
      <ul className="legend">
        {shares.map((s) => (
          <li key={s.category}>
            <span className="dot" style={{ background: categoryColor(s.category) }} aria-hidden />
            <span className="grow">{cap(s.category)}</span>
            <strong>{money(s.total)}</strong>
            <span className="muted small">{`${s.pct}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
