import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SharedCopyNotice } from '../src/ui/SharedCopyNotice'

beforeEach(() => localStorage.clear())

describe('SharedCopyNotice', () => {
  it('shows nothing when no copy was shared with this phone', () => {
    const { container } = render(<SharedCopyNotice onOpen={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers to open the shared copy that this phone remembers', async () => {
    localStorage.setItem('lp.snapshot', 'g.abc')
    const onOpen = vi.fn()
    render(<SharedCopyNotice onOpen={onOpen} />)
    await userEvent.click(screen.getByRole('button', { name: /view the shared copy/i }))
    expect(onOpen).toHaveBeenCalledWith('g.abc')
  })
})
