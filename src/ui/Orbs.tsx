import { useEffect } from 'react'

/** Decorative colour, dots, stripes and rings behind the glass, and a light that follows the pointer across cards. */
export function Orbs() {
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('.card, .kpi-card') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    document.addEventListener('pointermove', move, { passive: true })
    return () => document.removeEventListener('pointermove', move)
  }, [])
  return (
    <div className="orbs" aria-hidden="true" data-testid="orbs">
      <span className="o o1" />
      <span className="o o2" />
      <span className="o o3" />
      <span className="o o4" />
      <span className="orb-ring rg1" />
      <span className="orb-ring rg2" />
    </div>
  )
}
