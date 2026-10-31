import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('Donut selection', () => {
  const shares = [{ category: 'housing', total: 750, pct: 75 }, { category: 'dining', total: 250, pct: 25 }]
  const detail = (c: string) => <p>{`Details for ${c}`}</p>

  it('shows a category breakdown when its row is chosen, dims the rest, and restores on a second choice', async () => {
    render(<Donut shares={shares} detail={detail} />)
    const housing = screen.getByRole('button', { name: /housing/i })
    const dining = screen.getByRole('button', { name: /dining/i })
    expect(housing).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(housing)
    expect(housing).toHaveAttribute('aria-pressed', 'true')
    expect(dining).toHaveAttribute('data-dimmed', 'true')
    expect(within(screen.getByRole('complementary', { name: 'Breakdown for Housing' })).getByText('Details for housing')).toBeInTheDocument()
    await userEvent.click(housing)
    expect(housing).toHaveAttribute('aria-pressed', 'false')
    expect(dining).not.toHaveAttribute('data-dimmed')
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('selects by clicking a slice and switches to another category', async () => {
    const { container } = render(<Donut shares={shares} detail={detail} />)
    await userEvent.click(container.querySelector('circle[data-category="dining"]')!)
    expect(screen.getByRole('complementary', { name: 'Breakdown for Dining' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /housing/i }))
    expect(screen.getByRole('complementary', { name: 'Breakdown for Housing' })).toBeInTheDocument()
  })

  it('restores everything with Show all or by clicking the empty chart area', async () => {
    render(<Donut shares={shares} detail={detail} />)
    await userEvent.click(screen.getByRole('button', { name: /housing/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(screen.queryByRole('complementary')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /housing/i }))
    await userEvent.click(screen.getByRole('img', { name: /spending by category/i }))
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('gives each slice a tooltip with its amount', () => {
    const { container } = render(<Donut shares={shares} detail={detail} />)
    expect(container.querySelector('circle[data-category="housing"] title')).toHaveTextContent('Housing: $750 (75%)')
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
