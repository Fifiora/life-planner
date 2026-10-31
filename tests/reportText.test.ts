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
    const text = md(buildReport('2026-11', reportInput({ routines: [sat] })), 'November 2026')
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
    const text = md(buildReport('2026-10', full(), { game: { level: 4, bossesBeaten: 1 } }))
    expect(text).toContain('- Level now: 4')
    expect(text).toContain('- Bosses beaten: 1')
  })
  it('never prints NaN, undefined or Infinity', () => {
    expect(md(buildReport('2026-10', reportInput()))).not.toMatch(/NaN|undefined|Infinity/)
    expect(md()).not.toMatch(/NaN|undefined|Infinity/)
  })
  it('names the file by month', () => {
    expect(reportFileName('2026-10')).toBe('life-planner-report-2026-10.md')
  })
})
