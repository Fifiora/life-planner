import { useSyncExternalStore } from 'react'
import { getThemeChoice, setThemeChoice, THEME_EVENT, type ThemeChoice } from '../lib/theme'

const ORDER: ThemeChoice[] = ['system', 'light', 'dark']
const LABEL: Record<ThemeChoice, string> = { system: 'Match my phone', light: 'Light', dark: 'Dark' }
const ICON: Record<ThemeChoice, string> = { system: '🌓', light: '☀️', dark: '🌙' }

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(THEME_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** The current look choice, kept in step everywhere it is shown. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, getThemeChoice)
}

/** One tap cycles Match my phone, Light, Dark. Lives in the page header. */
export function ThemeToggle() {
  const choice = useThemeChoice()
  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]
  return (
    <button type="button" className="icon-btn theme-btn" aria-label={`Appearance: ${LABEL[choice]}. Tap for ${LABEL[next]}.`} title={`Appearance: ${LABEL[choice]}`} onClick={() => setThemeChoice(next)}>
      <span aria-hidden>{ICON[choice]}</span>
    </button>
  )
}

/** The same three choices as a small switch (shown in the laptop sidebar). */
export function ThemeSwitch() {
  const choice = useThemeChoice()
  return (
    <div className="side-theme" role="group" aria-label="Appearance">
      {ORDER.map((c) => (
        <button key={c} type="button" className="side-theme-btn" aria-pressed={choice === c} onClick={() => setThemeChoice(c)}>{LABEL[c]}</button>
      ))}
    </div>
  )
}
