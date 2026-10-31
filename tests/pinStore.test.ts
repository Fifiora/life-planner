import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getState, resetStore } from '../src/data/tableStore'
import { createPinRecord, type PinRecord } from '../src/lib/pin'
import { clearPin, effectivePin, migrateLocalPin, readLocalPin, readSharedPin, recordFromSettingsRows, savePin, SHARED_PIN_KEY } from '../src/lib/pinStore'

let a: PinRecord
let b: PinRecord
beforeAll(async () => {
  a = await createPinRecord('1234')
  b = await createPinRecord('9876')
})
beforeEach(() => {
  localStorage.clear()
  resetStore()
})

type Setting = { id: string; key: string; value: string }
const pinRows = () => (getState('settings').rows as unknown as Setting[]).filter((r) => r.key === SHARED_PIN_KEY)

describe('recordFromSettingsRows', () => {
  it('reads the shared PIN row', () => {
    expect(recordFromSettingsRows([{ id: 'x', key: SHARED_PIN_KEY, value: JSON.stringify(a) }])).toEqual(a)
  })
  it('ignores a missing, broken or wrong-shaped row', () => {
    expect(recordFromSettingsRows([])).toBeNull()
    expect(recordFromSettingsRows([{ id: 'x', key: SHARED_PIN_KEY, value: '{nope' }])).toBeNull()
    expect(recordFromSettingsRows([{ id: 'x', key: SHARED_PIN_KEY, value: '{"v":2}' }])).toBeNull()
    expect(recordFromSettingsRows([{ id: 'x', key: 'other', value: JSON.stringify(a) }])).toBeNull()
  })
})

describe('savePin and clearPin', () => {
  it('keep the PIN on this phone when not sharing', async () => {
    await savePin(a, false)
    expect(readLocalPin()).toEqual(a)
    expect(pinRows()).toHaveLength(0)
    await clearPin(false)
    expect(readLocalPin()).toBeNull()
  })
  it('put the PIN in the shared settings when sharing, in one row with a fixed id, and drop the local copy', async () => {
    localStorage.setItem('lp.pin', JSON.stringify(b))
    await savePin(a, true)
    expect(readLocalPin()).toBeNull()
    expect(pinRows()).toHaveLength(1)
    expect(pinRows()[0].id).toBe(SHARED_PIN_KEY)
    expect(readSharedPin()).toEqual(a)
    await savePin(b, true)
    expect(pinRows()).toHaveLength(1)
    expect(readSharedPin()).toEqual(b)
  })
  it('remove the shared row when clearing while sharing', async () => {
    await savePin(a, true)
    await clearPin(true)
    expect(pinRows()).toHaveLength(0)
    expect(effectivePin()).toBeNull()
  })
})

describe('effectivePin', () => {
  it('prefers the shared PIN over a local one', async () => {
    localStorage.setItem('lp.pin', JSON.stringify(b))
    await savePin(a, true)
    localStorage.setItem('lp.pin', JSON.stringify(b)) // a stale local copy
    expect(effectivePin()).toEqual(a)
  })
  it('falls back to the local PIN', () => {
    localStorage.setItem('lp.pin', JSON.stringify(b))
    expect(effectivePin()).toEqual(b)
  })
  it('is null when there is none', () => {
    expect(effectivePin()).toBeNull()
  })
})

describe('migrateLocalPin', () => {
  it('shares a local PIN when the household has none, then forgets the local copy', async () => {
    localStorage.setItem('lp.pin', JSON.stringify(a))
    await migrateLocalPin(true)
    expect(readSharedPin()).toEqual(a)
    expect(readLocalPin()).toBeNull()
  })
  it('lets the household PIN win over a local one', async () => {
    await savePin(a, true)
    localStorage.setItem('lp.pin', JSON.stringify(b))
    await migrateLocalPin(true)
    expect(readSharedPin()).toEqual(a)
    expect(readLocalPin()).toBeNull()
  })
  it('does nothing when this phone is not sharing', async () => {
    localStorage.setItem('lp.pin', JSON.stringify(a))
    await migrateLocalPin(false)
    expect(readLocalPin()).toEqual(a)
    expect(pinRows()).toHaveLength(0)
  })
  it('does nothing when there is no local PIN', async () => {
    await migrateLocalPin(true)
    expect(pinRows()).toHaveLength(0)
  })
})
