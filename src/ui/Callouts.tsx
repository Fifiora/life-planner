import type { Callout } from '../lib/ledger'

export function Callouts({ items }: { items: Callout[] }) {
  return (
    <div className="callouts">
      {items.map((c) => (
        <p key={c.text} className={`tone tone-${c.tone}`}>{c.text}</p>
      ))}
    </div>
  )
}
