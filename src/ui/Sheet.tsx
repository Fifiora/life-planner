import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Bottom sheet used for add/edit forms. It is drawn on the page itself (not inside the card that opened it), so
 * frosted-glass cards cannot trap it and it always covers the whole screen.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
