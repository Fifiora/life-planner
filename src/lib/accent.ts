/** Colour themes: one accent set (the main colour and its partner) on top of the calm glass look. */
export type AccentId = 'teal' | 'ocean' | 'rose' | 'plum' | 'forest' | 'sunset' | 'slate'

export interface Accent {
  id: AccentId
  label: string
  /** Shown on the swatch, and as the browser bar colour. Matches --brand in light. */
  swatch: string
}

export const ACCENTS: Accent[] = [
  { id: 'teal', label: 'Teal', swatch: '#1d6b62' },
  { id: 'ocean', label: 'Ocean', swatch: '#1f5fa8' },
  { id: 'rose', label: 'Rose', swatch: '#b0365a' },
  { id: 'plum', label: 'Plum', swatch: '#6a49b5' },
  { id: 'forest', label: 'Forest', swatch: '#2c6a3a' },
  { id: 'sunset', label: 'Sunset', swatch: '#ad4f19' },
  { id: 'slate', label: 'Slate', swatch: '#3e4959' },
]

const KEY = 'lp.accent'
export const ACCENT_EVENT = 'lp:accent'
const DEFAULT: AccentId = 'teal'

export function getAccent(): AccentId {
  try {
    const v = localStorage.getItem(KEY)
    return ACCENTS.some((a) => a.id === v) ? (v as AccentId) : DEFAULT
  } catch {
    return DEFAULT
  }
}

/** Sets <html data-accent> (teal is the plain default, so it has no attribute) and the browser bar colour. */
export function applyAccent(id: AccentId, root: HTMLElement = document.documentElement): void {
  if (id === DEFAULT) root.removeAttribute('data-accent')
  else root.setAttribute('data-accent', id)
  const swatch = ACCENTS.find((a) => a.id === id)?.swatch
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta && swatch) meta.setAttribute('content', swatch)
}

export const startAccent = (): void => applyAccent(getAccent())

export function setAccent(id: AccentId): void {
  try {
    if (id === DEFAULT) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, id)
  } catch {
    /* storage blocked: the choice still applies until the app closes */
  }
  applyAccent(id)
  window.dispatchEvent(new Event(ACCENT_EVENT))
}
