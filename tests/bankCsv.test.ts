import { describe, it, expect } from 'vitest'
import { categorize, newBankRows, parseBankCsv } from '../src/lib/bankCsv'

describe('parseBankCsv', () => {
  it('reads a simple date, description, amount file', () => {
    const csv = 'Date,Description,Amount\n11/03/2026,"HEB #123, SAN ANTONIO",-54.20\n2026-11-04,Payroll ACME,2500.00\n'
    expect(parseBankCsv(csv)).toEqual([
      { date: '2026-11-03', description: 'HEB #123, SAN ANTONIO', amount: -54.2 },
      { date: '2026-11-04', description: 'Payroll ACME', amount: 2500 },
    ])
  })
  it('reads separate debit and credit columns and bracketed negatives', () => {
    const csv = 'Posting Date,Details,Debit,Credit\n11/05/2026,Netflix,15.49,\n11/06/2026,Refund,,20\n'
    expect(parseBankCsv(csv)).toEqual([
      { date: '2026-11-05', description: 'Netflix', amount: -15.49 },
      { date: '2026-11-06', description: 'Refund', amount: 20 },
    ])
    expect(parseBankCsv('Date,Description,Amount\n11/07/2026,Gas,(30.00)\n')[0].amount).toBe(-30)
  })
  it('skips blank and unreadable lines', () => {
    const csv = 'Date,Description,Amount\n\nnot a date,Thing,5\n11/08/2026,Ok,-1\n'
    expect(parseBankCsv(csv)).toHaveLength(1)
  })
  it('explains a file it cannot understand', () => {
    expect(() => parseBankCsv('')).toThrow(/empty/i)
    expect(() => parseBankCsv('Foo,Bar\n1,2\n')).toThrow(/date.*description.*amount/i)
  })
})

describe('categorize', () => {
  it('sorts common descriptions into the planner\'s categories', () => {
    expect(categorize('NETFLIX.COM', -15)).toEqual({ kind: 'expense', category: 'subscriptions' })
    expect(categorize('HEB #123', -50)).toEqual({ kind: 'expense', category: 'groceries' })
    expect(categorize('Shell Oil 1234', -40)).toEqual({ kind: 'expense', category: 'transport' })
    expect(categorize('Top Nails', -45)).toEqual({ kind: 'expense', category: 'beauty' })
    expect(categorize('St Mary Church Offering', -50)).toEqual({ kind: 'expense', category: 'giving' })
    expect(categorize('Mystery Shop', -9)).toEqual({ kind: 'expense', category: 'other' })
  })
  it('treats money in as income and savings moves as transfers', () => {
    expect(categorize('Payroll ACME', 2500)).toEqual({ kind: 'income', category: 'income' })
    expect(categorize('Online Transfer to Savings', -500)).toEqual({ kind: 'transfer', category: 'transfer' })
  })
})

describe('newBankRows', () => {
  const parsed = [
    { date: '2026-11-03', description: 'HEB', amount: -54.2 },
    { date: '2026-11-04', description: 'Payroll', amount: 2500 },
  ]
  it('turns rows into planner entries with positive amounts, marked as from the bank', () => {
    const rows = newBankRows([], parsed, 'a')
    expect(rows).toEqual([
      { date: '2026-11-03', amount: 54.2, category: 'groceries', note: 'HEB', member_id: 'a', kind: 'expense', source: 'bank' },
      { date: '2026-11-04', amount: 2500, category: 'income', note: 'Payroll', member_id: 'a', kind: 'income', source: 'bank' },
    ])
  })
  it('skips rows that were imported before', () => {
    const existing = [{ id: '1', date: '2026-11-03', amount: 54.2, category: 'groceries', note: 'HEB', member_id: 'a', source: 'bank' as const }]
    expect(newBankRows(existing, parsed, 'a')).toHaveLength(1)
  })
})
