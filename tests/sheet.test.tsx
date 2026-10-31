import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sheet } from '../src/ui/Sheet'

describe('Sheet', () => {
  it('is drawn over the whole screen, not inside the card that opened it', () => {
    render(<section data-testid="card"><Sheet open onClose={() => {}} title="Add a routine"><p>form</p></Sheet></section>)
    const dialog = screen.getByRole('dialog', { name: 'Add a routine' })
    expect(dialog.closest('[data-testid="card"]')).toBeNull()
    expect(document.body.contains(dialog)).toBe(true)
  })
})
