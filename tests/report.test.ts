import { describe, it, expect } from 'vitest'
import { buildReport } from '../src/lib/report'
import { bossesBeatenIn } from '../src/lib/boss'
import { reportInput, routine, run, tick } from './reportFixture'

const hasNaN = (v: unknown): boolean => (typeof v === 'number' ? !Number.isFinite(v) : v && typeof v === 'object' ? Object.values(v as object).some(hasNaN) : false)

describe('buildReport', () => {
  it('is empty and calm for a month with no data', () => {
    const r = buildReport('2026-10', reportInput())
    expect(r.month).toBe('2026-10')
    expect(r.range.partial).toBe(false)
    expect(r.routines).toEqual([])
    expect(r.insights).toEqual({ wins: [], improve: [] })
    expect(r.game).toBeNull()
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
  it('passes the game lines and the focus goals through', () => {
    const r = buildReport('2026-10', reportInput({ routines: [routine('r1')], logs: [tick('1', 'r1', 'a', '2026-10-02')] }), { game: { levels: { a: 4 }, bossesBeaten: 2 }, focus: [{ text: 'Walk daily', done: false }] })
    expect(r.game).toEqual({ levels: { a: 4 }, bossesBeaten: 2 })
    expect(r.focus).toEqual([{ text: 'Walk daily', done: false }])
    expect(r.insights.wins.map((w) => w.text)).toContain('Boss beaten 2 times.')
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

describe('bossesBeatenIn', () => {
  const data = (over: Record<string, unknown> = {}) => ({ routines: [], logs: [], activities: [], milestones: [], attempts: [], payments: [], bills: [], ...over }) as Parameters<typeof bossesBeatenIn>[1]
  it('counts defeated bosses for weeks starting in the month only', () => {
    const sphinx = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, week_start: '2026-11-09', member_id: 'a', text: 't', done: true }))
    const giant = run('2026-10-05', 1).flatMap((d) => Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, date: d, member_id: 'a', type: 'run', minutes: 10 })))
    const d = data({ milestones: sphinx, activities: giant })
    expect(bossesBeatenIn('2026-11', d, ['a', 'b'])).toBe(1)
    expect(bossesBeatenIn('2026-10', d, ['a', 'b'])).toBe(1)
    expect(bossesBeatenIn('2026-12', d, ['a', 'b'])).toBe(0)
  })
})
