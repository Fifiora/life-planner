const KEY = 'lp.seen'

function read(): string[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return null
  }
}

/** True until anything has been recorded on this phone, so a first load never celebrates old progress. */
export const isFirstRun = (): boolean => read() === null

export const hasSeen = (key: string): boolean => read()?.includes(key) ?? false

/** Remember that these were celebrated (or quietly skipped) on this phone. Passing none still starts the record. */
export function markSeen(...keys: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...(read() ?? []), ...keys])]))
  } catch {
    /* storage full or blocked: worst case a celebration repeats */
  }
}
