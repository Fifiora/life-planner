// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { decryptPreload, encryptPreload, isPreloadFile } from '../src/lib/preload'

const plain = JSON.stringify({ v: 1, createdAt: '2026-11-01T00:00:00.000Z', tables: { bills: [{ id: '1', name: 'Café ☕', amount: 5 }] } })

describe('preload encryption', () => {
  it('round-trips with the right passphrase, including accents and emoji', async () => {
    const file = await encryptPreload(plain, 'ABCD-EFGH-JKMN-PQRS')
    expect(isPreloadFile(file)).toBe(true)
    expect(await decryptPreload(file, 'ABCD-EFGH-JKMN-PQRS')).toBe(plain)
  })

  it('does not contain the plain text anywhere in the file', async () => {
    const text = JSON.stringify(await encryptPreload(plain, 'ABCD-EFGH-JKMN-PQRS'))
    expect(text).not.toContain('Café')
    expect(text).not.toContain('bills')
    expect(text).not.toContain('amount')
  })

  it('gives different scrambled output every time', async () => {
    const a = await encryptPreload(plain, 'ABCD-EFGH')
    const b = await encryptPreload(plain, 'ABCD-EFGH')
    expect(a.data).not.toBe(b.data)
    expect(a.salt).not.toBe(b.salt)
  })

  it('accepts the passphrase typed in lower case or with spaces', async () => {
    const file = await encryptPreload(plain, 'ABCD-EFGH-JKMN-PQRS')
    expect(await decryptPreload(file, ' abcd efgh jkmn pqrs ')).toBe(plain)
  })

  it('refuses a wrong passphrase', async () => {
    const file = await encryptPreload(plain, 'ABCD-EFGH')
    await expect(decryptPreload(file, 'WRONG-WRONG')).rejects.toThrow(/passphrase/i)
  })

  it('refuses a file that was altered', async () => {
    const file = await encryptPreload(plain, 'ABCD-EFGH')
    const flipped = file.data.startsWith('A') ? `B${file.data.slice(1)}` : `A${file.data.slice(1)}`
    await expect(decryptPreload({ ...file, data: flipped }, 'ABCD-EFGH')).rejects.toThrow(/passphrase|damaged/i)
  })

  it('refuses a file in a format it does not know', async () => {
    await expect(decryptPreload({ v: 2 } as never, 'x')).rejects.toThrow(/format/i)
    expect(isPreloadFile({ v: 1 })).toBe(false)
    expect(isPreloadFile(null)).toBe(false)
    expect(isPreloadFile('text')).toBe(false)
  })
})
