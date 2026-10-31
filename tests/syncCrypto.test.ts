import { describe, it, expect } from 'vitest'
import { CODE_ALPHABET, decryptRow, deriveKey, encryptRow, formatCode, generateCode, householdId, isValidCode, normalizeCode } from '../src/lib/syncCrypto'

const row = { id: 'r1', name: 'Rent', amount: 1700, nested: { a: [1, 2, 3] } }

describe('pairing code', () => {
  it('is 6 groups of 4 from the safe alphabet and differs each time', () => {
    const a = generateCode()
    expect(a).toMatch(/^([A-HJKMNP-Z2-9]{4}-){5}[A-HJKMNP-Z2-9]{4}$/)
    expect(generateCode()).not.toBe(a)
    expect(CODE_ALPHABET).toHaveLength(31)
  })
  it('uses the whole alphabet roughly evenly', () => {
    const counts = new Map<string, number>()
    for (let i = 0; i < 400; i++) for (const c of normalizeCode(generateCode())) counts.set(c, (counts.get(c) ?? 0) + 1)
    expect(counts.size).toBe(31)
    expect(Math.max(...counts.values())).toBeLessThan(2.2 * Math.min(...counts.values()))
  })
  it('ignores case, spaces and dashes when typed', () => {
    expect(normalizeCode(' abcd-efgh ij ')).toBe('ABCDEFGHIJ')
    const code = generateCode()
    expect(isValidCode(code.toLowerCase().replace(/-/g, ' '))).toBe(true)
    expect(formatCode(normalizeCode(code))).toBe(code)
  })
  it('rejects the wrong length and characters outside the alphabet', () => {
    const good = normalizeCode(generateCode())
    expect(isValidCode(good.slice(0, 23))).toBe(false)
    expect(isValidCode(good + 'A')).toBe(false)
    for (const bad of ['0', 'O', 'I', 'L', '1']) expect(isValidCode(bad + good.slice(1))).toBe(false)
    expect(isValidCode('')).toBe(false)
  })
})

describe('household id', () => {
  it('is 64 hex characters, stable for any formatting, different per code, and never the code itself', async () => {
    const code = generateCode()
    const id = await householdId(code)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
    expect(await householdId(code.toLowerCase().replace(/-/g, ' '))).toBe(id)
    expect(await householdId(generateCode())).not.toBe(id)
    expect(id.toUpperCase()).not.toContain(normalizeCode(code))
  })
})

const M = { updated_at: 1_700_000_000_000_123, deleted: false }

describe('row encryption', () => {
  it('round-trips a row and does not show its contents', async () => {
    const key = await deriveKey(generateCode())
    const payload = await encryptRow(key, 'bills', row, M)
    expect(payload).not.toContain('Rent')
    expect(await decryptRow(key, 'bills', 'r1', payload, M)).toEqual(row)
  })
  it('gives a different ciphertext each time (fresh IV)', async () => {
    const key = await deriveKey(generateCode())
    expect(await encryptRow(key, 'bills', row, M)).not.toBe(await encryptRow(key, 'bills', row, M))
  })
  it('refuses a wrong code, another table, another id, a truncated payload and junk', async () => {
    const key = await deriveKey(generateCode())
    const other = await deriveKey(generateCode())
    const payload = await encryptRow(key, 'bills', row, M)
    await expect(decryptRow(other, 'bills', 'r1', payload, M)).rejects.toThrow()
    await expect(decryptRow(key, 'routines', 'r1', payload, M)).rejects.toThrow()
    await expect(decryptRow(key, 'bills', 'r2', payload, M)).rejects.toThrow()
    await expect(decryptRow(key, 'bills', 'r1', payload.slice(0, payload.length - 8), M)).rejects.toThrow()
    await expect(decryptRow(key, 'bills', 'r1', 'not base64 !!', M)).rejects.toThrow()
  })
  it('refuses a row whose change time or deleted flag was altered on the server', async () => {
    const key = await deriveKey(generateCode())
    const payload = await encryptRow(key, 'bills', row, M)
    await expect(decryptRow(key, 'bills', 'r1', payload, { ...M, updated_at: M.updated_at + 1 })).rejects.toThrow()
    await expect(decryptRow(key, 'bills', 'r1', payload, { ...M, deleted: true })).rejects.toThrow()
  })
  it('gives the same key for the same code however it was typed', async () => {
    const code = generateCode()
    const a = await deriveKey(code)
    const b = await deriveKey(code.toLowerCase().replace(/-/g, ''))
    expect(await decryptRow(b, 'bills', 'r1', await encryptRow(a, 'bills', row, M), M)).toEqual(row)
  })
})
