import { meetsTimeRule } from '../lib/cadence'
import { todayCT } from '../lib/dates'
import type { Routine, RoutineLog } from '../types'
import type { RoutineValues } from '../ui/RoutineForm'
import { useHousehold } from './household'
import { useSettings } from './useSettings'
import { useTable } from './useTable'

/** Routines, their logs and the actions screens need, loaded once per screen. */
export function useRoutineData() {
  const { me, members } = useHousehold()
  const routineTable = useTable<Routine>('routines')
  const logTable = useTable<RoutineLog>('routine_logs')
  const settings = useSettings()

  const anchor = settings.get('biweekly_anchor') ?? '2026-01-05'
  const today = todayCT()
  const routines = routineTable.rows.filter((r) => r.active && (r.applies_to === 'both' || r.applies_to === me.id))
  const logs = logTable.rows

  const myLogToday = (r: Routine) => logs.find((l) => l.routine_id === r.id && l.member_id === me.id && l.date === today)

  async function tick(r: Routine, value?: string) {
    const done = r.time_rule && value ? meetsTimeRule(r.time_rule, value) : true
    const existing = myLogToday(r)
    if (existing) await logTable.update(existing.id, { done, value: value ?? null })
    else await logTable.insert({ routine_id: r.id, member_id: me.id, date: today, done, value: value ?? null })
  }

  async function untick(r: Routine) {
    const existing = myLogToday(r)
    if (existing) await logTable.remove(existing.id)
  }

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
