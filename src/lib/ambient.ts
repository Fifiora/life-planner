/** The moving picture behind the glass: floating flowers, swimming fish, or nothing. Saved per device. */
export type AmbientId = 'flowers' | 'fish' | 'off'

export const AMBIENTS: { id: AmbientId; label: string }[] = [
  { id: 'flowers', label: 'Floating flowers' },
  { id: 'fish', label: 'Swimming fish' },
  { id: 'off', label: 'Off' },
]

const KEY = 'lp.ambient'
export const AMBIENT_EVENT = 'lp:ambient'

export function getAmbient(): AmbientId {
  try {
    const v = localStorage.getItem(KEY)
    return AMBIENTS.some((a) => a.id === v) ? (v as AmbientId) : 'flowers'
  } catch {
    return 'flowers'
  }
}

export function setAmbient(id: AmbientId): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage blocked: the choice still applies until the app closes */
  }
  window.dispatchEvent(new Event(AMBIENT_EVENT))
}
