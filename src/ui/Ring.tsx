export function Ring({
  value,
  label,
  color,
  size = 76,
}: {
  value: number
  label: string
  color: string
  size?: number
}) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const pct = Math.round(v * 100)
  const stroke = 8
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="ring">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        style={{ width: size, height: size, position: 'relative' }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        </svg>
        <span className="ring-pct" aria-hidden>{pct}%</span>
      </div>
      <span className="ring-label" aria-hidden>{label}</span>
    </div>
  )
}
