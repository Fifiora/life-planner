import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Donut } from '../src/ui/Donut'
import { GroupedBars } from '../src/ui/GroupedBars'
import { TrendBars } from '../src/ui/TrendBars'

describe('Donut', () => {
  it('shows each category with its amount and share, and describes itself for screen readers', () => {
    render(<Donut shares={[{ category: 'housing', total: 750, pct: 75 }, { category: 'dining', total: 250, pct: 25 }]} />)
    expect(screen.getByRole('img', { name: /spending by category: housing 75%, dining 25%/i })).toBeInTheDocument()
    expect(screen.getByText('Housing')).toBeInTheDocument()
    expect(screen.getByText('$750')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })
  it('says so when nothing was spent', () => {
    render(<Donut shares={[]} />)
    expect(screen.getByText(/no spending yet/i)).toBeInTheDocument()
  })
})

describe('GroupedBars', () => {
  const rows = [
    { month: '2026-10', income: 10000, spent: 4000, planned: 4500, net: 6000, hasData: true },
    { month: '2026-11', income: 10000, spent: 0, planned: 4500, net: 10000, hasData: false },
  ]
  it('compares income and spending month by month with a text summary', () => {
    render(<GroupedBars rows={rows} />)
    expect(screen.getByRole('img', { name: /income versus spending/i })).toHaveAttribute('aria-label', expect.stringContaining('October 2026'))
  })
})

describe('TrendBars', () => {
  it('draws one category month by month', () => {
    render(<TrendBars label="Housing" months={['2026-10', '2026-11']} values={[2000, 2200]} />)
    expect(screen.getByRole('img', { name: /housing by month: october 2026 \$2,000, november 2026 \$2,200/i })).toBeInTheDocument()
  })
})
