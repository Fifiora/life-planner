import { describe, it, expect } from 'vitest'
import { buildReport } from '../src/lib/report'
import { reportFileName, reportToMarkdown } from '../src/lib/reportText'
import { members, reportInput, routine, run, tick } from './reportFixture'

const walk = routine('r1', { name: 'Walk', applies_to: 'a' })
const full = () => reportInput({ routines: [walk], logs: [...run('2026-10-01', 31).map((d, i) => tick(`o${i}`, 'r1', 'a', d)), ...run('2026-09-01', 24).map((d, i) => tick(`s${i}`, 'r1', 'a', d))] })
const md = (r = buildReport('2026-10', full()), title = 'October 2026') => reportToMarkdown(r, members, title)

describe('reportToMarkdown', () => {
  it('starts with the title and has every section', () => {
    const text = md()
    expect(text.split('\n')[0]).toBe('# Life Planner report: October 2026')
    for (const h of ['Scorecard', 'Routines', 'Health', 'Study', 'Travel', 'Food', 'Finance', 'Calendar', 'Wins', 'Improve next month']) expect(text).toContain(`## ${h}`)
  })
  it('prints each person with this month and last month', () => {
    const text = md()
    expect(text).toContain('- Ada: 31 ticks (24 last month)')
    expect(text).toContain('- Ben: 0 ticks (0 last month)')
  })
  it('says Nothing logged everywhere, scorecard and routines included, when the month has no data', () => {
    const text = md(buildReport('2026-10', reportInput({ routines: [walk], bills: [{ id: 'b1', name: 'Rent', amount: 1700, category: 'housing', kind: 'recurring', due_month: null, paid: false }] })))
    expect(text).not.toContain('Walk (Ada)')
    expect(text).not.toContain('Bills paid')
    expect(text.match(/- Nothing logged/g)!.length).toBe(8)
  })
  it('says (so far) for the current month', () => {
    expect(md(buildReport('2026-11', full()), 'November 2026').split('\n')[0]).toBe('# Life Planner report: November 2026 (so far)')
  })
  it('says Nothing logged for empty sections and None this month for no wins', () => {
    const text = md(buildReport('2026-10', reportInput()))
    expect(text.match(/Nothing logged/g)!.length).toBeGreaterThanOrEqual(6)
    expect(text).toContain('- None this month.')
  })
  it('labels trivia as all time and prints a dash for an unknown percent', () => {
    const sat = routine('r2', { name: 'Sat walk', applies_to: 'a', cadence: 'weekly', weekday: 6 })
    const attempts = [{ id: 't1', question_id: 'q1', member_id: 'a', chosen_index: 0, correct: true }]
    const text = md(buildReport('2026-11', reportInput({ routines: [sat, walk], logs: [tick('w1', 'r1', 'a', '2026-11-01')], attempts })), 'November 2026')
    expect(text).toContain('Trivia (all time)')
    expect(text).toMatch(/Sat walk \(Ada\): 0 of 0 \(—\)/)
  })
  it('prints wins and improvements as list lines', () => {
    const text = md()
    expect(text).toContain('- Walk (Ada): 100% done. Keep it up!')
  })
  it('prints this month\'s focus goals with check boxes', () => {
    const text = md(buildReport('2026-10', full(), { focus: [{ text: 'Walk daily', done: true }, { text: 'Pay bills early', done: false }] }))
    expect(text).toContain('## Focus for October')
    expect(text).toContain('- [x] Walk daily')
    expect(text).toContain('- [ ] Pay bills early')
  })
  it('shows the game lines only when the report has them', () => {
    expect(md()).not.toContain('Level now')
    const text = md(buildReport('2026-10', full(), { game: { levels: { a: 4, b: 3 }, bossesBeaten: 1 } }))
    expect(text).toContain('- Level now: Ada 4, Ben 3')
    expect(text).toContain('- Bosses beaten: 1')
  })
  it('never prints NaN, undefined or Infinity', () => {
    expect(md(buildReport('2026-10', reportInput()))).not.toMatch(/NaN|undefined|Infinity/)
    expect(md()).not.toMatch(/NaN|undefined|Infinity/)
  })
  it('shows the workout types, friendly dates and capitalised categories', () => {
    const act = (id: string, type: string) => ({ id, date: '2026-10-07', member_id: 'a', type, minutes: 20 })
    const input = reportInput({
      routines: [walk],
      logs: [tick('1', 'r1', 'a', '2026-10-01')],
      activities: [act('x1', 'run'), act('x2', 'run'), act('x3', 'swim')],
      expenses: [{ id: 'e1', date: '2026-10-05', amount: 30, category: 'dining', note: '', member_id: 'a' }],
    })
    const text = md(buildReport('2026-10', input))
    expect(text).toContain('- Ada: 3 workouts (run 2, swim 1), 60 minutes')
    expect(text).toContain('- Dining: $30 against no budget')
    expect(text).toContain('starting with the week of Oct 12')
  })
  it('counts the focus goals in the scorecard and opens with them', () => {
    const text = md(buildReport('2026-10', full(), { focus: [{ text: 'Walk daily', done: true }, { text: 'Pay bills early', done: false }] }))
    expect(text).toContain('- Focus goals: 1 of 2 done')
    const lines = text.split('\n')
    expect(lines.indexOf('## Focus for October')).toBeLessThan(lines.indexOf('## Scorecard'))
  })
  it('calls out the three strongest routines', () => {
    const rts = ['A', 'B', 'C', 'D'].map((n, i) => routine(`r${i}`, { name: n, applies_to: 'a' }))
    const logs = [...run('2026-10-01', 31).map((d, i) => tick(`a${i}`, 'r0', 'a', d)), ...run('2026-10-01', 20).map((d, i) => tick(`b${i}`, 'r1', 'a', d)), ...run('2026-10-01', 10).map((d, i) => tick(`c${i}`, 'r2', 'a', d)), ...run('2026-10-01', 5).map((d, i) => tick(`d${i}`, 'r3', 'a', d))]
    const text = md(buildReport('2026-10', reportInput({ routines: rts, logs })))
    expect(text).toContain('- Strongest: A (Ada) 100%, B (Ada) 65%, C (Ada) 32%')
  })
  it('names the file by month', () => {
    expect(reportFileName('2026-10')).toBe('life-planner-report-2026-10.md')
  })
})
