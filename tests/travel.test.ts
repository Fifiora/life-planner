import { describe, it, expect } from 'vitest'
import { tierFor, sortPlaces } from '../src/lib/travel'
import type { Place } from '../src/types'

const place = (id: string, rank: number, drive_hours: number): Place => ({ id, name: id, rank, drive_hours, visited: false })

describe('tierFor', () => {
  it('treats exactly 6 hours as monthly', () => {
    expect(tierFor(6)).toBe('monthly')
  })
  it('treats more than 6 hours as quarterly', () => {
    expect(tierFor(6.1)).toBe('quarterly')
  })
  it('treats zero hours as monthly', () => {
    expect(tierFor(0)).toBe('monthly')
  })
})

describe('sortPlaces', () => {
  it('returns an empty list for no places', () => {
    expect(sortPlaces([])).toEqual([])
  })
  it('orders by rank, then by shorter drive', () => {
    const sorted = sortPlaces([place('c', 2, 3), place('a', 1, 5), place('b', 1, 2)])
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })
  it('does not modify the input list', () => {
    const input = [place('b', 2, 1), place('a', 1, 1)]
    sortPlaces(input)
    expect(input.map((p) => p.id)).toEqual(['b', 'a'])
  })
})
