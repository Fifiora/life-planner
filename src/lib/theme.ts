export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'lp.theme'

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Sets <html data-theme> to the look in use and says which one that is. */
export function applyTheme(choice: ThemeChoice, prefersDark: boolean, root: HTMLElement = document.documentElement): 'light' | 'dark' {
  const resolved = choice === 'system' ? (prefersDark ? 'dark' : 'light') : choice
  root.setAttribute('data-theme', resolved)
  return resolved
}

const phoneIsDark = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches

/** Apply the saved choice now, and keep following the phone while the choice is "system". */
export function startTheme(): void {
  applyTheme(getThemeChoice(), phoneIsDark())
  if (typeof window.matchMedia !== 'function') return
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getThemeChoice() === 'system') applyTheme('system', phoneIsDark())
  })
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* storage full or blocked: the choice still applies until the app closes */
  }
  applyTheme(choice, phoneIsDark())
}
