import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from './household'

/**
 * Rows of one household table with live updates.
 * Writes are optimistic and roll back (with `error` set) if the server rejects them.
 */
export function useTable<T extends { id: string }>(table: string) {
  const { householdId } = useHousehold()
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const uid = useId()
  const tmpCounter = useRef(0)

  const refetch = useCallback(async () => {
    const { data, error: err } = await supabase.from(table).select('*').eq('household_id', householdId)
    if (err) setError(err.message)
    else setRows((data ?? []) as T[])
    setLoading(false)
  }, [table, householdId])

  useEffect(() => {
    let cancelled = false
    refetch()
    const channel = supabase
      .channel(`rt-${table}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, () => {
        if (!cancelled) refetch()
      })
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [table, householdId, uid, refetch])

  const insert = useCallback(
    async (row: Partial<T>) => {
      const tmpId = `tmp-${++tmpCounter.current}`
      setError(null)
      setRows((prev) => [...prev, { ...row, id: tmpId } as T])
      const { error: err } = await supabase.from(table).insert({ household_id: householdId, ...row })
      if (err) {
        setRows((prev) => prev.filter((r) => r.id !== tmpId))
        setError(err.message)
        return
      }
      await refetch()
    },
    [table, householdId, refetch],
  )

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      setError(null)
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      const { error: err } = await supabase.from(table).update(patch).eq('id', id)
      if (err) {
        setError(err.message)
        await refetch()
      }
    },
    [table, refetch],
  )

  const remove = useCallback(
    async (id: string) => {
      setError(null)
      setRows((prev) => prev.filter((r) => r.id !== id))
      const { error: err } = await supabase.from(table).delete().eq('id', id)
      if (err) {
        setError(err.message)
        await refetch()
      }
    },
    [table, refetch],
  )

  return { rows, loading, error, insert, update, remove, refetch }
}
