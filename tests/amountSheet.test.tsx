import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountSheet } from '../src/ui/AmountSheet'

const setup = (over: Partial<Parameters<typeof AmountSheet>[0]> = {}) => {
  const onSave = vi.fn()
  const onClose = vi.fn()
  render(<AmountSheet open title="Amount paid" label="Amount" initial={120} onSave={onSave} onClose={onClose} {...over} />)
  return { onSave, onClose, dialog: screen.getByRole('dialog', { name: 'Amount paid' }) }
}

describe('AmountSheet', () => {
  it('starts on the current amount and saves a new one', async () => {
    const { onSave, dialog } = setup()
    const input = within(dialog).getByLabelText('Amount')
    expect(input).toHaveValue('120')
    await userEvent.clear(input)
    await userEvent.type(input, '95.50')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(95.5)
  })
  it('refuses an empty, zero or negative amount', async () => {
    const { onSave, dialog } = setup()
    const input = within(dialog).getByLabelText('Amount')
    for (const bad of ['', '0', '-5', 'abc']) {
      await userEvent.clear(input)
      if (bad) await userEvent.type(input, bad)
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
      expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter an amount greater than 0.')
    }
    expect(onSave).not.toHaveBeenCalled()
  })
  it('offers a one-tap "Pay in full" when a full amount is given', async () => {
    const { onSave, dialog } = setup({ full: 200, initial: 50 })
    await userEvent.click(within(dialog).getByRole('button', { name: /full \(\$200\)/i }))
    expect(onSave).toHaveBeenCalledWith(200)
  })
  it('has no full button otherwise', () => {
    const { dialog } = setup()
    expect(within(dialog).queryByRole('button', { name: /full/i })).toBeNull()
  })
})
