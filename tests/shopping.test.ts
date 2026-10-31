import { describe, it, expect } from 'vitest'
import { countByType, groupShopping } from '../src/lib/shopping'

const item = (id: string, name: string, store: string, done = false) => ({ id, name, store, done, added_by: 'a' })

describe('groupShopping', () => {
  it('groups by store in the order they first appear, with items still to buy first', () => {
    const groups = groupShopping([item('1', 'Rice', 'African store', true), item('2', 'Yam', 'African store'), item('3', 'Milk', 'Groceries'), item('4', 'Eggs', 'Groceries')])
    expect(groups.map((g) => g.store)).toEqual(['African store', 'Groceries'])
    expect(groups[0].items.map((i) => i.name)).toEqual(['Yam', 'Rice'])
    expect(groups[1].items.map((i) => i.name)).toEqual(['Eggs', 'Milk'])
  })
  it('is empty with no items', () => {
    expect(groupShopping([])).toEqual([])
  })
})

describe('countByType', () => {
  it('counts a month\'s nights of one kind', () => {
    const log = [
      { id: '1', date: '2026-11-03', type: 'date', activity: 'x', snack: '', host_id: 'a' },
      { id: '2', date: '2026-11-17', type: 'date', activity: 'y', snack: '', host_id: 'b' },
      { id: '3', date: '2026-11-10', type: 'movie', activity: 'z', snack: '', host_id: 'a' },
      { id: '4', date: '2026-10-20', type: 'date', activity: 'old', snack: '', host_id: 'a' },
    ]
    expect(countByType(log, '2026-11', 'date')).toBe(2)
    expect(countByType(log, '2026-11', 'game')).toBe(0)
  })
})
