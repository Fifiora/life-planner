// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createPinRecord, isValidPin, verifyPin } from '../src/lib/pin'

describe('PIN', () => {
  it('accepts the right PIN and rejects a wrong one', async () => {
    const rec = await createPinRecord('4821')
    expect(await verifyPin('4821', rec)).toBe(true)
    expect(await verifyPin('4822', rec)).toBe(false)
    expect(await verifyPin('', rec)).toBe(false)
  })
  it('does not store the PIN itself, and salts every record differently', async () => {
    const a = await createPinRecord('4821')
    const b = await createPinRecord('4821')
    expect(JSON.stringify(a)).not.toContain('4821')
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
  })
  it('only allows 4 to 8 digits', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('12345678')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('123456789')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
  })
  it('does not accept a damaged record', async () => {
    expect(await verifyPin('4821', { v: 1 } as never)).toBe(false)
  })
})
