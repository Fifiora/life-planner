import { useCallback, useState, useSyncExternalStore } from 'react'
import { useToast } from '../ui/Toast'
import { getState, insertIfEmpty, insertRow, refresh, removeRow, subscribe, updateRow } from './tableStore'

/**
 * Rows of one list stored in the data repo, shared by every screen that uses it.
 * Writes show instantly and roll back (with a toast) if GitHub rejects them.
 */
export function useTable<T extends { id: string }>(table: string) {
  const toast = useToast()
  const subscribeToTable = useCallback((onChange: () => void) => subscribe(table, onChange), [table])
  const state = useSyncExternalStore(subscribeToTable, () => getState(table))
  const [saveError, setSaveError] = useState<string | null>(null)

  const run = useCallback(
    async (work: () => Promise<void>) => {
      setSaveError(null)
      try {
        await work()
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setSaveError(message)
        toast(`Couldn't save: ${message}`)
      }
    },
    [toast],
  )

  const insert = useCallback((row: Partial<T>) => run(() => insertRow(table, row as Record<string, unknown>)), [table, run])
  const update = useCallback((id: string, patch: Partial<T>) => run(() => updateRow(table, id, patch as Record<string, unknown>)), [table, run])
  const remove = useCallback((id: string) => run(() => removeRow(table, id)), [table, run])
  const seedIfEmpty = useCallback((rows: Partial<T>[]) => run(() => insertIfEmpty(table, rows as Record<string, unknown>[])), [table, run])
  const refetch = useCallback(() => refresh(table), [table])

  return {
    rows: state.rows as unknown as T[],
    loading: false,
    error: saveError ?? state.error,
    insert,
    update,
    remove,
    seedIfEmpty,
    refetch,
  }
}
