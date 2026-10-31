import { describe, it, expect } from 'vitest'
import { parseImport } from '../src/lib/export'

describe('parseImport', () => {
  it('gives rows without an id a new one', () => {
    const out = parseImport('{"bills":[{"name":"Rent","amount":5}]}')
    expect(out.bills).toHaveLength(1)
    expect(out.bills[0].name).toBe('Rent')
    expect(typeof out.bills[0].id).toBe('string')
    expect((out.bills[0].id as string).length).toBeGreaterThan(8)
  })
  it('keeps existing ids and drops old household ids', () => {
    const out = parseImport('{"bills":[{"id":"x","household_id":"h","name":"Rent"}]}')
    expect(out.bills[0]).toEqual({ id: 'x', name: 'Rent' })
  })
  it('accepts empty tables', () => {
    expect(parseImport('{"places":[]}')).toEqual({ places: [] })
  })
  it('rejects text that is not JSON', () => {
    expect(() => parseImport('nope')).toThrow(/valid JSON/i)
  })
  it('rejects tables it does not know', () => {
    expect(() => parseImport('{"wat":[]}')).toThrow(/unknown/i)
  })
  it('rejects a table that is not a list', () => {
    expect(() => parseImport('{"bills":{}}')).toThrow(/list/i)
  })
  it('rejects a list containing something that is not a row', () => {
    expect(() => parseImport('{"bills":[5]}')).toThrow(/row/i)
  })
})
