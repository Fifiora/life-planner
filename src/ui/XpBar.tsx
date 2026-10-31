/** A level label with a thin bar showing how far into the level you are. */
export function XpBar({ label, level, into, needed }: { label: string; level: number; into: number; needed: number }) {
  const pct = needed > 0 ? Math.max(0, Math.min(100, Math.round((into / needed) * 100))) : 0
  return (
    <div className="xp">
      <span className="xp-label">{`${label} Lv ${level}`}</span>
      <div className="xp-track" role="progressbar" aria-label={`${label} XP`} aria-valuemin={0} aria-valuemax={needed} aria-valuenow={into}>
        <div className="xp-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="xp-num">{`${into}/${needed} XP`}</span>
    </div>
  )
}
