import { describe, it, expect } from 'vitest'
import { pickWinner } from '../src/lib/nights'
import type { NightOption, NightVote } from '../src/types'

const opt = (id: string): NightOption => ({ id, slot_date: '2026-11-14', type: 'game', proposed_by: 'a', activity: id, snack: 's' })
const vote = (option_id: string, member_id: string): NightVote => ({ id: `${option_id}-${member_id}`, option_id, member_id })

describe('pickWinner', () => {
  it('returns the option with the most votes', () => {
    expect(pickWinner([opt('x'), opt('y')], [vote('x', 'a'), vote('x', 'b'), vote('y', 'c')])).toBe('x')
  })
  it('returns null on a tie', () => {
    expect(pickWinner([opt('x'), opt('y')], [vote('x', 'a'), vote('y', 'b')])).toBeNull()
  })
  it('returns null with no votes', () => {
    expect(pickWinner([opt('x')], [])).toBeNull()
  })
  it('returns null with no options', () => {
    expect(pickWinner([], [])).toBeNull()
  })
  it('counts one vote per member per slot', () => {
    expect(pickWinner([opt('x'), opt('y')], [vote('x', 'a'), vote('y', 'a')])).toBe('y')
  })
})
