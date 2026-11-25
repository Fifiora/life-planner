import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TabBar } from '../src/ui/TabBar'

describe('Settings in the navigation bar', () => {
  it('is the last link in the bar, after the seven areas', () => {
    render(<MemoryRouter><TabBar /></MemoryRouter>)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(8)
    expect(links[7]).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
  })
  it('is left out on a view-only copy', () => {
    render(<MemoryRouter><TabBar showSettings={false} /></MemoryRouter>)
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(7)
  })
})
