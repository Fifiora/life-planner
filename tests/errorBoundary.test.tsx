import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '../src/ui/ErrorBoundary'

function Boom(): never {
  throw new Error('bad data')
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('shows the app normally when nothing is wrong', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows a way out instead of a blank screen, and can remove a shared copy', async () => {
    localStorage.setItem('lp.snapshot', 'g.abc')
    const onRemoveCopy = vi.fn()
    render(
      <ErrorBoundary onRemoveCopy={onRemoveCopy}>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /remove the shared copy/i }))
    expect(onRemoveCopy).toHaveBeenCalledTimes(1)
  })

  it('only offers to remove a shared copy when this phone has one', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.queryByRole('button', { name: /remove the shared copy/i })).not.toBeInTheDocument()
  })
})
