import { useMemo } from 'react'
import { addDays, PLAN_START, weekStart } from '../lib/dates'
import { bossForWeek, bossProgress } from '../lib/boss'
import { earnedBadges } from '../lib/badges'
import { levelFor, levelProgress, memberXp, partyXp, type GameData } from '../lib/xp'
import type { Activity, Bill, BillPayment, Cheer, Milestone, Routine, RoutineLog, TriviaAttempt } from '../types'
import { useStyleChoice } from '../ui/StyleSwitch'
import { useHousehold } from './household'
import { useTable } from './useTable'
import { useToday } from './useToday'

/** XP, levels and badges for me and for the two of us, worked out from what is already saved and synced. */
export function useGame(today?: string) {
  const liveToday = useToday()
  const day = today ?? liveToday
  const on = useStyleChoice() === 'anime'
  const { me, members } = useHousehold()
  const routines = useTable<Routine>('routines').rows
  const logs = useTable<RoutineLog>('routine_logs').rows
  const activities = useTable<Activity>('activities').rows
  const milestones = useTable<Milestone>('milestones').rows
  const attempts = useTable<TriviaAttempt>('trivia_attempts').rows
  const payments = useTable<BillPayment>('bill_payments').rows
  const bills = useTable<Bill>('bills').rows
  const cheers = useTable<Cheer>('cheers').rows

  return useMemo(() => {
    const data: GameData = { routines, logs, activities, milestones, attempts, payments, bills }
    const memberIds = members.map((m) => m.id)
    const mine = memberXp(data, me.id)
    const week = weekStart(day)
    const boss = bossForWeek(week)
    let bossesDefeated = 0
    for (let w = weekStart(PLAN_START); w <= week; w = addDays(w, 7)) if (bossProgress(bossForWeek(w), w, data, memberIds).defeated) bossesDefeated++
    const cheersSent = cheers.filter((c) => c.from_member === me.id).length
    const party = partyXp(data, memberIds)
    return {
      on,
      meId: me.id,
      memberIds,
      data,
      me: { xp: mine.total, level: levelFor(mine.total), progress: levelProgress(mine.total), byBucket: mine.byBucket, badges: earnedBadges(data, me.id, memberIds, { cheersSent, bossesDefeated }) },
      boss: { boss, week, progress: bossProgress(boss, week, data, memberIds) },
      party: { xp: party, level: levelFor(party), progress: levelProgress(party) },
    }
  }, [on, day, me.id, members, routines, logs, activities, milestones, attempts, payments, bills, cheers])
}
