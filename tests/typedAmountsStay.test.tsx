import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Finance from '../src/screens/Finance'
import { todayCT } from '../src/lib/dates'
import { paidPerBill } from '../src/lib/finance2'
import type { Bill, BillPayment } from '../src/types'
import { renderScreen, saved, seedPlanner } from './seed'

beforeEach(() => seedPlanner())

const month = () => todayCT().slice(0, 7)
const openTab = async (name: string) => userEvent.click(await screen.findByRole('tab', { name }))
const setBudget = async (category: string, value: string) => {
  const input = await screen.findByLabelText(`Budget for ${category}`)
  await userEvent.clear(input)
  await userEvent.type(input, value)
  await userEvent.tab()
}

describe('a typed paid amount survives a change to the plan', () => {
  it('keeps what was really paid when the budget changes (planned 1,700, paid 1,500, new plan 1,900)', async () => {
    localStorage.setItem('lp.data.bill_payments', JSON.stringify([{ id: 'now', bill_id: 'b1', month: month(), paid_on: todayCT(), amount: 1500 }]))
    renderScreen(<Finance />)
    await openTab('Budget')
    await setBudget('housing', '1900')
    await vi.waitFor(() => expect(saved('bills').find((b) => b.id === 'b1').amount).toBe(1900))
    await new Promise((r) => setTimeout(r, 50))
    expect(saved('bill_payments')[0].amount).toBe(1500)
  })
})

describe('one payment per bill per month', () => {
  it('does not add up two ticks of the same bill from two phones', () => {
    const rent: Bill = { id: 'r', name: 'Rent', amount: 1500, category: 'housing', kind: 'recurring', due_month: null, paid: false }
    const p = (id: string): BillPayment => ({ id, bill_id: 'r', month: '2026-11', paid_on: '2026-11-02' })
    expect(paidPerBill([rent], [p('a'), p('b')], '2026-11').get('r')).toBe(1500)
  })
})
