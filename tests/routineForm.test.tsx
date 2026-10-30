import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RoutineForm } from '../src/ui/RoutineForm'

describe('RoutineForm', () => {
  it('does not save without a name', async () => {
    const onSave = vi.fn()
    render(<RoutineForm onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves a weekly routine on Monday', async () => {
    const onSave = vi.fn()
    render(<RoutineForm onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Name'), 'Weekday mass')
    await userEvent.selectOptions(screen.getByLabelText('Repeats'), 'weekly')
    await userEvent.selectOptions(screen.getByLabelText('Weekday'), '1')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Weekday mass', cadence: 'weekly', weekday: 1 }))
  })

  it('only deletes after confirmation', async () => {
    const onDelete = vi.fn()
    render(<RoutineForm initial={{ name: 'x' }} onSave={() => {}} onDelete={onDelete} />)
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
