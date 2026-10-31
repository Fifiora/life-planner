import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HouseholdContext } from '../src/data/household'
import { resetStore } from '../src/data/tableStore'
import { todayCT, weekStart } from '../src/lib/dates'
import { TurnCard } from '../src/ui/TurnCard'

const ada = { id: 'a', display_name: 'Ada', color: '#111' }
const ben = { id: 'b', display_name: 'Ben', color: '#222' }

const renderCard = () =>
  render(
    <HouseholdContext.Provider value={{ householdId: 'home', members: [ada, ben], me: ada, readOnly: false, switchTo: () => {} }}>
      <TurnCard name="Bible study lead" title="Sunday Bible study" />
    </HouseholdContext.Provider>,
  )

const savedTurns = () => JSON.parse(localStorage.getItem('lp.data.turns') ?? '[]')

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

describe('TurnCard', () => {
  it('starts with the first person leading', () => {
    renderCard()
    expect(screen.getByText(/Sunday Bible study/)).toBeInTheDocument()
    expect(screen.getByText('Leads this week: Ada')).toBeInTheDocument()
  })

  it('shows who is next in line when a turn was saved', () => {
    localStorage.setItem('lp.data.turns', JSON.stringify([{ id: 't', name: 'Bible study lead', current_member_id: 'b', last_rotated_slot: null }]))
    renderCard()
    expect(screen.getByText('Leads this week: Ben')).toBeInTheDocument()
  })

  it('passes the lead on once, and remembers it was done this week', async () => {
    renderCard()
    await userEvent.click(screen.getByRole('button', { name: /pass the lead/i }))
    expect(await screen.findByText(/done this week/i)).toBeInTheDocument()
    expect(screen.getByText(/Ben leads next/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pass the lead/i })).not.toBeInTheDocument()
    expect(savedTurns()).toEqual([
      expect.objectContaining({ name: 'Bible study lead', current_member_id: 'b', last_rotated_slot: weekStart(todayCT()) }),
    ])
  })
})
