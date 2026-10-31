import { buildViewLink } from '../lib/snapshot'

function openCopy(encoded: string) {
  window.location.assign(buildViewLink(window.location.href, encoded))
  window.location.reload()
}

/** On a phone that has its own planner AND a remembered shared copy, a way to look at that copy. */
export function SharedCopyNotice({ onOpen = openCopy }: { onOpen?: (encoded: string) => void }) {
  const stored = localStorage.getItem('lp.snapshot')
  if (!stored) return null
  return (
    <section className="card">
      <h2>A shared copy is saved here</h2>
      <p className="muted small">Someone shared a view-only copy with this phone earlier.</p>
      <div className="actions">
        <button type="button" className="btn" onClick={() => onOpen(stored)}>View the shared copy</button>
      </div>
    </section>
  )
}
