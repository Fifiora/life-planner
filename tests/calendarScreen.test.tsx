import { describe, it, expect, beforeEach } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import Calendar from '../src/screens/Calendar'
import { TabBar } from '../src/ui/TabBar'
import { getAllRows, loadSnapshot } from '../src/data/tableStore'
import { addDays, todayCT } from '../src/lib/dates'
import { renderScreen, saved, seedPlanner } from './seed'

const cell = (container: HTMLElement, date: string) => container.querySelector(`[data-date="${date}"]`) as HTMLElement
const evRow = (over: Record<string, unknown>) => ({ id: 'e1', title: 'Old', date: '2026-10-20', time: null, member: 'both', category: 'other', repeat: 'none', repeat_until: null, notes: '', done_on: [], ...over })

beforeEach(() => seedPlanner())

describe('Calendar month view', () => {
  it('opens on the chosen month with a 6-week grid', () => {
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-date]')).toHaveLength(42)
  })

  it('has no limit going forward or back, and crosses year boundaries', async () => {
    renderScreen(<Calendar initialDate="2026-10-15" />)
    for (let i = 0; i < 14; i++) await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: 'December 2027' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
    expect(screen.getByRole('heading', { name: 'January 2028' })).toBeInTheDocument()
    for (let i = 0; i < 15; i++) await userEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
  })

  it('jumps to any month and year, even far away', async () => {
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    fireEvent.change(screen.getByLabelText('Year'), { target: { value: '2040' } })
    expect(screen.getByRole('heading', { name: 'October 2040' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Month'), '2')
    expect(screen.getByRole('heading', { name: 'February 2040' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-date]')).toHaveLength(42)
  })

  it('returns to today with the Today button', async () => {
    renderScreen(<Calendar initialDate="2031-03-01" />)
    await userEvent.click(screen.getByRole('button', { name: 'Today' }))
    const [y, m] = todayCT().split('-').map(Number)
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    expect(screen.getByRole('heading', { name: label })).toBeInTheDocument()
  })

  it('dims days before the plan start but keeps them open', () => {
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    expect(cell(container, '2026-10-25')).toHaveAttribute('data-before-start', 'true')
    expect(cell(container, '2026-10-26')).not.toHaveAttribute('data-before-start')
  })
})

describe('Calendar styling hooks', () => {
  it('does not reuse the Finance budget table cell class', () => {
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    expect(container.querySelector('.mcell')).toBeNull()
    expect(container.querySelector('.cal-cell')).not.toBeNull()
  })
})

describe('Calendar opened on a date', () => {
  it('shows that month with the day open', async () => {
    renderScreen(<Calendar />, '/calendar?date=2031-03-09')
    expect(screen.getByRole('heading', { name: 'March 2031' })).toBeInTheDocument()
    expect(await screen.findByRole('dialog', { name: 'Day details' })).toBeInTheDocument()
    expect(screen.getByText(/March 9, 2031/)).toBeInTheDocument()
  })
  it('ignores a bad date in the link', () => {
    renderScreen(<Calendar initialDate="2026-10-15" />, '/calendar?date=nonsense')
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Calendar with a damaged cycle start', () => {
  it('still opens', () => {
    localStorage.setItem('lp.data.settings', JSON.stringify([{ id: 's', key: 'biweekly_anchor', value: '' }]))
    renderScreen(<Calendar initialDate="2026-10-15" />)
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
  })
})

describe('Calendar year box and the ends of the range', () => {
  it('ignores years that are not four digits from 1000 to 9998', () => {
    renderScreen(<Calendar initialDate="2026-10-15" />)
    const year = screen.getByLabelText('Year')
    fireEvent.change(year, { target: { value: '0099' } })
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
    fireEvent.change(year, { target: { value: '9999' } })
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
    fireEvent.change(year, { target: { value: '2040' } })
    fireEvent.change(year, { target: { value: '20401' } })
    expect(year).toHaveValue(2040)
    expect(screen.getByRole('heading', { name: 'October 2040' })).toBeInTheDocument()
  })
  it('stops the arrows at December 9998 and January 1000', () => {
    const { unmount } = renderScreen(<Calendar initialDate="9998-12-10" />)
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
    unmount()
    renderScreen(<Calendar initialDate="1000-01-10" />)
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeDisabled()
  })
})

describe('Calendar accessibility', () => {
  it('names days with the year and how many events they hold', () => {
    localStorage.setItem('lp.data.events', JSON.stringify([evRow({ id: 'a1', title: 'One', date: '2026-10-28' }), evRow({ id: 'a2', title: 'Two', date: '2026-10-28' })]))
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    expect(cell(container, '2026-10-28')).toHaveAccessibleName('Wednesday, October 28, 2026, 2 events')
    expect(cell(container, '2026-10-29')).toHaveAccessibleName('Thursday, October 29, 2026')
  })
  it('announces month changes', () => {
    renderScreen(<Calendar initialDate="2026-10-15" />)
    expect(screen.getByRole('heading', { name: 'October 2026' })).toHaveAttribute('aria-live', 'polite')
  })
})

describe('Calendar night-in dots', () => {
  it('marks the day of a planned night in', () => {
    localStorage.setItem('lp.data.night_options', JSON.stringify([{ id: 'n1', slot_date: '2026-10-29', type: 'game', proposed_by: 'a', activity: 'Catan' }]))
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    expect(cell(container, '2026-10-29').querySelector('[data-marker="night"]')).not.toBeNull()
  })
})

describe('Calendar back buttons', () => {
  it('goes back to the calendar from a day', async () => {
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    await userEvent.click(cell(container, '2026-10-28'))
    await userEvent.click(screen.getByRole('button', { name: 'Back to calendar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('goes back to the day from the event form without saving', async () => {
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    await userEvent.click(cell(container, '2026-10-28'))
    await userEvent.click(screen.getByRole('button', { name: 'Add event' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Never saved')
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('dialog', { name: 'Day details' })).toBeInTheDocument()
    expect(saved('events')).toHaveLength(0)
  })
})

describe('Calendar day sheet', () => {
  it('lists the routines due that weekday', async () => {
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    await userEvent.click(cell(container, '2026-11-01'))
    const dialog = screen.getByRole('dialog', { name: 'Day details' })
    expect(within(dialog).getByText('Sunday mass')).toBeInTheDocument()
  })

  it('adds an event that then shows on the day and as a dot', async () => {
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    await userEvent.click(cell(container, '2026-10-28'))
    await userEvent.click(screen.getByRole('button', { name: 'Add event' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Dentist')
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'health')
    await userEvent.click(screen.getByRole('button', { name: 'Save event' }))
    await waitFor(() => expect(saved('events')[0]).toMatchObject({ title: 'Dentist', date: '2026-10-28', category: 'health' }))
    expect(await screen.findByText('Dentist')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(cell(container, '2026-10-28').querySelector('[data-marker="health"]')).not.toBeNull()
  })

  it('still shows an event dated before the plan start', async () => {
    localStorage.setItem('lp.data.events', JSON.stringify([evRow({})]))
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    await userEvent.click(cell(container, '2026-10-20'))
    expect(await screen.findByText('Old')).toBeInTheDocument()
  })

  it('ticks a routine today only', async () => {
    localStorage.setItem('lp.data.routine_logs', '[]')
    const today = todayCT()
    const { container } = renderScreen(<Calendar initialDate={today} />)
    await userEvent.click(cell(container, today))
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Daily activity' }))
    await waitFor(() => expect(saved('routine_logs')[0]).toMatchObject({ routine_id: 'r1', date: today, done: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await userEvent.click(cell(container, addDays(today, 1)))
    expect(screen.queryByRole('checkbox', { name: 'Daily activity' })).toBeNull()
    expect(screen.getByText('Daily activity')).toBeInTheDocument()
  })

  it('opens a day that has a row with odd fields', async () => {
    localStorage.setItem('lp.data.events', JSON.stringify([evRow({ id: 'q', title: 'Odd', date: '2026-10-28', time: 930 }), { ...evRow({ id: 'r', date: '2026-10-28' }), title: {} }]))
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    await userEvent.click(cell(container, '2026-10-28'))
    expect(await screen.findByText('Odd')).toBeInTheDocument()
  })

  it('lists routines that belong to the period rather than a weekday', async () => {
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    await userEvent.click(cell(container, '2026-10-28'))
    const dialog = screen.getByRole('dialog', { name: 'Day details' })
    expect(within(dialog).getByText('This period')).toBeInTheDocument()
    expect(within(dialog).getByText('Salon')).toBeInTheDocument()
  })

  it('says Done on a past day that was ticked', async () => {
    localStorage.setItem('lp.data.routine_logs', JSON.stringify([{ id: 'p1', routine_id: 'r1', member_id: 'a', date: '2026-10-27', done: true, value: null }]))
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    await userEvent.click(cell(container, '2026-10-27'))
    expect(within(screen.getByRole('dialog', { name: 'Day details' })).getByText('Done')).toBeInTheDocument()
  })

  it('keeps an edit when the event was deleted elsewhere meanwhile', async () => {
    localStorage.setItem('lp.data.events', JSON.stringify([evRow({ id: 'g1', title: 'Gone soon', date: '2026-10-28' })]))
    const { container } = renderScreen(<Calendar initialDate="2026-10-15" />)
    await userEvent.click(cell(container, '2026-10-28'))
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Gone soon' }))
    localStorage.setItem('lp.data.events', '[]')
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'lp.data.events', newValue: '[]' })) })
    const title = screen.getByLabelText('Title')
    await userEvent.clear(title)
    await userEvent.type(title, 'Kept edit')
    await userEvent.click(screen.getByRole('button', { name: 'Save event' }))
    await waitFor(() => expect(saved('events').map((e) => e.title)).toEqual(['Kept edit']))
  })

  it('survives a corrupt event row', () => {
    localStorage.setItem('lp.data.events', JSON.stringify([{ id: 'x' }, evRow({ id: 'y', date: '' })]))
    renderScreen(<Calendar initialDate="2026-10-15" />)
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
  })
})

describe('Calendar agenda empty state', () => {
  it('points to adding an event', async () => {
    localStorage.setItem('lp.data.routines', '[]')
    renderScreen(<Calendar />)
    await userEvent.click(screen.getByRole('button', { name: 'Agenda view' }))
    expect(screen.getByText(/Add an event from any day/)).toBeInTheDocument()
  })
})

describe('Calendar agenda', () => {
  it('lists coming events and loads more on request', async () => {
    const far = addDays(todayCT(), 30)
    localStorage.setItem('lp.data.events', JSON.stringify([evRow({ id: 'f', title: 'Far away', date: far })]))
    renderScreen(<Calendar />)
    await userEvent.click(screen.getByRole('button', { name: 'Agenda view' }))
    expect(screen.queryByText('Far away')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await screen.findByText('Far away')).toBeInTheDocument()
  })
})

describe('Calendar in a view-only copy made before events existed', () => {
  it('opens, with nothing to add or tick', async () => {
    const rows = getAllRows()
    delete (rows as Record<string, unknown>).events
    loadSnapshot(rows)
    const today = todayCT()
    const { container } = renderScreen(<Calendar initialDate={today} />)
    await userEvent.click(cell(container, today))
    expect(screen.getByRole('dialog', { name: 'Day details' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add event' })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('navigation', () => {
  it('has a Calendar tab right after Today', () => {
    render(<MemoryRouter><TabBar /></MemoryRouter>)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveTextContent('Today')
    expect(links[1]).toHaveTextContent('Calendar')
    expect(links[1]).toHaveAttribute('href', '/calendar')
  })
})
