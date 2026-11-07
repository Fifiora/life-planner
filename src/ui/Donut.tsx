import { useState, type ReactNode } from 'react'
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

/**
 * Spending split into slices, with a legend of amounts and shares beside it.
 * Choose a slice or a legend row to dim the rest and show its breakdown; choose it again (or the empty
 * area, or "Show all") to bring everything back.
 */
export function Donut({ shares, centerLabel, centerSub, detail }: { shares: Share[]; centerLabel?: string; centerSub?: string; detail?: (category: string) => ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null)
  // A category that left the chart must not come back selected when it returns.
  if (selected && !shares.some((s) => s.category === selected)) setSelected(null)
  if (shares.length === 0) return <p className="muted small">No spending yet this month.</p>

  const active = selected && shares.some((s) => s.category === selected) ? selected : null
  const toggle = (category: string) => setSelected(active === category ? null : category)
  const toGoSum = shares.reduce((s, x) => s + (x.toGo ?? 0), 0)
  const label = `Spending by category: ${shares.map((s) => `${s.category} ${s.pct}%`).join(', ')}${toGoSum > 0 ? `, still to pay ${money(toGoSum)}` : ''}`
  const sum = shares.reduce((s, x) => s + x.total + (x.toGo ?? 0), 0) || 1
  let used = 0

  return (
    <div className={`donut-layout${active && detail ? ' has-detail' : ''}`}>
      <div className="donut-main">
        <div role="img" aria-label={label} className="donut" onClick={() => setSelected(null)}>
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line)" strokeWidth="14" />
            {shares.map((s) => {
              const length = (s.total / sum) * CIRC
              const goLength = ((s.toGo ?? 0) / sum) * CIRC
              const start = used
              const pick = (e: { stopPropagation: () => void }) => {
                e.stopPropagation()
                toggle(s.category)
              }
              const common = {
                cx: 50,
                cy: 50,
                r: R,
                fill: 'none',
                stroke: categoryColor(s.category),
                transform: 'rotate(-90 50 50)',
                onClick: pick,
              }
              const state = `${active === s.category ? ' selected' : ''}${active && active !== s.category ? ' dimmed' : ''}`
              const strokeWidth = active === s.category ? 17 : 14
              used += length + goLength
              return (
                <g key={s.category}>
                  {length > 0 && (
                    <circle {...common} data-category={s.category} className={`slice${state}`} strokeWidth={strokeWidth} strokeDasharray={`${Math.max(0, length - 0.6)} ${CIRC}`} strokeDashoffset={-start}>
                      <title>{`${cap(s.category)}: ${money(s.total)} (${s.pct}%)`}</title>
                    </circle>
                  )}
                  {goLength > 0 && (
                    <circle {...common} data-togo={s.category} className={`slice togo${state}`} strokeWidth={strokeWidth} strokeOpacity={0.3} strokeDasharray={`${Math.max(0, goLength - 0.6)} ${CIRC}`} strokeDashoffset={-(start + length)}>
                      <title>{`${cap(s.category)}: ${money(s.toGo ?? 0)} still to pay`}</title>
                    </circle>
                  )}
                </g>
              )
            })}
            {centerLabel && <text x="50" y={centerSub ? 50 : 54} textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{centerLabel}</text>}
            {centerLabel && centerSub && <text x="50" y="60" textAnchor="middle" fontSize="6" fill="currentColor" opacity="0.7">{centerSub}</text>}
          </svg>
        </div>
        <ul className="legend">
          {shares.map((s) => (
            <li key={s.category}>
              <button
                type="button"
                className="legend-row"
                aria-pressed={active === s.category}
                data-dimmed={active && active !== s.category ? 'true' : undefined}
                onClick={() => toggle(s.category)}
              >
                <span className="dot" style={{ background: categoryColor(s.category) }} aria-hidden />
                <span className="grow">{cap(s.category)}</span>
                <strong>{money(s.total)}</strong>
                {(s.toGo ?? 0) > 0 && <span className="muted small">{`+${money(s.toGo ?? 0)} to go`}</span>}
                <span className="muted small">{`${s.pct}%`}</span>
              </button>
            </li>
          ))}
        </ul>
        {active && (
          <button type="button" className="chip" onClick={() => setSelected(null)}>Show all</button>
        )}
      </div>
      {active && detail && (
        <aside role="complementary" aria-label={`Breakdown for ${cap(active)}`} className="breakdown">
          {detail(active)}
        </aside>
      )}
    </div>
  )
}
