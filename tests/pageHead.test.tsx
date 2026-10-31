import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { HouseholdContext, type HouseholdValue } from '../src/data/household'
import { PageHead } from '../src/ui/PageHead'

const ada = { id: 'a', display_name: 'Ada', color: '#111' }
const ben = { id: 'b', display_name: 'Ben', color: '#222' }

function renderHead(over: Partial<HouseholdValue>) {
  const switchTo = vi.fn()
  const value: HouseholdValue = { householdId: 'home', members: [ada, ben], me: ada, readOnly: false, switchTo, ...over }
  render(
    <MemoryRouter>
      <HouseholdContext.Provider value={value}>
        <PageHead title="Today" />
      </HouseholdContext.Provider>
    </MemoryRouter>,
  )
  return switchTo
}

describe('PageHead', () => {
  it('shows who is using the app and switches to the other person', async () => {
    const switchTo = renderHead({})
    const chip = screen.getByRole('button', { name: /switch person/i })
    expect(chip).toHaveTextContent('Ada')
    await userEvent.click(chip)
    expect(switchTo).toHaveBeenCalledWith('b')
  })

  it('on a shared copy shows a view-only badge and lets her look as either person, with no settings', async () => {
    const switchTo = renderHead({ readOnly: true })
    expect(screen.getByText(/view-only/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /switch person/i }))
    expect(switchTo).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })
})
