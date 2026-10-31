import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { getAllRows, loadSnapshot } from '../src/data/tableStore'
import { PageHead } from '../src/ui/PageHead'
import { TabBar } from '../src/ui/TabBar'
import { renderScreen, seedPlanner } from './seed'

beforeEach(() => {
  seedPlanner()
  document.documentElement.removeAttribute('data-theme')
})

describe('theme button in the page header', () => {
  it('cycles Match my phone, Light, Dark and back, saving the choice and applying it', async () => {
    renderScreen(<PageHead title="Today" />)
    const btn = () => screen.getByRole('button', { name: /^Appearance:/ })
    expect(btn()).toHaveAccessibleName('Appearance: Match my phone. Tap for Light.')
    await userEvent.click(btn())
    expect(localStorage.getItem('lp.theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(btn()).toHaveAccessibleName('Appearance: Light. Tap for Dark.')
    await userEvent.click(btn())
    expect(localStorage.getItem('lp.theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(btn()).toHaveAccessibleName('Appearance: Dark. Tap for Match my phone.')
    await userEvent.click(btn())
    expect(localStorage.getItem('lp.theme')).toBeNull()
  })

  it('is there in a view-only copy too (it only changes how this phone looks)', () => {
    loadSnapshot(getAllRows())
    renderScreen(<PageHead title="Today" />)
    expect(screen.getByRole('button', { name: /^Appearance:/ })).toBeInTheDocument()
  })
})

describe('theme switch in the sidebar', () => {
  it('shows the three choices, marks the current one and changes it', async () => {
    render(<MemoryRouter><TabBar /></MemoryRouter>)
    const group = screen.getByRole('group', { name: 'Appearance' })
    const press = (name: string) => within(group).getByRole('button', { name })
    expect(press('Match my phone')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(press('Dark'))
    expect(localStorage.getItem('lp.theme')).toBe('dark')
    expect(press('Dark')).toHaveAttribute('aria-pressed', 'true')
    expect(press('Match my phone')).toHaveAttribute('aria-pressed', 'false')
  })

  it('keeps the header button and the sidebar switch in step', async () => {
    renderScreen(
      <>
        <PageHead title="Today" />
        <TabBar />
      </>,
    )
    await userEvent.click(within(screen.getByRole('group', { name: 'Appearance' })).getByRole('button', { name: 'Light' }))
    expect(screen.getByRole('button', { name: /^Appearance:/ })).toHaveAccessibleName('Appearance: Light. Tap for Dark.')
  })
})
