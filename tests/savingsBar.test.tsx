import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SavingsBar } from '../src/ui/SavingsBar'

describe('SavingsBar', () => {
  it('shows progress toward the target and the shortfall in words', () => {
    render(<SavingsBar savings={3000} target={5000} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '60')
    expect(screen.getByText(/2,000 short/)).toBeInTheDocument()
  })
  it('says the target is met when savings reach it', () => {
    render(<SavingsBar savings={5000} target={5000} />)
    expect(screen.getByText(/target met/i)).toBeInTheDocument()
  })
  it('does not divide by zero when the target is zero', () => {
    render(<SavingsBar savings={0} target={0} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
