import { describe, it, expect } from 'vitest'
import { SyncEngine } from '../src/lib/syncEngine'
import { decryptRow, deriveKey, encryptRow, generateCode } from '../src/lib/syncCrypto'
import { TABLES } from '../src/lib/tables'
import type { Row } from '../src/types'
import { FakeBackend, MemoryKV, MemoryLocal, offline, serverError } from './syncHelpers'

const HOUSEHOLD = 'a'.repeat(64)
const row = (id: string, extra: Record<string, unknown> = {}): Row => ({ id, name: `Item ${id}`, ...extra })

async function phone(code: string, backend: FakeBackend, opts: { kv?: MemoryKV; local?: MemoryLocal; now?: () => number; device?: number } = {}) {
  const key = await deriveKey(code)
  const kv = opts.kv ?? new MemoryKV()
  const local = opts.local ?? new MemoryLocal()
  const engine = new SyncEngine({ household: HOUSEHOLD, key, local, transport: backend, kv, now: opts.now, device: opts.device ?? 7 })
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
    kv.set('lp.sync.clock', '5000000') // this phone has already seen a change stamped 5,000,000
    const backend = new FakeBackend()
    const { engine, local } = await phone(generateCode(), backend, { kv, now: () => 1000 })
    local.put('bills', row('b1'))
    await engine.syncNow()
    expect(backend.pushes[0][0].updated_at).toBeGreaterThan(5_000_000)
  })

  it('records the time of the last good sync', async () => {
    const { engine, local } = await phone(generateCode(), new FakeBackend(), { now: () => 12345 })
    expect(engine.status.lastSyncedAt).toBeNull()
    local.put('bills', row('b1'))
    await engine.syncNow()
    expect(engine.status.lastSyncedAt).toBe(12345)
  })
})

async function pair(opts: { aNow?: () => number; bNow?: () => number } = {}) {
  const code = generateCode()
  const backend = new FakeBackend()
  const a = await phone(code, backend, { now: opts.aNow, device: 1 })
  const b = await phone(code, backend, { now: opts.bNow, device: 2 })
  return { code, backend, a, b }
}

describe('SyncEngine: receiving and merging', () => {
  it('shows a row added on one phone on the other', async () => {
    const { a, b } = await pair()
    a.local.put('bills', row('b1', { amount: 1700 }))
    await a.engine.syncNow()
    const result = await b.engine.syncNow()
    expect(result.pulled).toBe(1)
    expect(b.local.rows('bills')).toEqual([{ id: 'b1', name: 'Item b1', amount: 1700 }])
  })

  it('keeps edits to different rows made on both phones', async () => {
    const { a, b } = await pair()
    a.local.put('bills', row('b1'))
    a.local.put('bills', row('b2'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    a.local.put('bills', row('b1', { amount: 1 }))
    b.local.put('bills', row('b2', { amount: 2 }))
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.engine.syncNow()
    for (const p of [a, b]) expect(p.local.rows('bills').map((r) => [r.id, r.amount])).toEqual([['b1', 1], ['b2', 2]])
  })

  it('lets the later edit of the same row win on both phones, whichever syncs first', async () => {
    for (const order of ['ab', 'ba']) {
      const { a, b } = await pair({ aNow: () => 2000, bNow: () => 3000 })
      a.local.put('bills', row('b1'))
      await a.engine.syncNow()
      await b.engine.syncNow()
      a.local.put('bills', row('b1', { who: 'A' }))
      b.local.put('bills', row('b1', { who: 'B' }))
      const [first, second] = order === 'ab' ? [a, b] : [b, a]
      await first.engine.syncNow()
      await second.engine.syncNow()
      await first.engine.syncNow()
      expect(a.local.rows('bills')[0].who).toBe('B')
      expect(b.local.rows('bills')[0].who).toBe('B')
    }
  })

  it('removes a row on both phones when the delete is later than an offline edit, and never brings it back', async () => {
    const t = { a: 1000, b: 1000 }
    const { a, b } = await pair({ aNow: () => t.a, bNow: () => t.b })
    a.local.put('bills', row('b1'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    t.b = 4000
    b.local.put('bills', row('b1', { edited: true })) // offline, made at 4000
    t.a = 9000
    a.local.remove('bills', 'b1') // made later, at 9000
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.engine.syncNow()
    expect(a.local.rows('bills')).toEqual([])
    expect(b.local.rows('bills')).toEqual([])
    expect(b.engine.status.pending).toBe(0)
  })

  it('lets an edit that is later than a delete bring the row back', async () => {
    const t = { a: 1000, b: 1000 }
    const { a, b } = await pair({ aNow: () => t.a, bNow: () => t.b })
    a.local.put('bills', row('b1'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    t.a = 3000
    a.local.remove('bills', 'b1') // made at 3000
    t.b = 9000
    b.local.put('bills', row('b1', { edited: true })) // made later, at 9000
    await a.engine.syncNow()
    await b.engine.syncNow()
    await a.engine.syncNow()
    expect(a.local.rows('bills')[0]).toMatchObject({ id: 'b1', edited: true })
    expect(b.local.rows('bills')[0]).toMatchObject({ id: 'b1', edited: true })
  })

  it('does nothing on repeated syncs and never sends back what it just received', async () => {
    const { backend, a, b } = await pair()
    a.local.put('bills', row('b1'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    const pushes = backend.pushes.length
    const applied = b.local.applied.length
    for (let i = 0; i < 3; i++) {
      await a.engine.syncNow()
      await b.engine.syncNow()
    }
    expect(backend.pushes.length).toBe(pushes)
    expect(b.local.applied.length).toBe(applied)
    expect(b.engine.status.pending).toBe(0)
  })

  it('keeps pulling when a call returns a full page of 1000', async () => {
    const { backend, a, b } = await pair()
    a.local.tables = { logs: Array.from({ length: 1500 }, (_, i) => row(`l${i}`)) }
    a.engine.markAllDirty()
    await a.engine.syncNow()
    const result = await b.engine.syncNow()
    expect(result.pulled).toBe(1500)
    expect(b.local.rows('logs')).toHaveLength(1500)
    expect(backend.pulls.filter((p) => p === 0).length).toBeGreaterThanOrEqual(1)
    expect(backend.pulls.length).toBeGreaterThanOrEqual(3) // two for B, one for A's first sync
  })

  it('skips a row it cannot open, counts it, and still applies the rest', async () => {
    const { backend, a, b } = await pair()
    a.local.put('bills', row('good'))
    await a.engine.syncNow()
    const wrong = await deriveKey(generateCode())
    backend.rows.set(`${HOUSEHOLD}|bills|bad`, { tbl: 'bills', id: 'bad', payload: await encryptRow(wrong, 'bills', row('bad')), deleted: false, updated_at: 10, seq: ++backend.seq })
    const result = await b.engine.syncNow()
    expect(result.rejected).toBe(1)
    expect(b.local.rows('bills').map((r) => r.id)).toEqual(['good'])
    expect(b.engine.status.state).toBe('idle')
  })

  it('does not move on when the phone cannot save, and retries the same rows later', async () => {
    const { b, a } = await pair()
    a.local.put('bills', row('b1'))
    await a.engine.syncNow()
    b.local.applyError = new Error('storage full')
    await b.engine.syncNow()
    expect(b.engine.status).toMatchObject({ state: 'error', message: 'storage full' })
    expect(b.local.rows('bills')).toEqual([])
    expect(b.kv.get('lp.sync.cursor') ?? '0').toBe('0')
    b.local.applyError = null
    await b.engine.syncNow()
    expect(b.local.rows('bills')).toHaveLength(1)
    expect(b.engine.status.state).toBe('idle')
  })

  it('raises its clock to changes it has seen, so a later local edit beats them', async () => {
    const { backend, a, b } = await pair({ aNow: () => 50_000, bNow: () => 1000 })
    a.local.put('bills', row('b1'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    b.local.put('bills', row('b1', { edited: true }))
    await b.engine.syncNow()
    await a.engine.syncNow()
    expect(a.local.rows('bills')[0].edited).toBe(true)
    expect(backend.pushes.at(-1)![0].updated_at).toBeGreaterThan(50_000_000)
  })
})

describe('SyncEngine: joining a shared planner', () => {
  it('makes this phone match the shared copy, dropping what it held, and leaves nothing waiting', async () => {
    const { a, b } = await pair()
    a.local.put('bills', row('b1'))
    a.local.put('places', row('p1'))
    await a.engine.syncNow()
    b.local.put('routines', row('own')) // something entered on the new phone before joining
    const { pulled } = await b.engine.replaceFromRemote()
    expect(pulled).toBe(2)
    expect(b.local.rows('bills').map((r) => r.id)).toEqual(['b1'])
    expect(b.local.rows('routines')).toEqual([])
    for (const t of TABLES) expect(Array.isArray(b.local.tables[t])).toBe(true)
    expect(b.engine.status.pending).toBe(0)
    const sent = (await b.engine.syncNow()).pushed
    expect(sent).toBe(0)
  })

  it('works against an empty shared copy', async () => {
    const { b } = await pair()
    b.local.put('routines', row('own'))
    const { pulled } = await b.engine.replaceFromRemote()
    expect(pulled).toBe(0)
    expect(b.local.rows('routines')).toEqual([])
  })

  it('removes a row that was deleted in the shared copy', async () => {
    const { a, b } = await pair()
    a.local.put('bills', row('b1'))
    await a.engine.syncNow()
    a.local.remove('bills', 'b1')
    await a.engine.syncNow()
    await b.engine.replaceFromRemote()
    expect(b.local.rows('bills')).toEqual([])
  })
})
