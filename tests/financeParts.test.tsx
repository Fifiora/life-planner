import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryBars } from '../src/ui/CategoryBars'
import { ForecastTable } from '../src/ui/ForecastTable'
import { PayoffCard } from '../src/ui/PayoffCard'
import type { Bill } from '../src/types'

describe('CategoryBars', () => {
  it('lists each category with its amount and share of income', () => {
    render(<CategoryBars rows={[{ category: 'housing', total: 2000, count: 1, pctOfIncome: 20 }, { category: 'subscriptions', total: 20, count: 2, pctOfIncome: 0.2 }]} />)
    expect(screen.getByText('Housing')).toBeInTheDocument()
    expect(screen.getByText(/\$2,000/)).toBeInTheDocument()
    expect(screen.getByText(/20% of income/)).toBeInTheDocument()
    expect(screen.getByText('Subscriptions')).toBeInTheDocument()
    expect(screen.getByText(/2 bills/)).toBeInTheDocument()
  })
  it('says so when there are no monthly bills', () => {
    render(<CategoryBars rows={[]} />)
    expect(screen.getByText(/no monthly bills yet/i)).toBeInTheDocument()
  })
})

describe('ForecastTable', () => {
  const base = { recurring: 3020, deficit: 0 }
  const rows = [
    { ...base, month: '2026-11', oneTime: 4000, available: 2980, savings: 2980, shortfall: 2020 },
    { ...base, month: '2026-12', oneTime: 1000, available: 5980, savings: 5000, shortfall: 0 },
  ]
  it('shows each month with what is short or on target', () => {
    render(<ForecastTable rows={rows} target={5000} />)
    expect(screen.getByText('November 2026')).toBeInTheDocument()
    expect(screen.getByText(/\$2,020 short/)).toBeInTheDocument()
    expect(screen.getByText('December 2026')).toBeInTheDocument()
    expect(screen.getByText(/on target/i)).toBeInTheDocument()
  })
  it('has a text summary for screen readers', () => {
    render(<ForecastTable rows={rows} target={5000} />)
    expect(screen.getByRole('img', { name: /projected savings/i })).toBeInTheDocument()
  })
})

describe('PayoffCard', () => {
  const bill = (name: string, amount: number, due_month: string, paid: boolean): Bill => ({ id: name, name, amount, category: 'debt', kind: 'one_time', due_month, paid })
  it('shows progress, what is left, the days to the deadline and anything overdue', () => {
    const payoff = {
      total: 5500, paid: 4000, remaining: 1500, pct: 73, daysLeft: 47,
      overdue: [bill('Old', 500, '2026-10', false)],
      items: [
        { bill: bill('Old', 500, '2026-10', false), status: 'overdue' as const },
        { bill: bill('Card A', 4000, '2026-11', true), status: 'paid' as const },
        { bill: bill('Trip', 1000, '2026-12', false), status: 'upcoming' as const },
      ],
    }
    render(<PayoffCard payoff={payoff} deadlineLabel="Jan 1, 2027" />)
    expect(screen.getByText(/\$1,500/)).toBeInTheDocument()
    expect(screen.getByText(/47 days left/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /payoffs cleared/i })).toHaveAttribute('aria-valuenow', '73')
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Card A')).toBeInTheDocument()
  })
  it('celebrates when everything is cleared', () => {
    render(<PayoffCard payoff={{ total: 100, paid: 100, remaining: 0, pct: 100, daysLeft: 10, overdue: [], items: [] }} deadlineLabel="Jan 1, 2027" />)
    expect(screen.getByText(/all cleared/i)).toBeInTheDocument()
  })
})
