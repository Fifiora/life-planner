import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adjustPlan, migrateOwnData } from '../src/lib/migrate'
import { describeRoutine } from '../src/ui/RoutineRow'
import { StarterPlanLoader } from '../src/ui/StarterPlanLoader'
import { resetStore } from '../src/data/tableStore'
import type { PreloadFile } from '../src/lib/preload'
import type { Routine, Row } from '../src/types'

type Tables = Record<string, Row[]>
import { renderScreen, saved } from './seed'

const r = (over: Partial<Routine> & { id: string; name: string }): Routine => ({
  bucket: 'food', sub_bucket: null, cadence: 'weekly', times_per_period: 1, applies_to: 'both', place: null, time_rule: null, weekday: 2, active: true, shared: true, ...over,
})

beforeEach(() => {
  localStorage.clear()
  resetStore()
})

describe('adjustPlan', () => {
  it('turns a weekly farmers market into a monthly one and leaves the rest alone', () => {
    const input = { routines: [r({ id: '1', name: 'Farmers market (Tuesdays)' }), r({ id: '2', name: 'Sunday mass', bucket: 'health', weekday: 0 })], bills: [{ id: 'b' }] }
    const out = adjustPlan(input as unknown as Tables)
    expect(out.routines.map((x) => x.cadence)).toEqual(['monthly', 'weekly'])
    expect(out.routines[0].weekday).toBe(2)
    expect(input.routines[0].cadence).toBe('weekly')
    expect(out.bills).toEqual([{ id: 'b' }])
  })
  it('leaves a farmers market that is already monthly or biweekly', () => {
    const out = adjustPlan({ routines: [r({ id: '1', name: 'Farmers market', cadence: 'biweekly' })] } as unknown as Tables)
    expect(out.routines[0].cadence).toBe('biweekly')
  })
  it('passes through plans with no routines', () => {
    expect(adjustPlan({ bills: [] } as Tables)).toEqual({ bills: [] })
  })
})

describe('migrateOwnData', () => {
  it('converts the farmers market already saved on this phone, once', () => {
    localStorage.setItem('lp.data.routines', JSON.stringify([r({ id: '1', name: 'Farmers market (Tuesdays)' })]))
    expect(migrateOwnData()).toBe(1)
    expect(JSON.parse(localStorage.getItem('lp.data.routines')!)[0].cadence).toBe('monthly')
    // The user changes it back on purpose: it must not be converted again.
    localStorage.setItem('lp.data.routines', JSON.stringify([r({ id: '1', name: 'Farmers market (Tuesdays)' })]))
    expect(migrateOwnData()).toBe(0)
    expect(JSON.parse(localStorage.getItem('lp.data.routines')!)[0].cadence).toBe('weekly')
  })
  it('does nothing on an empty phone', () => {
    expect(migrateOwnData()).toBe(0)
  })
})

describe('describeRoutine', () => {
  it('says "a Tuesday each month" for a monthly routine with a weekday', () => {
    expect(describeRoutine(r({ id: '1', name: 'x', cadence: 'monthly', weekday: 2 }))).toBe('A Tuesday each month')
    expect(describeRoutine(r({ id: '1', name: 'x', cadence: 'weekly', weekday: 2 }))).toBe('Tuesdays')
  })
})

describe('starter plan keeps farmers market monthly', () => {
  const file: PreloadFile = { v: 1, kdf: 'PBKDF2-SHA256', iterations: 250000, salt: 'AAAA', iv: 'BBBB', data: 'CCCC' }
  const plain = JSON.stringify({ v: 1, createdAt: '2026-11-01T00:00:00.000Z', tables: { routines: [r({ id: 'f1', name: 'Farmers market (Tuesdays)' })] } })
  it('when loaded from Settings', async () => {
    localStorage.setItem('lp.data.members', JSON.stringify([{ id: 'a', display_name: 'Ada', color: '#111' }]))
    localStorage.setItem('lp.me', 'a')
    renderScreen(<StarterPlanLoader loadFile={async () => file} decrypt={async () => plain} />)
    await userEvent.click(screen.getByRole('button', { name: 'Load our starter plan' }))
    await userEvent.type(await screen.findByLabelText('Starter plan passphrase'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Unlock and add' }))
    await screen.findByRole('status', { name: 'Starter plan result' })
    expect(saved('routines')[0].cadence).toBe('monthly')
  })
})
