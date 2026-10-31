import { bossForWeek, bossProgress } from '../lib/boss'
import { earnedBadges } from '../lib/badges'
import { addDays, PLAN_START, weekStart } from '../lib/dates'
import { levelFor, levelProgress, memberTicks, memberXp, partyXp, BUCKETS, type BucketXp, type GameData } from '../lib/xp'
import type { Activity, Bill, BillPayment, Cheer, Milestone, Routine, RoutineLog, TriviaAttempt } from '../types'
import { useStyleChoice } from '../ui/StyleSwitch'
import { useHousehold } from './household'
import { useTable } from './useTable'
import { useToday } from './useToday'

const zeroXp = (): BucketXp => Object.fromEntries(BUCKETS.map((b) => [b, 0])) as BucketXp

function compute(on: boolean, day: string, meId: string, memberIds: string[], data: GameData, cheers: Cheer[]) {
  const week = weekStart(day)
  const boss = bossForWeek(week)
  if (!on) {
    // Classic and view-only copies never show the game layer, so none of it is worked out.
    const none = { xp: 0, level: 1, progress: levelProgress(0) }
    return { on, meId, memberIds, data, me: { ...none, byBucket: zeroXp(), badges: [] as string[] }, party: none, boss: { boss, week, progress: { value: 0, target: boss.target, defeated: false } } }
  }
  const mine = memberXp(data, meId)
  const party = partyXp(data, memberIds)
  const ticks = new Map(memberIds.map((id) => [id, memberTicks(data, id)]))
  const ticksOf = (id: string) => ticks.get(id) ?? []
  let bossesDefeated = 0
  for (let w = weekStart(PLAN_START); w <= week; w = addDays(w, 7)) if (bossProgress(bossForWeek(w), w, data, memberIds, ticksOf).defeated) bossesDefeated++
  const cheersSent = cheers.filter((c) => c.from_member === meId).length
  return {
    on,
    meId,
    memberIds,
    data,
    me: { xp: mine.total, level: levelFor(mine.total), progress: levelProgress(mine.total), byBucket: mine.byBucket, badges: earnedBadges(data, meId, memberIds, { cheersSent, bossesDefeated, partyXp: party }) },
    party: { xp: party, level: levelFor(party), progress: levelProgress(party) },
    boss: { boss, week, progress: bossProgress(boss, week, data, memberIds, ticksOf) },
  }
}

type Game = ReturnType<typeof compute>

// Several components on a screen ask for the game at once; they share one calculation per state of the saved lists.
let last: { deps: unknown[]; value: Game } | null = null
function shared(deps: unknown[], make: () => Game): Game {
  if (last && last.deps.length === deps.length && last.deps.every((d, i) => Object.is(d, deps[i]))) return last.value
  last = { deps, value: make() }
  return last.value
}

/** XP, levels and badges for me and for the two of us, worked out from what is already saved and synced. */
export function useGame(today?: string): Game {
  const style = useStyleChoice()
  const { me, members, readOnly } = useHousehold()
  const liveToday = useToday()
  const day = today ?? liveToday
  const on = style === 'anime' && !readOnly
  const routines = useTable<Routine>('routines').rows
  const logs = useTable<RoutineLog>('routine_logs').rows
  const activities = useTable<Activity>('activities').rows
  const milestones = useTable<Milestone>('milestones').rows
  const attempts = useTable<TriviaAttempt>('trivia_attempts').rows
  const payments = useTable<BillPayment>('bill_payments').rows
  const bills = useTable<Bill>('bills').rows
  const cheers = useTable<Cheer>('cheers').rows

  return shared([on, day, me.id, members, routines, logs, activities, milestones, attempts, payments, bills, cheers], () =>
    compute(on, day, me.id, members.map((m) => m.id), { routines, logs, activities, milestones, attempts, payments, bills }, cheers),
  )
}
