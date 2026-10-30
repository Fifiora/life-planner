import { useRef } from 'react'
import { meetsTimeRule } from '../lib/cadence'
import { DEFAULT_ANCHOR, todayCT } from '../lib/dates'
import type { Routine, RoutineLog } from '../types'
import type { RoutineValues } from '../ui/RoutineForm'
import { useHousehold } from './household'
import { useSettings } from './useSettings'
import { useTable } from './useTable'
import { useToday } from './useToday'

/** Routines, their logs and the actions screens need, loaded once per screen. */
export function useRoutineData() {
  const { me, members } = useHousehold()
  const routineTable = useTable<Routine>('routines')
  const logTable = useTable<RoutineLog>('routine_logs')
  const settings = useSettings()
  const today = useToday()
  const pending = useRef(new Set<string>())

  const anchor = settings.get('biweekly_anchor') ?? DEFAULT_ANCHOR
  const routines = routineTable.rows.filter((r) => r.active && (r.applies_to === 'both' || r.applies_to === me.id))
  const logs = logTable.rows

  const myLogOn = (r: Routine, day: string) => logs.find((l) => l.routine_id === r.id && l.member_id === me.id && l.date === day)
  const myLogToday = (r: Routine) => myLogOn(r, today)

  /** Runs one tick/untick per routine at a time, so a fast double tap can't act on an unsaved row. */
  async function once(r: Routine, work: () => Promise<void>) {
    if (pending.current.has(r.id)) return
    pending.current.add(r.id)
    try {
      await work()
    } finally {
      pending.current.delete(r.id)
    }
  }

  const tick = (r: Routine, value?: string) =>
    once(r, async () => {
      const day = todayCT() // fresh: the screen may have been open overnight
      const done = r.time_rule && value ? meetsTimeRule(r.time_rule, value) : true
      const existing = myLogOn(r, day)
      if (existing) await logTable.update(existing.id, { done, value: value ?? null })
      else await logTable.insert({ routine_id: r.id, member_id: me.id, date: day, done, value: value ?? null })
    })

  const untick = (r: Routine) =>
    once(r, async () => {
      const existing = myLogOn(r, todayCT())
      if (existing) await logTable.remove(existing.id)
    })

  async function saveRoutine(values: RoutineValues, id?: string) {
    if (id) await routineTable.update(id, values)
    else await routineTable.insert(values)
  }

  return {
    me,
    members,
    routines,
    logs,
    anchor,
    today,
    loading: routineTable.loading || logTable.loading,
    error: routineTable.error ?? logTable.error,
    myLogToday,
    tick,
    untick,
    saveRoutine,
    deleteRoutine: (id: string) => routineTable.remove(id),
  }
}

export type RoutineData = ReturnType<typeof useRoutineData>
