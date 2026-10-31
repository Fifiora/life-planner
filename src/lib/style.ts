export type StyleChoice = 'anime' | 'classic'

const KEY = 'lp.style'
export const STYLE_EVENT = 'lp:style'

/** The look chosen on this phone. Anime unless Classic was picked (also when storage is blocked). */
export function getStyleChoice(): StyleChoice {
  try {
    return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'anime'
  } catch {
    return 'anime'
  }
}

export function applyStyle(choice: StyleChoice, root: HTMLElement = document.documentElement): void {
  root.setAttribute('data-style', choice)
}

export function setStyleChoice(choice: StyleChoice): void {
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    /* storage full or blocked: the choice still applies until the app closes */
  }
  applyStyle(choice)
  window.dispatchEvent(new Event(STYLE_EVENT)) // other controls showing the choice update themselves
}

/** Apply the saved choice when the app opens. */
export function startStyle(): void {
  applyStyle(getStyleChoice())
}
