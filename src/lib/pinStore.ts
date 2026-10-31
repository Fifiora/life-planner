import { getState, insertRow, removeRow, subscribe, updateRow } from '../data/tableStore'
import { isPinRecord, type PinRecord } from './pin'

/** The shared PIN lives in the synced settings under this key (and row id), so every paired device sees one PIN. */
export const SHARED_PIN_KEY = 'household_pin'
const LOCAL_KEY = 'lp.pin'

export const isSharing = (): boolean => localStorage.getItem('lp.sync.code') !== null

export function readLocalPin(): PinRecord | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? 'null')
    return isPinRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** The PIN stored in a list of settings rows, or null when there is none (or it is unreadable). */
export function recordFromSettingsRows(rows: { key?: unknown; value?: unknown }[]): PinRecord | null {
  const row = rows.find((r) => r.key === SHARED_PIN_KEY)
  if (!row || typeof row.value !== 'string') return null
  try {
    const parsed: unknown = JSON.parse(row.value)
    return isPinRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const readSharedPin = (): PinRecord | null => recordFromSettingsRows(getState('settings').rows as { key?: unknown; value?: unknown }[])

/** The PIN in force: the one shared with the paired devices, else this phone's own. */
export const effectivePin = (): PinRecord | null => readSharedPin() ?? readLocalPin()

/** A string that changes whenever the PIN in force changes (for `useSyncExternalStore`). */
export const pinSignature = (): string => JSON.stringify(effectivePin())

export function subscribePin(onChange: () => void): () => void {
  const off = subscribe('settings', onChange)
  window.addEventListener('storage', onChange)
  return () => {
    off()
    window.removeEventListener('storage', onChange)
  }
}

/** Set the PIN: for every paired device when this phone is sharing, otherwise just for this phone. */
export async function savePin(record: PinRecord, sharing: boolean = isSharing()): Promise<void> {
  if (!sharing) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(record))
    return
  }
  const value = JSON.stringify(record)
  const existing = (getState('settings').rows as { id: string; key?: unknown }[]).find((r) => r.key === SHARED_PIN_KEY)
  if (existing) await updateRow('settings', existing.id, { value })
  else await insertRow('settings', { id: SHARED_PIN_KEY, key: SHARED_PIN_KEY, value })
  localStorage.removeItem(LOCAL_KEY)
}

export async function clearPin(sharing: boolean = isSharing()): Promise<void> {
  localStorage.removeItem(LOCAL_KEY)
  if (!sharing) return
  for (const r of getState('settings').rows as { id: string; key?: unknown }[]) if (r.key === SHARED_PIN_KEY) await removeRow('settings', r.id)
}

/** A phone that has a PIN of its own and is now sharing: it becomes the household's PIN if there is none, else the household's wins. */
export async function migrateLocalPin(sharing: boolean = isSharing()): Promise<void> {
  if (!sharing) return
  const local = readLocalPin()
  if (!local) return
  if (!readSharedPin()) await savePin(local, true)
  else localStorage.removeItem(LOCAL_KEY)
}
