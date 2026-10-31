import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import Settings from '../src/screens/Settings'
import Today from '../src/screens/Today'
import { loadSnapshot } from '../src/data/tableStore'
import { ReportCard } from '../src/ui/ReportCard'
import { renderScreen, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

describe('ReportCard', () => {
  it('announces last month\'s report during the first week', async () => {
    renderScreen(<ReportCard today="2026-11-03" />)
    expect(await screen.findByText('Your October 2026 report is ready')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open report' })).toHaveAttribute('href', '/report?month=2026-10')
  })
  it('shows in Classic too', async () => {
    localStorage.setItem('lp.style', 'classic')
    renderScreen(<ReportCard today="2026-11-03" />)
    expect(await screen.findByText('Your October 2026 report is ready')).toBeInTheDocument()
  })
  it('is gone later in the month and before the plan began', async () => {
    const later = renderScreen(<ReportCard today="2026-11-12" />)
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByText(/report is ready/)).toBeNull()
    later.unmount()
    renderScreen(<ReportCard today="2026-10-03" />)
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByText(/report is ready/)).toBeNull()
  })
})

describe('Settings', () => {
  it('links to the month-end report', async () => {
    renderScreen(<Settings />)
    expect(await screen.findByRole('link', { name: 'Month-end report' })).toHaveAttribute('href', '/report')
  })
})

describe('Today link', () => {
  it('always has a way to the report', async () => {
    renderScreen(<Today />)
    expect(await screen.findByRole('link', { name: 'Month-end report' })).toHaveAttribute('href', '/report')
  })
  it('is there in a view-only copy too', async () => {
    loadSnapshot({ members: [{ id: 'a', display_name: 'Ada', color: '#16a34a', user_id: '' }, { id: 'b', display_name: 'Ben', color: '#6366f1', user_id: '' }] })
    renderScreen(<Today />)
    expect(await screen.findByRole('link', { name: 'Month-end report' })).toHaveAttribute('href', '/report')
  })
})
