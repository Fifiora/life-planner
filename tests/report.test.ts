import { describe, it, expect } from 'vitest'
import { buildReport } from '../src/lib/report'
import { reportInput, routine, tick } from './reportFixture'

const hasNaN = (v: unknown): boolean => (typeof v === 'number' ? !Number.isFinite(v) : v && typeof v === 'object' ? Object.values(v as object).some(hasNaN) : false)

describe('buildReport', () => {
  it('is empty and calm for a month with no data', () => {
    const r = buildReport('2026-10', reportInput())
    expect(r.month).toBe('2026-10')
    expect(r.range.partial).toBe(false)
    expect(r.routines).toEqual([])
    expect(r.insights).toEqual({ wins: [], improve: [] })
    expect(r.focus).toEqual([])
    expect(r.scorecard.completionPct).toBeNull()
    expect(hasNaN(r)).toBe(false)
  })
  it('puts the section results and the insights together', () => {
    const input = reportInput({ routines: [routine('r1', { name: 'Walk', applies_to: 'a' })], logs: [tick('1', 'r1', 'a', '2026-10-01')] })
    const r = buildReport('2026-10', input)
    expect(r.routines).toHaveLength(1)
    expect(r.scorecard.ticksByMember.a).toBe(1)
    expect(r.insights.improve[0].text).toBe('Walk (Ada) was done 3% of the time (1 of 31).')
  })
  it('passes the focus goals through', () => {
    const r = buildReport('2026-10', reportInput({ routines: [routine('r1')], logs: [tick('1', 'r1', 'a', '2026-10-02')] }), { focus: [{ text: 'Walk daily', done: false }] })
    expect(r.focus).toEqual([{ text: 'Walk daily', done: false }])
  })
  it('says there is no data when nothing was logged, even with routines and bills set up', () => {
    const input = reportInput({
      routines: [routine('r1', { name: 'Walk' })],
      bills: [{ id: 'b1', name: 'Rent', amount: 1700, category: 'housing', kind: 'recurring', due_month: null, paid: false }],
    })
    const r = buildReport('2026-10', input)
    expect(r.hasData).toBe(false)
    expect(r.insights).toEqual({ wins: [], improve: [] })
    expect(buildReport('2026-10', reportInput({ routines: [routine('r1')], logs: [tick('1', 'r1', 'a', '2026-10-02')] })).hasData).toBe(true)
  })
  it('marks the current month as partial', () => {
    expect(buildReport('2026-11', reportInput()).range.partial).toBe(true)
  })
})
