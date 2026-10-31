import { cleanEvent } from '../lib/calendar'
import type { CalEvent } from '../types'
import { useTable } from './useTable'

export type EventValues = Omit<CalEvent, 'id' | 'done_on'>

/** The couple's own calendar events, with add / edit / delete and per-day ticking for repeats. */
export function useEvents() {
  const table = useTable<CalEvent>('events')
  const events = table.rows.map(cleanEvent).filter((e): e is CalEvent => e !== null)

  return {
    events,
    add: (v: EventValues) => table.insert({ ...v, done_on: [] }),
    edit: (id: string, v: EventValues) => table.update(id, v),
    remove: (id: string) => table.remove(id),
    toggleDone: async (id: string, date: string) => {
      const row = events.find((e) => e.id === id)
      if (!row) return
      const done = Array.isArray(row.done_on) ? row.done_on : []
      await table.update(id, { done_on: done.includes(date) ? done.filter((d) => d !== date) : [...done, date] })
    },
  }
}
