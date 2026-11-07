import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Donut } from '../src/ui/Donut'
import { BreakdownPanel } from '../src/ui/BreakdownPanel'

describe('Donut with a still-to-pay part', () => {
  const shares = [
    { category: 'housing', total: 1500, pct: 100, toGo: 500 },
    { category: 'debt', total: 0, pct: 0, toGo: 300 },
  ]
  it('draws the part paid and the part still to pay for each category', () => {
    const { container } = render(<Donut shares={shares} centerLabel="$1,500" centerSub="of $2,300" />)
    expect(container.querySelector('circle[data-category="housing"]')).not.toBeNull()
    expect(container.querySelector('circle[data-togo="housing"]')).not.toBeNull()
    expect(container.querySelector('circle[data-togo="debt"]')).not.toBeNull()
    expect(container.querySelector('circle[data-category="debt"]')).toBeNull()
    expect(screen.getByText('of $2,300')).toBeInTheDocument()
  })
  it('lists categories with nothing paid yet, and what is still to pay', () => {
    render(<Donut shares={shares} />)
    expect(screen.getByRole('button', { name: /debt/i })).toHaveTextContent('+$300 to go')
    expect(screen.getByRole('button', { name: /housing/i })).toHaveTextContent('$1,500')
    expect(screen.getByRole('button', { name: /housing/i })).toHaveTextContent('+$500 to go')
  })
  it('says in its description how much is still to pay', () => {
    render(<Donut shares={shares} />)
    expect(screen.getByRole('img', { name: /still to pay \$800/i })).toBeInTheDocument()
  })
  it('is unchanged when nothing is still to pay', () => {
    const { container } = render(<Donut shares={[{ category: 'housing', total: 100, pct: 100 }]} />)
    expect(container.querySelector('circle[data-togo]')).toBeNull()
    expect(screen.queryByText(/to go/)).toBeNull()
  })
})

describe('BreakdownPanel with part payments', () => {
  it('shows "paid of planned" for a part-paid bill and lists what is still to pay', () => {
    const breakdown = {
      category: 'housing',
      rows: [{ label: 'Rent', amount: 1500, kind: 'bill' as const, of: 2000 }],
      total: 1500,
      previousTotal: 0,
      change: 1500,
      hasPrevious: false,
      toGo: [{ label: 'Rent', amount: 500, kind: 'bill' as const }, { label: 'Parking', amount: 50, kind: 'bill' as const }],
      toGoTotal: 550,
    }
    render(<BreakdownPanel breakdown={breakdown} income={10000} planned={false} />)
    expect(screen.getByText('of $2,000')).toBeInTheDocument()
    expect(screen.getByText(/still to pay/i)).toHaveTextContent('$550')
    expect(screen.getByText('Parking')).toBeInTheDocument()
  })
})
