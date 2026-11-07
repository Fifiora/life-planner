import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AmountSheet } from '../src/ui/AmountSheet'

const setup = () => {
  const onSave = vi.fn()
  render(<AmountSheet open title="Amount paid: Rent" label="Amount" initial={1700} full={1700} planOffer={{ name: 'Rent', current: 1700 }} onSave={onSave} onClose={vi.fn()} />)
  return { onSave, dialog: screen.getByRole('dialog', { name: 'Amount paid: Rent' }) }
}
const type = async (dialog: HTMLElement, value: string) => {
  const input = within(dialog).getByLabelText('Amount')
  await userEvent.clear(input)
  await userEvent.type(input, value)
}

describe('AmountSheet plan offer', () => {
  it('offers to change the bill only when the typed amount differs from it', async () => {
    const { dialog } = setup()
    expect(within(dialog).queryByRole('checkbox')).toBeNull()
    await type(dialog, '1900')
    expect(within(dialog).getByRole('checkbox', { name: 'Also make Rent $1,900 from now on' })).not.toBeChecked()
    await type(dialog, '1700')
    expect(within(dialog).queryByRole('checkbox')).toBeNull()
  })
  it('reports whether the bill should change too', async () => {
    const { onSave, dialog } = setup()
    await type(dialog, '1900')
    await userEvent.click(within(dialog).getByRole('checkbox'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(1900, { makePlan: true })
  })
  it('keeps the bill as it is when the box is left unticked', async () => {
    const { onSave, dialog } = setup()
    await type(dialog, '1900')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(1900, { makePlan: false })
  })
})
