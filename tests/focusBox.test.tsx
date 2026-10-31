import { describe, it, expect, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadSnapshot } from '../src/data/tableStore'
import Report from '../src/screens/Report'
import { parseFocus } from '../src/lib/focus'
import { renderScreen, saved, seedPlanner } from './seed'

const page = (month: string) => renderScreen(<Report today="2026-11-03" />, `/report?month=${month}`)
const stored = (key: string) => saved('settings').find((r) => r.key === key)?.value as string | undefined

beforeEach(() => seedPlanner())

describe("Next month's focus", () => {
  it('saves a goal for the month after the one being read', async () => {
    page('2026-10')
    await userEvent.type(await screen.findByLabelText('Goal 1'), 'Walk daily')
    await userEvent.tab()
    expect(parseFocus(stored('focus:2026-11'))).toEqual([{ text: 'Walk daily', done: false }])
  })
  it('has room for three goals, no more', async () => {
    page('2026-10')
    await screen.findByLabelText('Goal 1')
    expect(screen.getAllByLabelText(/^Goal \d$/)).toHaveLength(3)
  })
  it('stops a goal at 80 characters', async () => {
    page('2026-10')
    await userEvent.type(await screen.findByLabelText('Goal 1'), 'x'.repeat(100))
    await userEvent.tab()
    expect(parseFocus(stored('focus:2026-11'))[0].text).toHaveLength(80)
  })
  it('does not save blank goals', async () => {
    page('2026-10')
    await userEvent.type(await screen.findByLabelText('Goal 2'), '   ')
    await userEvent.tab()
    expect(parseFocus(stored('focus:2026-11'))).toEqual([])
  })
})

describe("Last month's goals in the next report", () => {
  const withGoals = () => localStorage.setItem('lp.data.settings', JSON.stringify([...saved('settings'), { id: 'f1', key: 'focus:2026-11', value: JSON.stringify([{ text: 'Walk daily', done: false }]) }]))
  it('are listed with a tick box that saves', async () => {
    withGoals()
    page('2026-11')
    expect(await screen.findByText('Our focus for November')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Done: Walk daily' }))
    expect(parseFocus(stored('focus:2026-11'))).toEqual([{ text: 'Walk daily', done: true }])
  })
  it('show nothing when the saved text is corrupt', async () => {
    localStorage.setItem('lp.data.settings', JSON.stringify([...saved('settings'), { id: 'f1', key: 'focus:2026-11', value: '{broken' }]))
    page('2026-11')
    await screen.findByRole('heading', { name: 'Scorecard' })
    expect(screen.queryByText('Our focus for November')).toBeNull()
  })
  it('are read-only in a view-only copy', async () => {
    const members = [{ id: 'a', display_name: 'Ada', color: '#16a34a', user_id: '' }, { id: 'b', display_name: 'Ben', color: '#6366f1', user_id: '' }]
    loadSnapshot({ members, settings: [{ id: 'f1', key: 'focus:2026-11', value: JSON.stringify([{ text: 'Walk daily', done: false }]) }] })
    page('2026-11')
    expect(await screen.findByRole('checkbox', { name: 'Done: Walk daily' })).toBeDisabled()
    expect(within(await screen.findByRole('heading', { name: "Next month's focus" }).then((h) => h.closest('section')!)).getByLabelText('Goal 1')).toHaveAttribute('readonly')
  })
})
