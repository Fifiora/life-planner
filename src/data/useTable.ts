import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../ui/Toast'
import { useHousehold } from './household'

const isUnsaved = (id: string) => id.startsWith('tmp-')

/**
 * Rows of one household table with live updates.
 * Writes are optimistic and roll back (with `error` set and a toast) if the server rejects them.
 */
export function useTable<T extends { id: string }>(table: string) {
  const { householdId } = useHousehold()
  const toast = useToast()
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const uid = useId()
  const tmpCounter = useRef(0)
  const latestRequest = useRef(0)

  const refetch = useCallback(async () => {
    const mine = ++latestRequest.current
    const { data, error: err } = await supabase.from(table).select('*').eq('household_id', householdId)
    if (mine !== latestRequest.current) return // a newer load is already in charge
    if (err) setError(err.message)
    else setRows((data ?? []) as T[])
    setLoading(false)
  }, [table, householdId])

  useEffect(() => {
    let cancelled = false
    const onChange = () => {
      if (!cancelled) refetch()
    }
    refetch()
    const channel = supabase
      .channel(`rt-${table}-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, onChange)
      // Deleted rows carry no household id, so a filtered subscription can miss them.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, onChange)
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [table, householdId, uid, refetch])

  const fail = useCallback(
    (message: string) => {
      setError(message)
      toast(`Couldn't save: ${message}`)
    },
    [toast],
  )

  const insert = useCallback(
    async (row: Partial<T>) => {
      const tmpId = `tmp-${++tmpCounter.current}`
      setError(null)
      setRows((prev) => [...prev, { ...row, id: tmpId } as T])
      const { error: err } = await supabase.from(table).insert({ household_id: householdId, ...row })
      if (err) {
        setRows((prev) => prev.filter((r) => r.id !== tmpId))
        fail(err.message)
        return
      }
      await refetch()
    },
    [table, householdId, refetch, fail],
  )

  const update = useCallback(
    async (id: string, patch: Partial<T>) => {
      if (isUnsaved(id)) return
      setError(null)
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      const { error: err } = await supabase.from(table).update(patch as Record<string, unknown>).eq('id', id)
      if (err) {
        fail(err.message)
        await refetch()
      }
    },
    [table, refetch, fail],
  )

  const remove = useCallback(
    async (id: string) => {
      if (isUnsaved(id)) return
      setError(null)
      setRows((prev) => prev.filter((r) => r.id !== id))
      const { error: err } = await supabase.from(table).delete().eq('id', id)
      if (err) {
        fail(err.message)
        await refetch()
      }
    },
    [table, refetch, fail],
  )

  return { rows, loading, error, insert, update, remove, refetch }
}
