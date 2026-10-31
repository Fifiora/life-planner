import { useId, type CSSProperties } from 'react'

export function Ring({
  value,
  label,
  color,
  size = 76,
  icon,
  caption,
  centre,
}: {
  value: number
  label: string
  color: string
  size?: number
  /** Shown in the middle instead of the percent. */
  icon?: string
  /** Small text under the label, e.g. "2/5". */
  caption?: string
  /** Your own text in the middle (wins over the icon and the percent). */
  centre?: string
}) {
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const pct = Math.round(v * 100)
  const stroke = size >= 90 ? 11 : 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="prog-ring" style={{ '--ring-color': color } as CSSProperties}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ width: size, height: size, position: 'relative' }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: color }} />
              <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${color} 55%, white)` }} />
            </linearGradient>
          </defs>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          <circle
            className="prog-arc"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        </svg>
        <span className={`prog-pct${icon && !centre ? ' prog-icon' : ''}`} aria-hidden>{centre ?? icon ?? `${pct}%`}</span>
      </div>
      <span className="prog-label" aria-hidden>{label}</span>
      {caption && <span className="prog-caption" aria-hidden>{caption}</span>}
    </div>
  )
}
