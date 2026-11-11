import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import Today from '../src/screens/Today'
import Health from '../src/screens/Health'
import Settings from '../src/screens/Settings'
import { renderScreen, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

describe('There is no game layer', () => {
  it('Today has no levels, trophies, boss, mascot, cheers or episode', async () => {
    renderScreen(<Today />)
    await screen.findByRole('progressbar', { name: 'Done today' })
    expect(screen.queryByText(/Party/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Trophies' })).toBeNull()
    expect(screen.queryByLabelText('Weekly boss')).toBeNull()
    expect(screen.queryByRole('img', { name: /^Pip/ })).toBeNull()
    expect(screen.queryByText(/cheered you on/)).toBeNull()
    expect(screen.queryByText(/Arc \d/)).toBeNull()
  })
  it('bucket screens have no level chip', async () => {
    renderScreen(<Health />)
    await screen.findByRole('heading', { name: 'Health' })
    expect(screen.queryByRole('img', { name: /level/i })).toBeNull()
  })
  it('Settings has no Trophies or Episodes', async () => {
    renderScreen(<Settings />)
    await screen.findByLabelText('Appearance')
    expect(screen.queryByRole('heading', { name: 'Trophies' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Episodes' })).toBeNull()
  })
})
