import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlaceForm } from '../src/ui/PlaceForm'

describe('PlaceForm', () => {
  it('shows Monthly for exactly 6 hours and Quarterly above it', async () => {
    render(<PlaceForm onSave={() => {}} />)
    const hours = screen.getByLabelText('Drive hours')
    await userEvent.type(hours, '6')
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    await userEvent.clear(hours)
    await userEvent.type(hours, '6.1')
    expect(screen.getByText('Quarterly')).toBeInTheDocument()
  })

  it('rejects negative drive hours', async () => {
    const onSave = vi.fn()
    render(<PlaceForm onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Name'), 'Austin')
    await userEvent.type(screen.getByLabelText('Drive hours'), '-3')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Drive hours must be 0 or more')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves a valid place', async () => {
    const onSave = vi.fn()
    render(<PlaceForm onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Name'), 'Austin')
    await userEvent.type(screen.getByLabelText('Drive hours'), '3.5')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Austin', drive_hours: 3.5 }))
  })
})
