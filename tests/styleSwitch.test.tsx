import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StyleSwitch, StyleToggle } from '../src/ui/StyleSwitch'
import Settings from '../src/screens/Settings'
import { renderScreen, seedPlanner } from './seed'

beforeEach(() => {
  seedPlanner()
  document.documentElement.removeAttribute('data-style')
})

describe('style controls', () => {
  it('the header button names the style and flips it', async () => {
    render(<StyleToggle />)
    const btn = screen.getByRole('button', { name: 'Style: Anime. Tap for Classic.' })
    await userEvent.click(btn)
    expect(screen.getByRole('button', { name: 'Style: Classic. Tap for Anime.' })).toBeInTheDocument()
    expect(document.documentElement.dataset.style).toBe('classic')
    expect(localStorage.getItem('lp.style')).toBe('classic')
  })

  it('the sidebar switch shows the choice and changes it', async () => {
    render(<StyleSwitch />)
    const group = screen.getByRole('group', { name: 'Style' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anime' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Classic' }))
    expect(screen.getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.dataset.style).toBe('classic')
  })

  it('every control showing the style updates together', async () => {
    render(
      <>
        <StyleToggle />
        <StyleSwitch />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Style: Anime. Tap for Classic.' }))
    expect(screen.getByRole('button', { name: 'Classic' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Settings has a Style choice', async () => {
    renderScreen(<Settings />)
    const select = await screen.findByLabelText('Style')
    expect(select).toHaveValue('anime')
    await userEvent.selectOptions(select, 'Classic')
    expect(document.documentElement.dataset.style).toBe('classic')
  })
})
