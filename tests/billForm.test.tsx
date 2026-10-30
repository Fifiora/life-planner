import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BillForm } from '../src/ui/BillForm'

describe('BillForm', () => {
  it('rejects a one-time bill with no due month', async () => {
    const onSave = vi.fn()
    render(<BillForm onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Name'), 'Card')
    await userEvent.type(screen.getByLabelText('Amount'), '10')
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'one_time')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('One-time bills need a due month')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves a valid recurring bill', async () => {
    const onSave = vi.fn()
    render(<BillForm onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Name'), 'Rent')
    await userEvent.type(screen.getByLabelText('Amount'), '100')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Rent', amount: 100, kind: 'recurring' }))
  })
})
