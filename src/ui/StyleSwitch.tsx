import { useSyncExternalStore } from 'react'
import { getStyleChoice, setStyleChoice, STYLE_EVENT, type StyleChoice } from '../lib/style'

const LABEL: Record<StyleChoice, string> = { anime: 'Anime', classic: 'Classic' }
const ICON: Record<StyleChoice, string> = { anime: '✨', classic: '📋' }
const ORDER: StyleChoice[] = ['anime', 'classic']

function subscribe(onChange: () => void) {
  window.addEventListener(STYLE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(STYLE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** The style chosen on this phone, kept in step everywhere it is shown. */
export function useStyleChoice(): StyleChoice {
  return useSyncExternalStore(subscribe, getStyleChoice)
}

/** One tap flips Anime and Classic. Lives in the page header. */
export function StyleToggle() {
  const choice = useStyleChoice()
  const next = choice === 'anime' ? 'classic' : 'anime'
  return (
    <button type="button" className="icon-btn theme-btn" aria-label={`Style: ${LABEL[choice]}. Tap for ${LABEL[next]}.`} title={`Style: ${LABEL[choice]}`} onClick={() => setStyleChoice(next)}>
      <span aria-hidden>{ICON[choice]}</span>
    </button>
  )
}

/** The same two choices as a small switch (shown in the laptop sidebar). */
export function StyleSwitch() {
  const choice = useStyleChoice()
  return (
    <div className="side-theme side-style" role="group" aria-label="Style">
      {ORDER.map((c) => (
        <button key={c} type="button" className="side-theme-btn" aria-label={LABEL[c]} aria-pressed={choice === c} onClick={() => setStyleChoice(c)}>{LABEL[c]}</button>
      ))}
    </div>
  )
}
