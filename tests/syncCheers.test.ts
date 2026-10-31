import { describe, it, expect } from 'vitest'
import { SyncEngine } from '../src/lib/syncEngine'
import { deriveKey, generateCode } from '../src/lib/syncCrypto'
import { TABLES } from '../src/lib/tables'
import { FakeBackend, MemoryKV, MemoryLocal } from './syncHelpers'

describe('cheers sync between phones', () => {
  it('is one of the lists the app saves', () => {
    expect(TABLES).toContain('cheers')
  })
  it('a cheer sent on one phone reaches the other', async () => {
    const key = await deriveKey(generateCode())
    const backend = new FakeBackend()
    const phone = (device: number) => {
      const local = new MemoryLocal()
      const engine = new SyncEngine({ household: 'a'.repeat(64), key, local, transport: backend, kv: new MemoryKV(), device })
      engine.start()
      return { local, engine }
    }
    const a = phone(1)
    const b = phone(2)
    a.local.put('cheers', { id: 'c1', from_member: 'a', to_member: 'b', date: '2026-11-04' })
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(b.local.rows('cheers')).toEqual([{ id: 'c1', from_member: 'a', to_member: 'b', date: '2026-11-04' }])
  })
})
