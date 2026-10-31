import { describe, it, expect } from 'vitest'
import { SyncEngine } from '../src/lib/syncEngine'
import { decryptRow, deriveKey, generateCode } from '../src/lib/syncCrypto'
import type { Row } from '../src/types'
import { FakeBackend, MemoryKV, MemoryLocal, offline, serverError } from './syncHelpers'

const HOUSEHOLD = 'a'.repeat(64)
const row = (id: string, extra: Record<string, unknown> = {}): Row => ({ id, name: `Item ${id}`, ...extra })

async function phone(code: string, backend: FakeBackend, opts: { kv?: MemoryKV; local?: MemoryLocal; now?: () => number } = {}) {
  const key = await deriveKey(code)
  const kv = opts.kv ?? new MemoryKV()
  const local = opts.local ?? new MemoryLocal()
  const engine = new SyncEngine({ household: HOUSEHOLD, key, local, transport: backend, kv, now: opts.now })
  engine.start()
  return { engine, kv, local, key }
}

describe('SyncEngine: tracking and pushing local changes', () => {
  it('pushes an added row encrypted, and clears it from pending', async () => {
    const code = generateCode()
    const backend = new FakeBackend()
    const { engine, local, key } = await phone(code, backend)
    local.put('bills', row('b1', { name: 'Rent', amount: 1700 }))
    expect(engine.status.pending).toBe(1)
    const result = await engine.syncNow()
    expect(result.pushed).toBe(1)
    expect(engine.status.pending).toBe(0)
    const sent = backend.pushes[0][0]
    expect(sent).toMatchObject({ tbl: 'bills', id: 'b1', deleted: false })
    expect(sent.payload).not.toContain('Rent')
    expect(await decryptRow(key, 'bills', 'b1', sent.payload as string)).toEqual({ id: 'b1', name: 'Rent', amount: 1700 })
  })

  it('does not mark a row that was saved without any change', async () => {
    const { engine, local } = await phone(generateCode(), new FakeBackend())
    local.put('bills', row('b1'))
    await engine.syncNow()
    local.put('bills', row('b1'))
    expect(engine.status.pending).toBe(0)
  })

  it('pushes an edit and a delete (a tombstone with no payload)', async () => {
    const backend = new FakeBackend()
    const { engine, local } = await phone(generateCode(), backend)
    local.put('bills', row('b1'))
    await engine.syncNow()
    local.put('bills', row('b1', { amount: 5 }))
    await engine.syncNow()
    expect(backend.pushes[1][0].deleted).toBe(false)
    local.remove('bills', 'b1')
    expect(engine.status.pending).toBe(1)
    await engine.syncNow()
    expect(backend.pushes[2][0]).toMatchObject({ tbl: 'bills', id: 'b1', deleted: true, payload: null })
  })

  it('stamps later changes with a later time', async () => {
    const backend = new FakeBackend()
    const { engine, local } = await phone(generateCode(), backend, { now: () => 1000 })
    local.put('bills', row('b1'))
    local.put('bills', row('b2'))
    await engine.syncNow()
    const [a, b] = backend.pushes[0]
    expect(b.updated_at).toBeGreaterThan(a.updated_at)
  })

  it('uploads everything it holds after markAllDirty', async () => {
    const backend = new FakeBackend()
    const { engine, local } = await phone(generateCode(), backend)
    local.tables = { bills: [row('b1'), row('b2')], places: [row('p1')] }
    engine.markAllDirty()
    expect(engine.status.pending).toBe(3)
    await engine.syncNow()
    expect(backend.rows.size).toBe(3)
  })

  it('sends at most 200 rows per call', async () => {
    const backend = new FakeBackend()
    const { engine, local } = await phone(generateCode(), backend)
    local.tables = { logs: Array.from({ length: 450 }, (_, i) => row(`l${i}`)) }
    engine.markAllDirty()
    await engine.syncNow()
    expect(backend.pushes.map((p) => p.length)).toEqual([200, 200, 50])
  })

  it('keeps rows waiting when offline, never throws, and sends them after a restart', async () => {
    const code = generateCode()
    const backend = new FakeBackend()
    const first = await phone(code, backend)
    first.local.put('bills', row('b1'))
    backend.failNext = offline()
    await expect(first.engine.syncNow()).resolves.toBeDefined()
    expect(first.engine.status).toMatchObject({ state: 'offline', pending: 1 })
    first.engine.stop()
    // the app was closed and reopened: new engine, same saved state
    const second = await phone(code, backend, { kv: first.kv, local: first.local })
    expect(second.engine.status.pending).toBe(1)
    await second.engine.syncNow()
    expect(second.engine.status).toMatchObject({ state: 'idle', pending: 0 })
    expect(backend.rows.size).toBe(1)
  })

  it('reports a server problem with its message', async () => {
    const backend = new FakeBackend()
    const { engine, local } = await phone(generateCode(), backend)
    local.put('bills', row('b1'))
    backend.failNext = serverError('bad household')
    await engine.syncNow()
    expect(engine.status).toMatchObject({ state: 'error', message: 'bad household', pending: 1 })
  })

  it('keeps a slow clock from losing: new edits are later than anything already seen', async () => {
    const kv = new MemoryKV()
    kv.set('lp.sync.clock', '5000') // this phone has already seen a change stamped 5000
    const backend = new FakeBackend()
    const { engine, local } = await phone(generateCode(), backend, { kv, now: () => 1000 })
    local.put('bills', row('b1'))
    await engine.syncNow()
    expect(backend.pushes[0][0].updated_at).toBeGreaterThan(5000)
  })

  it('records the time of the last good sync', async () => {
    const { engine, local } = await phone(generateCode(), new FakeBackend(), { now: () => 12345 })
    expect(engine.status.lastSyncedAt).toBeNull()
    local.put('bills', row('b1'))
    await engine.syncNow()
    expect(engine.status.lastSyncedAt).toBe(12345)
  })
})
