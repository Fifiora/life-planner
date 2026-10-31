import type { Place, TripPlan } from '../types'
import { shiftMonthKey } from './format'
import { sortPlaces, tierFor } from './travel'

export interface Rhythm {
  lastDone: string | null
  dueMonth: string
  status: 'upcoming' | 'due' | 'overdue'
  suggestion: string | null // id of the top-ranked place not yet visited
}

/** When the next monthly (nearby) and quarterly (far) trips are due, and where to go. */
export function tripRhythm(trips: TripPlan[], places: Place[], today: string): { monthly: Rhythm; quarterly: Rhythm } {
  const now = today.slice(0, 7)
  const one = (tier: 'monthly' | 'quarterly'): Rhythm => {
    const inTier = places.filter((p) => tierFor(p.drive_hours) === tier)
    const ids = new Set(inTier.map((p) => p.id))
    const lastDone = trips.filter((t) => t.status === 'done' && ids.has(t.place_id)).map((t) => t.planned_month).sort().at(-1) ?? null
    const dueMonth = lastDone ? shiftMonthKey(lastDone, tier === 'monthly' ? 1 : 3) : now
    return {
      lastDone,
      dueMonth,
      status: dueMonth > now ? 'upcoming' : dueMonth === now ? 'due' : 'overdue',
      suggestion: sortPlaces(inTier.filter((p) => !p.visited))[0]?.id ?? null,
    }
  }
  return { monthly: one('monthly'), quarterly: one('quarterly') }
}
