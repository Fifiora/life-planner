import { describe, it, expect } from 'vitest'
import { tripRhythm } from '../src/lib/trips'
import type { Place, TripPlan } from '../src/types'

const place = (id: string, rank: number, drive_hours: number, visited = false): Place => ({ id, name: id, rank, drive_hours, visited })
const trip = (place_id: string, planned_month: string, status: TripPlan['status'] = 'done'): TripPlan => ({ id: `${place_id}${planned_month}`, place_id, planned_month, status })

describe('tripRhythm', () => {
  const places = [place('A', 1, 3, true), place('B', 2, 9, true), place('C', 3, 4), place('D', 4, 12)]

  it('says when the next monthly and quarterly trips are due and suggests where to go', () => {
    const r = tripRhythm([trip('A', '2026-10'), trip('B', '2026-08')], places, '2026-11-15')
    expect(r.monthly).toEqual({ lastDone: '2026-10', dueMonth: '2026-11', status: 'due', suggestion: 'C' })
    expect(r.quarterly).toEqual({ lastDone: '2026-08', dueMonth: '2026-11', status: 'due', suggestion: 'D' })
  })
  it('is upcoming when the last trip was recent', () => {
    const r = tripRhythm([trip('A', '2026-11'), trip('B', '2026-10')], places, '2026-11-15')
    expect(r.monthly).toMatchObject({ dueMonth: '2026-12', status: 'upcoming' })
    expect(r.quarterly).toMatchObject({ dueMonth: '2027-01', status: 'upcoming' })
  })
  it('is overdue when it has been too long', () => {
    const r = tripRhythm([trip('A', '2026-08')], places, '2026-11-15')
    expect(r.monthly.status).toBe('overdue')
  })
  it('is due now when there has never been a trip, and has no suggestion when everything is visited', () => {
    const r = tripRhythm([], [place('A', 1, 3, true)], '2026-11-15')
    expect(r.monthly).toEqual({ lastDone: null, dueMonth: '2026-11', status: 'due', suggestion: null })
    expect(r.quarterly.suggestion).toBeNull()
  })
  it('ignores trips that are only planned', () => {
    const r = tripRhythm([trip('A', '2026-11', 'planned')], places, '2026-11-15')
    expect(r.monthly.lastDone).toBeNull()
  })
})
