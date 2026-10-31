import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderScreen, saved, seedPlanner } from './seed'
import { EventForm } from '../src/ui/EventForm'
import { useEvents } from '../src/data/useEvents'
import { TABLES } from '../src/lib/tables'

const members = [
  { id: 'a', display_name: 'Ada', color: '#16a34a' },
  { id: 'b', display_name: 'Ben', color: '#6366f1' },
]

describe('EventForm', () => {
  it('saves what was typed', async () => {
    const onSave = vi.fn()
    render(<EventForm defaultDate="2026-11-03" members={members} onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Title'), 'Dentist')
    await userEvent.selectOptions(screen.getByLabelText('Repeat'), 'biweekly')
    await userEvent.click(screen.getByRole('button', { name: 'Save event' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dentist', date: '2026-11-03', repeat: 'biweekly', member: 'both', category: 'other', time: null }))
  })
  it('asks for a title', async () => {
    const onSave = vi.fn()
    render(<EventForm defaultDate="2026-11-03" members={members} onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save event' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Give the event a title.')
    expect(onSave).not.toHaveBeenCalled()
  })
  it('rejects a repeat-until before the date', async () => {
    const onSave = vi.fn()
    render(<EventForm defaultDate="2026-11-03" members={members} onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('Title'), 'Gym')
    await userEvent.selectOptions(screen.getByLabelText('Repeat'), 'weekly')
    fireEvent.change(screen.getByLabelText('Repeat until'), { target: { value: '2026-11-01' } })
    await userEvent.click(screen.getByRole('button', { name: 'Save event' }))
    expect(screen.getByRole('alert')).toHaveTextContent('"Repeat until" must be on or after the date.')
  })
  it('offers delete only when editing', async () => {
    const { rerender } = render(<EventForm defaultDate="2026-11-03" members={members} onSave={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Delete event' })).toBeNull()
    rerender(<EventForm defaultDate="2026-11-03" members={members} onSave={() => {}} onDelete={() => {}} initial={{ id: 'e1', title: 'X', date: '2026-11-03', time: null, member: 'both', category: 'other', repeat: 'none', repeat_until: null, notes: '', done_on: [] }} />)
    expect(screen.getByRole('button', { name: 'Delete event' })).toBeInTheDocument()
  })
})

function Probe() {
  const ev = useEvents()
  return (
    <div>
      <span data-testid="count">{ev.events.length}</span>
      <button onClick={() => void ev.add({ title: 'Dinner', date: '2026-11-05', time: '19:00', member: 'both', category: 'food', repeat: 'weekly', repeat_until: null, notes: '' })}>add</button>
      <button onClick={() => void ev.toggleDone(ev.events[0].id, '2026-11-05')}>toggle</button>
      <button onClick={() => void ev.remove(ev.events[0].id)}>remove</button>
    </div>
  )
}

describe('useEvents', () => {
  beforeEach(() => seedPlanner())
  it('adds, ticks per date, unticks and removes', async () => {
    renderScreen(<Probe />)
    await userEvent.click(screen.getByText('add'))
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
    expect(saved('events')[0]).toMatchObject({ title: 'Dinner', done_on: [] })
    await userEvent.click(screen.getByText('toggle'))
    await waitFor(() => expect(saved('events')[0].done_on).toEqual(['2026-11-05']))
    await userEvent.click(screen.getByText('toggle'))
    await waitFor(() => expect(saved('events')[0].done_on).toEqual([]))
    await act(async () => { await userEvent.click(screen.getByText('remove')) })
    await waitFor(() => expect(saved('events')).toHaveLength(0))
  })
})

describe('tables', () => {
  it('stores events so backups and shared copies include them', () => {
    expect(TABLES).toContain('events')
  })
})
