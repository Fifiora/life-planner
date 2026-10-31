import { describe, it, expect } from 'vitest'
import { focusKey, parseFocus, serializeFocus } from '../src/lib/focus'

describe('focus goals', () => {
  it('has a key per month', () => {
    expect(focusKey('2026-11')).toBe('focus:2026-11')
  })
  it('reads nothing from bad or missing text', () => {
    for (const raw of [undefined, 'nope', '{}', '[1]', '[{"text":5}]']) expect(parseFocus(raw)).toEqual([])
  })
  it('keeps three goals, trims, drops blanks and cuts to 80 characters', () => {
    const raw = JSON.stringify([{ text: '  Walk daily  ', done: 1 }, { text: '   ' }, { text: 'x'.repeat(100), done: false }, { text: 'Three', done: true }, { text: 'Four' }])
    const goals = parseFocus(raw)
    expect(goals).toHaveLength(3)
    expect(goals[0]).toEqual({ text: 'Walk daily', done: true })
    expect(goals[1].text).toHaveLength(80)
    expect(goals[2]).toEqual({ text: 'Three', done: true })
  })
  it('round-trips and drops blanks', () => {
    const goals = [{ text: 'Cook at home', done: false }, { text: '', done: false }, { text: 'Pay bills early', done: true }]
    expect(parseFocus(serializeFocus(goals))).toEqual([{ text: 'Cook at home', done: false }, { text: 'Pay bills early', done: true }])
  })
})
