import type { Place } from '../types'

/** Up to and including 6 hours of driving is a monthly trip; farther is quarterly. */
export function tierFor(hours: number): 'monthly' | 'quarterly' {
  return hours <= 6 ? 'monthly' : 'quarterly'
}

export function sortPlaces(places: Place[]): Place[] {
  return [...places].sort((a, b) => a.rank - b.rank || a.drive_hours - b.drive_hours)
}
