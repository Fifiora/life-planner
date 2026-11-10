import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Finance from '../src/screens/Finance'
import { todayCT } from '../src/lib/dates'
import { renderScreen, saved, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

const month = () => todayCT().slice(0, 7)
const openTab = async (name: string) => userEvent.click(await screen.findByRole('tab', { name }))

async function fill(category: string, name: string, amount: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Add to ${category}` }))
  const dialog = await screen.findByRole('dialog', { name: `Add to ${category}` })
  await userEvent.type(within(dialog).getByLabelText('Name'), name)
  await userEvent.type(within(dialog).getByLabelText('Amount'), amount)
  return dialog
}

describe('Add an item to a category on the Bills tab', () => {
  it('adds a monthly bill in that category by default', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    const dialog = await fill('Housing', 'Parking', '50')
    expect(within(dialog).queryByLabelText('Category')).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(saved('bills').find((b) => b.name === 'Parking')).toBeTruthy())
    expect(saved('bills').find((b) => b.name === 'Parking')).toMatchObject({ amount: 50, category: 'housing', kind: 'recurring', due_month: null, paid: false })
    const group = (await screen.findByRole('heading', { name: 'Housing' })).closest('section') as HTMLElement
    expect(within(group).getByText('Parking')).toBeInTheDocument()
  })

  it('can add it for this month only', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    const dialog = await fill('Food', 'Cake', '35')
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Just this month' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(saved('bills').find((b) => b.name === 'Cake')).toBeTruthy())
    expect(saved('bills').find((b) => b.name === 'Cake')).toMatchObject({ amount: 35, category: 'food', kind: 'one_time', due_month: month(), one_off: true })
  })

  it('asks for a name and an amount', async () => {
    renderScreen(<Finance />)
    await openTab('Bills')
    await userEvent.click(await screen.findByRole('button', { name: 'Add to Housing' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add to Housing' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(saved('bills')).toHaveLength(4)
  })
})
