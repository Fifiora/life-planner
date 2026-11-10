import { describe, it, expect } from 'vitest'
import { monthPay, paydays, scheduledDates } from '../src/lib/pay'

const schedule = { amount: 9600, anchor: '2026-10-16' }

describe('paydays every two weeks', () => {
  it('works out every date from one real payday, before and after it', () => {
    expect(scheduledDates('2026-10-16', '2026-11-01', '2026-12-31')).toEqual(['2026-11-13', '2026-11-27', '2026-12-11', '2026-12-25'])
    expect(scheduledDates('2026-10-16', '2026-09-20', '2026-10-17')).toEqual(['2026-10-02', '2026-10-16'])
    expect(scheduledDates('2026-10-16', '2026-09-01', '2026-09-30')).toEqual(['2026-09-04', '2026-09-18'])
  })

  it('counts two paydays in most months and three in some', () => {
    expect(monthPay(schedule, [], '2026-11')).toMatchObject({ count: 2, planned: 19200, received: 0, toCome: 19200, threeDeposits: false })
    expect(monthPay(schedule, [], '2026-10')).toMatchObject({ count: 3, planned: 28800, threeDeposits: true })
    expect(monthPay(schedule, [], '2027-04')).toMatchObject({ count: 3, planned: 28800, threeDeposits: true })
  })

  it('uses what a ticked payday really was, and what is still to come', () => {
    const rows = [{ id: 'p1', slot: '2026-11-13', date: '2026-11-13', amount: 9400, received: true }]
    expect(monthPay(schedule, rows, '2026-11')).toMatchObject({ planned: 19000, received: 9400, toCome: 9600, count: 2 })
  })

  it('moves a payday to the day it really landed', () => {
    const rows = [{ id: 'p1', slot: '2026-11-13', date: '2026-11-14', amount: null, received: true }]
    const list = paydays(schedule, rows, '2026-11-01', '2026-11-30')
    expect(list.map((p) => p.date)).toEqual(['2026-11-14', '2026-11-27'])
    expect(list[0]).toMatchObject({ slot: '2026-11-13', amount: 9600, received: true })
  })

  it('counts a payday that landed in the next month in that month', () => {
    const rows = [{ id: 'p1', slot: '2026-11-27', date: '2026-12-01', amount: null, received: true }]
    expect(monthPay(schedule, rows, '2026-11').count).toBe(1)
    expect(monthPay(schedule, rows, '2026-12').count).toBe(3)
  })

  it('leaves out a skipped payday', () => {
    const rows = [{ id: 'p1', slot: '2026-11-13', date: '2026-11-13', amount: null, received: false, skipped: true }]
    expect(monthPay(schedule, rows, '2026-11')).toMatchObject({ count: 1, planned: 9600 })
  })

  it('adds an extra deposit on top without making it a third payday', () => {
    const rows = [{ id: 'x', slot: null, date: '2026-11-20', amount: 500, received: false, note: 'Bonus' }]
    const m = monthPay(schedule, rows, '2026-11')
    expect(m.planned).toBe(19700)
    expect(m.threeDeposits).toBe(false)
    expect(m.paydays.find((p) => p.extra)).toMatchObject({ amount: 500, note: 'Bonus' })
  })
})
