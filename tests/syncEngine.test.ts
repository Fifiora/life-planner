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
    expect(await decryptRow(key, 'bills', 'b1', sent.payload as string, { updated_at: sent.updated_at, deleted: false })).toEqual({ id: 'b1', name: 'Rent', amount: 1700 })
  })

  it('does not mark a row that was saved without any change', async () => {
    const { engine, local } = await phone(generateCode(), new FakeBackend())
    local.put('bills', row('b1'))
    await engine.syncNow()
    local.put('bills', row('b1'))
    expect(engine.status.pending).toBe(0)
  })

  it('pushes an edit and a delete (the delete is encrypted too)', async () => {
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
    expect(backend.pushes[2][0]).toMatchObject({ tbl: 'bills', id: 'b1', deleted: true, payload: expect.any(String) })
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
    a.local.tables = { routine_logs: Array.from({ length: 1500 }, (_, i) => row(`l${i}`)) }
    a.engine.markAllDirty()
    await a.engine.syncNow()
    const result = await b.engine.syncNow()
    expect(result.pulled).toBe(1500)
    expect(b.local.rows('routine_logs')).toHaveLength(1500)
    expect(backend.pulls.filter((p) => p === 0).length).toBeGreaterThanOrEqual(1)
    expect(backend.pulls.length).toBeGreaterThanOrEqual(3) // two for B, one for A's first sync
  })

  it('skips a row it cannot open, counts it, and still applies the rest', async () => {
    const { backend, a, b } = await pair()
    a.local.put('bills', row('good'))
    await a.engine.syncNow()
    const wrong = await deriveKey(generateCode())
    backend.rows.set(`${HOUSEHOLD}|bills|bad`, { tbl: 'bills', id: 'bad', payload: await encryptRow(wrong, 'bills', row('bad'), { updated_at: 10, deleted: false }), deleted: false, updated_at: 10, seq: ++backend.seq })
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

  it('refuses to replace anything when the shared copy is empty (a mistyped code), and changes nothing', async () => {
    const { b } = await pair()
    b.local.put('routines', row('own'))
    await expect(b.engine.replaceFromRemote()).rejects.toThrow(/No shared planner found/)
    expect(b.local.rows('routines')).toHaveLength(1)
    expect(b.local.applied).toEqual([])
    expect(b.engine.status.pending).toBe(1)
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

describe('SyncEngine: edits while a sync is working', () => {
  it('keeps an edit made while it is working out what the other phone sent', async () => {
    const { backend, a, b } = await pair()
    a.local.put('bills', row('x'))
    await a.engine.syncNow()
    const before = backend.pulls.length
    b.local.afterGetAll = () => {
      if (backend.pulls.length > before) {
        b.local.afterGetAll = null
        queueMicrotask(() => b.local.put('bills', row('mine')))
      }
    }
    await b.engine.syncNow()
    expect(b.local.rows('bills').map((r) => r.id).sort()).toEqual(['mine', 'x'])
    await b.engine.syncNow()
    await a.engine.syncNow()
    expect(a.local.rows('bills').map((r) => r.id).sort()).toEqual(['mine', 'x'])
  })

  it('does not write anything after it was stopped, even if a sync was in flight', async () => {
    const { backend, a, b } = await pair()
    a.local.put('bills', row('x'))
    await a.engine.syncNow()
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const realPull = backend.pull.bind(backend)
    backend.pull = async (h: string, after: number) => {
      await gate
      return realPull(h, after)
    }
    const inflight = b.engine.syncNow()
    await new Promise((r) => setTimeout(r, 5))
    b.engine.stop()
    b.kv.m.clear()
    release()
    await inflight
    expect(b.kv.m.size).toBe(0)
    expect(b.local.rows('bills')).toEqual([])
  })
})

describe('SyncEngine: a refused push does not stop everything', () => {
  it('still receives while a push is being refused, and keeps the row waiting', async () => {
    const { backend, a, b } = await pair()
    a.local.put('bills', row('x'))
    await a.engine.syncNow()
    b.local.put('bills', row('y'))
    backend.failNext = serverError('payload too large')
    await b.engine.syncNow()
    expect(b.local.rows('bills').map((r) => r.id).sort()).toEqual(['x', 'y'])
    expect(b.engine.status).toMatchObject({ state: 'error', message: 'payload too large', pending: 1 })
  })

  it('leaves out a row that is too large to sync, says so, and sends the rest', async () => {
    const { backend, a } = await pair()
    a.local.put('bills', row('big', { blob: 'x'.repeat(40_000) }))
    a.local.put('bills', row('ok'))
    await a.engine.syncNow()
    expect(backend.rows.size).toBe(1)
    expect(a.engine.status).toMatchObject({ state: 'idle', pending: 0 })
    expect(a.engine.status.message).toMatch(/1 item is too large to sync/)
  })

  it('leaves out a row with an unusable id', async () => {
    const { backend, a } = await pair()
    a.local.put('bills', { id: 'z'.repeat(100), name: 'long id' })
    a.local.put('bills', row('ok'))
    await a.engine.syncNow()
    expect(backend.rows.size).toBe(1)
    expect(a.engine.status.pending).toBe(0)
  })
})

describe('SyncEngine: what the server holds cannot be trusted blindly', () => {
  async function forge(backend: FakeBackend, code: string, over: { tbl?: string; id?: string; updated_at?: number; deleted?: boolean; payloadDeleted?: boolean; payloadUpdated?: number }) {
    const key = await deriveKey(code)
    const id = over.id ?? 'forged'
    const tbl = over.tbl ?? 'bills'
    const updated_at = over.updated_at ?? 10
    const payload = await encryptRow(key, tbl, row(id), { updated_at: over.payloadUpdated ?? updated_at, deleted: over.payloadDeleted ?? over.deleted ?? false })
    backend.rows.set(`${HOUSEHOLD}|${tbl}|${id}`, { tbl, id, payload, deleted: over.deleted ?? false, updated_at, seq: ++backend.seq })
  }

  it('rejects a row whose deleted flag or time was changed after it was encrypted', async () => {
    const { code, backend, b } = await pair()
    await forge(backend, code, { id: 'f1', deleted: true, payloadDeleted: false })
    await forge(backend, code, { id: 'f2', updated_at: 20, payloadUpdated: 10 })
    const result = await b.engine.syncNow()
    expect(result.rejected).toBe(2)
    expect(b.local.rows('bills')).toEqual([])
  })

  it('rejects a change time absurdly far ahead, which would win every later edit', async () => {
    const { code, backend, b } = await pair({ bNow: () => 1000 })
    await forge(backend, code, { id: 'far', updated_at: 9_000_000_000_000_000 })
    const result = await b.engine.syncNow()
    expect(result.rejected).toBe(1)
    expect(b.local.rows('bills')).toEqual([])
  })

  it('ignores a table the app does not have', async () => {
    const { code, backend, b } = await pair()
    await forge(backend, code, { tbl: 'zzz' })
    const result = await b.engine.syncNow()
    expect(result.rejected).toBe(1)
    expect(b.local.tables.zzz).toBeUndefined()
  })
})

describe('SyncEngine: changes made while it was not listening', () => {
  it('notices new, edited and removed rows at the next sync', async () => {
    const backend = new FakeBackend()
    const { engine, local } = await phone(generateCode(), backend)
    local.put('bills', row('a'))
    local.put('bills', row('b'))
    await engine.syncNow()
    backend.pushes.length = 0
    local.silentPut('bills', row('a', { edited: true }))
    local.silentPut('bills', row('c'))
    local.silentRemove('bills', 'b')
    const result = await engine.syncNow()
    expect(result.pushed).toBe(3)
    const sent = new Map(backend.pushes.flat().map((r) => [r.id, r.deleted]))
    expect(sent).toEqual(new Map([['a', false], ['b', true], ['c', false]]))
  })

  it('sends rows that came before the engine had any notes about them', async () => {
    const backend = new FakeBackend()
    const { engine, local } = await phone(generateCode(), backend)
    local.silentPut('bills', row('old'))
    expect(engine.status.pending).toBe(0)
    const result = await engine.syncNow()
    expect(result.pushed).toBe(1)
  })

  it('does not re-send what it just received', async () => {
    const { backend, a, b } = await pair()
    a.local.put('bills', row('x'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    const n = backend.pushes.length
    expect((await b.engine.syncNow()).pushed).toBe(0)
    expect(backend.pushes.length).toBe(n)
  })
})

describe('SyncEngine: its own notes cannot be saved', () => {
  it('says so instead of failing quietly', async () => {
    const { engine, local, kv } = await phone(generateCode(), new FakeBackend())
    kv.failSet = true
    local.put('bills', row('b1'))
    expect(engine.status).toMatchObject({ state: 'error' })
    expect(engine.status.message).toMatch(/storage/i)
  })
})

describe('SyncEngine: joining with a planner that cannot be read', () => {
  async function badRow(backend: FakeBackend, id = 'bad') {
    const wrong = await deriveKey(generateCode())
    backend.rows.set(`${HOUSEHOLD}|bills|${id}`, { tbl: 'bills', id, payload: await encryptRow(wrong, 'bills', row(id), { updated_at: 10, deleted: false }), deleted: false, updated_at: 10, seq: ++backend.seq })
  }

  it('refuses when no row can be read with this code, and changes nothing', async () => {
    const { backend, b } = await pair()
    await badRow(backend)
    b.local.put('routines', row('own'))
    await expect(b.engine.replaceFromRemote()).rejects.toThrow(/could not be read/)
    expect(b.local.rows('routines')).toHaveLength(1)
    expect(b.local.applied).toEqual([])
  })

  it('refuses when only some rows cannot be read', async () => {
    const { backend, a, b } = await pair()
    a.local.put('bills', row('good'))
    await a.engine.syncNow()
    await badRow(backend)
    b.local.put('routines', row('own'))
    await expect(b.engine.replaceFromRemote()).rejects.toThrow(/could not be read/)
    expect(b.local.rows('routines')).toHaveLength(1)
  })
})

describe('SyncEngine: unreadable rows are reported', () => {
  it('says how many changes from the other phone could not be read', async () => {
    const { backend, a, b } = await pair()
    a.local.put('bills', row('good'))
    await a.engine.syncNow()
    const wrong = await deriveKey(generateCode())
    backend.rows.set(`${HOUSEHOLD}|bills|bad`, { tbl: 'bills', id: 'bad', payload: await encryptRow(wrong, 'bills', row('bad'), { updated_at: 10, deleted: false }), deleted: false, updated_at: 10, seq: ++backend.seq })
    await b.engine.syncNow()
    expect(b.engine.status.state).toBe('idle')
    expect(b.engine.status.message).toMatch(/1 change from the other phone could not be read/)
    expect(b.local.rows('bills').map((r) => r.id)).toEqual(['good'])
  })
})

describe('SyncEngine: two local rows with the same id', () => {
  it('settles on the last one and stops re-sending it', async () => {
    const { backend, a, b } = await pair()
    a.local.tables = { bills: [{ id: 'd', name: 'first' }, { id: 'd', name: 'second' }] }
    a.engine.markAllDirty()
    expect((await a.engine.syncNow()).pushed).toBe(1)
    await b.engine.syncNow()
    expect(b.local.rows('bills')).toEqual([{ id: 'd', name: 'second' }])
    const pushes = backend.pushes.length
    for (let i = 0; i < 3; i++) {
      expect((await a.engine.syncNow()).pushed).toBe(0)
      expect((await b.engine.syncNow()).pushed).toBe(0)
    }
    expect(backend.pushes.length).toBe(pushes)
  })
})

describe('SyncEngine: quiet syncs', () => {
  it('writes no notes when nothing changed', async () => {
    const { a, b } = await pair()
    a.local.put('bills', row('x'))
    await a.engine.syncNow()
    await b.engine.syncNow()
    const before = a.kv.sets + b.kv.sets
    await a.engine.syncNow()
    await b.engine.syncNow()
    expect(a.kv.sets + b.kv.sets).toBe(before)
  })
})

describe('SyncEngine: big pushes', () => {
  it('keeps each push well under the server limit', async () => {
    const { backend, a } = await pair()
    a.local.tables = { routine_logs: Array.from({ length: 60 }, (_, i) => row(`big${i}`, { blob: 'q'.repeat(20_000) })) }
    a.engine.markAllDirty()
    await a.engine.syncNow()
    expect(backend.rows.size).toBe(60)
    expect(backend.pushes.length).toBeGreaterThan(1)
    for (const p of backend.pushes) expect(p.reduce((n, r) => n + (r.payload?.length ?? 0), 0)).toBeLessThanOrEqual(950_000)
  })
})

describe('SyncEngine: joining with a check before anything is replaced', () => {
  it('hands the pulled tables to the check, and replaces only if the check allows it', async () => {
    const code = generateCode()
    const backend = new FakeBackend()
    const a = await phone(code, backend)
    a.local.put('bills', row('b1', { amount: 1 }))
    await a.engine.syncNow()
    const seen: string[] = []
    const b = await phone(code, backend)
    b.local.silentPut('routines', row('own'))
    await b.engine.replaceFromRemote({ beforeApply: async (tables) => void seen.push(...tables.bills.map((r) => r.id)) })
    expect(seen).toEqual(['b1'])
    expect(b.local.rows('bills')).toHaveLength(1)
    expect(b.local.rows('routines')).toEqual([])
  })
  it('leaves the phone untouched when the check refuses', async () => {
    const code = generateCode()
    const backend = new FakeBackend()
    const a = await phone(code, backend)
    a.local.put('bills', row('b1'))
    await a.engine.syncNow()
    const b = await phone(code, backend)
    b.local.silentPut('routines', row('own'))
    await expect(b.engine.replaceFromRemote({ beforeApply: async () => { throw new Error('No') } })).rejects.toThrow('No')
    expect(b.local.rows('routines')).toHaveLength(1)
    expect(b.local.rows('bills')).toEqual([])
  })
})
