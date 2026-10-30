import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Ring } from '../src/ui/Ring'
import { EmptyState } from '../src/ui/EmptyState'
import { TabBar } from '../src/ui/TabBar'

describe('Ring', () => {
  it('exposes its progress to assistive tech', () => {
    render(<Ring value={0.5} label="Health" color="#16a34a" />)
    const bar = screen.getByRole('progressbar', { name: 'Health' })
    expect(bar).toHaveAttribute('aria-valuenow', '50')
  })
  it('clamps values above 1 and below 0', () => {
    const { rerender } = render(<Ring value={2} label="A" color="#000" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    rerender(<Ring value={-1} label="A" color="#000" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('EmptyState', () => {
  it('renders its title and an action that can be clicked', async () => {
    const onAction = vi.fn()
    render(<EmptyState title="Nothing yet" actionLabel="Add one" onAction={onAction} />)
    expect(screen.getByText('Nothing yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Add one' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})

describe('TabBar', () => {
  it('links to the six main screens', () => {
    render(
      <MemoryRouter>
        <TabBar />
      </MemoryRouter>,
    )
    for (const name of ['Today', 'Health', 'Study', 'Travel', 'Food', 'Finance']) {
      expect(screen.getByRole('link', { name })).toBeInTheDocument()
    }
  })
})
