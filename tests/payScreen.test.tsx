import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Finance from '../src/screens/Finance'
import { todayCT } from '../src/lib/dates'
import { renderScreen, saved, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

const month = () => todayCT().slice(0, 7)
const first = () => `${month()}-05`
const second = () => `${month()}-19`
const openTab = async (name: string) => userEvent.click(await screen.findByRole('tab', { name }))
const withPay = (amount: string, anchor: string) =>
  localStorage.setItem('lp.data.settings', JSON.stringify([
    { id: 's1', key: 'savings_target', value: '10000' },
    { id: 's2', key: 'pay_amount', value: amount },
    { id: 's3', key: 'pay_anchor', value: anchor },
  ]))
const setting = (key: string) => saved('settings').find((s) => s.key === key)?.value

describe('Pay tab: setting it up', () => {
  it('asks for the amount and one real payday, then saves the schedule', async () => {
    renderScreen(<Finance />)
    await openTab('Pay')
    expect(await screen.findByRole('heading', { name: 'Set up your pay' })).toBeInTheDocument()
    const amount = screen.getByLabelText('Amount every two weeks')
    await userEvent.clear(amount)
    await userEvent.type(amount, '9600')
    fireEvent.change(screen.getByLabelText('A recent or upcoming payday'), { target: { value: first() } })
    await userEvent.click(screen.getByRole('button', { name: 'Save pay schedule' }))
    await vi.waitFor(() => expect(setting('pay_anchor')).toBe(first()))
    expect(setting('pay_amount')).toBe('9600')
  })

  it('needs an amount and a date', async () => {
    renderScreen(<Finance />)
    await openTab('Pay')
    await userEvent.click(await screen.findByRole('button', { name: 'Save pay schedule' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(setting('pay_anchor')).toBeUndefined()
  })
})

describe('Pay tab: ticking paydays', () => {
  it('lists the month\'s paydays with the expected amount', async () => {
    withPay('9600', first())
    renderScreen(<Finance />)
    await openTab('Pay')
    expect(await screen.findByRole('checkbox', { name: `Payday ${first()} received` })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: `Payday ${second()} received` })).not.toBeChecked()
    expect(screen.getByText(/Expected \$19,200/)).toBeInTheDocument()
    expect(screen.getByText(/Received \$0/)).toBeInTheDocument()
  })

  it('ticking a payday saves it as received with its amount', async () => {
    withPay('9600', first())
    renderScreen(<Finance />)
    await openTab('Pay')
    await userEvent.click(await screen.findByRole('checkbox', { name: `Payday ${first()} received` }))
    await vi.waitFor(() => expect(saved('paychecks')).toHaveLength(1))
    expect(saved('paychecks')[0]).toMatchObject({ slot: first(), date: first(), amount: 9600, received: true })
    expect(await screen.findByText(/Received \$9,600/)).toBeInTheDocument()
  })

  it('unticking takes it back', async () => {
    withPay('9600', first())
    renderScreen(<Finance />)
    await openTab('Pay')
    const box = await screen.findByRole('checkbox', { name: `Payday ${first()} received` })
    await userEvent.click(box)
    await vi.waitFor(() => expect(box).toBeChecked())
    await userEvent.click(box)
    await vi.waitFor(() => expect(saved('paychecks')[0].received).toBe(false))
    expect(await screen.findByText(/Received \$0/)).toBeInTheDocument()
  })

  it('changing the schedule amount later leaves a ticked payday as it was', async () => {
    withPay('9600', first())
    renderScreen(<Finance />)
    await openTab('Pay')
    await userEvent.click(await screen.findByRole('checkbox', { name: `Payday ${first()} received` }))
    await vi.waitFor(() => expect(saved('paychecks')).toHaveLength(1))
    await userEvent.click(screen.getByRole('button', { name: 'Change the schedule' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pay schedule' })
    const amount = within(dialog).getByLabelText('Amount every two weeks')
    await userEvent.clear(amount)
    await userEvent.type(amount, '10000')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save pay schedule' }))
    await vi.waitFor(() => expect(setting('pay_amount')).toBe('10000'))
    expect(await screen.findByText(/Expected \$19,600/)).toBeInTheDocument()
  })
})

describe('Pay tab: when it is not the usual amount or day', () => {
  it('edits what one payday really was', async () => {
    withPay('9600', first())
    renderScreen(<Finance />)
    await openTab('Pay')
    await userEvent.click(await screen.findByRole('button', { name: `Edit amount for payday ${first()}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Amount for this payday' })
    const box = within(dialog).getByLabelText('Amount')
    await userEvent.clear(box)
    await userEvent.type(box, '9400')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(saved('paychecks')[0]).toMatchObject({ slot: first(), amount: 9400 }))
    expect(await screen.findByText(/Expected \$19,000/)).toBeInTheDocument()
  })

  it('moves a payday to the day the money really arrived', async () => {
    withPay('9600', first())
    renderScreen(<Finance />)
    await openTab('Pay')
    await userEvent.click(await screen.findByRole('button', { name: `Edit date for payday ${first()}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Payday date' })
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: `${month()}-06` } })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(saved('paychecks')[0]).toMatchObject({ slot: first(), date: `${month()}-06` }))
  })

  it('skips a payday that does not come', async () => {
    withPay('9600', first())
    renderScreen(<Finance />)
    await openTab('Pay')
    await userEvent.click(await screen.findByRole('button', { name: `Skip payday ${first()}` }))
    await vi.waitFor(() => expect(saved('paychecks')[0]).toMatchObject({ slot: first(), skipped: true }))
    expect(await screen.findByText(/Expected \$9,600/)).toBeInTheDocument()
  })

  it('adds an extra deposit', async () => {
    withPay('9600', first())
    renderScreen(<Finance />)
    await openTab('Pay')
    await userEvent.click(await screen.findByRole('button', { name: 'Add an extra deposit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Extra deposit' })
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: `${month()}-10` } })
    await userEvent.type(within(dialog).getByLabelText('Amount'), '500')
    await userEvent.type(within(dialog).getByLabelText('Note'), 'Bonus')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(saved('paychecks')).toHaveLength(1))
    expect(saved('paychecks')[0]).toMatchObject({ slot: null, date: `${month()}-10`, amount: 500, note: 'Bonus', received: false })
    expect(await screen.findByText(/Expected \$19,700/)).toBeInTheDocument()
  })
})

describe('Pay feeds the plan', () => {
  it('uses the month\'s paydays as its income once a schedule is set', async () => {
    withPay('10000', first())
    renderScreen(<Finance />)
    expect((await screen.findAllByText('$20,000')).length).toBeGreaterThan(0)
  })

  it('keeps the old monthly income when no schedule is set', async () => {
    renderScreen(<Finance />)
    expect((await screen.findAllByText('$19,200')).length).toBeGreaterThan(0)
  })
})
